// Conservative offline extraction: explicit textual patterns only; every candidate needs author approval.
import {normFact} from './intelligence.js';
const PERSON=String.raw`([A-ZÁÉÍÓÚÜÑ][\p{L}]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}]+){0,2})`;
const PLACE=String.raw`([A-ZÁÉÍÓÚÜÑ][\p{L}]+(?:\s+(?:de|del|la|las|los|el|[A-ZÁÉÍÓÚÜÑ][\p{L}]+)){0,4})`;
const RULES=[
 {attribute:'Edad',rx:new RegExp(String.raw`\b${PERSON}\s+(?:tiene|tenía|tenia|contaba con)\s+(\d{1,3})\s+años\b`,'giu'),convert:m=>`${m[2]} años`},
 {attribute:'Lugar de nacimiento',rx:new RegExp(String.raw`\b${PERSON}\s+naci[oó]\s+en\s+${PLACE}(?=[.,;:!?]|\s+(?:en|cuando|pero|y|donde|antes|después)|$)`,'giu'),convert:m=>m[2]},
 {attribute:'Residencia',rx:new RegExp(String.raw`\b${PERSON}\s+(?:vive|vivía|vivia|reside|residía|residia)\s+en\s+${PLACE}(?=[.,;:!?]|\s+(?:en|cuando|pero|y|donde|antes|después)|$)`,'giu'),convert:m=>m[2]},
 {attribute:'Estado vital',rx:new RegExp(String.raw`\b${PERSON}\s+(está vivo|está viva|estaba vivo|estaba viva|ha muerto|murió|murio)\b`,'giu'),convert:m=>/muert|muri[oó]/i.test(m[2])?'muerto/a':'vivo/a'},
];
const STOP=new Set(['El','La','Los','Las','Un','Una','En','Cuando','Entonces','Pero','Mientras','Ella','Él','Esta','Este','Aquel','Aquella','Después','Antes','Allí','Aquí']);
function sentences(text){return String(text||'').match(/[^.!?\n]+[.!?]?/gu)||[]}
export function extractCandidates(scenes,{maxCandidates=250}={}){
 const result=[],seen=new Set();
 for(const scene of scenes){
  if(!scene?.id||!scene?.projectId)continue;
  const scope=String(scene.storyDate||'').trim().slice(0,160);
  for(const segment of sentences(scene.content)){
   const quote=segment.trim();if(!quote||quote.length>1500)continue;
   for(const rule of RULES){rule.rx.lastIndex=0;let m;
    while((m=rule.rx.exec(quote))!==null){
     const subject=m[1].trim(),value=String(rule.convert(m)).trim();
     if(STOP.has(subject.split(' ')[0])||!value||value.length>240)continue;
     const key=[scene.id,normFact(subject),normFact(rule.attribute),normFact(value),normFact(quote)].join('|');
     if(seen.has(key))continue;seen.add(key);
     result.push({projectId:scene.projectId,sceneId:scene.id,subject,attribute:rule.attribute,value,scope,evidence:quote,origin:'extracted',confidence:'heuristic'});
     if(result.length>=maxCandidates)return result;
    }
   }
  }
 }
 return result;
}
export function newCandidates(candidates,facts){const registered=new Set(facts.map(f=>[f.sceneId,normFact(f.subject),normFact(f.attribute),normFact(f.value),normFact(f.evidence)].join('|')));return candidates.filter(f=>!registered.has([f.sceneId,normFact(f.subject),normFact(f.attribute),normFact(f.value),normFact(f.evidence)].join('|')))}
