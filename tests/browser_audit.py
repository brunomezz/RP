"""Sector audit against the LOCAL D1/R2 dev server. Uses only fictitious data."""
import os,uuid,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
url='http://127.0.0.1:'+os.environ.get('PORT','3010')
tag='Auditoria '+uuid.uuid4().hex[:8]
file={'name':'audit.txt','mimeType':'text/plain','buffer':b'Evidencia de auditoria ficticia'}
views={'inicio':'Painel de suprimentos','solicitacoes':'Solicitações','cotacoes':'Cotações','aprovacoes':'Aprovações','pedidos':'Pedidos de compra','recebimentos':'Recebimentos','contratos':'Contratos e medições','medicoes':'Medições de serviços','estoque':'Estoque por obra','movimentos':'Movimentações','cadastros':'Materiais e insumos','fornecedores':'Fornecedores','relatorios':'Acompanhamento operacional','orcamento':'Orçamento'}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('FES_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
    errors=[];pages={}
    for persona in ['user1','user2','procurement','director']:
        page=browser.new_context(viewport={'width':1440,'height':1000}).new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url)
        page.locator('#dev-persona').select_option(persona);page.locator('#dev-login').click()
        expect(page.get_by_role('heading',name='Painel de suprimentos',exact=True)).to_be_visible();pages[persona]=page
    for page in pages.values():page.locator('#work').select_option('ELYSIUM')
    a,e,s,d=[pages[k] for k in ['user1','user2','procurement','director']]
    def close(page):
        if page.locator('#dialog').evaluate('(d)=>d.open'):page.locator('.dialog-head [data-action="close"]').click()
    def view(page,name):
        close(page);page.goto(url+'/#'+name);expect(page.get_by_role('heading',name=views[name],exact=True)).to_be_visible();page.wait_for_function("document.body.getAttribute('aria-busy') !== 'true'");
        with page.expect_response(lambda r:r.url.endswith('/api/state')):page.locator('#refresh').click()
        page.wait_for_function("document.body.getAttribute('aria-busy') !== 'true'")
    def request(page,rid):
        view(page,'solicitacoes');page.locator('[data-action="request"][data-id="'+rid+'"]').click()
    def state(page):return page.request.get(url+'/api/state').json()
    # Empty initial catalog must not crash when almoxarifado opens stock withdrawal.
    empty=state(a);empty['catalog']=[]
    a.route('**/api/state',lambda r:r.fulfill(json=empty));view(a,'estoque');a.get_by_role('button',name='Registrar saída',exact=True).click()
    expect(a.locator('#dialog-content')).to_contain_text('Nenhum material cadastrado');close(a);a.unroute('**/api/state')
    # Global material and supplier registries via the actual forms.
    view(s,'cadastros');s.get_by_role('button',name='Novo material').click();s.locator('[name="name"]').fill(tag+' material');s.locator('[name="unit"]').fill('kg');s.get_by_role('button',name='Cadastrar material').click()
    expect(s.locator('#content')).to_contain_text(tag+' material');mid=next(m['id'] for m in state(s)['catalog'] if m['name']==tag+' material')
    view(s,'fornecedores');s.get_by_role('button',name='Novo fornecedor').click();s.locator('[name="name"]').fill(tag+' fornecedor');s.locator('[name="contact"]').fill('Contato inicial');s.locator('[name="email"]').fill('ficticio@example.test');s.get_by_role('button',name='Salvar fornecedor').click()
    expect(s.locator('#content')).to_contain_text(tag+' fornecedor');sid=next(v['id'] for v in state(s)['suppliers'] if v['name']==tag+' fornecedor')
    s.locator('[data-action="edit-supplier"][data-id="'+sid+'"]').click();s.locator('[name="contact"]').fill('Contato atualizado');s.get_by_role('button',name='Salvar fornecedor').click();expect(s.locator('#content')).to_contain_text('Contato atualizado')
    # Mixed request, return, revision and engineering reapproval.
    view(a,'solicitacoes');a.get_by_role('button',name='Nova solicitação').click();a.locator('[name="purpose"]').fill(tag)
    a.locator('[data-field="material"]').select_option(mid);a.locator('[data-field="qty"]').fill('0.3');a.locator('[data-field="neededDate"]').fill('2026-11-10');a.locator('[data-field="location"]').fill('Torre A');a.locator('[data-field="service"]').select_option('alvenaria')
    a.get_by_role('button',name='Adicionar item').click();a.locator('[data-field="kind"]').nth(1).select_option('service');a.locator('[data-field="name"]').fill(tag+' execução');a.locator('[data-field="qty"]').nth(1).fill('0.3');a.locator('[data-field="neededDate"]').nth(1).fill('2026-11-11');a.locator('[data-field="location"]').nth(1).fill('Torre B');a.locator('[data-field="service"]').nth(1).select_option('alvenaria')
    a.get_by_role('button',name='Enviar à engenharia').click();expect(a.locator('#dialog-content')).to_contain_text('Aguardando engenharia');rid=a.locator('.dialog-head h2').inner_text().split(' · ')[0]
    request(e,rid);e.get_by_role('button',name='Devolver',exact=True).click();e.locator('[name="reason"]').fill('Confirmar escopo');e.get_by_role('button',name='Devolver',exact=True).click();expect(e.locator('#dialog-content')).to_contain_text('Em correção')
    request(a,rid);a.get_by_role('button',name='Editar solicitação').click();a.locator('[name="purpose"]').fill(tag+' revisado');a.get_by_role('button',name='Salvar revisão').click();expect(a.locator('#dialog-content')).to_contain_text('Aguardando engenharia')
    request(e,rid);e.get_by_role('button',name='Aprovar necessidade').click();expect(e.locator('#dialog-content')).to_contain_text('Em cotação')
    request(s,rid);s.get_by_role('button',name='Abrir comparativo').click()
    for n in range(3):
        s.get_by_role('button',name='Adicionar proposta').click();s.locator('[name="supplier"]').fill(tag+' fornecedor'+('' if n==0 else ' '+str(n)));s.locator('[name="price-0"]').fill(str(10+n));s.locator('[name="price-1"]').fill(str(20+n))
        if n==0:s.locator('#quote-files').set_input_files(file)
        s.get_by_role('button',name='Salvar proposta').click();expect(s.locator('.quote-card')).to_have_count(n+1)
        if n==0:
            s.locator('[data-action="select-quote"]').first.click();s.get_by_role('button',name='Enviar ao diretor').click();expect(s.locator('#error')).to_contain_text('três')
            s.locator('[data-action="quote-files"]').first.click();s.locator('#existing-quote-files').set_input_files({'name':'complemento.txt','mimeType':'text/plain','buffer':b'Complemento ficticio'});s.get_by_role('button',name='Salvar anexos',exact=True).click();expect(s.locator('.quote-card')).to_have_count(1)
    s.get_by_role('button',name='Enviar ao diretor').click();expect(s.locator('#dialog-content')).to_contain_text('Aguardando diretor')
    request(d,rid);d.get_by_role('button',name='Aprovar e emitir').click();expect(d.locator('#error')).to_contain_text('data')
    for n in range(2):d.locator('[data-arrival="'+str(n)+'"]').fill('2026-11-10')
    d.get_by_role('button',name='Aprovar e emitir').click();expect(d.locator('#error')).to_contain_text('escolher')
    d.get_by_role('button',name='Devolver a suprimentos').click();d.locator('[name="reason"]').fill('Rever prazo');d.get_by_role('button',name='Devolver',exact=True).click();expect(d.locator('#dialog-content')).to_contain_text('Em cotação')
    request(s,rid);s.get_by_role('button',name='Abrir comparativo').click();s.get_by_role('button',name='Enviar ao diretor').click();expect(s.locator('#dialog-content')).to_contain_text('Aguardando diretor')
    request(d,rid);qid=d.locator('[data-decision="0"] option').nth(2).get_attribute('value')
    for n in range(2):d.locator('[data-decision="'+str(n)+'"]').select_option(qid);d.locator('[data-arrival="'+str(n)+'"]').fill('2026-10-03' if n==0 else '2026-11-11')
    d.get_by_role('button',name='Aprovar e emitir').click();expect(d.locator('#dialog-content')).to_contain_text('Pedido emitido')
    records=state(a);o=next(o for o in records['orders'] if o['requestId']==rid);c=next(c for c in records['contracts'] if c['requestId']==rid)
    assert o['supplier']==tag+' fornecedor 1';assert c['supplier']==o['supplier'];assert len(o['items'])==len(c['items'])==1
    view(s,'recebimentos');s.locator('#list-search').fill(tag);expect(s.locator('#content')).to_contain_text('Atrasado')
    with s.expect_download() as down:s.get_by_role('button',name='Exportar CSV').click()
    assert tag in Path(down.value.path()).read_text(encoding='utf-8-sig')
    # Suprimentos updates arrival and adds order attachments.
    view(s,'pedidos');s.locator('[data-action="order"][data-id="'+o['id']+'"]').click();s.locator('#order-files').set_input_files(file);s.locator('[name="arrival-0"]').fill('2026-11-09');s.get_by_role('button',name='Salvar previsões de chegada').click();s.wait_for_function("document.body.getAttribute('aria-busy') !== 'true'");expect(s.locator('[name="arrival-0"]')).to_have_value('2026-11-09')
    assert s.locator('#order-files').evaluate('(el)=>el.files[0]?.name')=='audit.txt';s.locator('[name="arrival-0"]').fill('2026-11-08');s.get_by_role('button',name='Salvar anexos do pedido').click();expect(s.locator('#dialog-content')).to_contain_text('audit.txt');expect(s.locator('[name="arrival-0"]')).to_have_value('2026-11-08')
    # Partial decimal receipt closes exactly, includes receipt attachments.
    for quantity in ['0.1','0.2']:
        view(a,'pedidos');a.locator('[data-action="order"][data-id="'+o['id']+'"]').click();expect(a.locator('[name="qty-0"]')).to_have_attribute('max','0.3' if quantity=='0.1' else '0.2');a.locator('[name="qty-0"]').fill(quantity);a.locator('[name="nf"]').fill(tag+' NF '+quantity)
        if quantity=='0.1':a.locator('#receipt-files').set_input_files(file)
        a.get_by_role('button',name='Registrar recebimento').click();expect(a.locator('#dialog-content')).to_contain_text(tag+' NF '+quantity)
    expect(a.locator('#dialog-content')).to_contain_text('Entrega completa')
    # Readonly users can still close their contract form normally.
    view(s,'contratos');s.locator('[data-action="contract"][data-id="'+c['id']+'"]').click();expect(s.locator('#measure-form input').first).to_be_disabled();expect(s.locator('#measure-form [data-action="close"]')).to_be_enabled();s.locator('#measure-form [data-action="close"]').click()
    for quantity in ['0.1','0.2']:
        view(e,'medicoes');e.locator('[data-action="contract"][data-id="'+c['id']+'"]').click();e.locator('[name="qty-0"]').fill(quantity);e.locator('[name="period"]').fill(tag+' etapa '+quantity);e.get_by_role('button',name='Registrar medição',exact=True).click();expect(e.locator('#dialog-content')).to_contain_text(tag+' etapa '+quantity)
    for quantity in ['0.1','0.2']:
        view(a,'estoque');a.get_by_role('button',name='Registrar saída',exact=True).click();a.locator('[name="material"]').select_option(mid);a.locator('[name="qty"]').fill(quantity);a.locator('[name="who"]').fill('Retirante fictício');a.locator('[name="service"]').select_option('alvenaria');a.get_by_role('button',name='Registrar saída',exact=True).last.click();expect(a.locator('#dialog')).not_to_be_visible()
    records=state(a);order=next(x for x in records['orders'] if x['id']==o['id']);contract=next(x for x in records['contracts'] if x['id']==c['id'])
    assert order['items'][0]['received']==0.3;assert contract['items'][0]['measured']==0.3
    assert len([m for m in records['movements'] if m['material']==mid])==4
    # All screens, filters, exports and audit with no JavaScript exceptions.
    for name in views:view(s,name)
    view(s,'fornecedores');s.locator('#list-search').fill(tag);expect(s.locator('#content')).to_contain_text('Contato atualizado');s.get_by_role('button',name='Limpar filtros').click();expect(s.locator('#list-search')).to_have_value('')
    view(a,'movimentos');a.locator('#list-search').fill(tag)
    with a.expect_download() as down:a.get_by_role('button',name='Exportar CSV').click()
    assert 'Retirante fictício' in Path(down.value.path()).read_text(encoding='utf-8-sig')
    a.get_by_role('button',name='Histórico',exact=True).click();expect(a.locator('#dialog-content')).to_contain_text('Teste · Engenharia');expect(a.locator('#dialog-content')).to_contain_text('Teste · Diretor')
    assert not errors,errors
    # Material units are stored user text, not executable markup.
    response=s.request.post(url+'/api/commands',headers={'Idempotency-Key':str(uuid.uuid4())},data={'action':'material','work':'ELYSIUM','name':tag+' unidade literal','unit':'<svg/onload=alert(1)>'})
    assert response.status==200
    dialogs=[];s.on('dialog',lambda dialog:(dialogs.append(dialog.message),dialog.dismiss()))
    view(s,'estoque');expect(s.locator('#content')).to_contain_text('<svg/onload=alert(1)>');assert s.locator('#content svg').count()==0
    s.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');assert not dialogs,dialogs
    browser.close()
print('PASS: 14 telas; materiais; fornecedores e edição; solicitação mista; devoluções e revisão; 3 cotações; anexos de proposta/pedido/recebimento; decisão alternativa do diretor; chegada; recebimentos/medições/saídas fracionários; filtros; CSV; histórico; formulário readonly; catálogo vazio.')
