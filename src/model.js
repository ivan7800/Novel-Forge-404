import {verifyFactBackup} from './intelligence.js';
export const now=()=>new Date().toISOString();
export const newId=()=>crypto.randomUUID();
export const sortPositions=(a,b)=>(a.position??0)-(b.position??0)||a.id.localeCompare(b.id);
export function validateSnapshot(data){if(!data||data.app!=='STORYVERSE-404'||data.version!==1)throw Error('Formato o versión de copia incompatible');for(const name of ['projects','chapters','scenes']){if(!Array.isArray(data[name])||data[name].length>100000)throw Error('Colección inválida: '+name);const seen=new Set();for(const r of data[name]){if(!r||typeof r.id!=='string'||r.id.length>100||!r.id||seen.has(r.id)||typeof r.title!=='string'||r.title.length>160||typeof r.content!=='undefined'&&typeof r.content!=='string')throw Error('Registro inválido en '+name);seen.add(r.id);if(name!=='projects'&&(typeof r.projectId!=='string'||!r.projectId))throw Error('Referencia inválida')}}const ids=new Set(data.projects.map(p=>p.id)),chapters=new Map(data.chapters.map(c=>[c.id,c]));for(const c of data.chapters)if(!ids.has(c.projectId))throw Error('Capítulo sin novela');for(const s of data.scenes)if(!ids.has(s.projectId)||!chapters.has(s.chapterId)||chapters.get(s.chapterId).projectId!==s.projectId)throw Error('Escena sin capítulo');return true}
export function renamedSnapshot(data,existing){const projectMap=new Map(),chapterMap=new Map();const copy=structuredClone(data);for(const project of copy.projects){const old=project.id;project.id=newId();project.title=existing.has(project.title)?project.title+' (importada)':project.title;projectMap.set(old,project.id)}for(const chapter of copy.chapters){const old=chapter.id;chapter.id=newId();chapter.projectId=projectMap.get(chapter.projectId);chapterMap.set(old,chapter.id)}for(const scene of copy.scenes){scene.id=newId();scene.projectId=projectMap.get(scene.projectId);scene.chapterId=chapterMap.get(scene.chapterId)}return copy}
export const wordCount=t=>(t.trim().match(/\S+/gu)||[]).length;

export const LORE_STORES=['characters','places','plotlines','events','links'];
export const LORE_TYPES=['character','place','plotline','event'];
export function validateLore(snapshot){
 const allIds=new Set([...snapshot.projects,...snapshot.chapters,...snapshot.scenes,...LORE_STORES.flatMap(k=>snapshot[k]||[])].map(r=>r.id));
 const projects=new Set(snapshot.projects.map(r=>r.id));
 const typed={character:new Set((snapshot.characters||[]).map(r=>r.id)),place:new Set((snapshot.places||[]).map(r=>r.id)),plotline:new Set((snapshot.plotlines||[]).map(r=>r.id)),event:new Set((snapshot.events||[]).map(r=>r.id)),scene:new Set(snapshot.scenes.map(r=>r.id))};
 for(const name of LORE_STORES){const records=snapshot[name]||[];if(!Array.isArray(records)||records.length>100000)throw Error('Colección inválida: '+name);const ids=new Set();for(const r of records){if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||ids.has(r.id)||typeof r.projectId!=='string'||!projects.has(r.projectId))throw Error('Registro inválido: '+name);ids.add(r.id);for(const k of ['name','title','notes','description','goals','conflicts','role','status','relation','storyDate','summary'])if(r[k]!==undefined&&(typeof r[k]!=='string'||r[k].length>200000))throw Error('Campo inválido: '+k);}}
 for(const l of snapshot.links||[]){if(!typed[l.sourceType]?.has(l.sourceId)||!typed[l.targetType]?.has(l.targetId))throw Error('Vínculo huérfano');const source= l.sourceType==='scene'?snapshot.scenes.find(r=>r.id===l.sourceId):(snapshot[l.sourceType+'s']||snapshot[l.sourceType==='character'?'characters':l.sourceType==='plotline'?'plotlines':'events']).find(r=>r.id===l.sourceId);const target= l.targetType==='scene'?snapshot.scenes.find(r=>r.id===l.targetId):(snapshot[l.targetType==='character'?'characters':l.targetType==='plotline'?'plotlines':'events']).find(r=>r.id===l.targetId);if(source?.projectId!==l.projectId||target?.projectId!==l.projectId)throw Error('Vínculo entre novelas distintas');}
 return true;
}
export function upgradeSnapshot(snapshot){validateSnapshot(snapshot);const data=structuredClone(snapshot);for(const key of LORE_STORES)if(!data[key])data[key]=[];validateLore(data);validateHistory(data);verifyFactBackup(data);if(!data.facts)data.facts=[];if(!data.history)data.history=[];return data}
export function remapLore(source,copy){const maps={};for(const name of ['projects','chapters','scenes',...LORE_STORES]){maps[name]=new Map();for(let i=0;i<(source[name]||[]).length;i++)maps[name].set(source[name][i].id,copy[name][i].id)}
 for(const name of LORE_STORES){if(name==='links')continue;for(let i=0;i<source[name].length;i++){const old=source[name][i],next=copy[name][i];next.id=newId();next.projectId=maps.projects.get(old.projectId);maps[name].set(old.id,next.id)}}
 const typeStore={scene:'scenes',character:'characters',place:'places',plotline:'plotlines',event:'events'};
 for(let i=0;i<source.links.length;i++){const old=source.links[i],next=copy.links[i];next.id=newId();next.projectId=maps.projects.get(old.projectId);next.sourceId=maps[typeStore[old.sourceType]].get(old.sourceId);next.targetId=maps[typeStore[old.targetType]].get(old.targetId)}
 return copy;}

// History is optional for backups from versions <=0.7. Import remaps every owner.
export function remapHistory(source,copy){
 const owners={};
 for(const store of ['chapters','scenes']){
  owners[store]=new Map((source[store]||[]).map((r,i)=>[r.id,copy[store][i]?.id]));
 }
 const projectIds=new Map(source.projects.map((r,i)=>[r.id,copy.projects[i]?.id]));
 copy.history=(source.history||[]).map(r=>({
  ...r,id:newId(),entityId:owners[r.entityType].get(r.entityId),
  projectId:projectIds.get(r.projectId)
 }));
 return copy;
}
export function validateHistory(data){
 if(data.history===undefined)return true;
 if(!Array.isArray(data.history)||data.history.length>100000)throw Error('Historial inválido');
 const owners={chapters:new Map(data.chapters.map(r=>[r.id,r])),scenes:new Map(data.scenes.map(r=>[r.id,r]))};
 const seen=new Set();
 for(const r of data.history){
  if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||seen.has(r.id)||
    !['chapters','scenes'].includes(r.entityType)||!owners[r.entityType].has(r.entityId)||
    owners[r.entityType].get(r.entityId).projectId!==r.projectId||
    typeof r.content!=='string'||r.content.length>10000000||typeof r.title!=='string'||r.title.length>160||
    typeof r.createdAt!=='string')throw Error('Revisión inválida en copia JSON');
  seen.add(r.id);
 }
 return true;
}
