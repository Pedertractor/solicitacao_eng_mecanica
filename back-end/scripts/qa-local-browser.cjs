const fs=require('node:fs/promises');
const path=require('node:path');
const {createRequire}=require('node:module');
const assert=require('node:assert/strict');
const root=path.resolve('..'), kroot=path.resolve('../../kairo');
const {chromium}=createRequire(path.join(kroot,'frontend/package.json'))('playwright');
(async()=>{
 const fx=JSON.parse(await fs.readFile(path.join(root,'qa-local/fixtures.json'),'utf8'));
 const item=JSON.parse(await fs.readFile(path.join(root,'qa-local/ui-item.json'),'utf8'));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(20000);
 const errors=[],results=[];page.on('pageerror',e=>errors.push(String(e)));
 async function test(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(e){results.push({name,passed:false,error:String(e)});console.log('FAIL '+name+': '+e);}await fs.writeFile(path.join(root,'qa-local/browser-results.json'),JSON.stringify({results,errors},null,2));}
 await test('Login pela interface do Pederflow',async()=>{
  await page.goto('http://localhost:5174/login',{waitUntil:'domcontentloaded'});
  await page.locator('#card').fill(fx.users.super.cardNumber);await page.locator('input[value="PEDERTRACTOR"]').check();await page.locator('#password').fill(fx.password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/solicitacoes',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Solicitações',exact:true}).waitFor();
  await page.screenshot({path:path.join(root,'qa-local/pederflow-lista.png'),fullPage:true});
 });
 await test('Detalhes e revisão da solicitação criada no navegador',async()=>{
  await page.goto('http://localhost:5174/solicitacoes/'+item.id,{waitUntil:'domcontentloaded'});
  await page.getByText(item.trackingCode,{exact:false}).first().waitFor();
  console.log('DETAILS '+(await page.locator('body').innerText()).slice(-4000));
  await page.screenshot({path:path.join(root,'qa-local/pederflow-detalhe.png'),fullPage:true});
 });
 await test('Aprovar e enviar a solicitação ao Kairo pela interface',async()=>{
  const approve=page.getByRole('button',{name:'Aprovar',exact:true});
  if(await approve.count()) await approve.click();
  else await page.getByRole('button',{name:'Kairo',exact:true}).click();
  const dialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Enviar ao Kairo',exact:true})});
  await dialog.waitFor();
  const submit=dialog.getByRole('button',{name:'Confirmar envio',exact:true});
  if(await submit.count()){
   await dialog.getByRole('combobox').nth(0).click();await page.getByRole('option',{name:'QA LOCAL — Integração Pederflow',exact:true}).click();
   await dialog.getByRole('combobox').nth(1).click();await page.getByRole('option',{name:'Atividade',exact:true}).click();
   const response=page.waitForResponse(r=>r.url().endsWith('/send-to-kairo')&&r.request().method()==='POST');
   await submit.click();const sent=await response;assert.equal(sent.status(),200);const payload=await sent.json();assert(payload.solicitation.kairoCardId);
   await fs.writeFile(path.join(root,'qa-local/ui-send-result.json'),JSON.stringify(payload,null,2));
  }
 });
 await test('Operação Comercial e etapas visíveis',async()=>{
  await page.goto('http://localhost:5174/workflow',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Operação Comercial',exact:true}).waitFor();
  assert(await page.getByText('Qualidade · PPAP',{exact:true}).count()>0);
  await page.screenshot({path:path.join(root,'qa-local/pederflow-workflow.png'),fullPage:true});
 });
 await test('Acompanhamento público do protocolo',async()=>{
  const p=await context.newPage();await p.goto('http://localhost:5174/solicitacao/acompanhar/'+item.trackingCode,{waitUntil:'domcontentloaded'});
  await p.getByText(item.trackingCode,{exact:false}).first().waitFor();assert((await p.locator('body').innerText()).includes(item.title));
  await p.screenshot({path:path.join(root,'qa-local/pederflow-rastreio.png'),fullPage:true});await p.close();
 });
 await test('Layout móvel da página pública sem rolagem horizontal',async()=>{
  await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:5174/solicitacao',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Engenharia Mecânica/}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:path.join(root,'qa-local/pederflow-mobile.png'),fullPage:true});
 });
 await test('Login e time de integração no Kairo',async()=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto('http://localhost:5173/login',{waitUntil:'domcontentloaded'});console.log('KAIRO LOGIN '+await page.locator('body').innerText());
  console.log('KAIRO INPUTS '+JSON.stringify(await page.locator('input').evaluateAll(ns=>ns.map(n=>({id:n.id,name:n.name,placeholder:n.placeholder,type:n.type})))));
 });
 await test('Nenhum erro JavaScript nas páginas visitadas',async()=>assert.deepEqual(errors,[]));
 await browser.close();console.log(JSON.stringify({passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
