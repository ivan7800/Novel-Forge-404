import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const db=fs.readFileSync(new URL('../src/db.js',import.meta.url),'utf8');
test('los nuevos controles existen y están vinculados',()=>{
 for(const id of ['globalSearchBtn','globalQuery','globalCount','globalResults','globalBack','trashBtn','trashList','trashCount','trashBack']){
  assert.ok(html.includes(`id="${id}"`),id+' falta en HTML');assert.ok(app.includes(`$('${id}')`),id+' falta en JS');
 }
});
test('papelera migra esquema y mueve/restaura registros en una transacción',()=>{
 assert.match(db,/SCHEMA_VERSION=[5-9]/);assert.match(db,/'trash'/);assert.match(db,/export async function trashManuscriptItem/);assert.match(db,/export async function restoreTrash/);
});
