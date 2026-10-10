import assert from 'node:assert/strict';
import {analyzeNovel,auditMarkdown} from '../src/audit.js';
const snapshot={projects:[{id:'p',title:'Prueba'}],chapters:[{id:'c',projectId:'p',title:'Inicio',content:'Hola mundo',position:1}],scenes:[{id:'s1',projectId:'p',chapterId:'c',title:'Escena vacía',content:'',position:1,storyOrder:1},{id:'s2',projectId:'p',chapterId:'c',title:'Escena dos',content:'cuento '.repeat(45),position:2,storyOrder:1}],characters:[{id:'x',projectId:'p',name:'Bruna'}],plotlines:[{id:'t',projectId:'p',title:'Misterio',status:'abierta'}],links:[]};
const a=analyzeNovel(snapshot,'p');assert.equal(a.stats.words,47);assert.equal(a.stats.scenes,2);assert.ok(a.findings.some(f=>f.code==='EMPTY_TEXT'));assert.ok(a.findings.some(f=>f.code==='PLOT_OPEN'));assert.ok(a.findings.some(f=>f.code==='CHARACTER_NO_SCENE'));assert.ok(a.findings.some(f=>f.code==='SHARED_CHRONOLOGY'));assert.ok(a.findings.some(f=>f.code==='FREQUENT_WORD'));assert.ok(auditMarkdown(a).includes('Misterio'));
const b=analyzeNovel({...snapshot,links:[{sourceType:'scene',sourceId:'s2',targetType:'character',targetId:'x',projectId:'p'}]},'p');assert.ok(!b.findings.some(f=>f.code==='CHARACTER_NO_SCENE'));
assert.throws(()=>analyzeNovel(snapshot,'bad'),/Novela no encontrada/);
assert.equal(analyzeNovel({projects:[{id:'p',title:'Nueva'}],chapters:[],scenes:[],characters:[],plotlines:[],links:[]},'p').findings[0].code,'NO_CHAPTERS');
console.log('OK: 9 verificaciones del motor de auditoría');
