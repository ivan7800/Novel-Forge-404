import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const db=readFileSync(new URL('../src/db.js',import.meta.url),'utf8');
test('destructive actions use a referentially consistent transaction',()=>{
 assert.match(app,/trashManuscriptItem\(isScene\?'scenes':'chapters',item\.id\)/);
 assert.match(db,/transaction\(\['chapters','scenes','links','history','trash','facts'\],'readwrite'\)/);
 assert.match(db,/history\.delete\(x\.id\)/);
 assert.match(db,/links\.delete\(x\.id\)/);
});
test('reordering uses single readwrite transaction',()=>{
 assert.match(app,/swapPositions\(store,/);
 assert.match(db,/objects\.put\(first\);objects\.put\(second\)/);
});
