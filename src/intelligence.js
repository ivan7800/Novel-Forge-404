// Deterministic Narrative Intelligence: author-supplied fact ledger, no external services.
export const normFact = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es').replace(/\s+/g,' ');
export function validateFact(f){
 if(!f||typeof f!=='object'||typeof f.id!=='string'||!f.id||typeof f.projectId!=='string'||!f.projectId)throw Error('Identificador del hecho inválido');
 for(const k of ['subject','attribute','value','scope','evidence','sceneId'])if(typeof f[k]!=='string'||f[k].length>(k==='evidence'?1500:240))throw Error('Campo del hecho inválido: '+k);
 if(!f.subject.trim()||!f.attribute.trim()||!f.value.trim())throw Error('Sujeto, atributo y valor son obligatorios');
 return true;
}
// Conservative context comparisons: a year is useful only if the author supplied it unambiguously.
export function scopeYear(scope){
 const v=String(scope||'').trim();
 const match=v.match(/^(?:año\s+)?(1\d{3}|20\d{2})(?:\s*(?:d\.?\s*c\.?|dc))?$/i);
 return match?Number(match[1]):null;
}
export function numericAge(value){
 const match=normFact(value).match(/^(\d{1,3})(?:\s+anos)?$/);
 return match?Number(match[1]):null;
}
const VITAL={vivo:'vivo',viva:'vivo','vivo/a':'vivo',muerto:'muerto',muerta:'muerto','muerto/a':'muerto',fallecido:'muerto',fallecida:'muerto'};
function equivalentValue(a,b,attribute){
 const av=normFact(a),bv=normFact(b);
 if(av===bv)return true;
 if(normFact(attribute)==='edad')return numericAge(av)!==null&&numericAge(av)===numericAge(bv);
 if(normFact(attribute)==='estado vital')return VITAL[av]&&VITAL[av]===VITAL[bv];
 return false;
}
function compareContext(a,b){
 const sa=normFact(a.scope),sb=normFact(b.scope);
 if(sa===sb)return {compare:true,severity:sa?'warning':'review',explanation:sa?'Comparten contexto temporal.':'Ambos hechos carecen de fecha verificable.'};
 const ya=scopeYear(a.scope),yb=scopeYear(b.scope);
 if(ya!==null&&ya===yb)return {compare:true,severity:'review',explanation:'Comparten año, pero podrían referirse a momentos diferentes dentro del año.'};
 if(ya!==null&&yb!==null){
  if(normFact(a.attribute)==='edad'){
   const aa=numericAge(a.value),ab=numericAge(b.value);
   if(aa!==null&&ab!==null){
    const older=ya<yb?{age:aa,year:ya}:{age:ab,year:yb};
    const newer=ya<yb?{age:ab,year:yb}:{age:aa,year:ya};
    const years=newer.year-older.year,delta=newer.age-older.age;
    if(delta<years-1||delta>years+1)return {compare:true,severity:'review',explanation:`La diferencia de edad (${delta}) no parece compatible con ${years} años transcurridos; revisa fechas y cumpleaños.`};
   }
  }
  return {compare:false};
 }
 if(!sa||!sb)return {compare:true,severity:'review',explanation:'Falta contexto temporal en al menos uno de los hechos.'};
 return {compare:false}; // Different unparseable contexts are not assumed equal.
}
export function analyzeFacts(facts, scenes=[]){
 const findings=[],groups=new Map(),sceneById=new Map(scenes.map(s=>[s.id,s]));
 for(const f of facts){validateFact(f);const key=[normFact(f.subject),normFact(f.attribute)].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);
  if(f.sceneId&&!sceneById.has(f.sceneId))findings.push({type:'orphan',severity:'warning',ids:[f.id],title:'Referencia de escena ausente',detail:`El hecho «${f.subject} · ${f.attribute}» cita una escena que ya no existe.`});
  else if(f.sceneId&&f.evidence.trim()&&!normFact(sceneById.get(f.sceneId)?.content||'').includes(normFact(f.evidence)))findings.push({type:'evidence',severity:'review',ids:[f.id],title:'Cita no encontrada',detail:`La evidencia registrada para «${f.subject} · ${f.attribute}» no aparece literalmente en la escena vinculada. Puede haber cambiado el texto.`});
 }
 for(const group of groups.values())for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
  const a=group[i],b=group[j];if(equivalentValue(a.value,b.value,a.attribute))continue;
  const result=compareContext(a,b);if(!result.compare)continue;
  findings.push({type:'conflict',severity:result.severity,ids:[a.id,b.id],title:result.severity==='warning'?'Posibles hechos incompatibles':'Revisar coherencia y contexto',detail:`${a.subject} / ${a.attribute}: «${a.value}» frente a «${b.value}». ${result.explanation} La novela puede justificar ambas afirmaciones; comprueba las evidencias.`,evidence:[a,b].map(f=>({value:f.value,scope:f.scope,quote:f.evidence,sceneId:f.sceneId}))});
 }
 return findings;
}
export function verifyFactBackup(data){
 if(data.facts===undefined)return true;
 if(!Array.isArray(data.facts)||data.facts.length>30000)throw Error('Colección de hechos inválida');
 const projects=new Set(data.projects.map(x=>x.id)),scenes=new Map(data.scenes.map(x=>[x.id,x])),seen=new Set();
 for(const f of data.facts){validateFact(f);if(seen.has(f.id)||!projects.has(f.projectId)||f.sceneId&&scenes.get(f.sceneId)?.projectId!==f.projectId)throw Error('Hecho huérfano o duplicado');seen.add(f.id)}
 return true;
}
export function remapFacts(source,copy){const p=new Map(source.projects.map((x,i)=>[x.id,copy.projects[i].id])),s=new Map(source.scenes.map((x,i)=>[x.id,copy.scenes[i].id]));copy.facts=(source.facts||[]).map(f=>({...f,id:crypto.randomUUID(),projectId:p.get(f.projectId),sceneId:f.sceneId?s.get(f.sceneId):''}));return copy}

// Stable key for review state; changing evidence or result makes it a new alert.
export function findingKey(f){
 const canonical=JSON.stringify([f.type,[...(f.ids||[])].sort(),f.detail,(f.evidence||[]).map(e=>[e.scope,e.quote,e.sceneId])]);
 let hash=2166136261;for(let i=0;i<canonical.length;i++){hash^=canonical.charCodeAt(i);hash=Math.imul(hash,16777619)}
 return (hash>>>0).toString(36);
}
