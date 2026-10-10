// Novel Forge 404 -> Narrative Intelligence: copy-only migration.
// It does not mutate the editorial database or claim bidirectional sync.
const uid=()=>crypto.randomUUID();
const stamp=()=>new Date().toISOString();
const textOf=(html)=>{
  if(typeof html!=='string')return '';
  if(typeof DOMParser!=='undefined'){
    const doc=new DOMParser().parseFromString(html,'text/html');
    for(const e of doc.querySelectorAll('script,style,iframe,object,svg'))e.remove();
    for(const e of doc.querySelectorAll('p,div,li,h1,h2,h3,blockquote,br'))e.append('\n');
    return (doc.body.textContent||'').replace(/\n{3,}/g,'\n\n').trim();
  }
  // Node fallback for unit tests; browser always uses DOMParser.
  return html.replace(/<\s*br\s*\/?>/gi,'\n').replace(/<\/(?:p|div|h[1-6]|li)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').trim();
};
export function convertNovelForgeProject(source){
 if(!source||typeof source!=='object'||Array.isArray(source)||!Array.isArray(source.chapters))throw Error('Proyecto Novel Forge inválido');
 if(source.chapters.length>3000)throw Error('Demasiados capítulos');
 const projectId=uid(),createdAt=stamp();
 const project={id:projectId,title:String(source.title||'Novela importada').slice(0,150),content:String(source.synopsis||''),createdAt,updatedAt:createdAt};
 const chapters=[],scenes=[],characters=[],places=[],plotlines=[],events=[];
 source.chapters.forEach((c,idx)=>{
   const chapterId=uid();
   chapters.push({id:chapterId,projectId,title:String(c.title||`Capítulo ${idx+1}`).slice(0,150),content:'',position:idx,createdAt,updatedAt:createdAt});
   const original=Array.isArray(c.scenes)?c.scenes:[];
   original.forEach((s,j)=>{
     const content=textOf(s.html||s.content||'');
     if(content.length>10000000)throw Error('Escena supera el límite de importación');
     scenes.push({id:uid(),projectId,chapterId,title:String(s.title||`Escena ${j+1}`).slice(0,150),content,position:j,storyOrder:null,storyDate:'',createdAt,updatedAt:createdAt});
   });
 });
 const mapType=(type)=>{const t=String(type||'').toLowerCase();if(/personaj|character|protagon|antagon/.test(t))return 'characters';if(/lugar|escenar|place|location/.test(t))return 'places';if(/trama|plot|conflict/.test(t))return 'plotlines';return 'events'};
 for(const b of Array.isArray(source.bible)?source.bible:[]){
   const store=mapType(b.type);
   ({characters,places,plotlines,events})[store].push({id:uid(),projectId,name:String(b.name||'Ficha').slice(0,150),description:String(b.summary||''),notes:textOf(b.content||''),createdAt,updatedAt:createdAt});
 }
 return {app:'STORYVERSE-404',version:1,projects:[project],chapters,scenes,characters,places,plotlines,events,links:[],history:[],facts:[]};
}
export async function readNovelForgeProjects(){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open('novel-forge-404');let existed=true;
  r.onupgradeneeded=()=>{existed=false; r.transaction.abort()};
  r.onerror=()=>{if(!existed){resolve([]);return}reject(r.error||Error('No se puede abrir la base editorial'))};
  r.onsuccess=()=>{
   const db=r.result;
   const stores=[...db.objectStoreNames];
   if(!existed||!stores.length){db.close();resolve([]);return}
   const name=stores.includes('app-state')?'app-state':stores[0];
   const tx=db.transaction(name,'readonly');
   const req=tx.objectStore(name).get('projects');
   req.onsuccess=()=>{const v=req.result;resolve(Array.isArray(v)?v:[])};
   req.onerror=()=>reject(req.error||Error('No se pudo leer Novel Forge'));
   tx.oncomplete=()=>db.close();
   tx.onabort=()=>reject(tx.error||Error('Lectura cancelada'));
  };
 });
}
