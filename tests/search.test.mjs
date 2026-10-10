import test from 'node:test';
import assert from 'node:assert/strict';
import {searchManuscript} from '../src/search.js';
const chapters=[{id:'c1',projectId:'p',title:'Prólogo',content:'Bruna regresa en silencio.'},{id:'c2',projectId:'otro',title:'Bruna',content:'No debe aparecer'}];
const scenes=[{id:'s1',projectId:'p',chapterId:'c1',title:'Campo',content:'La campana suena.'}];
test('búsqueda por texto y capítulo con aislamiento entre novelas',()=>{
 const a=searchManuscript(chapters,scenes,'p','bruna');assert.equal(a.length,1);assert.equal(a[0].id,'c1');
 assert.equal(searchManuscript(chapters,scenes,'p','CAMPANA')[0].id,'s1');
 assert.equal(searchManuscript(chapters,scenes,'p','  ').length,0);
 assert.equal(searchManuscript(chapters,scenes,'p','sin coincidencias').length,0);
});
test('búsqueda no modifica los registros originales',()=>{
 const before=JSON.stringify([chapters,scenes]);searchManuscript(chapters,scenes,'p','bruna');assert.equal(JSON.stringify([chapters,scenes]),before);
});
