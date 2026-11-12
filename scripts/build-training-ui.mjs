import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFile(path.join(root, file), 'utf8');
// The recovered APK contains legacy fallback credentials. Strip them even
// from the preserved base file, so an unused asset cannot leak them on GitHub.
const recovered = await read('dist/assets/index-DwIbDUhG.js');
let original = recovered;
for (const [name, field] of [['Ud', 'openaiKey'], ['Bd', 'apiKey']]) {
  const pattern = new RegExp(`${name}=\\(\\)=>on\\(\\)\\.settings\\.${field}\\|\\|"[^"]*"`);
  original = original.replace(pattern, `${name}=()=>String(on().settings.${field}||"").trim()`);
}
await writeFile(path.join(root, 'dist/assets/index-DwIbDUhG.js'), original);
const replacements = await read('src/training-charts.js');
let bundle = original;
for (const [name, next] of [['Ms', 'const zh='], ['Th', 'function Lh(']]) {
  const start = bundle.indexOf(`function ${name}(`);
  const end = bundle.indexOf(next, start);
  const replacementStart = replacements.indexOf(`function ${name}(`);
  const replacementEnd = replacements.indexOf('\nfunction ', replacementStart + 1);
  if (start < 0 || end < start || replacementStart < 0) throw new Error(`Missing component boundary: ${name}`);
  bundle = bundle.slice(0, start) + replacements.slice(replacementStart, replacementEnd < 0 ? undefined : replacementEnd) + '\n' + bundle.slice(end);
}
const trainingStart = bundle.indexOf('function bh(');
const trainingEnd = bundle.indexOf('const au=', trainingStart);
let training = bundle.slice(trainingStart, trainingEnd);
for (const [before, after] of [
  ['className:"screen"', 'className:"screen training-screen"'],
  ['className:"card",style:{padding:20}', 'className:"card training-summary",style:{padding:20}']
]) {
  if (!training.includes(before)) throw new Error(`Missing training layout: ${before}`);
  training = training.replace(before, after);
}
bundle = bundle.slice(0, trainingStart) + training + bundle.slice(trainingEnd);
const aiStart = bundle.indexOf('async function cn(');
const aiEnd = bundle.indexOf('function ih(', aiStart);
if (aiStart < 0 || aiEnd < aiStart) throw new Error('Missing AI request boundary');
bundle = bundle.slice(0, aiStart) + 'async function cn(e,t,n){return GromRunAi(e,t,n)}' + bundle.slice(aiEnd);
const profileStart = bundle.indexOf('function Oh(');
const profileEnd = bundle.indexOf('const $h=', profileStart);
let profile = bundle.slice(profileStart, profileEnd);
const keysStart = profile.indexOf('l.jsx("div",{className:"h2",children:"AI ključevi"})');
const keysEnd = profile.indexOf('l.jsx("button",{className:"btn",style:{marginTop:14}', keysStart);
if (keysStart < 0 || keysEnd < keysStart) throw new Error('Missing API settings boundary');
profile = profile.slice(0, keysStart) + 'l.jsx(GromApiSettings,{}),' + profile.slice(keysEnd);
const legacySave = ',settings:{...v.settings,apiKey:r.trim(),openaiKey:s.trim()}';
if (!profile.includes(legacySave)) throw new Error('Missing legacy API save');
profile = profile.replace(legacySave, '').replace('GromCAL 1.1', 'GromCAL 1.2');
bundle = bundle.slice(0, profileStart) + profile + bundle.slice(profileEnd);
const mount = 'render(l.jsx(Rh,{}))';
if (!bundle.includes(mount)) throw new Error('Missing root mount');
bundle = bundle.replace(mount, 'render(l.jsx(GromAppRoot,{}))');
bundle = (await read('src/api-setup.js')) + '\n' + bundle;
// Capacitor's web chunks import the JSX bundle's WebPlugin export. Repoint
// both ends so a lazy import cannot execute the old application a second time.
for (const file of ['web-D_8JOBi4.js', 'web-G14FqwBW.js']) {
  const generated = `training-${file}`;
  bundle = bundle.replaceAll(file, generated);
  const chunk = (await read(`dist/assets/${file}`)).replaceAll('./index-DwIbDUhG.js', './training-ui.js');
  await writeFile(path.join(root, 'dist/assets', generated), chunk);
}
await writeFile(path.join(root, 'dist/assets/training-ui.js'), bundle);
await writeFile(path.join(root, 'dist/assets/training-ui.css'), await read('dist/assets/index-C2tsGJ3k.css') + '\n' + await read('src/training-ui.css') + '\n' + await read('src/api-setup.css'));
let html = await read('dist/index.html');
html = html.replace('./assets/index-DwIbDUhG.js', './assets/training-ui.js').replace('./assets/index-C2tsGJ3k.css', './assets/training-ui.css');
await writeFile(path.join(root, 'dist/index.html'), html);
console.log('Built training UI from the preserved original bundle.');
