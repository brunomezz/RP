"""Personal launcher in Chromium, local only; real D1/R2 and fictitious roles."""
import os, tempfile, subprocess, uuid, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parent.parent
data=tempfile.mkdtemp(prefix='RP browser pessoal ')
proc=None
try:
    proc=subprocess.Popen(['node','scripts/local-launcher.mjs','--no-browser'],cwd=root,env={**os.environ,'FES_DEV_DATA_DIR':str(Path(data)/'data'),'PORT':'0'},stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    while True:
        line=proc.stdout.readline()
        if line.startswith('RP_READY '):url=line.strip().split(' ',1)[1];break
        if not line:raise RuntimeError(proc.stderr.read())
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=os.environ.get('FES_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url);expect(page.locator('#identity')).to_contain_text('Administrador')
        expect(page.locator('#dev-access')).to_contain_text('TESTE PESSOAL')
        expect(page.locator('#dev-persona')).to_have_value('admin')
        page.locator('#dev-persona').select_option('user1');page.locator('#dev-login').click()
        expect(page.locator('#identity')).to_contain_text('Almoxarifado');expect(page.locator('#dev-persona')).to_have_value('user1')
        page.get_by_role('button',name='Nova solicitação').click();page.locator('#form-work').select_option('ELYSIUM')
        tag='Teste pessoal '+uuid.uuid4().hex[:8]
        page.locator('[name=purpose]').fill(tag);page.locator('[data-field=qty]').fill('3')
        page.locator('[data-field=neededDate]').fill('2026-11-10');page.locator('[data-field=location]').fill('Torre A');page.locator('[data-field=service]').select_option('alvenaria')
        page.get_by_role('button',name='Enviar à engenharia',exact=True).click();expect(page.locator('#dialog-content')).to_contain_text(tag)
        page.locator('#dev-persona').select_option('user2');page.locator('#dev-login').click()
        expect(page.locator('#identity')).to_contain_text('Engenharia');expect(page.locator('#dev-persona')).to_have_value('user2')
        page.goto(url+'/#solicitacoes');expect(page.locator('#content')).to_contain_text(tag)
        page.reload();expect(page.locator('#dev-persona')).to_have_value('user2')
        assert not errors,errors
        browser.close()
    proc.stdin.write('stop\n');proc.stdin.flush();assert proc.wait(timeout=20)==0
    print('PASS: entrada automática como Admin, faixa pessoal, troca de cargos, solicitação e consulta pela interface, cargo mantido ao recarregar, sem erros JavaScript.')
finally:
    if proc and proc.poll() is None:
        proc.stdin.write('stop\n');proc.stdin.flush();proc.wait(timeout=20)
    shutil.rmtree(data)
