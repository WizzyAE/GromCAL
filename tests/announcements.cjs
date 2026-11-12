const assert = require('node:assert/strict');
const {startServer, launchBrowser} = require('./browser.cjs');
(async()=>{
 let browser;
 try {
  browser=await launchBrowser();
  for (const app of ['Gromify','Gromflix']) {
   const server=await startServer(`../${app}/dist`);
   try {
    const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
     localStorage.setItem('gromify-version-seen','1.5.17');
     localStorage.setItem('gromflix.profile',JSON.stringify('test-profile'));
     localStorage.setItem('gromflix.profiles',JSON.stringify([{id:'test-profile',name:'Test',color:'#1f6fff',color2:'#5aa8ff',avatar:'smile'}]));
    });
    await page.route('https://api.github.com/repos/WizzyAE/GromCAL/releases/latest',r=>r.fulfill({status:200,contentType:'application/json',body:'{"tag_name":"v1.2.0"}'}));
    await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks:[],playlists:[],folders:[],liked:[],history:[],sections:[],items:[],mixes:[],seeds:[],genres:[],pairedAt:null})}));
    await page.goto(server.url);
    const dialog=page.getByRole('dialog',{name:'Stigao je GromCAL!'});
    await dialog.waitFor({timeout:20000});
    assert.equal(await dialog.getByRole('link',{name:'Baci oko'}).getAttribute('href'),'https://github.com/WizzyAE/GromCAL');
    const fits=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;});
    assert(fits,'Announcement fits on a phone screen');
    await page.screenshot({path:`artifacts/${app.toLowerCase()}-gromcal-announcement.png`});
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>localStorage.getItem('gromcal-launch-1.2-dismissed')),'1');
    await page.reload();await page.waitForTimeout(2500);assert.equal(await dialog.count(),0);
    assert.deepEqual(errors,[],`${app} runtime errors`);
    console.log(`PASS ${app}: mobile layout, GitHub link, Escape and persistent dismissal`);
    await page.close();
   } finally {await server.close();}
  }
 } finally {await browser?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
