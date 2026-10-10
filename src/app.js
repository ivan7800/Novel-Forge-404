import {convertNovelForgeProject,readNovelForgeProjects} from './novelforge-bridge.js';
import {analyzeFacts,remapFacts,findingKey} from './intelligence.js';
import {analyzeContinuity} from './continuity.js';
import {extractCandidates,newCandidates} from './extraction.js';
import {proposeWithLocalAI} from './local-ai.js';
import {searchManuscript} from './search.js';
import {createEpub} from './epub.js';
import {findMatches,replaceCurrent,replaceEvery,buildGraph,graphLayout} from './studio.js';
import {openDB,all,put,remove,importSnapshot,putWithHistory,saveIfUnchanged,revisions,deleteManuscriptItem,swapPositions,trashManuscriptItem,restoreTrash,exportSnapshotAtomic} from './db.js';
import {analyzeNovel,auditMarkdown} from './audit.js';
import {initLore,leaveLore,reloadLore,loreOpen,loreSceneLinks} from './lore.js';
import {now,newId,sortPositions,validateSnapshot,renamedSnapshot,wordCount,upgradeSnapshot,remapLore,remapHistory,LORE_STORES} from './model.js';
const $=id=>document.getElementById(id);
const state={projects:[],chapters:[],scenes:[],projectId:null,chapterId:null,sceneId:null,dirty:false,conflict:false};
let writeChain=Promise.resolve(), timer=null, modalType='project';
const savedVersions=new Map();
const entity=()=>state.sceneId?state.scenes.find(s=>s.id===state.sceneId):state.chapters.find(c=>c.id===state.chapterId);
const status=(message,bad=false)=>{const el=$('saveStatus');el.textContent=message;el.style.color=bad?'#ff979e':'#a8b2a3'};
const error=e=>{console.error(e);status('Error de guardado',true);alert('No se pudo completar la operación: '+(e?.message||e)+'. Conserva esta pestaña abierta si hay texto sin guardar.')};
async function refresh(){[state.projects,state.chapters,state.scenes]=await Promise.all([all('projects'),all('chapters'),all('scenes')]);if(!state.projects.some(p=>p.id===state.projectId))state.projectId=state.projects[0]?.id||null;if(!state.chapters.some(c=>c.id===state.chapterId&&c.projectId===state.projectId))state.chapterId=state.chapters.filter(c=>c.projectId===state.projectId).sort(sortPositions)[0]?.id||null;if(!state.scenes.some(s=>s.id===state.sceneId&&s.chapterId===state.chapterId))state.sceneId=null;render();await reloadLore()}
function buttons(id,items,selected,callback){const host=$(id);host.replaceChildren();for(const item of items){const b=document.createElement('button');b.type='button';b.textContent=item.title;b.classList.toggle('active',item.id===selected);b.setAttribute('aria-current',item.id===selected?'true':'false');b.addEventListener('click',()=>changeSelection(()=>callback(item)));host.append(b)}}
// Emergency tab-local draft, independent from IndexedDB: never silently discard unsaved prose.
const draftPrefix='storyverse404:draft:';
function draftKey(store,id){return draftPrefix+store+':'+id}
function saveDraft(){const item=entity();if(!item)return;const store=state.sceneId?'scenes':'chapters';try{sessionStorage.setItem(draftKey(store,item.id),JSON.stringify({title:$('itemTitle').value,content:$('editor').value,storyDate:$('storyDate').value,storyOrder:$('storyOrder').value,at:Date.now()}))}catch(e){console.warn('No se pudo conservar el borrador temporal',e)}}
function clearDraft(store,id){try{sessionStorage.removeItem(draftKey(store,id))}catch{}}
function recoverDraft(store,item){try{const raw=sessionStorage.getItem(draftKey(store,item.id));if(!raw)return;const draft=JSON.parse(raw);if((draft.content??'')===(item.content??'')&&draft.title===item.title){clearDraft(store,item.id);return}if(!confirm('Hay un borrador temporal no guardado de «'+item.title+'». ¿Recuperarlo?'))return;$('itemTitle').value=draft.title;$('editor').value=draft.content;$('storyDate').value=draft.storyDate||'';$('storyOrder').value=draft.storyOrder||'';changed()}catch(e){console.warn('Borrador no recuperable',e)}}
function render(){if(loreOpen()||!$('auditWorkspace').hidden||!$('graphWorkspace').hidden||!$('globalWorkspace').hidden||!$('trashWorkspace').hidden||!$('intelligenceWorkspace').hidden){return}document.body.classList.remove('focus-mode');$('focusBtn').setAttribute('aria-pressed','false');$('focusBtn').textContent='◈ Concentración';const project=state.projects.find(p=>p.id===state.projectId);const chapters=state.chapters.filter(c=>c.projectId===state.projectId).sort(sortPositions);const scenes=state.scenes.filter(s=>s.chapterId===state.chapterId).sort(sortPositions);buttons('projects',state.projects,state.projectId,p=>{state.projectId=p.id;state.chapterId=null;state.sceneId=null;refresh()});buttons('chapters',chapters,state.sceneId?null:state.chapterId,c=>{state.chapterId=c.id;state.sceneId=null;render()});buttons('scenes',scenes,state.sceneId,s=>{state.sceneId=s.id;render()});$('addChapter').disabled=!project;$('addScene').disabled=!state.chapterId;$('empty').hidden=!!project;$('workspace').hidden=!project;const item=entity();if(!project)return;if(!item){$('crumb').textContent=project.title+' / sin capítulos';$('itemTitle').value='';$('itemTitle').disabled=true;$('editor').disabled=true;$('editor').value='';$('itemMeta').textContent='Crea un capítulo para empezar a escribir';$('sceneFields').hidden=true;$('deleteBtn').disabled=true;$('upBtn').disabled=true;$('downBtn').disabled=true;return}const isScene=!!state.sceneId;$('itemTitle').disabled=false;$('editor').disabled=false;$('itemTitle').value=item.title;$('editor').value=item.content||'';savedVersions.set((state.sceneId?'scenes':'chapters')+':'+item.id,structuredClone(item));$('crumb').textContent=project.title+' / '+(isScene?'ESCENA':'CAPÍTULO');$('itemMeta').textContent=isScene?'Escena del capítulo '+(state.chapters.find(c=>c.id===state.chapterId)?.title||''):'Capítulo independiente · escenas vinculadas debajo';$('sceneFields').hidden=!isScene;$('sceneReferences').hidden=!isScene;if(isScene){const sid=state.sceneId;loreSceneLinks(sid).then(refs=>{if(state.sceneId===sid){$('sceneReferences').textContent=refs.length?('Conexiones en Story Bible: '+refs.length+' · Abre las fichas para consultarlas.'):'Sin vínculos narrativos todavía. Abre Story Bible para crear conexiones.'}}).catch(console.error)}$('storyOrder').value=item.storyOrder??'';$('storyDate').value=item.storyDate||'';$('deleteBtn').disabled=false;const siblings=(isScene?scenes:chapters);const position=siblings.findIndex(i=>i.id===item.id);$('upBtn').disabled=position<1;$('downBtn').disabled=position===siblings.length-1;updateWords();updateFindStatus();status('Guardado local');recoverDraft(isScene?'scenes':'chapters',item)}
function updateWords(){const count=wordCount($('editor').value);$('wordCount').textContent=count+' palabras';$('readingTime').textContent=Math.max(1,Math.ceil(count/220))+' min lectura'}
function queueWrite(fn){const result=writeChain.then(fn);writeChain=result.catch(()=>{});return result}
function commitEditor(){
 clearTimeout(timer);
 if(state.conflict)return Promise.reject(new Error('Conflicto entre pestañas: copia tu borrador o recarga esta página para cargar la versión guardada. No se sobrescribirá el manuscrito ajeno.'));
 if(!state.dirty)return writeChain;
 const item=entity();if(!item)return writeChain;
 const store=state.sceneId?'scenes':'chapters', id=item.id;
 const patch={...item,content:$('editor').value,title:$('itemTitle').value.trim()||'Sin título',updatedAt:now(),revision:(item.revision||0)+1};
 if(store==='scenes'){patch.storyOrder=$('storyOrder').value===''?null:Number($('storyOrder').value);patch.storyDate=$('storyDate').value}
 state.dirty=false;status('Guardando…');
 return queueWrite(async()=>{
  try{
   // Resolve the latest DB state inside the queue so overlapping autosaves do not overwrite revisions.
   const expectedRevision=savedVersions.get(store+':'+id)?.revision||0;
   const updated=await saveIfUnchanged(store,patch,expectedRevision);
   Object.assign(item,updated);savedVersions.set(store+':'+id,structuredClone(updated));
   if(state.dirty)saveDraft();else clearDraft(store,id);
   if(state.dirty){clearTimeout(timer);timer=setTimeout(()=>commitEditor().catch(error),100)}
   status(state.dirty?'Cambios pendientes…':'Guardado · '+new Date().toLocaleTimeString('es-ES'));
  }catch(e){state.dirty=true;saveDraft();if(e.code==='STORYVERSE_CONFLICT')state.conflict=true;status(state.conflict?'CONFLICTO ENTRE PESTAÑAS · Borrador preservado':'Error: cambios sin guardar',true);throw e}
 });
}
function changed(){if(!entity())return;saveDraft();state.dirty=true;status(state.conflict?'Conflicto: copia el texto antes de recargar':'Cambios pendientes…',state.conflict);updateWords();updateFindStatus();clearTimeout(timer);if(!state.conflict)timer=setTimeout(()=>commitEditor().catch(error),500)}
async function changeSelection(fn){try{await commitEditor();await writeChain;if(state.dirty)await commitEditor();if(state.dirty)throw Error('El manuscrito no se guardó: no se cambiará de elemento');await leaveLore();$('auditWorkspace').hidden=true;$('graphWorkspace').hidden=true;$('globalWorkspace').hidden=true;$('trashWorkspace').hidden=true;$('intelligenceWorkspace').hidden=true;await fn();if(!loreOpen())render()}catch(e){error(e)}}
function openCreate(type){modalType=type;$('dialogHeading').textContent=type==='project'?'Nueva novela':type==='chapter'?'Nuevo capítulo':'Nueva escena';$('newName').value='';$('dialog').showModal();$('newName').focus()}
$('entityForm').addEventListener('submit',async e=>{
 e.preventDefault();
 
 const title=$('newName').value.trim();if(!title)return;
 const submit=$('entityForm').querySelector('button[value="confirm"]');submit.disabled=true;
 try{
  const type=modalType,projectId=state.projectId,chapterId=state.chapterId;
  await queueWrite(async()=>{
   const ts=now(),id=newId();let item,store;
   if(type==='project'){store='projects';item={id,title,genre:'',language:'es',createdAt:ts,updatedAt:ts,schemaVersion:1}}
   else if(type==='chapter'){if(!projectId)throw Error('Selecciona una novela');store='chapters';item={id,projectId,title,position:Math.max(0,...state.chapters.filter(c=>c.projectId===projectId).map(c=>c.position))+1,content:'',updatedAt:ts,revision:0}}
   else{if(!projectId||!chapterId)throw Error('Selecciona un capítulo');store='scenes';item={id,projectId,chapterId,title,position:Math.max(0,...state.scenes.filter(s=>s.chapterId===chapterId).map(s=>s.position))+1,content:'',storyOrder:null,storyDate:'',updatedAt:ts,revision:0}}
   await put(store,item);
   if(store==='projects'){state.projectId=id;state.chapterId=null;state.sceneId=null}
   else if(store==='chapters'){state.chapterId=id;state.sceneId=null}else state.sceneId=id;
  });
  $('dialog').close();await refresh();
 }catch(err){error(err)}finally{submit.disabled=false}
});
$('cancelCreate').addEventListener('click',()=>$('dialog').close());
$('addProject').onclick=()=>changeSelection(()=>openCreate('project'));
$('emptyCreate').onclick=()=>changeSelection(()=>openCreate('project'));
$('addChapter').onclick=()=>changeSelection(()=>openCreate('chapter'));
$('addScene').onclick=()=>changeSelection(()=>openCreate('scene'));
for(const key of ['itemTitle','editor','storyOrder','storyDate'])$(key).addEventListener('input',changed);
async function reorder(offset){await commitEditor();if(state.dirty)throw Error('Cambios pendientes sin guardar');const item=entity(),isScene=!!state.sceneId;if(!item)return;const store=isScene?'scenes':'chapters';const siblings=(isScene?state.scenes.filter(s=>s.chapterId===state.chapterId):state.chapters.filter(c=>c.projectId===state.projectId)).sort(sortPositions);const i=siblings.findIndex(s=>s.id===item.id),other=siblings[i+offset];if(!other)return;const old=item.position,next=other.position;await queueWrite(()=>swapPositions(store,{...item,position:next},{...other,position:old}));item.position=next;other.position=old;render()}
$('upBtn').onclick=()=>reorder(-1).catch(error);$('downBtn').onclick=()=>reorder(1).catch(error);
$('deleteBtn').onclick=async()=>{try{await commitEditor();if(state.dirty)throw Error('Cambios pendientes sin guardar');const item=entity();if(!item)return;const isScene=!!state.sceneId;const linked=state.scenes.filter(s=>s.chapterId===item.id);if(!confirm(isScene?'¿Mover esta escena a la papelera?':`¿Mover este capítulo y sus ${linked.length} escenas a la papelera? Se podrán restaurar.`))return;await queueWrite(()=>trashManuscriptItem(isScene?'scenes':'chapters',item.id));if(isScene)state.sceneId=null;else{state.chapterId=null;state.sceneId=null}await refresh()}catch(e){error(e)}};
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
const safeName=s=>(s||'storyverse').replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,70);
async function snapshot(){
 await commitEditor();await writeChain;
 if(state.dirty)throw Error('Hay texto sin guardar');
 const data=await exportSnapshotAtomic();
 // Trash stays local until recovery: backups of the live manuscript remain
 // interoperable with older import formats. The user is warned in the UI.
 return {app:'STORYVERSE-404',version:1,exportedAt:now(),...Object.fromEntries(Object.entries(data).filter(([name])=>name!=='trash'))};
}
$('exportBtn').onclick=async()=>{try{download('storyverse-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(await snapshot(),null,2),'application/json')}catch(e){error(e)}};
$('mdBtn').onclick=async()=>{try{await commitEditor();await writeChain;if(state.dirty)throw Error('Hay texto sin guardar');const p=state.projects.find(p=>p.id===state.projectId);if(!p)return alert('Crea primero una novela');const cs=(await all('chapters')).filter(c=>c.projectId===p.id).sort(sortPositions),ss=(await all('scenes')).filter(s=>s.projectId===p.id);const parts=['# '+p.title];for(const c of cs){parts.push('## '+c.title,c.content||'');for(const s of ss.filter(s=>s.chapterId===c.id).sort(sortPositions))parts.push('### '+s.title,s.content||'')}download(safeName(p.title)+'.md',parts.join('\n\n'),'text/markdown;charset=utf-8')}catch(e){error(e)}};
function manuscriptParts(p,chapters,scenes){const out=[{level:1,title:p.title,body:''}];for(const c of chapters){out.push({level:2,title:c.title,body:c.content||''});for(const scene of scenes.filter(s=>s.chapterId===c.id).sort(sortPositions))out.push({level:3,title:scene.title,body:scene.content||''})}return out}
function htmlEscape(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
async function exportBook(format){await commitEditor();await writeChain;if(state.dirty)throw Error('Hay cambios pendientes: exportación cancelada');const p=state.projects.find(p=>p.id===state.projectId);if(!p)throw Error('Selecciona una novela');const chapters=(await all('chapters')).filter(c=>c.projectId===p.id).sort(sortPositions);const scenes=(await all('scenes')).filter(s=>s.projectId===p.id);const sections=manuscriptParts(p,chapters,scenes);if(format==='txt'){download(safeName(p.title)+'.txt',sections.map(x=>x.title+'\n\n'+x.body).join('\n\n---\n\n'),'text/plain;charset=utf-8');return}const doc='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+htmlEscape(p.title)+'</title><style>body{font-family:Georgia,serif;max-width:760px;margin:50px auto;padding:0 24px;line-height:1.8;color:#222}h1,h2,h3{line-height:1.3;break-after:avoid}section{margin-bottom:3rem}p{white-space:pre-wrap}@media print{body{margin:0;max-width:none}section{break-inside:avoid-page}}</style>'+sections.map(x=>'<section><h'+x.level+'>'+htmlEscape(x.title)+'</h'+x.level+'><p>'+htmlEscape(x.body)+'</p></section>').join('')+'</html>';download(safeName(p.title)+'.html',doc,'text/html;charset=utf-8')}
$('epubBtn').addEventListener('click',async()=>{try{await commitEditor();await writeChain;if(state.dirty)throw Error('Hay cambios sin guardar');const project=state.projects.find(p=>p.id===state.projectId);if(!project)throw Error('Selecciona una novela');const chapters=(await all('chapters')).filter(c=>c.projectId===project.id).sort(sortPositions),scenes=(await all('scenes')).filter(s=>s.projectId===project.id);const blob=createEpub(project.title,chapters,scenes);const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=safeName(project.title)+'.epub';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}catch(e){error(e)}});
$('txtBtn').onclick=()=>exportBook('txt').catch(error);$('htmlBtn').onclick=()=>exportBook('html').catch(error);
$('closeHistory').onclick=()=>$('historyDialog').close();
$('historyBtn').onclick=async()=>{try{await commitEditor();await writeChain;if(state.dirty)throw Error('Guarda los cambios antes de abrir el historial');const item=entity();if(!item)return;const type=state.sceneId?'scenes':'chapters';const rev=await revisions(type,item.id);const select=$('revisionSelect');select.replaceChildren();for(const r of rev){const option=document.createElement('option');option.value=r.id;option.textContent=new Date(r.createdAt).toLocaleString('es-ES')+' · revisión '+r.revision+' · '+wordCount(r.content)+' palabras';select.append(option)}$('historyEmpty').hidden=rev.length>0;$('revisionSelect').hidden=rev.length===0;$('restoreRevision').disabled=!rev.length;$('historyDialog').showModal();$('restoreRevision').onclick=async()=>{try{const selected=rev.find(r=>r.id===select.value);if(!selected)return;if(!confirm('¿Restaurar esta versión? La versión actual quedará registrada en el historial.'))return;const patch={...item,title:selected.title,content:selected.content,updatedAt:now()};const restored=await queueWrite(()=>saveIfUnchanged(type,patch,savedVersions.get(type+':'+item.id)?.revision||0));Object.assign(item,restored);savedVersions.set(type+':'+item.id,structuredClone(restored));$('historyDialog').close();render();status('Versión recuperada')}catch(e){error(e)}}}catch(e){error(e)}};
$('importFromForge').addEventListener('click',async()=>{
 try{
  await commitEditor();await writeChain;if(state.dirty||state.conflict)throw Error('Primero guarda o resuelve los cambios pendientes');
  const projects=await readNovelForgeProjects();
  if(!projects.length){alert('No hay novelas en el editor profesional para este origen. Abre «Editor profesional» y crea o importa una novela allí primero.');return}
  const numbered=projects.map((p,i)=>`${i+1}. ${p.title||'Sin título'} (${(p.chapters||[]).length} capítulos)`).join('\n');
  const answer=prompt('Transferir UNA COPIA al análisis narrativo.\nLos datos del editor profesional NO se modificarán.\nLa transferencia NO sincroniza posteriores cambios.\n\n'+numbered+'\n\nNúmero a transferir:','1');
  if(answer===null)return;
  if(!/^[0-9]+$/.test(answer.trim()))throw Error('Número inválido');
  const index=Number(answer)-1;if(index<0||index>=projects.length)throw Error('Novela no encontrada');
  const input=projects[index];
  const snapshot=upgradeSnapshot(convertNovelForgeProject(input));
  const exists=new Set((await all('projects')).map(p=>p.title));
  const copy=renamedSnapshot(snapshot,exists);remapLore(snapshot,copy);remapHistory(snapshot,copy);remapFacts(snapshot,copy);
  if(!confirm(`Se creará una COPIA de «${input.title}» con ${copy.chapters.length} capítulos y ${copy.scenes.length} escenas. El análisis utilizará texto sin formato; el editor profesional conserva el formato original. ¿Continuar?`))return;
  await importSnapshot(copy);await refresh();status('Copia transferida al análisis narrativo');
  alert('Transferencia completada. Ya puedes utilizar el mapa, las fichas y Narrative Intelligence. Cambios futuros en el editor profesional requieren otra transferencia manual.');
 }catch(e){error(e)}
});
$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>25*1024*1024)throw Error('Archivo demasiado grande (máximo 25 MB)');const source=upgradeSnapshot(JSON.parse(await file.text()));await commitEditor();await writeChain;if(state.dirty)throw Error('Hay texto sin guardar');const current=await all('projects');const copy=renamedSnapshot(source,new Set(current.map(p=>p.title)));remapLore(source,copy);remapHistory(source,copy);remapFacts(source,copy);if(!confirm(`Importar ${copy.projects.length} novela(s), ${copy.chapters.length} capítulo(s) y ${copy.scenes.length} escena(s)? No reemplazará las novelas existentes.`))return;await importSnapshot(copy);await refresh();await reloadLore();status('Importación terminada')}catch(err){error(err)}};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')commitEditor().catch(error)});window.addEventListener('pagehide',()=>{commitEditor().catch(error)});window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue=''}});
initLore(()=>({projectId:state.projectId}),async()=>{await commitEditor();if(state.dirty)throw Error('Hay texto sin guardar');await writeChain});openDB().then(refresh).then(()=>{window.__storyverseDbReady=true;window.dispatchEvent(new Event('storyverse-db-ready'));if(!state.dirty&&!state.conflict)status('Base de datos lista')}).catch(e=>{window.__storyverseDbReady=false;window.__storyverseDbError=String(e?.message||e);window.dispatchEvent(new Event('storyverse-db-failed'));error(e)});

// Phase 5: editorial preferences. Never store manuscript text in localStorage.
const preferenceKey='storyverse-404:ux:v1';
function applyPreferences(){
 const theme=['nocturne','paper','forest'].includes($('themeSelect').value)?$('themeSelect').value:'nocturne';
 const font=['serif','sans','mono'].includes($('fontSelect').value)?$('fontSelect').value:'serif';
 const size=['16','18','20','22'].includes($('sizeSelect').value)?$('sizeSelect').value:'18';
 document.body.dataset.theme=theme;
 document.documentElement.style.setProperty('--editor-size',size+'px');
 document.documentElement.style.setProperty('--editor-font',font==='mono'?'ui-monospace,SFMono-Regular,Consolas,monospace':font==='sans'?'system-ui,-apple-system,Segoe UI,sans-serif':'Georgia,Times New Roman,serif');
 try{localStorage.setItem(preferenceKey,JSON.stringify({theme,font,size}))}catch(e){console.warn('No se pudieron guardar las preferencias visuales',e)}
}
try{
 const saved=JSON.parse(localStorage.getItem(preferenceKey)||'{}');
 for(const [key,id,allowed] of [['theme','themeSelect',['nocturne','paper','forest']],['font','fontSelect',['serif','sans','mono']],['size','sizeSelect',['16','18','20','22']]]){
  if(allowed.includes(String(saved[key])))$(id).value=String(saved[key]);
 }
}catch(e){console.warn('Preferencias visuales inválidas',e)}
for(const id of ['themeSelect','fontSelect','sizeSelect'])$(id).addEventListener('change',applyPreferences);
applyPreferences();
const focusButton=$('focusBtn');
function setFocusMode(enabled){document.body.classList.toggle('focus-mode',enabled);focusButton.setAttribute('aria-pressed',String(enabled));focusButton.textContent=enabled?'◈ Salir de concentración':'◈ Concentración';if(enabled)$('editor').focus()}
focusButton.addEventListener('click',()=>setFocusMode(!document.body.classList.contains('focus-mode')));
$('navToggle').addEventListener('click',()=>{const on=$('sidebar').classList.toggle('mobile-open');$('navToggle').setAttribute('aria-expanded',String(on))});
document.addEventListener('keydown',e=>{
 if(e.altKey&&!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='f'){e.preventDefault();if(!$('workspace').hidden)setFocusMode(!document.body.classList.contains('focus-mode'))}
 if(e.key==='Escape'&&document.body.classList.contains('focus-mode'))setFocusMode(false);
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();commitEditor().catch(error)}
});

// Phase 6: deterministic and read-only narrative audit.
let lastAudit=null;
function auditCell(parent,tag,value,cls=''){const el=document.createElement(tag);el.textContent=String(value);if(cls)el.className=cls;parent.append(el);return el}
async function showAudit(){
 try{
  await commitEditor();await writeChain;
  if(state.dirty)throw Error('Hay cambios sin guardar. No se ejecutará la auditoría.');
  await leaveLore();
  if(!state.projectId)throw Error('Crea o selecciona una novela primero');
  $('workspace').hidden=true;$('empty').hidden=true;$('loreWorkspace').hidden=true;$('graphWorkspace').hidden=true;$('globalWorkspace').hidden=true;$('trashWorkspace').hidden=true;$('intelligenceWorkspace').hidden=true;$('auditWorkspace').hidden=false;
  await runAudit();
 }catch(e){error(e)}
}
async function runAudit(){
 await commitEditor();await writeChain;
 if(state.dirty)throw Error('Hay cambios sin guardar');
 if(!state.projectId)throw Error('Selecciona una novela');
 const source=await snapshot();const report=analyzeNovel(source,state.projectId);lastAudit=report;
 const r=$('auditResults');r.replaceChildren();
 $('auditSummary').textContent=`${report.projectTitle} · ${report.stats.words} palabras · ${report.stats.chapters} capítulos · ${report.stats.scenes} escenas · ${report.findings.length} observaciones`;
 const bySeverity={attention:'Atención',review:'Revisar',info:'Informativo'};
 const section=auditCell(r,'section','','auditPanel');auditCell(section,'h2','Hallazgos de las reglas');
 if(!report.findings.length)auditCell(section,'p','Sin observaciones con las reglas activas. Esto no garantiza que el manuscrito no tenga problemas.');
 for(const f of report.findings){const item=auditCell(section,'article','','auditFinding');auditCell(item,'strong',`${bySeverity[f.severity]||f.severity} · ${f.title}`);auditCell(item,'p',f.detail)}
 const lengths=auditCell(r,'section','','auditPanel');auditCell(lengths,'h2','Extensión por capítulo');
 if(!report.chapterWords.length)auditCell(lengths,'p','Todavía no hay capítulos.');
 const max=Math.max(1,...report.chapterWords.map(x=>x.words));for(const c of report.chapterWords){const row=auditCell(lengths,'div','','auditLength');auditCell(row,'span',c.title);const track=auditCell(row,'div','','auditTrack');const bar=document.createElement('div');bar.className='auditBar';bar.style.width=(100*c.words/max)+'%';track.append(bar);auditCell(row,'small',c.words+' palabras')}
 const note=auditCell(r,'p','Estas reglas no pueden determinar si un personaje aparece realmente en la prosa, si una trama está bien resuelta o si una fecha histórica es correcta. Los vínculos y estados dependen de tus fichas.','muted');
 return report;
}
$('auditBtn').addEventListener('click',showAudit);
$('runAudit').addEventListener('click',()=>runAudit().catch(error));
$('auditExport').addEventListener('click',()=>{if(!lastAudit||lastAudit.projectId!==state.projectId)return alert('Ejecuta primero el análisis de la novela actual');download(safeName(lastAudit.projectTitle)+'_auditoria.md',auditMarkdown(lastAudit),'text/markdown;charset=utf-8')});
$('auditBack').addEventListener('click',()=>{$('auditWorkspace').hidden=true;lastAudit=null;render()});

// v0.12: Plain-text find/replace, preserving textarea selection and existing save path.
let searchCursor=-1;
const findInput=$('findInput'),replaceInput=$('replaceInput');
function updateFindStatus(){
 const matches=findMatches($('editor').value,findInput.value);
 $('findStatus').textContent=matches.length+' coincidencia'+(matches.length===1?'':'s');
 return matches;
}
function findNext(){
 if($('workspace').hidden||$('editor').disabled)return;
 const matches=updateFindStatus();if(!matches.length)return;
 const start=$('editor').selectionEnd;const match=matches.find(m=>m.start>=start)||matches[0];
 $('editor').focus();$('editor').setSelectionRange(match.start,match.end);searchCursor=match.start;
}
function replaceSelected(allMatches){
 const editor=$('editor');if($('workspace').hidden||editor.disabled||!findInput.value)return;
 const before=editor.value;
 if(allMatches){const result=replaceEvery(before,findInput.value,replaceInput.value);if(result.text===before)return;editor.value=result.text;editor.setSelectionRange(0,0)}
 else {const selection={start:editor.selectionStart,end:editor.selectionEnd};const result=replaceCurrent(before,findInput.value,replaceInput.value,selection);if(!result.changed){findNext();return}editor.value=result.text;editor.setSelectionRange(result.cursor,result.cursor)}
 changed();editor.focus();updateFindStatus();
}
findInput.addEventListener('input',()=>{searchCursor=-1;updateFindStatus()});
$('findNext').addEventListener('click',findNext);
$('replaceOne').addEventListener('click',()=>replaceSelected(false));
$('replaceAll').addEventListener('click',()=>{if(!findInput.value)return;const count=findMatches($('editor').value,findInput.value).length;if(count&&confirm('¿Sustituir '+count+' coincidencias del texto actual?'))replaceSelected(true)});
$('typewriterBtn').addEventListener('click',()=>{const enabled=document.body.classList.toggle('typewriter-mode');$('typewriterBtn').setAttribute('aria-pressed',String(enabled));$('editor').focus()});
$('editor').addEventListener('keyup',()=>{if(document.body.classList.contains('typewriter-mode')){const el=$('editor');const line=el.value.slice(0,el.selectionStart).split('\n').length;const lh=parseFloat(getComputedStyle(el).lineHeight)||30;el.scrollTop=Math.max(0,line*lh-el.clientHeight/2)}});
// Graph is a read-only projection of existing IndexedDB records, never modifies them.
async function showGraph(){
 try{
  await commitEditor();await writeChain;if(state.dirty)throw Error('Guarda los cambios antes de abrir el mapa');
  await leaveLore();if(!state.projectId)throw Error('Crea o selecciona una novela');
  $('workspace').hidden=true;$('empty').hidden=true;$('auditWorkspace').hidden=true;$('loreWorkspace').hidden=true;$('globalWorkspace').hidden=true;$('trashWorkspace').hidden=true;$('intelligenceWorkspace').hidden=true;$('graphWorkspace').hidden=false;
  await refreshGraph();
 }catch(e){error(e)}
}
async function refreshGraph(){
 const projectId=state.projectId;const types=['scenes','characters','places','plotlines','events','links'];
 const data=Object.fromEntries(await Promise.all(types.map(async type=>[type,(await all(type)).filter(x=>x.projectId===projectId)])));
 const {nodes,edges}=buildGraph(data),positions=graphLayout(nodes,edges);
 const root=$('graphCanvas');root.replaceChildren();
 $('graphSummary').textContent=nodes.length+' fichas y escenas · '+edges.length+' conexiones documentadas';
 if(!nodes.length){root.textContent='Aún no hay escenas ni fichas. Crea contenidos desde la biblioteca y Story Bible.';return}
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1000 620');svg.setAttribute('aria-label','Diagrama de conexiones');svg.classList.add('graphSvg');
 const ns='http://www.w3.org/2000/svg';const make=(tag,attrs)=>{const element=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))element.setAttribute(k,String(v));return element};
 const coords=new Map(positions.map(p=>[p.key,p]));
 for(const edge of edges){const a=coords.get(edge.from),b=coords.get(edge.to);if(!a||!b)continue;svg.append(make('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'graphEdge'}))}
 for(const node of nodes){const pt=coords.get(node.key);if(!pt)continue;const group=make('g',{class:'graphNode graph-'+node.type,role:'button',tabindex:'0','aria-label':node.label});group.append(make('circle',{cx:pt.x,cy:pt.y,r:node.type==='scene'?26:31}));const title=make('text',{x:pt.x,y:pt.y+48,'text-anchor':'middle'});title.textContent=node.label.length>23?node.label.slice(0,22)+'…':node.label;group.append(title);const mark=make('text',{x:pt.x,y:pt.y+5,'text-anchor':'middle',class:'graphGlyph'});mark.textContent=({scene:'◈',character:'●',place:'◆',plotline:'▰',event:'✦'})[node.type];group.append(mark);const open=()=>{$('graphDetail').textContent=node.label+' · '+({scene:'Escena',character:'Personaje',place:'Lugar',plotline:'Trama',event:'Evento'})[node.type]+' · '+edges.filter(e=>e.from===node.key||e.to===node.key).length+' conexiones';svg.querySelectorAll('.selected').forEach(n=>n.classList.remove('selected'));group.classList.add('selected')};group.addEventListener('click',open);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});svg.append(group)}
 root.append(svg);
}
$('graphBtn').addEventListener('click',showGraph);
$('graphRefresh').addEventListener('click',()=>refreshGraph().catch(error));
$('graphBack').addEventListener('click',()=>{$('graphWorkspace').hidden=true;render()});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'&&!$('workspace').hidden){e.preventDefault();findInput.focus();findInput.select()}});

// PWA registration must never interfere with editing if the browser rejects SW registration.
if('serviceWorker' in navigator && location.protocol==='https:'){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(e=>console.warn('Modo instalable no disponible',e)));
}

// v1.1 — Project-wide search and recoverable trash.
const showMain=()=>{for(const id of ['workspace','empty','auditWorkspace','graphWorkspace','loreWorkspace','globalWorkspace','trashWorkspace','intelligenceWorkspace'])$(id).hidden=true};
async function ensureSafeNavigation(){await commitEditor();await writeChain;if(state.dirty||state.conflict)throw Error('Hay cambios sin guardar; no se abandonará el editor');await leaveLore()}
$('globalSearchBtn').addEventListener('click',async()=>{try{await ensureSafeNavigation();if(!state.projectId)throw Error('Selecciona una novela');showMain();$('globalWorkspace').hidden=false;await runGlobalSearch()}catch(e){error(e)}});
let globalSearchGeneration=0;
async function runGlobalSearch(){
 const generation=++globalSearchGeneration;
 const out=$('globalResults');out.replaceChildren();const term=$('globalQuery').value.trim().toLocaleLowerCase('es');
 if(!state.projectId){out.textContent='Selecciona una novela.';return}
 if(!term){out.textContent='Introduce un término para buscar en todos los capítulos y escenas.';return}
 const records=searchManuscript(await all('chapters'),await all('scenes'),state.projectId,term);
 if(generation!==globalSearchGeneration || $('globalWorkspace').hidden)return;
 const matches=records.length;
 for(const item of records){
  const btn=document.createElement('button');btn.type='button';btn.className='globalResult';
  const heading=document.createElement('strong');heading.textContent=(item.store==='scenes'?'Escena · ':'Capítulo · ')+item.title;
  const snippet=document.createElement('span');snippet.textContent=item.snippet;
  btn.append(heading,snippet);
  btn.addEventListener('click',()=>changeSelection(()=>{state.projectId=item.projectId;state.chapterId=item.store==='scenes'?item.chapterId:item.id;state.sceneId=item.store==='scenes'?item.id:null;$('globalWorkspace').hidden=true;render()}));out.append(btn);
 }
 $('globalCount').textContent=matches+' resultados';if(!matches)out.textContent='Sin coincidencias en la novela actual.';
}
$('globalQuery').addEventListener('input',()=>{if(!$('globalWorkspace').hidden)runGlobalSearch().catch(error)});
$('globalBack').addEventListener('click',()=>{globalSearchGeneration++;$('globalWorkspace').hidden=true;render()});
$('trashBtn').addEventListener('click',async()=>{try{await ensureSafeNavigation();showMain();$('trashWorkspace').hidden=false;await renderTrash()}catch(e){error(e)}});
async function renderTrash(){const out=$('trashList');out.replaceChildren();const entries=(await all('trash')).filter(x=>x.projectId===state.projectId).sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt));$('trashCount').textContent=entries.length+' elementos recuperables';if(!entries.length){out.textContent='No hay elementos en la papelera de esta novela.';return}
 for(const item of entries){const row=document.createElement('div');row.className='trashEntry';const label=document.createElement('span');label.textContent=(item.entityType==='chapters'?'Capítulo: ':'Escena: ')+item.title+' · '+new Date(item.deletedAt).toLocaleString('es-ES');const btn=document.createElement('button');btn.type='button';btn.textContent='Restaurar';btn.addEventListener('click',async()=>{btn.disabled=true;try{await restoreTrash(item.id);await refresh();await renderTrash();status('Elemento restaurado')}catch(e){error(e);btn.disabled=false}});row.append(label,btn);out.append(row)}
}
$('trashBack').addEventListener('click',()=>{$('trashWorkspace').hidden=true;render()});


// v1.2 — evidence-first, deterministic narrative intelligence.
let lastIntelligence=null;
const factView=$('intelligenceWorkspace');
const factMessage=(message)=>{$('factStatus').textContent=message};
function factRowText(f){return `${f.subject} · ${f.attribute}: ${f.value}${f.scope?' ['+f.scope+']':''}`}
async function renderFactLedger(){
 const projectId=state.projectId;
 const [facts,scenes]=await Promise.all([all('facts'),all('scenes')]);
 if(state.projectId!==projectId||factView.hidden)return;
 const mine=facts.filter(f=>f.projectId===projectId);
 const aiDropdown=$('localAiScene');const aiSelected=aiDropdown.value;aiDropdown.replaceChildren();
 for(const sc of scenes.filter(s=>s.projectId===projectId)){const option=document.createElement('option');option.value=sc.id;option.textContent=sc.title;aiDropdown.append(option)}
 if([...aiDropdown.options].some(o=>o.value===aiSelected))aiDropdown.value=aiSelected;
 const dropdown=$('factScene');const chosen=dropdown.value;dropdown.replaceChildren();
 const empty=document.createElement('option');empty.value='';empty.textContent='Sin escena asociada';dropdown.append(empty);
 for(const scene of scenes.filter(s=>s.projectId===projectId)){
  const option=document.createElement('option');option.value=scene.id;option.textContent=scene.title;dropdown.append(option)
 }
 dropdown.value=[...dropdown.options].some(o=>o.value===chosen)?chosen:'';
 const host=$('factList');host.replaceChildren();
 for(const f of mine){
  const card=document.createElement('article');card.className='ni-fact';
  const heading=document.createElement('strong');heading.textContent=factRowText(f);card.append(heading);
  if(f.evidence){const q=document.createElement('blockquote');q.textContent='«'+f.evidence+'»';card.append(q)}
  const controls=document.createElement('div');controls.className='ni-row';
  const del=document.createElement('button');del.type='button';del.textContent='Eliminar hecho';del.setAttribute('aria-label','Eliminar '+f.subject+' '+f.attribute);
  del.addEventListener('click',async()=>{if(!confirm('¿Eliminar este hecho de la memoria narrativa?'))return;del.disabled=true;try{await remove('facts',f.id);await renderFactLedger();lastIntelligence=null;$('intelligenceResults').textContent='Memoria modificada; vuelve a comprobar la coherencia.'}catch(e){del.disabled=false;error(e)}});
  controls.append(del);card.append(controls);host.append(card)
 }
 factMessage(`${mine.length} hechos registrados · ${scenes.filter(s=>s.projectId===projectId).length} escenas disponibles`);
 if(!mine.length)host.textContent='Todavía no hay hechos documentados. Registra el primero en el formulario.';
}
$('intelligenceBtn').addEventListener('click',async()=>{try{
 await ensureSafeNavigation();if(!state.projectId)throw Error('Crea o selecciona una novela primero');
 showMain();factView.hidden=false;extractionRun++;$('extractionCandidates').replaceChildren();$('extractionStatus').textContent='Pulsa «Extraer hechos» para analizar escenas.';await renderFactLedger();
}catch(e){error(e)}});
$('factForm').addEventListener('submit',async(e)=>{
 e.preventDefault();if(!state.projectId)return;
 const form=e.currentTarget;const submit=form.querySelector('[type=submit]');submit.disabled=true;
 try{
  const fact={id:newId(),projectId:state.projectId,subject:$('factSubject').value.trim(),attribute:$('factAttribute').value.trim(),value:$('factValue').value.trim(),scope:$('factScope').value.trim(),sceneId:$('factScene').value,evidence:$('factEvidence').value.trim(),createdAt:now()};
  if(!fact.subject||!fact.attribute||!fact.value)throw Error('Completa los campos obligatorios');
  await put('facts',fact);form.reset();lastIntelligence=null;$('intelligenceResults').textContent='Hecho guardado. Ejecuta el análisis para comprobar conflictos.';
  await renderFactLedger();
 }catch(err){error(err)}finally{submit.disabled=false}
});
async function runIntelligence(){
 await ensureSafeNavigation();if(!state.projectId)throw Error('Selecciona una novela');
 const projectId=state.projectId;
 const [facts,scenes,links,characters,places,plotlines,events]=await Promise.all(['facts','scenes','links','characters','places','plotlines','events'].map(all));
 const mine=facts.filter(f=>f.projectId===projectId),ss=scenes.filter(s=>s.projectId===projectId);
 const findings=[...analyzeFacts(mine,ss),...analyzeContinuity(projectId,{scenes:ss,links,characters,places,plotlines,events})];lastIntelligence={projectId,findings,facts:mine,generatedAt:now()};
 const host=$('intelligenceResults');host.replaceChildren();
 const summary=document.createElement('p');summary.textContent=`${mine.length} hechos · ${findings.length} observaciones · ${findings.filter(f=>f.type==='conflict').length} posibles conflictos · ${findings.filter(f=>f.type==='broken-link'||f.type==='shared-order').length} alertas de continuidad`;host.append(summary);
 if(!findings.length){const p=document.createElement('p');p.textContent='No aparecen incompatibilidades entre los hechos registrados. Esto NO demuestra que el manuscrito carezca de contradicciones.';host.append(p)}
 for(const f of findings){const card=document.createElement('article');card.className='ni-finding';
  const title=document.createElement('h3');title.textContent=(f.severity==='warning'?'⚠ ':'◇ ')+f.title;
  const detail=document.createElement('p');detail.textContent=f.detail;card.append(title,detail);
  for(const e of f.evidence||[]){const item=document.createElement('blockquote');item.textContent=`${e.value} · ${e.scope||'Contexto no especificado'}${e.quote?' — «'+e.quote+'»':''}`;card.append(item);
   const scene=ss.find(scene=>scene.id===e.sceneId);
   if(scene){const open=document.createElement('button');open.type='button';open.textContent='↗ Abrir evidencia: '+scene.title;
    open.addEventListener('click',async()=>{try{await ensureSafeNavigation();if(state.projectId!==projectId)throw Error('La novela seleccionada ha cambiado');state.chapterId=scene.chapterId;state.sceneId=scene.id;showMain();await refresh();if(e.quote){const editor=$('editor'),at=editor.value.toLocaleLowerCase('es').indexOf(e.quote.toLocaleLowerCase('es'));if(at>=0){editor.focus();editor.setSelectionRange(at,at+e.quote.length)}}}catch(err){error(err)}});
    card.append(open)}
  }
  const key=findingKey(f), storageKey='storyverse404:review:'+projectId+':'+key;
  const review=document.createElement('button');review.type='button';review.className='ni-review';review.setAttribute('aria-pressed',localStorage.getItem(storageKey)==='1'?'true':'false');
  const updateReview=()=>{const reviewed=review.getAttribute('aria-pressed')==='true';review.textContent=reviewed?'✓ Revisada · Reabrir':'Marcar como revisada';card.classList.toggle('ni-reviewed',reviewed)};
  review.addEventListener('click',()=>{const next=review.getAttribute('aria-pressed')!=='true';try{if(next)localStorage.setItem(storageKey,'1');else localStorage.removeItem(storageKey);review.setAttribute('aria-pressed',String(next));updateReview()}catch(err){error(err)}});
  updateReview();card.append(review);host.append(card)
 }
}
async function showFactSuggestions(candidates,scenes,projectId,target){
for(const candidate of candidates){
   const card=document.createElement('article');card.className='ni-fact';
   const heading=document.createElement('strong');heading.textContent=factRowText(candidate);
   const meta=document.createElement('p');meta.className='muted';meta.textContent='Escena: '+(scenes.find(s=>s.id===candidate.sceneId)?.title||'Sin título')+' · '+(candidate.origin==='local-ai'?'Propuesta IA sin verificar':'Regla local')+' / revisar contexto';
   const q=document.createElement('blockquote');q.textContent=candidate.evidence;
   const controls=document.createElement('div');controls.className='ni-row';
   const approve=document.createElement('button');approve.type='button';approve.className='primary';approve.textContent='✓ Confirmar hecho';
   const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Descartar propuesta';
   approve.addEventListener('click',async()=>{approve.disabled=true;dismiss.disabled=true;try{
    if(state.projectId!==projectId)throw Error('Ha cambiado la novela seleccionada');
    const current=await all('facts');
    if(newCandidates([candidate],current).length){await put('facts',{...candidate,id:newId(),createdAt:now()})}
    card.remove();lastIntelligence=null;$('intelligenceResults').textContent='Hechos modificados; ejecuta de nuevo la comprobación.';await renderFactLedger();
   }catch(e){approve.disabled=false;dismiss.disabled=false;error(e)}});
   dismiss.addEventListener('click',()=>card.remove());controls.append(approve,dismiss);card.append(heading,meta,q,controls);target.append(card);
  }
}
// Every extracted proposal is reviewed and explicitly approved before persistence.
let extractionRun=0;
$('intelligenceExtract').addEventListener('click',async()=>{
 const button=$('intelligenceExtract');button.disabled=true;
 const run=++extractionRun, projectId=state.projectId, target=$('extractionCandidates');
 target.replaceChildren();$('extractionStatus').textContent='Leyendo las escenas…';
 try{
  await ensureSafeNavigation();if(!projectId)throw Error('Selecciona primero una novela');
  const [scenes,facts]=await Promise.all([all('scenes'),all('facts')]);
  if(run!==extractionRun||projectId!==state.projectId)return;
  const candidates=newCandidates(extractCandidates(scenes.filter(s=>s.projectId===projectId)),facts.filter(f=>f.projectId===projectId));
  $('extractionStatus').textContent=`${candidates.length} candidatos pendientes de revisión. La extracción es orientativa, no una lectura semántica completa.`;
  if(!candidates.length)target.textContent='No se encontraron nuevas afirmaciones explícitas. Prueba con frases como «Bruna tiene 9 años». No significa que no existan contradicciones.';
  await showFactSuggestions(candidates,scenes,projectId,target);
 }catch(e){$('extractionStatus').textContent='No se pudo completar la extracción.';error(e)}finally{button.disabled=false}
});
$('localAiAnalyze').addEventListener('click',async()=>{
 const btn=$('localAiAnalyze');btn.disabled=true;
 const projectId=state.projectId,target=$('extractionCandidates');
 try{
  await ensureSafeNavigation();
  if(!projectId)throw Error('Selecciona primero una novela');
  const sceneId=$('localAiScene').value;
  const [scenes,facts]=await Promise.all([all('scenes'),all('facts')]);
  const scene=scenes.find(s=>s.id===sceneId&&s.projectId===projectId);
  if(!scene)throw Error('Selecciona una escena válida');
  if(!confirm('¿Enviar ÚNICAMENTE el texto de esta escena al modelo configurado en tu ordenador? No se contactará con servidores de Internet.'))return;
  $('extractionStatus').textContent='Analizando escena con IA local…';target.replaceChildren();
  const proposed=await proposeWithLocalAI(scene,{endpoint:$('localAiEndpoint').value.trim(),model:$('localAiModel').value.trim()});
  if(state.projectId!==projectId||factView.hidden)return;
  const unique=newCandidates(proposed,facts.filter(f=>f.projectId===projectId));
  $('extractionStatus').textContent=`${unique.length} propuestas de IA pendientes de revisión (sin verificar).`;
  if(!unique.length)target.textContent='La IA no ha encontrado citas literales verificables nuevas.';
  await showFactSuggestions(unique,scenes,projectId,target);
 }catch(e){$('extractionStatus').textContent='Error en el análisis local: '+(e?.message||e);console.error(e)}finally{btn.disabled=false}
});
$('intelligenceCheck').addEventListener('click',()=>runIntelligence().catch(error));
$('intelligenceExport').addEventListener('click',()=>{
 if(!lastIntelligence||lastIntelligence.projectId!==state.projectId){alert('Ejecuta primero la comprobación de coherencia.');return}
 const data=lastIntelligence;const lines=['# STORYVERSE 404 — Narrative Intelligence',`Generado: ${data.generatedAt}`,'',`Hechos documentados: ${data.facts.length}`,'',...data.findings.flatMap(f=>[`## ${f.title}`,f.detail,...(f.evidence||[]).map(x=>`- ${x.value} (${x.scope||'sin contexto'}): ${x.quote||'sin cita'}`),''])];
 if(!data.findings.length)lines.push('Sin observaciones entre los hechos introducidos. No certifica coherencia del manuscrito.');
 download('storyverse-inteligencia-'+state.projectId.slice(0,8)+'.md',lines.join('\n'),'text/markdown;charset=utf-8')
});
$('intelligenceBack').addEventListener('click',()=>{factView.hidden=true;render()});

// Clean legacy local SW installations, which may serve stale app.js during debugging.
if ('serviceWorker' in navigator && ['localhost','127.0.0.1'].includes(location.hostname)) {
 navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.filter(r => r.scope.startsWith(location.origin+'/')).map(r => r.unregister()))).catch(console.warn);
}
