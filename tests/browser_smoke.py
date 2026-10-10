"""QA visual de STORYVERSE 404. Ejecutar: py -m pip install playwright; py -m playwright install chromium; py tests/browser_smoke.py"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from contextlib import contextmanager
import json, os, socket, sys, time
from functools import partial

ROOT=Path(__file__).resolve().parents[1]
RESULTS=[]
def test(name, fn):
    try:
        fn(); RESULTS.append({'action':name,'status':'PASS','detail':''}); print('PASS',name,flush=True)
    except Exception as e:
        RESULTS.append({'action':name,'status':'FAIL','detail':str(e)[:600]}); print('FAIL',name,str(e)[:200],flush=True)

@contextmanager
def server():
    s=socket.socket();s.bind(('127.0.0.1',0)); port=s.getsockname()[1];s.close()
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    http=ThreadingHTTPServer(('127.0.0.1',port),partial(Quiet,directory=str(ROOT)))
    t=Thread(target=http.serve_forever,daemon=True);t.start()
    try:yield f'http://127.0.0.1:{port}/'
    finally:http.shutdown();http.server_close()

def main():
    try:from playwright.sync_api import sync_playwright
    except ImportError:
        print('Falta Playwright: py -m pip install playwright && py -m playwright install chromium');return 2
    with server() as url, sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True, executable_path="/usr/bin/chromium" if Path("/usr/bin/chromium").exists() else None, args=["--no-sandbox"])
        context=browser.new_context(accept_downloads=True)
        page=context.new_page(); errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.on('dialog',lambda d:d.accept())
        test('Arranque HTTP y módulos',lambda:(page.goto(url,wait_until='load'),page.wait_for_function("window.__storyverseBoot === 'ready' && window.__storyverseDbReady === true",timeout=12000)))
        if not any(r['status']=='PASS' for r in RESULTS):
            print('No se pueden probar controles: el arranque falló');browser.close();return finish()
        def create(kind,title):
            page.locator('#'+kind).click();page.locator('#dialog').wait_for(state='visible');page.locator('#newName').fill(title);page.locator('#entityForm button[value="confirm"]').click();page.locator('#dialog').wait_for(state='hidden');page.wait_for_timeout(200)
        test('Crear novela',lambda:(create('addProject','QA novela'),page.locator('#projects button').filter(has_text='QA novela').wait_for()))
        test('Crear capítulo',lambda:(create('addChapter','QA capítulo'),page.locator('#chapters button').filter(has_text='QA capítulo').wait_for()))
        test('Crear escena',lambda:(create('addScene','QA escena'),page.locator('#scenes button').filter(has_text='QA escena').wait_for()))
        test('Editar escena y autoguardar',lambda:(page.locator('#editor').fill('Bruna tiene 9 años en 1800. Texto de prueba QA.'),page.wait_for_function("document.querySelector('#saveStatus').textContent.includes('Guardado')",timeout=10000)))
        test('Recargar y conservar manuscrito',lambda:(page.reload(),page.wait_for_function("window.__storyverseDbReady === true"),page.locator('#scenes button').filter(has_text='QA escena').click(),page.locator('#editor').input_value().__contains__('Bruna tiene 9 años') or (_ for _ in ()).throw(AssertionError('Contenido no recuperado'))))
        test('Búsqueda del editor',lambda:(page.locator('#findInput').fill('Bruna'),page.locator('#findNext').click(),page.locator('#findStatus').inner_text()))
        test('Modo concentración',lambda:(page.locator('#focusBtn').click(),page.locator('body.focus-mode').wait_for(),page.locator('#focusBtn').click()))
        test('Tema Papel',lambda:(page.locator('#themeSelect').select_option('paper'),page.locator('body[data-theme="paper"]').wait_for()))
        test('Historial: abrir y cerrar',lambda:(page.locator('#historyBtn').click(),page.locator('#historyDialog').wait_for(state='visible'),page.locator('#closeHistory').click(),page.locator('#historyDialog').wait_for(state='hidden')))
        test('Abrir Story Bible',lambda:(page.locator('#tabCharacters').click(),page.locator('#loreWorkspace').wait_for(state='visible')))
        test('Abrir auditoría',lambda:(page.locator('#auditBtn').click(),page.locator('#auditWorkspace').wait_for(state='visible'),page.locator('#runAudit').click(),page.wait_for_timeout(300)))
        test('Volver de auditoría',lambda:(page.locator('#auditBack').click(),page.locator('#workspace').wait_for(state='visible')))
        test('Mapa narrativo',lambda:(page.locator('#graphBtn').click(),page.locator('#graphWorkspace').wait_for(state='visible'),page.locator('#graphBack').click()))
        test('Búsqueda global',lambda:(page.locator('#globalSearchBtn').click(),page.locator('#globalWorkspace').wait_for(state='visible'),page.locator('#globalQuery').fill('Bruna'),page.locator('#globalBack').click()))
        test('Inteligencia narrativa',lambda:(page.locator('#intelligenceBtn').click(),page.locator('#intelligenceWorkspace').wait_for(state='visible'),page.locator('#intelligenceBack').click()))
        test('Papelera',lambda:(page.locator('#trashBtn').click(),page.locator('#trashWorkspace').wait_for(state='visible'),page.locator('#trashBack').click()))
        def export_json():
            with page.expect_download(timeout=10000) as dl:page.locator('#exportBtn').click()
            d=dl.value;assert d.suggested_filename.endswith('.json');p=ROOT/'tests'/'_qa_export_tmp.json';d.save_as(str(p));data=json.loads(p.read_text(encoding='utf-8'));p.unlink();assert data['projects'] and data['chapters'] and data['scenes']
        test('Exportar JSON con novela, capítulo, escena',export_json)
        def export_id(button,extension):
            with page.expect_download(timeout=10000) as dl:page.locator('#'+button).click()
            assert dl.value.suggested_filename.endswith(extension)
        for button,extension in [('mdBtn','.md'),('txtBtn','.txt'),('htmlBtn','.html'),('epubBtn','.epub')]:test('Exportar '+extension,lambda b=button,e=extension:export_id(b,e))
        def delete_restore():
            page.locator('#scenes button').filter(has_text='QA escena').click()
            page.locator('#deleteBtn').click()
            page.locator('#trashBtn').click()
            page.locator('#trashWorkspace').wait_for(state='visible')
            buttons=page.locator('#trashList button')
            assert buttons.count()>0, 'Falta control de restauración'
            buttons.first.click()
            page.wait_for_timeout(300)
            page.locator('#trashBack').click()
            page.locator('#scenes button').filter(has_text='QA escena').wait_for()
        test('Papelera: eliminar y restaurar escena',delete_restore)
        test('Consola sin excepciones JS' ,lambda:(_ for _ in ()).throw(AssertionError(errors)) if errors else None)
        browser.close()
    return finish()

def finish():
    target=ROOT/'QA-BROWSER-RESULTS.json';target.write_text(json.dumps(RESULTS,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Resultados:',target,'PASS:',sum(r['status']=='PASS' for r in RESULTS),'FAIL:',sum(r['status']=='FAIL' for r in RESULTS))
    return 1 if any(r['status']=='FAIL' for r in RESULTS) else 0

if __name__=='__main__':sys.exit(main())
