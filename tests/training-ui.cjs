const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {existsSync} = require('node:fs');

function seed({count, draft}) {
  const today = new Date();
  const day = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const date = day(today);
  const exercises = Array.from({length: count}, (_, i) => ({
    id: 'ex' + i, name: i === 2 ? 'Vježba'.repeat(30) : 'Jednoručno veslanje na spravi s dodatnim opterećenjem ' + i,
    emoji: '🏋️', min: 30, kcal: i === 0 ? 12000 : 80, sets: 10, reps: 15, weight: 100, type: 'strength'
  }));
  const analysis = {exercises: {grade: 'super'}, time: {grade: 'good'}, load: {grade: 'grom'}};
  const result = {verdict: 'grom', score: 280, slogan: 'Dobar trening', message: 'Provjera dugog treninga.', analysis, exercises};
  const days = {};
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    days[day(d)] = {foods: [], water: 0, workouts: count ? [{
      id: 'w' + i, name: 'Dugi trening s puno različitih vježbi', icon: '🏋️',
      min: 1200, kcal: i === 0 ? 120000 : i === 1 ? 1 : 400, volume: 100000,
      exercises: i === 0 ? exercises : []
    }] : []};
  }
  localStorage.setItem('gromcel.v1', JSON.stringify({
    profile: {name: 'Test', sex: 'm', age: 28, height: 178, weight: 85, startWeight: 85, goalWeight: 78, activity: 1.2, pace: .5, createdAt: '2025-01-01', lifestyleSet: true},
    days, weights: {[date]: 85}, settings: {apiKey: '', openaiKey: 'test-only-api-key-for-ui-tests', aiProvider: 'openai', apiSetupVersion: 1, aiModel: 'gpt-4.1-mini', notify: false},
    trainingDraft: draft ? {day: date, text: `${count} vježbi`, min: '1200', r: result} : null
  }));
}

(async () => {
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer(async (req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) {res.writeHead(403).end(); return;}
    try {
      const body = await fs.readFile(file);
      const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2'};
      res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'}).end(body);
    } catch {res.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const installed = [process.env.GROMCAL_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
  let browser;
  try {
    browser = await chromium.launch({headless: true, ...(installed ? {executablePath: installed} : {})});
    const cases = [
      ...[320, 360, 390, 430, 768].map(width => ({width, count: 40, draft: true})),
      {width: 320, count: 40, draft: false}, {width: 390, count: 40, draft: false},
      {width: 320, count: 1, draft: true}, {width: 320, count: 0, draft: false},
      {width: 320, count: 300, draft: true}
    ];
    for (const scenario of cases) {
      const page = await browser.newPage({viewport: {width: scenario.width, height: 740}});
      const errors = [], scripts = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => {if (r.resourceType() === 'script') scripts.push(r.url());});
      await page.addInitScript(seed, scenario);
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.locator('.tab').nth(1).click();
      await page.locator('.training-screen').waitFor();
      await page.waitForTimeout(1100);
      const bounds = await page.locator('.screen').evaluate(root => {
        const frame = root.getBoundingClientRect();
        return {width: root.clientWidth, scroll: root.scrollWidth, overflow: [...root.querySelectorAll('*')].filter(el => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && (b.left < frame.left - 1 || b.right > frame.right + 1);
        }).map(el => el.tagName + '.' + (el.className.baseVal ?? el.className))};
      });
      assert.equal(bounds.scroll, bounds.width, JSON.stringify({scenario, bounds}));
      assert.deepEqual(bounds.overflow, [], JSON.stringify(scenario));
      const geometry = await page.locator('svg[viewBox="0 0 340 130"]').evaluate(svg => [...svg.querySelectorAll('rect')].every(r => {
        const y = +r.getAttribute('y'), h = +r.getAttribute('height');
        return Number.isFinite(y) && Number.isFinite(h) && y >= 16 - .001 && h >= 0 && y + h <= 108.001;
      }));
      assert(geometry, 'Bars must stay above the labels');
      assert(!scripts.some(url => /\/index-DwIbDUhG\.js$/.test(url)), 'Lazy chunks must not mount the old app');
      if (scenario.draft && scenario.count > 1) {
        const rows = page.locator('.training-exercise-row');
        assert.equal(await rows.count(), scenario.count);
        const last = rows.last(); await last.scrollIntoViewIfNeeded();
        assert(await last.isVisible(), 'Every exercise remains reachable');
        assert(await page.locator('.training-exercise-chart').evaluate(el => el.scrollHeight > el.clientHeight));
        assert.equal(await rows.first().locator('.num').innerText(), '12.000');
      }
      if (scenario.width === 390 && scenario.draft) {
        await fs.mkdir(path.resolve(__dirname, '../artifacts'), {recursive: true});
        const chart = page.locator('.training-consumption');
        await page.locator('.training-exercise-chart').evaluate(el => {el.scrollTop = 0;});
        await chart.scrollIntoViewIfNeeded();
        await page.screenshot({path: path.resolve(__dirname, '../artifacts/training-fixed.png')});
        const before = await page.evaluate(() => {
          const s = JSON.parse(localStorage.getItem('gromcel.v1'));
          return {days: Object.keys(s.days).length, exercises: s.trainingDraft.r.exercises.length};
        });
        await page.getByRole('button', {name: 'Spremi trening', exact: true}).click();
        await page.locator('.training-consumption').waitFor({state: 'detached'});
        const saved = await page.evaluate(() => {
          const s = JSON.parse(localStorage.getItem('gromcel.v1'));
          return {days: Object.keys(s.days).length, draft: s.trainingDraft, lastCount: Object.values(s.days)[0].workouts.at(-1).exercises.length};
        });
        assert.equal(saved.days, before.days); assert.equal(saved.lastCount, before.exercises); assert.equal(saved.draft, null);
        await page.locator('.tab').nth(3).click();
        await page.waitForTimeout(100);
        assert.equal(await page.locator('.screen').count(), 1);
      }
      assert.deepEqual(errors, [], 'Browser runtime errors');
      console.log(`PASS ${scenario.width}px, ${scenario.count} exercises, ${scenario.draft ? 'draft' : 'saved'}`);
      await page.close();
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => {console.error(e); process.exitCode = 1;});
