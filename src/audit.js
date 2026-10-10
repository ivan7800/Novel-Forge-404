import {wordCount,sortPositions} from './model.js';
const round=n=>Math.round(n*10)/10;
const finding=(code,severity,title,detail,ref='')=>({code,severity,title,detail,ref});
const lexemes=text=>(text.toLocaleLowerCase('es').match(/[\p{L}]{4,}/gu)||[]);
const stop=new Set('para como pero esta este estos estas sobre entre desde hasta donde cuando porque aunque luego antes despues mientras habia habia tenido tiene fueron seria puede deben hacia estos aquellos alguna algunas todo todos cada mismo misma esto aquel aquella también entonces ahora aquí allí además nunca siempre estaba eran cual cuales tener hacer siendo acerca capítulo escena'.normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(' '));
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function analyzeNovel(snapshot,projectId){
 const p=snapshot.projects.find(x=>x.id===projectId);if(!p)throw Error('Novela no encontrada');
 const chapters=snapshot.chapters.filter(x=>x.projectId===projectId).sort(sortPositions);
 const scenes=snapshot.scenes.filter(x=>x.projectId===projectId);
 const characters=(snapshot.characters||[]).filter(x=>x.projectId===projectId);
 const plotlines=(snapshot.plotlines||[]).filter(x=>x.projectId===projectId);
 const links=(snapshot.links||[]).filter(x=>x.projectId===projectId);
 const entries=chapters.flatMap(c=>[c,...scenes.filter(s=>s.chapterId===c.id).sort(sortPositions)]);
 const findings=[];
 const counts=entries.map(e=>({id:e.id,title:e.title||'Sin título',kind:e.chapterId?'Escena':'Capítulo',words:wordCount(e.content||'')}));
 const total=counts.reduce((s,r)=>s+r.words,0);
 const chapterWords=chapters.map(c=>({id:c.id,title:c.title,words:wordCount(c.content||'')+scenes.filter(s=>s.chapterId===c.id).reduce((n,x)=>n+wordCount(x.content||''),0)}));
 if(!chapters.length)findings.push(finding('NO_CHAPTERS','attention','Sin capítulos','La novela todavía no contiene capítulos.'));
 for(const r of counts.filter(x=>x.words===0))findings.push(finding('EMPTY_TEXT','attention',r.kind+' sin texto',`«${r.title}» no tiene manuscrito.`,r.id));
 const positive=chapterWords.filter(x=>x.words>0).map(x=>x.words).sort((a,b)=>a-b);
 const median=positive.length?(positive.length%2?positive[(positive.length-1)/2]:(positive[positive.length/2-1]+positive[positive.length/2])/2):0;
 if(positive.length>=3&&median>=200)for(const c of chapterWords){if(c.words>median*2.5)findings.push(finding('LENGTH_OUTLIER','review','Capítulo considerablemente más largo',`«${c.title}»: ${c.words} palabras frente a mediana de ${median}. No implica necesariamente un problema de ritmo.`,c.id));}
 const linkedCharacters=new Set();for(const l of links){if(l.sourceType==='character'&&l.targetType==='scene')linkedCharacters.add(l.sourceId);if(l.targetType==='character'&&l.sourceType==='scene')linkedCharacters.add(l.targetId)}
 for(const c of characters.filter(x=>!linkedCharacters.has(x.id)))findings.push(finding('CHARACTER_NO_SCENE','review','Personaje sin vínculo a escenas',`«${c.name||'Sin nombre'}» no está vinculado a ninguna escena. Esto no demuestra que no aparezca en el texto.`,c.id));
 for(const t of plotlines){const status=norm(String(t.status||'').toLowerCase().trim());if(!status)findings.push(finding('PLOT_UNCLASSIFIED','info','Trama sin estado',`«${t.title||'Sin título'}» no tiene estado registrado.`,t.id));else if(['abierta','abierto','pendiente','en curso','iniciada','sin resolver'].includes(status))findings.push(finding('PLOT_OPEN','review','Trama registrada como abierta',`«${t.title||'Sin título'}» tiene estado «${t.status}». Comprueba si debe cerrarse antes del desenlace.`,t.id))}
 const ordered=scenes.filter(s=>Number.isFinite(s.storyOrder));const repeats=new Map();for(const s of ordered){const k=s.storyOrder;repeats.set(k,[...(repeats.get(k)||[]),s])}for(const [k,a] of repeats)if(a.length>1)findings.push(finding('SHARED_CHRONOLOGY','info','Orden cronológico compartido',`${a.length} escenas tienen el orden ${k}; puede ser simultaneidad intencionada.`,a[0].id));
 const tokens=lexemes(entries.map(x=>x.content||'').join(' ')).map(norm).filter(w=>!stop.has(w));const frequency=new Map();for(const w of tokens)frequency.set(w,(frequency.get(w)||0)+1);
 const repetition=[...frequency].filter(([word,count])=>count>=8&&count/Math.max(tokens.length,1)>=0.015).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([word,count])=>({word,count,per1000:round(count/Math.max(total,1)*1000)}));
 for(const item of repetition)findings.push(finding('FREQUENT_WORD','info','Palabra frecuente',`«${item.word}» aparece ${item.count} veces (${item.per1000} por 1.000 palabras). Es un indicador estadístico, no una valoración de estilo.`));
 const wordsByScene=scenes.map(s=>({id:s.id,title:s.title,words:wordCount(s.content||'')}));
 return {projectId,projectTitle:p.title,generatedAt:new Date().toISOString(),stats:{chapters:chapters.length,scenes:scenes.length,characters:characters.length,plotlines:plotlines.length,words:total,medianChapterWords:median,linkedCharacters:linkedCharacters.size},chapterWords,wordsByScene,repetition,findings};
}
export function auditMarkdown(report){const lines=[`# Auditoría narrativa · ${report.projectTitle}`,`Fecha: ${report.generatedAt}`,`Palabras: ${report.stats.words} · Capítulos: ${report.stats.chapters} · Escenas: ${report.stats.scenes}`,'','## Observaciones'];for(const f of report.findings)lines.push(`- **${f.severity.toUpperCase()} — ${f.title}:** ${f.detail}`);if(!report.findings.length)lines.push('No se detectaron observaciones con las reglas activas. Esto no garantiza ausencia de errores.');lines.push('','## Extensión por capítulo',...report.chapterWords.map(c=>`- ${c.title}: ${c.words} palabras`),'','> Auditoría heurística, local y orientativa. No detecta contradicciones semánticas ni evalúa calidad literaria.');return lines.join('\n')}
