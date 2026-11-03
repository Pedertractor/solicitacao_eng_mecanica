const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=path.resolve('..'),kroot=path.resolve('../../kairo');
const {chromium}=createRequire(path.join(kroot,'frontend/package.json'))('playwright');
const S='http://localhost:3142/api',K='http://localhost:3000/api';
(async()=>{
 const fx=JSON.parse(await fs.readFile(path.join(root,'qa-local/fixtures.json'),'utf8'));
 const results=[],errors=[];let browser;
 async function request(base,p,method='GET',body,token){const r=await fetch(base+p,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert(r.ok,`${p}: ${JSON.stringify(data)}`);return data;}
 async function test(name,fn){const start=Date.now();try{const detail=await fn();results.push({name,passed:true,ms:Date.now()-start,...detail});console.log('PASS '+name+' '+JSON.stringify(detail||{}));}catch(e){results.push({name,passed:false,error:String(e)});console.log('FAIL '+name+': '+String(e));if(browser)for(const c of browser.contexts())for(const p of c.pages()){console.log('DEBUG PAGE '+p.url());console.log((await p.locator('body').innerText({timeout:2000}).catch(String)).slice(0,2000));}}await fs.writeFile(path.join(root,'qa-local/render-final-results.json'),JSON.stringify({results,errors},null,2));}
 try{
 for(const base of [S,K]) for(let attempt=0;attempt<60;attempt++){
  try{await fetch(base,{signal:AbortSignal.timeout(1000)});break;}catch(e){if(attempt===59)throw e;await new Promise(r=>setTimeout(r,500));}
 }
 const auth=await request(S,'/users/login','POST',{...fx.users.tool,password:fx.password});
 const ka=await request(K,'/auth/login','POST',{cardNumber:fx.kairoUser.cardNumber,unit:'PEDERTRACTOR',password:fx.password});
 const s=(p,method='GET',body)=>request(S,p,method,body,auth.token);
 const k=(p,method='GET',body)=>request(K,p,method,body,ka.dados.token);
 const ak=(await k('/api-keys','POST',{name:'QA LOCAL Render'})).dados.apiKey;
 await s('/me/kairo','PUT',{apiKey:ak.key});
 const item=(await request(S,'/solicitations','POST',{...fx.requests[0],pillarOrLocation:'QA_LOCAL_RENDER',requesterEmail:'qa-local@example.invalid',department:'FERRAMENTARIA',processInstructionRequester:'Comercial',processInstructionType:'Simulação Comercial',executionUnit:'PEDERTRACTOR',client:'PEDERTRACTOR',comments:'QA_LOCAL_RENDER — atualização de tela'})).solicitation;
 const sent=(await s(`/solicitations/${item.id}/workflow/tooling/send-to-kairo`,'POST',{teamId:fx.teamId,title:'QA_LOCAL_RENDER — atividade ao vivo'})).solicitation;
 const cardId=sent.workflow.stages[0].kairoCardIds;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),sp=await ctx.newPage(),kp=await ctx.newPage();
 for(const p of [sp,kp]){p.setDefaultTimeout(12000);p.setDefaultNavigationTimeout(20000);p.on('pageerror',e=>errors.push(String(e)));}
 await test('Login real nas duas interfaces',async()=>{
  await sp.bringToFront();await sp.goto('http://localhost:5174/login',{waitUntil:'domcontentloaded'});await sp.locator('#card').fill(fx.users.tool.cardNumber);await sp.locator('input[value="PEDERTRACTOR"]').check();await sp.locator('#password').fill(fx.password);await sp.getByRole('button',{name:'Entrar',exact:true}).click();await sp.waitForURL(u=>!u.pathname.includes('/login'),{waitUntil:'domcontentloaded'});
  await kp.bringToFront();await kp.goto('http://localhost:5173/login',{waitUntil:'domcontentloaded'});await kp.locator('#cardNumber').fill(fx.kairoUser.cardNumber);await kp.locator('#password').fill(fx.password);await kp.getByRole('button',{name:'Entrar',exact:true}).click();await kp.waitForURL('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await sp.bringToFront();await sp.goto('http://localhost:5174/solicitacoes/'+item.id,{waitUntil:'domcontentloaded'});await sp.getByText(item.trackingCode,{exact:false}).first().waitFor();
  await kp.bringToFront();await kp.goto(`http://localhost:5173/equipes/${fx.teamId}/atividades/${cardId}`,{waitUntil:'domcontentloaded'});await kp.getByRole('heading',{name:'QA_LOCAL_RENDER — atividade ao vivo',exact:true}).waitFor();
 });
 await test('Timer iniciado no Kairo atualiza seu badge e a etapa do Pederflow sem recarregar',async()=>{
  const start=Date.now();await kp.getByRole('button',{name:'Iniciar timer',exact:true}).first().click();await kp.getByRole('button',{name:'Em andamento',exact:true}).waitFor();const kairoMs=Date.now()-start;
  await sp.bringToFront();await sp.locator('#workflow').getByText('Em andamento',{exact:true}).waitFor();const pederflowMs=Date.now()-start;
  await sp.screenshot({path:path.join(root,'qa-local/render-pederflow-andamento.png'),fullPage:true});
  return {kairoMs,pederflowMs};
 });
 await test('Recusa no Pederflow pausa o timer e atualiza o Kairo aberto para Cancelado',async()=>{
  await sp.getByRole('button',{name:'Recusar etapa · Ferramentaria',exact:true}).click();await sp.getByLabel('Motivo da recusa').fill('QA LOCAL — teste de renderização e cancelamento com timer ativo');
  const start=Date.now();await sp.getByRole('button',{name:'Confirmar recusa',exact:true}).click();await sp.locator('#workflow').getByText('Recusada',{exact:true}).waitFor();const pederflowMs=Date.now()-start;
  await kp.bringToFront();await kp.getByRole('button',{name:'Cancelado',exact:true}).waitFor();const kairoMs=Date.now()-start;
  const active=(await k('/time-entries/active')).dados.activeTimer;assert.equal(active,null);
  await kp.waitForFunction(()=>document.querySelectorAll('button[aria-label="Pausar timer"]').length===0);
  const timerMs=Date.now()-start;
  await kp.locator('table tbody tr').first().waitFor();
  await kp.screenshot({path:path.join(root,'qa-local/render-kairo-cancelado.png'),fullPage:true});await sp.bringToFront();await sp.screenshot({path:path.join(root,'qa-local/render-pederflow-recusada.png'),fullPage:true});
  return {pederflowMs,kairoMs,timerMs};
 });
 await test('Alteração por outra sessão atualiza o detalhe Kairo em até um ciclo de consulta',async()=>{
  const card=(await k(`/teams/${fx.teamId}/activities`,'POST',{title:'QA_LOCAL_RENDER — outra sessão'})).dados.activity;
  await kp.bringToFront();await kp.goto(`http://localhost:5173/equipes/${fx.teamId}/atividades/${card.id}`,{waitUntil:'domcontentloaded'});await kp.getByRole('button',{name:'A fazer',exact:true}).waitFor();
  const start=Date.now();await k(`/teams/${fx.teamId}/activities/${card.id}`,'PATCH',{status:'PAUSED'});await kp.getByRole('button',{name:'Pausado',exact:true}).waitFor();return {renderMs:Date.now()-start};
 });
 await test('Cancelamento externo de projeto atualiza a tarefa aberta e pausa seu timer',async()=>{
  const project=(await k(`/teams/${fx.teamId}/projects`,'POST',{title:'QA_LOCAL_RENDER — projeto'})).dados.project;
  const task=(await k(`/projects/${project.id}/tasks`,'POST',{title:'QA_LOCAL_RENDER — tarefa'})).dados.task;
  await kp.bringToFront();await kp.goto(`http://localhost:5173/projetos/${project.id}/tarefas/${task.id}`,{waitUntil:'domcontentloaded'});await kp.getByRole('heading',{name:'QA_LOCAL_RENDER — tarefa',exact:true}).waitFor();
  await k(`/projects/${project.id}/tasks/${task.id}/time-entries`,'POST',{});
  const start=Date.now();await request(K,`/integrations/v1/teams/${fx.teamId}/projects/${project.id}/cancel`,'POST',undefined,ak.key);
  await kp.getByText('Pausada',{exact:true}).first().waitFor();
  await kp.waitForFunction(()=>document.querySelectorAll('button[aria-label="Pausar timer"]').length===0);
  assert.equal((await k('/time-entries/active')).dados.activeTimer,null);
  return {renderMs:Date.now()-start};
 });
 await test('Nenhum erro JavaScript durante as transições',async()=>assert.deepEqual(errors,[]));
 }finally{if(browser)await browser.close();}
 console.log(JSON.stringify({passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length}));
})().catch(e=>{console.error(e);process.exitCode=1});
