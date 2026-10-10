export const SCHEMA_VERSION=5;
const DB_NAME='storyverse404';
const STORES=['projects','chapters','scenes','characters','places','plotlines','events','links','history','trash','facts'];
let dbPromise;
export function openDB(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,SCHEMA_VERSION);request.onupgradeneeded=()=>{const db=request.result;for(const name of STORES){if(!db.objectStoreNames.contains(name)){const store=db.createObjectStore(name,{keyPath:'id'});if(name!=='projects')store.createIndex('projectId','projectId');if(name==='scenes')store.createIndex('chapterId','chapterId')}}};request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();dbPromise=null};request.result.onclose=()=>{dbPromise=null};resolve(request.result)};request.onerror=()=>{dbPromise=null;reject(request.error)};request.onblocked=()=>{dbPromise=null;reject(new Error('Base de datos bloqueada por otra pestaña'))}}).catch(e=>{dbPromise=null;throw e});return dbPromise}
export async function all(store){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const request=tx.objectStore(store).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
export async function put(store,item){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(item);tx.oncomplete=()=>resolve(item);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
export async function remove(store,id){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
export async function importSnapshot(snapshot){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORES,'readwrite');for(const name of STORES){const target=tx.objectStore(name);for(const item of (snapshot[name]||[]))target.add(item)}tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
export const stores=STORES;
// Obtain a coherent multi-store backup: no other readwrite transaction can
// interleave between reading its chapters, scenes, facts or history.
export async function exportSnapshotAtomic(){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORES,'readonly'), data={};
  for(const name of STORES){
   const req=tx.objectStore(name).getAll();
   req.onsuccess=()=>{data[name]=req.result};
  }
  tx.oncomplete=()=>resolve(data);
  tx.onerror=()=>reject(tx.error||new Error('Error de lectura de copia'));
  tx.onabort=()=>reject(tx.error||new Error('Copia interrumpida'));
 });
}


export async function putWithHistory(store,item,previous){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction([store,'history'],'readwrite');const history=tx.objectStore('history');if(previous&&((previous.content||'')!==(item.content||'')||previous.title!==item.title)){history.put({id:crypto.randomUUID(),projectId:item.projectId,entityType:store,entityId:item.id,content:previous.content||'',title:previous.title,revision:previous.revision||0,createdAt:new Date().toISOString()})}tx.objectStore(store).put(item);tx.oncomplete=()=>resolve(item);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
// Compare-and-swap in one readwrite transaction; another tab cannot interleave its write.
export async function saveIfUnchanged(store,item,expectedRevision){
 if(!['chapters','scenes'].includes(store))throw Error('Colección no autorizada');
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([store,'history'],'readwrite');
  const objects=tx.objectStore(store), history=tx.objectStore('history');
  let saved=null, conflict=null;
  const read=objects.get(item.id);
  read.onsuccess=()=>{
   const previous=read.result;
   if(!previous || (previous.revision||0)!==expectedRevision){
    conflict=new Error('CONFLICTO: el capítulo o la escena se modificó en otra pestaña. Tu borrador sigue disponible en esta pestaña.');
    conflict.code='STORYVERSE_CONFLICT';
    tx.abort();return;
   }
   saved={...item,revision:(previous.revision||0)+1};
   if((previous.content||'')!==(saved.content||'')||previous.title!==saved.title){
    history.put({id:crypto.randomUUID(),projectId:saved.projectId,entityType:store,entityId:saved.id,content:previous.content||'',title:previous.title,revision:previous.revision||0,createdAt:new Date().toISOString()});
   }
   objects.put(saved);
  };
  tx.oncomplete=()=>resolve(saved);
  tx.onerror=()=>reject(conflict||tx.error);
  tx.onabort=()=>reject(conflict||tx.error||new Error('Transacción cancelada'));
 });
}
export async function revisions(store,id){return (await all('history')).filter(r=>r.entityType===store&&r.entityId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}

// Delete a scene or chapter and all dependent records in ONE transaction.
// Keep history and links in sync so exported backups remain importable.
export async function deleteManuscriptItem(type,id){
 if(!['chapters','scenes'].includes(type))throw Error('Tipo de borrado no permitido');
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['chapters','scenes','links','history'],'readwrite');
  const chapters=tx.objectStore('chapters'),scenes=tx.objectStore('scenes');
  const links=tx.objectStore('links'),history=tx.objectStore('history');
  const sceneIds=new Set(type==='scenes'?[id]:[]);
  const getScenes=scenes.getAll();
  getScenes.onsuccess=()=>{
   if(type==='chapters')for(const scene of getScenes.result)if(scene.chapterId===id)sceneIds.add(scene.id);
   const getLinks=links.getAll(),getHistory=history.getAll();
   getLinks.onsuccess=()=>{
    for(const link of getLinks.result)if((link.sourceType==='scene'&&sceneIds.has(link.sourceId))||(link.targetType==='scene'&&sceneIds.has(link.targetId)))links.delete(link.id);
   };
   getHistory.onsuccess=()=>{
    for(const revision of getHistory.result)if((revision.entityType==='scenes'&&sceneIds.has(revision.entityId))||(type==='chapters'&&revision.entityType==='chapters'&&revision.entityId===id))history.delete(revision.id);
   };
   for(const sceneId of sceneIds)scenes.delete(sceneId);
   if(type==='chapters')chapters.delete(id);
  };
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Borrado cancelado'));
 });
}

// Update both positions atomically; a storage failure cannot leave duplicate positions.
export async function swapPositions(store,first,second){
 if(!['chapters','scenes'].includes(store))throw Error('Colección no autorizada');
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,'readwrite'),objects=tx.objectStore(store);
  objects.put(first);objects.put(second);
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });
}

// Recoverable deletion: all affected records, revisions and links are retained
// in the trash payload; the live set remains consistent for JSON exports.
export async function trashManuscriptItem(type,id){
 if(!['chapters','scenes'].includes(type))throw Error('Tipo no permitido');
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['chapters','scenes','links','history','trash','facts'],'readwrite');
  const chapters=tx.objectStore('chapters'),scenes=tx.objectStore('scenes');
  const links=tx.objectStore('links'),history=tx.objectStore('history'),trash=tx.objectStore('trash'),facts=tx.objectStore('facts');
  let record=null;
  const req=type==='chapters'?chapters.get(id):scenes.get(id);
  req.onsuccess=()=>{
   if(!req.result){tx.abort();return}
   record=req.result;
   const sr=scenes.getAll(),lr=links.getAll(),hr=history.getAll(),fr=facts.getAll();
   let results=0; const values={};
   for(const [name,r] of [['scenes',sr],['links',lr],['history',hr],['facts',fr]])r.onsuccess=()=>{
    values[name]=r.result;if(++results!==4)return;
    const sceneIds=new Set(type==='scenes'?[id]:values.scenes.filter(x=>x.chapterId===id).map(x=>x.id));
    const removedScenes=values.scenes.filter(x=>sceneIds.has(x.id));
    const removedLinks=values.links.filter(x=>(x.sourceType==='scene'&&sceneIds.has(x.sourceId))||(x.targetType==='scene'&&sceneIds.has(x.targetId)));
    const removedHistory=values.history.filter(x=>(x.entityType==='scenes'&&sceneIds.has(x.entityId))||(type==='chapters'&&x.entityType==='chapters'&&x.entityId===id));
    trash.put({id:crypto.randomUUID(),projectId:record.projectId,title:record.title,entityType:type,deletedAt:new Date().toISOString(),record,scenes:removedScenes,links:removedLinks,history:removedHistory,facts:values.facts.filter(f=>sceneIds.has(f.sceneId))});
    for(const x of removedScenes)scenes.delete(x.id);
    for(const x of removedLinks)links.delete(x.id);
    for(const x of removedHistory)history.delete(x.id);
    for(const f of values.facts)if(sceneIds.has(f.sceneId))facts.put({...f,sceneId:''});
    (type==='chapters'?chapters:scenes).delete(id);
   };
  };
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error('No se pudo mover a la papelera'));tx.onerror=()=>reject(tx.error);
 });
}
export async function restoreTrash(id){
 const db=await openDB();return new Promise((resolve,reject)=>{
  const tx=db.transaction(['projects','chapters','scenes','links','history','trash','facts'],'readwrite');
  const trash=tx.objectStore('trash'),projects=tx.objectStore('projects');
  const req=trash.get(id);req.onsuccess=()=>{
   const item=req.result;if(!item){tx.abort();return}
   const project=projects.get(item.projectId);project.onsuccess=()=>{
    if(!project.result){tx.abort();return}
    const owner=tx.objectStore(item.entityType),existing=owner.get(item.record.id);
    existing.onsuccess=()=>{
     if(existing.result){tx.abort();return}
     const restore=()=>{
      owner.add(item.record);
      for(const [store,records] of [['scenes',item.scenes],['links',item.links],['history',item.history]])for(const x of records)tx.objectStore(store).add(x);
      for(const fact of (item.facts||[]))tx.objectStore('facts').put(fact);
      trash.delete(id);
     };
     if(item.entityType==='scenes'){
      const chapter=tx.objectStore('chapters').get(item.record.chapterId);
      chapter.onsuccess=()=>{if(!chapter.result){tx.abort();return}restore()};
     }else restore();
    };
   };
  };
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error('Restauración cancelada: faltan referencias o hay identificadores duplicados'));tx.onerror=()=>reject(tx.error);
 });
}

// Remove a Story Bible record and all its references atomically.
export async function deleteLoreEntity(store,id){
 if(!['characters','places','plotlines','events'].includes(store))throw Error('Colección no autorizada');
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([store,'links'],'readwrite');
  const target=tx.objectStore(store),links=tx.objectStore('links');
  const kind={characters:'character',places:'place',plotlines:'plotline',events:'event'}[store];
  const request=links.getAll();
  request.onsuccess=()=>{
   for(const link of request.result){
    if((link.sourceType===kind&&link.sourceId===id)||(link.targetType===kind&&link.targetId===id))links.delete(link.id);
   }
   target.delete(id);
  };
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error||new Error('Borrado cancelado'));
 });
}
