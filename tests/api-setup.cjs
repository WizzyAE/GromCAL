const assert = require('node:assert/strict');
const {startServer, launchBrowser} = require('./browser.cjs');

const TEST_KEY = 'test-only-user-owned-key-123456';
function seed() {
  if (localStorage.getItem('gromcel.v1')) return;
  localStorage.setItem('gromcel.v1', JSON.stringify({profile:{name:'Test',sex:'m',age:28,height:178,weight:85,startWeight:85,goalWeight:78,activity:1.2,pace:.5,createdAt:'2026-01-01',lifestyleSet:true},days:{},weights:{},settings:{notify:false}}));
}
(async()=>{
 const server=await startServer(); let browser;
 try {
  browser=await launchBrowser();
  for (const provider of ['openai','gemini']) {
   const page=await browser.newPage({viewport:{width:360,height:800}});const calls=[];const errors=[];let status=401;
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(seed);
   await page.route(/https:\/\/(?:api\.openai\.com|generativelanguage\.googleapis\.com)\//,async route=>{
    const req=route.request();calls.push({url:req.url(),headers:req.headers(),method:req.method()});
    if(status!==200) return route.fulfill({status,contentType:'application/json',body:JSON.stringify({error:{message:'do not display raw credentials'}})});
    const expected=provider==='openai'?'api.openai.com':'generativelanguage.googleapis.com';assert(req.url().includes(expected));
    assert.equal(provider==='openai'?req.headers().authorization:req.headers()['x-goog-api-key'],provider==='openai'?'Bearer '+TEST_KEY:TEST_KEY);
    assert(!req.url().includes(TEST_KEY));
    let json;
    if(req.method()==='GET') json=provider==='openai'?{data:[{id:'gpt-4.1-mini'}]}:{models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']}]};
    else {
     const body=req.postDataJSON();const prompt=JSON.stringify(body);
     const result=prompt.includes('ok')&&!prompt.includes('Opis današnjeg treninga')?{ok:true}:{verdict:'super',score:90,slogan:'Dobar trening',message:'Analiza radi.',exercises:[{name:'Čučanj',emoji:'🏋️',type:'gym',min:30,kcal:100,sets:4,reps:8,weight:60}]};
     json=provider==='openai'?{choices:[{message:{content:JSON.stringify(result)}}]}:{candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]};
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(json)});
   });
   await page.goto(server.url);await page.getByRole('heading',{name:'Poveži svoj AI'}).waitFor();
   assert.equal(calls.length,0,'No credentials, no automatic AI request');
   await page.getByLabel('AI servis',{exact:true}).selectOption(provider);
   await page.getByLabel('Vlastiti API ključ',{exact:true}).fill(TEST_KEY);
   await page.getByRole('button',{name:'Provjeri i poveži'}).click();
   await page.getByRole('alert').filter({hasText:'Ključ nije prihvaćen'}).waitFor();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gromcel.v1')).settings.apiSetupVersion),undefined);
   status=429;await page.getByRole('button',{name:'Provjeri i poveži'}).click();
   await page.getByRole('alert').filter({hasText:'limit ili nema dostupne kvote'}).waitFor();
   status=200;await page.getByRole('button',{name:'Provjeri i poveži'}).click();
   await page.locator('.app').waitFor();
   let settings=await page.evaluate(()=>JSON.parse(localStorage.getItem('gromcel.v1')).settings);
   assert.equal(settings.aiProvider,provider);assert.equal(settings[provider==='openai'?'openaiKey':'apiKey'],TEST_KEY);
   assert.equal(settings[provider==='openai'?'apiKey':'openaiKey'],'');
   await page.reload(); await page.locator('.app').waitFor();
   assert.equal(await page.locator('.grom-api-gate').count(),0,'A remembered key survives reload');
   // Use the actual training action, not a direct call to the test helper.
   await page.locator('.tab').nth(1).click();await page.locator('textarea').fill('Čučanj 4x8 60 kg, 30 minuta');
   await page.getByRole('button',{name:'Analiziraj trening',exact:true}).click();
   await page.getByRole('button',{name:'Spremi trening',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gromcel.v1')).trainingDraft.r.exercises[0].name),'Čučanj');
   // A profile save must not overwrite a key managed by the new API form.
   await page.locator('.tab').nth(4).click();await page.getByRole('button',{name:'Spremi',exact:true}).click();
   settings=await page.evaluate(()=>JSON.parse(localStorage.getItem('gromcel.v1')).settings);
   assert.equal(settings[provider==='openai'?'openaiKey':'apiKey'],TEST_KEY);
   assert.deepEqual(errors,[]);
   assert(calls.every(c=>c.url.includes(provider==='openai'?'api.openai.com':'generativelanguage.googleapis.com')),'No fallback to another account or service');
   if(provider==='openai') {
    await page.screenshot({path:'artifacts/api-settings.png'});
    await page.getByLabel('Vlastiti API ključ',{exact:true}).fill(TEST_KEY);
    await page.getByLabel('Zapamti ključ na ovom uređaju').uncheck();
    await page.getByRole('button',{name:'Provjeri i poveži'}).click();await page.getByRole('status').filter({hasText:'Veza je provjerena'}).waitFor();
    settings=await page.evaluate(()=>JSON.parse(localStorage.getItem('gromcel.v1')).settings);
    assert.equal(settings.apiKey,'');assert.equal(settings.openaiKey,'');
    // Reload without the initial seed: an in-memory key must be gone.
    await page.goto(server.url+'/index.html');await page.getByRole('heading',{name:'Poveži svoj AI'}).waitFor();
   }
   console.log('PASS API setup, errors, training and key isolation:',provider);await page.close();
  }
 } finally {await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
