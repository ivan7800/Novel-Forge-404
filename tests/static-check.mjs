import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fail = message => { console.error(`ERROR: ${message}`); process.exitCode = 1; };
const required = ['index.html','styles.css','app.js','sw.js','manifest.webmanifest','assets/icon-192.png','assets/icon-512.png'];
for (const file of required) if (!fs.existsSync(path.join(root,file))) fail(`Falta ${file}`);
const html = read('index.html');
const js = read('app.js');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const duplicates = ids.filter((id,i)=>ids.indexOf(id)!==i);
if (duplicates.length) fail(`IDs duplicados: ${[...new Set(duplicates)].join(', ')}`);
for (const id of [...js.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1])) {
  if (!ids.includes(id)) fail(`app.js referencia #${id}, que no existe`);
}
const actions = [...new Set([...html.matchAll(/data-action="([^"]+)"/g)].map(m=>m[1]))];
for (const action of actions) {
  if (!js.includes(`'${action}':`)) fail(`Acción sin manejador: ${action}`);
}
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const ref = match[1].split('?')[0];
  if (/^(?:https?:|data:|#|mailto:|tel:)/.test(ref)) continue;
  if (!fs.existsSync(path.join(root,ref))) fail(`Recurso inexistente: ${ref}`);
}
const manifest = JSON.parse(read('manifest.webmanifest'));
if (manifest.start_url !== './' || manifest.scope !== './') fail('Manifest no preparado para subruta de GitHub Pages');
if (/\b(?:sk-|ghp_|AIza|BEGIN PRIVATE KEY)\b/.test([html,js,read('README.md')].join('\n'))) fail('Posible secreto detectado');
if (!html.includes('app.js?v=1.4.0')) fail('index.html no carga la versión estable de app.js');
if (!read('sw.js').includes('novel-forge-404-v1.4.0')) fail('Caché del service worker no actualizada');
if (!process.exitCode) console.log(`OK: ${required.length} archivos esenciales, ${ids.length} IDs, ${actions.length} acciones y rutas locales verificadas.`);
