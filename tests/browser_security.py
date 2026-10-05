"""Real local administration and access recovery. No mocked permission grants."""
import os, uuid
from playwright.sync_api import sync_playwright, expect
url='http://127.0.0.1:'+os.environ.get('PORT','3010')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('FES_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
    errors=[]
    def login(persona):
        page=browser.new_context(viewport={'width':1440,'height':1100}).new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url);page.locator('#dev-persona').select_option(persona);page.locator('#dev-login').click();return page
    def done(page):page.wait_for_function("document.body.getAttribute('aria-busy') !== 'true'")
    def select_user(user_id):
        admin.locator('#security-user').select_option(user_id)
        return admin.locator('#security-user-form')
    def save_user(form,reason):
        form.locator('[name="reason"]').fill(reason);form.get_by_role('button',name='Salvar acesso do usuário').click();done(admin)
        expect(admin.locator('#toast')).to_have_text('Configuração de segurança salva.')
    admin=login('admin');expect(admin.get_by_role('heading',name='Bem-vindo ao ERP')).to_be_visible()
    admin.get_by_role('link',name='Abrir Segurança').click();expect(admin.get_by_role('heading',name='Segurança',exact=True)).to_be_visible()
    expect(admin.locator('#list-search')).to_have_count(0);expect(admin.locator('#work')).to_be_disabled()
    pending=login('unassigned');expect(pending.get_by_role('heading',name='Acesso ao ERP pendente')).to_be_visible();expect(pending.locator('#content')).to_contain_text('test-unassigned')
    assert pending.request.get(url+'/api/security').status==403
    admin.locator('#refresh').click();done(admin)
    form=select_user('test-unassigned')
    form.locator('fieldset').filter(has=admin.locator('legend',has_text='ELYSIUM')).get_by_label('Almoxarifado',exact=True).check()
    save_user(form,'Liberar acesso pela interface')
    pending.get_by_role('button',name='Verificar acesso').click();expect(pending.get_by_role('heading',name='Painel de suprimentos')).to_be_visible();expect(pending.get_by_role('button',name='Nova solicitação')).to_be_visible()
    expect(pending.get_by_role('link',name='Segurança',exact=True)).to_have_count(0)
    engineer=login('user2');expect(engineer.get_by_role('heading',name='Painel de suprimentos')).to_be_visible();expect(engineer.get_by_role('button',name='Nova solicitação')).to_be_visible();expect(engineer.get_by_role('button',name='Nova solicitação')).to_be_disabled()
    admin.locator('#security-role').select_option('engenharia');role=admin.locator('#security-role-form');role.get_by_label('Criar solicitações',exact=True).check();role.locator('[name="reason"]').fill('Autorizar criação para engenharia no teste');role.get_by_role('button',name='Salvar poderes do cargo').click();done(admin)
    engineer.locator('#refresh').click();expect(engineer.get_by_role('button',name='Nova solicitação')).to_be_visible()
    # Revoke it, keeping the engineer's page open; the direct API must already deny.
    admin.locator('#security-role').select_option('engenharia');role=admin.locator('#security-role-form');role.get_by_label('Criar solicitações',exact=True).uncheck();role.locator('[name="reason"]').fill('Restaurar poderes originais');role.get_by_role('button',name='Salvar poderes do cargo').click();done(admin)
    response=engineer.request.post(url+'/api/commands',headers={'Idempotency-Key':str(uuid.uuid4())},data={'action':'create','work':'ELYSIUM','purpose':'Bloqueado','items':[]});assert response.status==403
    engineer.locator('#refresh').click();expect(engineer.get_by_role('button',name='Nova solicitação')).to_be_visible();expect(engineer.get_by_role('button',name='Nova solicitação')).to_be_disabled()
    form=select_user('test-unassigned');form.get_by_label('Suspender acesso ao ERP').check();save_user(form,'Suspender durante teste')
    pending.locator('#refresh').click();expect(pending.get_by_role('heading',name='Acesso suspenso')).to_be_visible();expect(pending.locator('#nav')).to_be_empty()
    form=select_user('test-unassigned');form.get_by_label('Suspender acesso ao ERP').uncheck();save_user(form,'Reativar durante teste')
    pending.get_by_role('button',name='Tentar novamente').click();expect(pending.get_by_role('heading',name='Painel de suprimentos')).to_be_visible()
    form=select_user('test-admin');form.get_by_label('Administrador de segurança').uncheck();form.locator('[name="reason"]').fill('Tentativa de remover o último administrador');form.get_by_role('button',name='Salvar acesso do usuário').click();expect(admin.locator('#security-error')).to_contain_text('pelo menos um administrador')
    work='TEST_'+uuid.uuid4().hex[:8];form=admin.locator('#security-work-form');form.locator('[name="workId"]').fill(work);form.locator('[name="name"]').fill('Obra de teste da segurança');form.locator('[name="reason"]').fill('Cadastro pela interface');form.get_by_role('button',name='Cadastrar obra').click();done(admin);expect(admin.locator('#content')).to_contain_text('Cadastro pela interface')
    expect(admin.locator('#content')).to_contain_text('Teste · Administrador');expect(admin.locator('#content')).to_contain_text('Restaurar poderes originais')
    # Return the fixture to pending for the access regression and repeatable runs.
    form=select_user('test-unassigned')
    for checkbox in form.locator('[name="membership"]').all():checkbox.uncheck()
    save_user(form,'Encerrar teste e restaurar acesso pendente')
    assert not errors,errors
    browser.close()
print('PASS: Segurança; liberação real sem recarregar; poderes por cargo; API após revogação; suspensão e reativação; último admin; obra; histórico.')
