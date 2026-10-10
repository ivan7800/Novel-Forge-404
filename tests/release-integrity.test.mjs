import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const db=readFileSync(new URL('../src/db.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('backup uses one readonly transaction for every active store',()=>{
 assert.match(db,/function exportSnapshotAtomic\(\)/);
 assert.match(db,/db\.transaction\(STORES,'readonly'\)/);
 assert.match(app,/await exportSnapshotAtomic\(\)/);
});
test('trash preserves and restores associated narrative facts',()=>{
 assert.match(db,/facts:values\.facts\.filter\(f=>sceneIds\.has\(f\.sceneId\)\)/);
 assert.match(db,/for\(const fact of \(item\.facts\|\|\[\]\)\)tx\.objectStore\('facts'\)\.put\(fact\)/);
 assert.match(db,/\['projects','chapters','scenes','links','history','trash','facts'\]/);
});
test('trash backup limitation is explicitly visible to the user',()=>{
 assert.match(html,/la papelera no se incluye en las copias JSON/i);
});
