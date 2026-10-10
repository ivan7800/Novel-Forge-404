/* Plain script: works even when ES modules cannot load. */
(function () {
  'use strict';
  const issues=[];
  const append=(msg)=>{if(!issues.includes(msg))issues.push(msg);};
  window.addEventListener('error', e=>{if(e.message)append(e.message);});
  window.addEventListener('unhandledrejection', e=>append(String(e.reason?.message || e.reason || 'Promesa rechazada')));
  const diag=()=>{
    if(document.getElementById('startupDiagnostics'))return;
    const panel=document.createElement('aside'); panel.id='startupDiagnostics';panel.setAttribute('role','alert');
    panel.style.cssText='position:fixed;inset:auto 12px 12px 12px;z-index:2147483647;background:#21131a;color:#fff;border:2px solid #ff6800;border-radius:12px;padding:18px;box-shadow:0 12px 45px #000a;font:15px/1.5 system-ui,sans-serif;max-height:70vh;overflow:auto';
    const heading=document.createElement('strong');heading.textContent='STORYVERSE 404 · Error de inicio';panel.append(heading);
    const p=document.createElement('p');p.textContent=location.protocol==='file:'?'La aplicación se ha abierto como archivo local (file://). Los módulos JavaScript no se cargan correctamente de este modo. Extrae el ZIP y ejecuta INICIAR_STORYVERSE.bat; entra en http://127.0.0.1:8765/ .':'No se ha podido iniciar JavaScript o IndexedDB. Comprueba los errores de consola (F12), la caché y la carga de módulos.';panel.append(p);
    const log=document.createElement('pre');log.style.cssText='white-space:pre-wrap;word-break:break-word;font-size:12px';log.textContent=[window.__storyverseBootError,window.__storyverseDbError,...issues].filter(Boolean).slice(0,6).join('\n');panel.append(log);
    const copy=document.createElement('button');copy.type='button';copy.textContent='Copiar diagnóstico';copy.style.cssText='background:#ff6800;color:#111;padding:8px 14px;border:0;border-radius:8px;cursor:pointer';copy.addEventListener('click',()=>navigator.clipboard?.writeText(location.href+'\n'+log.textContent).catch(()=>{}));panel.append(copy);
    document.body.append(panel);
  };
  window.addEventListener('storyverse-failed',diag);
  window.addEventListener('storyverse-db-failed',diag);
  window.addEventListener('storyverse-ready',()=>{document.getElementById('startupDiagnostics')?.remove()});
  setTimeout(()=>{if(window.__storyverseBoot!=='ready'||window.__storyverseDbReady===false)diag()},3500);
})();
