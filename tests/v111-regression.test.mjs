import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('el arranque no pisa el estado de un borrador recuperado',()=>{
 const source=read('../src/app.js');
 assert.match(source,/if\(!state\.dirty&&!state\.conflict\)status\('Base de datos lista'\)/);
});
test('el borrado de fichas y sus vínculos comparte una transacción',()=>{
 const db=read('../src/db.js');const lore=read('../src/lore.js');
 assert.match(db,/export async function deleteLoreEntity/);
 assert.match(db,/db\.transaction\(\[store,'links'\],'readwrite'\)/);
 assert.match(lore,/await deleteLoreEntity\(active,item\.id\)/);
});
test('búsqueda global descarta resultados asíncronos obsoletos',()=>{
 const source=read('../src/app.js');
 assert.match(source,/generation!==globalSearchGeneration/);
 assert.match(source,/globalSearchGeneration\+\+/);
});
