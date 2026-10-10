// Pure search helper: Unicode-aware and deterministic; never modifies manuscripts.
export function searchManuscript(chapters,scenes,projectId,query){
 const needle=String(query||'').trim().toLocaleLowerCase('es');
 if(!needle)return [];
 return [...chapters.map(item=>({...item,store:'chapters'})),...scenes.map(item=>({...item,store:'scenes'}))]
  .filter(item=>item.projectId===projectId)
  .flatMap(item=>{
   const content=String(item.content||'');
   const title=String(item.title||'');
   const match=(title+' '+content).toLocaleLowerCase('es').indexOf(needle);
   if(match<0)return [];
   const at=content.toLocaleLowerCase('es').indexOf(needle);
   return [{...item,snippet:at<0?'Coincidencia en título':content.slice(Math.max(0,at-70),at+100).replace(/\s+/gu,' ')}];
  });
}
