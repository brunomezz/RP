"""Browser acceptance test against the LOCAL dev server, never a production URL."""
import os, json, uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
url='http://127.0.0.1:'+os.environ.get('PORT','3010')
purpose='Teste compartilhado '+str(uuid.uuid4())[:8]
attachment={'name':'cotacao-teste.txt','mimeType':'text/plain','buffer':b'Arquivo compartilhado de teste'}
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path=os.environ.get('FES_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
    pages={}; errors=[]
    for persona in ['user1','user2','procurement','director','restricted']:
        ctx=b.new_context(viewport={'width':1440,'height':1000})
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url);page.locator('#dev-persona').select_option(persona)
        page.locator('#dev-login').click()
        expect(page.locator('#identity')).not_to_have_text('Conectando…')
        pages[persona]=page
    a,e,s,d,x=[pages[k] for k in ['user1','user2','procurement','director','restricted']]
    # Old local browser data are ignored and never submitted by shared app.
    a.evaluate("localStorage.setItem('fes-prototype-v1',JSON.stringify({version:1,requests:[{id:'LOCAL-ONLY',purpose:'Não importar'}]}))")
    a.reload();expect(a.locator('#identity')).not_to_have_text('Conectando…')
    assert 'LOCAL-ONLY' not in a.request.get(url+'/api/state').text()
    a.get_by_role('button',name='Nova solicitação').click()
    a.locator('[name="purpose"]').fill(purpose)
    a.locator('[data-field="qty"]').fill('10')
    a.locator('[data-field="neededDate"]').fill('2026-11-10')
    a.locator('[data-field="location"]').fill('Torre A · 1º andar')
    a.locator('[data-field="service"]').select_option('alvenaria')
    a.get_by_role('button',name='Enviar à engenharia',exact=True).click()
    expect(a.locator('#dialog-content')).to_contain_text(purpose)
    rid=a.locator('.dialog-head h2').inner_text().split(' · ')[0]
    assert a.locator('[data-action="approve-engineering"]').is_hidden()
    assert a.locator('[name="requester"]').count()==0
    e.get_by_role('button',name='Atualizar',exact=True).click()
    expect(e.locator('#content')).to_contain_text(purpose)
    e.locator('[data-action="request"][data-id="'+rid+'"]').click()
    e.get_by_role('button',name='Aprovar necessidade').click()
    expect(e.locator('#dialog-content')).to_contain_text('Em cotação')
    s.get_by_role('button',name='Atualizar',exact=True).click()
    s.locator('[data-group="Compras"]').click() if not s.locator('a[href="#cotacoes"]').is_visible() else None
    s.locator('a[href="#cotacoes"]').click()
    expect(s.locator('#content')).to_contain_text(purpose)
    s.locator('[data-action="request"][data-id="'+rid+'"]').click()
    s.get_by_role('button',name='Abrir comparativo').click()
    s.get_by_role('button',name='Adicionar proposta').click()
    s.locator('[name="supplier"]').fill('Fornecedor '+purpose)
    s.locator('[name="price-0"]').fill('12')
    s.locator('#quote-files').set_input_files(attachment)
    s.get_by_role('button',name='Salvar proposta').click()
    expect(s.locator('.quote-card')).to_have_count(1)
    s.locator('[data-action="select-quote"]').click()
    expect(s.locator('[data-allocation="0"]')).not_to_have_value('')
    s.locator('#exception').fill('Fornecedor único neste teste')
    s.get_by_role('button',name='Enviar ao diretor').click()
    expect(s.locator('#dialog-content')).to_contain_text('Aguardando diretor')
    d.get_by_role('button',name='Atualizar',exact=True).click()
    d.locator('[data-action="request"][data-id="'+rid+'"]').click()
    with d.expect_download() as down:d.get_by_role('button',name='cotacao-teste.txt',exact=False).click()
    assert Path(down.value.path()).read_bytes()==attachment['buffer']
    ids=d.locator('[data-decision="0"] option').evaluate_all('(nodes)=>nodes.slice(1).map(n=>n.value)')
    d.locator('[data-decision="0"]').select_option(ids[0])
    d.locator('[data-arrival="0"]').fill('2026-11-09')
    d.get_by_role('button',name='Aprovar e emitir').click()
    expect(d.locator('#dialog-content')).to_contain_text('Pedido emitido')
    a.get_by_role('button',name='Fechar',exact=True).first.click()
    a.locator('a[href="#pedidos"]').click()
    expect(a.locator('#content')).to_contain_text('Fornecedor '+purpose)
    order=a.request.get(url+'/api/state').json()['orders'][-1]
    a.locator('[data-action="order"][data-id="'+order['id']+'"]').click()
    a.locator('[name="qty-0"]').fill('4');a.locator('[name="nf"]').fill('NF-'+purpose)
    a.locator('#receipt-files').set_input_files({'name':'nf-teste.txt','mimeType':'text/plain','buffer':b'NF de teste'})
    a.get_by_role('button',name='Registrar recebimento').click()
    expect(a.locator('#dialog-content')).to_contain_text('NF-'+purpose)
    e.get_by_role('button',name='Fechar',exact=True).first.click();e.locator('a[href="#pedidos"]').click()
    expect(e.locator('#content')).to_contain_text('Parcial')
    e.locator('[data-action="order"][data-id="'+order['id']+'"]').click()
    assert e.get_by_role('button',name='Registrar recebimento').is_disabled()
    with e.expect_download() as down:e.get_by_role('button',name='nf-teste.txt',exact=False).click()
    assert Path(down.value.path()).read_bytes()==b'NF de teste'
    x.get_by_role('button',name='Atualizar',exact=True).click()
    expect(x.locator('#content')).not_to_contain_text(purpose)
    state=a.request.get(url+'/api/state').json()
    r=next(r for r in state['requests'] if r['id']==rid)
    assert {h['actorId'] for h in r['history']}=={'test-almox','test-engineer','test-procurement','test-director'}
    assert json.loads(a.evaluate("localStorage.getItem('fes-prototype-v1')"))['requests'][0]['id']=='LOCAL-ONLY'
    assert not errors,errors
    a.get_by_role('button',name='Fechar',exact=True).first.click()
    a.screenshot(path='/tmp/fes-shared-browser.png',full_page=True)
    b.close()
print('PASS: cinco sessões isoladas; criação/aprovação/cotação/decisão/recebimento pela UI; anexos entre usuários; permissões; autoria; dados locais preservados.')
