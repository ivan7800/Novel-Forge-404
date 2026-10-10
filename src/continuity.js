// Non-semantic consistency checks for relationships and scene chronology.
const stores={scene:'scenes',character:'characters',place:'places',plotline:'plotlines',event:'events'};
export function analyzeContinuity(projectId, data){
 const findings=[];
 const lookup=new Map();
 for(const [type,store] of Object.entries(stores))lookup.set(type,new Set((data[store]||[]).filter(x=>x.projectId===projectId).map(x=>x.id)));
 for(const link of (data.links||[]).filter(x=>x.projectId===projectId)){
  const absent=[['source',link.sourceType,link.sourceId],['target',link.targetType,link.targetId]].filter(([,type,id])=>!lookup.has(type)||!lookup.get(type).has(id));
  if(absent.length)findings.push({type:'broken-link',severity:'warning',ids:[link.id],title:'Vínculo narrativo sin destino',detail:`La relación «${link.relation||'sin nombre'}» apunta a ${absent.map(x=>x[0]==='source'?'un origen inexistente':'un destino inexistente').join(' y ')}. Revisa la Story Bible.`,evidence:[]});
 }
 const scenes=(data.scenes||[]).filter(x=>x.projectId===projectId&&x.storyOrder!==null&&x.storyOrder!==undefined&&String(x.storyOrder)!=='');
 const byOrder=new Map();for(const s of scenes){const order=Number(s.storyOrder);if(!Number.isFinite(order))continue;if(!byOrder.has(order))byOrder.set(order,[]);byOrder.get(order).push(s)}
 for(const [order,group] of byOrder)if(group.length>1)findings.push({type:'shared-order',severity:'review',ids:group.map(x=>x.id),title:'Escenas con el mismo orden cronológico',detail:`${group.length} escenas comparten el orden ${order}. Puede ser simultáneo o un número duplicado; comprueba sus fechas.`,evidence:group.map(x=>({value:x.title,scope:x.storyDate||'',quote:'',sceneId:x.id}))});
 return findings;
}
