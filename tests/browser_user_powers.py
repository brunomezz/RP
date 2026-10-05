"""Role assignment and individual allow/deny through the real local UI/API."""
import os,uuid
from playwright.sync_api import sync_playwright,expect
url='http://127.0.0.1:'+os.environ.get('PORT','3010')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('FES_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
    errors=[]
    def login(persona):
        page=browser.new_context(viewport={'width':1366,'height':1000}).new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url);page.locator('#dev-persona').select_option(persona);page.locator('#dev-login').click();page.wait_for_function("document.querySelector('#identity').textContent.startsWith('Teste')");return page
    def done(page):page.wait_for_function("document.body.getAttribute('aria-busy') !== 'true'")
    a=login('admin');e=login('user2');pending=login('unassigned');a.goto(url+'/#seguranca');expect(a.get_by_role('heading',name='Segurança',exact=True)).to_be_visible()
    def user(id):
        a.get_by_role('tab',name='Usuários',exact=True).click();a.locator('#security-user').select_option(id);return a.locator('#security-user-form')
    def save(form):
        form.locator('[name="reason"]').fill('Teste de poderes individuais '+uuid.uuid4().hex[:6]);form.get_by_role('button',name='Salvar usuário',exact=True).click();done(a);expect(a.locator('#toast')).to_have_text('Configuração de segurança salva.')
    f=user('test-engineer');expect(f.locator('#security-user-role')).to_have_value('engenharia');expect(f.locator('.security-person')).to_contain_text('Engenharia')
    f.locator('#security-individual summary').click();f.locator('#security-user-power-work').select_option('ELYSIUM');f.locator('#user-power-create').select_option('allow');expect(f.locator('.security-power-row:has(#user-power-create)')).to_contain_text('Permitido');save(f)
    e.locator('#refresh').click();done(e);expect(e.get_by_role('button',name='Nova solicitação')).to_be_enabled()
    # Role defaults were not changed.
    a.get_by_role('tab',name='Poderes por cargo').click();a.locator('#security-role').select_option('engenharia');expect(a.locator('#security-role-form').get_by_label('Criar solicitações',exact=True)).not_to_be_checked()
    f=user('test-engineer');expect(f.locator('#user-power-create')).to_have_value('allow');f.locator('#user-power-create').select_option('deny');save(f)
    e.locator('#refresh').click();done(e);expect(e.get_by_role('button',name='Nova solicitação')).to_be_disabled()
    assert e.request.post(url+'/api/commands',headers={'Idempotency-Key':str(uuid.uuid4())},data={'action':'create','work':'ELYSIUM','purpose':'Bloqueado','items':[]}).status==403
    f=user('test-engineer');f.locator('#security-reset-powers').click();expect(f.locator('#user-power-create')).to_have_value('inherit');save(f)
    f=user('test-unassigned');f.locator('#security-user-role').select_option('almoxarifado');save(f)
    pending.get_by_role('button',name='Verificar acesso').click();expect(pending.get_by_role('button',name='Nova solicitação')).to_be_enabled();assert not pending.request.get(url+'/api/session').json()['isAdmin']
    f=user('test-unassigned');f.locator('#security-user-role').select_option('admin');expect(f.locator('#security-admin-help')).to_be_visible();expect(f.locator('#security-work-access')).to_be_hidden();save(f)
    pending.locator('#refresh').click();done(pending);assert pending.request.get(url+'/api/session').json()['isAdmin'];assert pending.request.get(url+'/api/security').status==200;pending.locator('#work').select_option('BLEND');expect(pending.get_by_role('button',name='Nova solicitação')).to_be_enabled()
    a.get_by_role('tab',name='Poderes por cargo').click();a.locator('#security-role').select_option('admin');expect(a.locator('#security-role-form')).to_contain_text('todos os poderes');expect(a.locator('#security-role-form [name="permission"]')).to_have_count(0)
    # Restore fixtures, keeping the real designated first Admin.
    f=user('test-unassigned');f.locator('#security-user-role').select_option('almoxarifado')
    f.locator('#security-user-role').select_option('none')
    save(f)
    a.screenshot(path='/tmp/fes-security-users.png',full_page=True)
    assert not errors,errors
    browser.close()
print('PASS: cargo simples; permitir/bloquear individual; herança e cargo intacto; API bloqueada; promoção/demissão explícita de Admin; obras globais e Admin fixo.')
