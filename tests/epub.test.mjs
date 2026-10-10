import assert from 'node:assert/strict';
import {createEpub,zipStored} from '../src/epub.js';
const blob=createEpub('Prueba & relato',[{id:'c1',title:'Primer capítulo',content:'Uno\nDos'}],[{id:'s1',chapterId:'c1',title:'Una escena',content:'Tres',position:1}]);
const b=new Uint8Array(await blob.arrayBuffer());
assert.equal(blob.type,'application/epub+zip');assert.equal(Buffer.from(b.slice(0,4)).toString('hex'),'504b0304');
const text=Buffer.from(b).toString('utf8');
for(const needle of ['mimetype','META-INF/container.xml','EPUB/package.opf','EPUB/nav.xhtml','Primer capítulo','Una escena','Prueba &amp; relato'])assert.ok(text.includes(needle),needle);
assert.ok(zipStored([['a','b']]).size>0);
console.log('EPUB: estructura y contenido mínimo verificados');
