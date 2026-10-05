"""Local D1/R2 browser flow. Mail transport is simulated; no real email is delivered."""
import os,uuid,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
url='http://127.0.0.1:'+os.environ.get('PORT','3010')
tag='Comunicação '+uuid.uuid4().hex[:8]
file=Path('/tmp/fes-browser-communication.pdf')
source="""import {PDFDocument,StandardFonts} from 'pdf-lib';import {writeFileSync} from 'node:fs';const d=await PDFDocument.create(),f=await d.embedFont(StandardFonts.Helvetica),p=d.addPage();const lines=JSON.parse(process.argv[1]);lines.forEach((l,n)=>p.drawText(l,{x:40,y:780-n*20,font:f,size:12}));writeFileSync(process.argv[2],await d.save());"""
import json
subprocess.run(['node','--input-type=module','-e',source,json.dumps(['Finalidade: '+tag,'Fornecedor: '+tag+' fornecedor','Bloco · catálogo de teste ; 2 ; un ; 12,50']),str(file)],check=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('FES_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
    errors=[]
    def login(persona):
        page=browser.new_context(viewport={'width':1440,'height':1100}).new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url);page.locator('#dev-persona').select_option(persona);page.locator('#dev-login').click();page.wait_for_function("document.querySelector('#identity').textContent.startsWith('Teste')")
        return page
    def done(page):page.wait_for_function("document.body.getAttribute('aria-busy') !== 'true'")
    def view(page,name,heading):
        if page.locator('#dialog').evaluate('(d)=>d.open'):page.locator('.dialog-head [data-action="close"]').click()
        page.goto(url+'/#'+name);expect(page.get_by_role('heading',name=heading,exact=True)).to_be_visible();done(page)
        page.locator('#refresh').click();done(page)
    admin=login('admin');view(admin,'seguranca','Segurança');admin.locator('#security-user').select_option('test-engineer');form=admin.locator('#security-user-form');form.locator('[name="email"]').fill('engineer@example.test');form.locator('[name="reason"]').fill('E-mail fictício para teste do envio');form.get_by_role('button',name='Salvar usuário').click();done(admin)
    a=login('user1');e=login('user2');s=login('procurement')
    view(a,'documentos','Importar PDFs');a.locator('#document-file').set_input_files(str(file));a.get_by_role('button',name='Importar e extrair texto').click()
    expect(a.locator('.pdf-text')).to_have_value(__import__('re').compile(tag));expect(a.locator('#dialog-content')).to_contain_text('Itens sugeridos');expect(a.locator('#dialog-content')).to_contain_text('12.5')
    # Upload alone has not created a business record.
    assert not any(r['purpose']==tag for r in a.request.get(url+'/api/state').json()['requests'])
    a.get_by_role('button',name='Revisar e criar solicitação').click();expect(a.locator('[name="purpose"]')).to_have_value(tag);expect(a.locator('[data-field="material"]')).to_have_value('bloco');expect(a.locator('[data-field="qty"]')).to_have_value('2')
    a.locator('[data-field="neededDate"]').fill('2026-11-10');a.locator('[data-field="location"]').fill('Torre A');a.locator('[data-field="service"]').select_option('alvenaria');a.get_by_role('button',name='Enviar à engenharia').click();expect(a.locator('#dialog-content')).to_contain_text('Aguardando engenharia');expect(a.locator('#dialog-content')).to_contain_text('Origem em documento PDF')
    rid=next(r['id'] for r in a.request.get(url+'/api/state').json()['requests'] if r['purpose']==tag)
    view(e,'notificacoes','Notificações');expect(e.locator('#content')).to_contain_text(rid);notice=e.locator('.notice').filter(has_text=rid).first;notice.get_by_role('button',name='Marcar como lida').click();done(e)
    assert any(n['record_id']==rid and n['read_at'] for n in e.request.get(url+'/api/notifications').json()['items'])
    # Another collaborator's unread flag is independent.
    assert any(n['record_id']==rid and n['read_at'] is None for n in s.request.get(url+'/api/notifications').json()['items'])
    view(e,'solicitacoes','Solicitações');e.locator('[data-action="request"][data-id="'+rid+'"]').click();e.get_by_role('button',name='Aprovar necessidade').click();expect(e.locator('#dialog-content')).to_contain_text('Em cotação')
    view(a,'central-relatorios','Central de relatórios');form=a.locator('#stage-report-form');form.locator('[name="query"]').fill(tag);form.get_by_role('button',name='Gerar relatório',exact=True).click();expect(a.locator('#report-preview')).to_contain_text(tag)
    with a.expect_download() as download:a.get_by_role('button',name='Exportar PDF',exact=True).click()
    assert Path(download.value.path()).read_bytes().startswith(b'%PDF-')
    assert a.request.get(url+'/api/reports/options').json()['emailConfigured'],'Start this test server with FES_TEST_MAIL=1 (simulated mail).'
    a.locator('#report-recipient').select_option('test-engineer');a.locator('#report-mail-form [name="message"]').fill('Mensagem fictícia');a.get_by_role('button',name='Enviar relatório por e-mail').click();expect(a.locator('#content')).to_contain_text('Aceito pelo serviço')
    view(e,'notificacoes','Notificações');expect(e.locator('#content')).to_contain_text('Relatório encaminhado por e-mail')
    # All eleven report choices can be previewed by the interface.
    view(a,'central-relatorios','Central de relatórios')
    for stage in ['solicitacoes','engenharia','cotacoes','aprovacoes','pedidos','recebimentos','contratos','medicoes','estoque','movimentos','orcamento']:
        a.locator('#stage-report-form [name="stage"]').select_option(stage);a.locator('#stage-report-form [name="query"]').fill('');a.get_by_role('button',name='Gerar relatório',exact=True).click();done(a);expect(a.locator('#report-pdf')).to_be_enabled()
    # The same source is recognized, rather than creating a second document/cadastro.
    view(a,'documentos','Importar PDFs');a.locator('#document-file').set_input_files(str(file));a.get_by_role('button',name='Importar e extrair texto').click();expect(a.locator('#dialog-content')).to_contain_text('Cadastro confirmado');expect(a.get_by_role('button',name='Revisar e criar solicitação')).to_have_count(0)
    with a.expect_download() as original:a.get_by_role('button',name='Baixar PDF original').click()
    assert Path(original.value.path()).read_bytes()==file.read_bytes()
    a.get_by_role('button',name='Visualizar PDF',exact=True).click()
    expect(a.get_by_role('link',name='Abrir PDF original')).to_be_visible()
    with a.expect_popup() as popup:a.get_by_role('link',name='Abrir PDF original').click()
    popup.value.wait_for_load_state();assert popup.value.url.startswith('blob:');popup.value.close()
    # A second document can fill a proposal after explicit review.
    second=Path('/tmp/fes-browser-quote.pdf');subprocess.run(['node','--input-type=module','-e',source,json.dumps(['Fornecedor: '+tag+' fornecedor','Bloco · catálogo de teste ; 2 ; un ; 13,75']),str(second)],check=True)
    view(s,'documentos','Importar PDFs');s.locator('#document-file').set_input_files(str(second));s.get_by_role('button',name='Importar e extrair texto').click();expect(s.locator('#document-quote-request')).to_be_visible();s.locator('#document-quote-request').select_option(rid);s.get_by_role('button',name='Revisar e cadastrar proposta').click();expect(s.locator('[name="supplier"]')).to_have_value(tag+' fornecedor');expect(s.locator('[name="price-0"]')).to_have_value('13.75');s.get_by_role('button',name='Salvar proposta',exact=True).click();expect(s.locator('.quote-card')).to_have_count(1)
    assert not errors,errors
    browser.close()
print('PASS: importação e extração reais; revisão explícita de solicitação/proposta; deduplicação; PDF/download; 11 etapas; notificações e leitura isolada; envio de e-mail simulado.')
