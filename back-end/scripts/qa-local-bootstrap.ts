import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaClient as KairoPrisma } from '../../../kairo/backend/src/generated/client.js';

const root = resolve(process.cwd(), '..');
const kroot = resolve(root, '../kairo/backend');
const senv = parse(readFileSync(resolve(root, 'back-end/.env')));
const kenv = parse(readFileSync(resolve(kroot, '.env')));
for (const [label, value] of [['solicitacao', senv.DATABASE_URL], ['kairo', kenv.DATABASE_URL]]) {
  if (!['localhost', '127.0.0.1'].includes(new URL(value).hostname)) throw Error(`${label}: banco não local`);
}
const s = new PrismaClient({ adapter: new PrismaPg({ connectionString: senv.DATABASE_URL }) });
const k = new KairoPrisma({ adapter: new PrismaPg({ connectionString: kenv.DATABASE_URL }) });
const out = resolve(root, 'qa-local'); mkdirSync(out, { recursive: true });
const password = 'QaLocal!2026';
const secret = senv.KAIRO_WEBHOOK_SECRET || randomBytes(32).toString('hex');
const roles = [['super','SUPER_ADMIN',null], ['eng','ADMIN','ENG_MECANICA'], ['process','ADMIN','DESENVOLVIMENTO_PROCESSOS'], ['tool','ADMIN','FERRAMENTARIA'], ['quality','ADMIN','QUALIDADE'], ['sample','ADMIN','AMOSTRA'], ['pcp','ADMIN','PCP'], ['commercial','ADMIN','COMERCIAL'], ['user','USER','ENG_MECANICA']] as const;
const users: Record<string, any> = {};
for (const [name, role, department] of roles) {
 const cardNumber = `QA_LOCAL_${name}`;
 users[name] = await s.user.upsert({ where: { employeeId: cardNumber }, create: { employeeId: cardNumber, cardNumber, name: `QA Local ${name}`, role, department, unit: 'PEDERTRACTOR', passwordHash: await bcrypt.hash(password, 10), mustChangePassword: false }, update: { role, department } });
}
const ku = await k.user.upsert({ where: { employeeId: 'QA_LOCAL_KAIRO' }, create: { employeeId:'QA_LOCAL_KAIRO', cardNumber:'QA_LOCAL_KAIRO', name:'QA Local Integração', unit:'PEDERTRACTOR', role:'ADMIN', firstLogin:false, passwordHash:await bcrypt.hash(password, 10) }, update:{} });
let team = await k.team.findFirst({ where: { name: 'QA LOCAL — Integração Pederflow' } });
if (!team) team = await k.team.create({ data: { name:'QA LOCAL — Integração Pederflow', createdById:ku.id, members: {create:{userId:ku.id, role:'ADMIN'}} } });
let tag = await k.tag.findFirst({ where: {teamId:team.id, name:'QA LOCAL'} });
if (!tag) tag = await k.tag.create({data:{ teamId:team.id, name:'QA LOCAL', color:'#2563eb'}});
const settingsBackup = { smtp: { CORREIO: senv.CORREIO, PORT_CORREIO:senv.PORT_CORREIO } };
if (!existsSync(resolve(out, '.env-restore.json'))) writeFileSync(resolve(out, '.env-restore.json'), JSON.stringify(settingsBackup));
function updateEnv(path: string, updates: Record<string,string>) {
 let content=readFileSync(path,'utf8');
 for (const [key,value] of Object.entries(updates)) {
  const re = new RegExp(`^${key}=.*$`,'m');
  content = re.test(content) ? content.replace(re, `${key}=${value}`) : `${content.trimEnd()}\n${key}=${value}\n`;
 }
 writeFileSync(path,content);
}
updateEnv(resolve(root,'back-end/.env'), { CORREIO:'127.0.0.1', PORT_CORREIO:'1025', KAIRO_WEBHOOK_SECRET:secret });
updateEnv(resolve(kroot,'.env'), { SOLICITATION_WEBHOOK_URL:'http://localhost:3142/api/webhooks/kairo', SOLICITATION_WEBHOOK_SECRET:secret });
// Select valid local source records without publishing personal data in the report.
const requests = await s.solicitation.findMany({ take:8, select:{cardNumber:true,unit:true,costCenter:true} });
const headers={ nameapplication:senv.APPNAME, key:senv.APPKEY };
const sectors = await fetch(`${senv.API_PEDERTRACTOR_URL}/sector/list`,{headers}).then(async r=>({status:r.status, body:await r.json()})).catch(e=>({error:String(e)}));
const employee = requests.length ? await fetch(`${senv.API_PEDERTRACTOR_URL}/employee/get/${requests[0].cardNumber}/${requests[0].unit}`, {headers}).then(async r=>({status:r.status,body:await r.json()})).catch(e=>({error:String(e)})) : null;
if ('body' in sectors && Array.isArray(sectors.body)) {
 const sector=sectors.body.find((item:any)=>item.status && item.costCenter);
 const candidates=await s.user.findMany({where:{employeeId:{not:{startsWith:'QA_LOCAL'}}},select:{cardNumber:true,unit:true}});
 for(const candidate of candidates){
  const response=await fetch(`${senv.API_PEDERTRACTOR_URL}/employee/get/${candidate.cardNumber}/${candidate.unit}`,{headers,signal:AbortSignal.timeout(10000)});
  const data=await response.json();
  if(response.ok && data.status && sector){requests.unshift({...candidate,costCenter:sector.costCenter});break;}
 }
}
writeFileSync(resolve(out,'fixtures.json'),JSON.stringify({password,users:Object.fromEntries(Object.entries(users).map(([n,u])=>[n,{id:u.id,cardNumber:u.cardNumber,unit:u.unit}])),kairoUser:{id:ku.id,cardNumber:ku.cardNumber},teamId:team.id,tagId:tag.id,requests,sectors,employee},null,2));
console.log(JSON.stringify({ users:roles.length, teamId:team.id, sourceApi:senv.API_PEDERTRACTOR_URL, sectorStatus:'status' in sectors?sectors.status:'failed', employeeStatus:employee && 'status' in employee?employee.status:'failed' }));
await s.$disconnect(); await k.$disconnect();
