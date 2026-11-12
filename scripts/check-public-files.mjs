import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=[];
async function walk(relative) {
  for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})) {
    if(relative==='integrations' && entry.name==='staged') continue;
    const file=path.join(relative,entry.name);
    if(entry.isDirectory()) await walk(file);
    else if(entry.isFile()) files.push(file);
    else throw new Error(`Unexpected symlink or special file: ${file}`);
  }
}
for(const folder of ['src','scripts','tests','dist','integrations']) await walk(folder);
for(const file of ['package.json','package-lock.json','README.md','.gitignore','capacitor.config.json','Start-GromCAL.ps1']) files.push(file);
const keyPattern=/\b(?:sk-|AIza|AQ\.)[A-Za-z0-9_.-]{30,}/;
const failures=[];
for(const file of files) if(keyPattern.test(await readFile(path.join(root,file),'utf8'))) failures.push(file);
if(failures.length) throw new Error(`Potential credentials in public files: ${failures.join(', ')}. Values withheld.`);
console.log(`PASS public-file audit: ${files.length} files, no embedded API key patterns. Private backups and native decompilation are excluded.`);
