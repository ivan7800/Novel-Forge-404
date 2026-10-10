// Explicit opt-in local LLM adapter. No cloud endpoints, no automatic writes.
const MAX_RESPONSE=90000;
export function validateLocalEndpoint(input){
 const url=new URL(String(input));
 if(url.username||url.password||url.search||url.hash)throw Error('La dirección local no debe contener credenciales ni parámetros');
 const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,'');
 if(!['localhost','127.0.0.1','::1'].includes(host))throw Error('Solo se permiten servicios de IA en este equipo (localhost / 127.0.0.1)');
 if(!['http:','https:'].includes(url.protocol))throw Error('Protocolo no permitido');
 if(!/^\/?(?:api\/generate)?\/?$/.test(url.pathname))throw Error('Usa la URL base del servidor local, sin rutas adicionales');
 url.pathname='/api/generate';return url.toString();
}
export function parseLocalSuggestions(payload,scene){
 let data=payload;
 if(typeof data==='string'){
  const stripped=data.trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
  data=JSON.parse(stripped);
 }
 const values=Array.isArray(data)?data:data?.facts;
 if(!Array.isArray(values)||values.length>40)throw Error('La IA devolvió una estructura de hechos inválida');
 const out=[];
 for(const v of values){
  if(!v||typeof v!=='object')continue;
  const subject=String(v.subject||'').trim().slice(0,160),attribute=String(v.attribute||'').trim().slice(0,160),value=String(v.value||'').trim().slice(0,240),evidence=String(v.evidence||'').trim().slice(0,1500);
  if(!subject||!attribute||!value||!evidence||!String(scene.content||'').includes(evidence))continue;
  out.push({projectId:scene.projectId,sceneId:scene.id,subject,attribute,value,scope:String(scene.storyDate||'').slice(0,160),evidence,origin:'local-ai',confidence:'unverified'});
 }
 return out;
}
export async function proposeWithLocalAI(scene,{endpoint='http://127.0.0.1:11434',model='llama3.2',signal,fetchImpl=fetch}={}){
 const uri=validateLocalEndpoint(endpoint);
 if(!/^[\w.:/-]{1,120}$/.test(model))throw Error('Nombre de modelo no válido');
 if(String(scene.content||'').length>12000)throw Error('Escena demasiado larga: divide el análisis en fragmentos de hasta 12 000 caracteres');
 const prompt=`Analiza SOLO el texto de ficción proporcionado. Extrae afirmaciones explícitas y verificables sobre personajes, lugares y objetos. No deduzcas, no inventes y omite metáforas, hipótesis, diálogos dudosos y hechos temporales ambiguos. Devuelve exclusivamente JSON con {"facts":[{"subject":"","attribute":"","value":"","evidence":""}]}. evidence debe ser una cita LITERAL exacta y contigua del texto. Máximo 20 hechos. Texto:\n<manuscrito>\n${scene.content||''}\n</manuscrito>`;
 const response=await fetchImpl(uri,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,format:'json',prompt,options:{temperature:0}}),signal});
 if(!response.ok)throw Error(`IA local: HTTP ${response.status}. Comprueba Ollama, modelo y permisos CORS.`);
 const body=await response.text();if(body.length>MAX_RESPONSE)throw Error('Respuesta del modelo demasiado grande');
 const outer=JSON.parse(body);return parseLocalSuggestions(outer.response,scene);
}
