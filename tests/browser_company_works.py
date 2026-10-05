"""One company work registration, visible across users without per-person assignments."""
import os,uuid
from playwright.sync_api import sync_playwright,expect
url='http://127.0.0.1:'+os.environ.get('PORT','3010')
name='Obra compartilhada '+uuid.uuid4().hex[:8]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path=os.environ.get('FES_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
    errors=[]
    def login(persona):
        page=b.new_context(viewport={'width':1366,'height':1000}).new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url);page.locator('#dev-persona').select_option(persona);page.locator('#dev-login').click();page.wait_for_function("document.querySelector('#identity').textContent.startsWith('Teste')");return page
    def done(page):page.wait_for_function("document.body.getAttribute('aria-busy') !== 'true'")
    admin=login('admin');e=login('user2');a=login('user1');pending=login('unassigned')
    admin.goto(url+'/#seguranca');expect(admin.get_by_role('heading',name='Segurança',exact=True)).to_be_visible();admin.get_by_role('tab',name='Obras',exact=True).click()
    form=admin.locator('#security-work-form');expect(form.locator('[name=workId]')).not_to_have_attribute('required','');form.locator('[name=name]').fill(name);form.locator('[name=reason]').fill('Cadastro único pela interface');form.get_by_role('button',name='Cadastrar obra',exact=True).click();done(admin);expect(admin.locator('#toast')).to_have_text('Configuração de segurança salva.')
    work=next(w for w in admin.request.get(url+'/api/security').json()['works'] if w['name']==name)
    for page in [e,a]:
        page.locator('#refresh').click();done(page);page.locator('#work').select_option(work['id']);expect(page.locator('#work')).to_have_value(work['id'])
    expect(e.get_by_role('button',name='Nova solicitação')).to_be_disabled();expect(a.get_by_role('button',name='Nova solicitação')).to_be_enabled()
    a.get_by_role('button',name='Nova solicitação').click();expect(a.locator('#form-work')).to_have_value(work['id']);a.locator('[name=purpose]').fill(name+' solicitação');a.locator('[data-field=neededDate]').fill('2026-11-10');a.locator('[data-field=location]').fill('Torre A');a.get_by_role('button',name='Enviar à engenharia',exact=True).click();expect(a.locator('#dialog-content')).to_contain_text(name+' solicitação')
    e.goto(url+'/#solicitacoes');expect(e.locator('#content')).to_contain_text(name+' solicitação')
    admin.get_by_role('tab',name='Usuários',exact=True).click();admin.locator('#security-user').select_option('test-unassigned');form=admin.locator('#security-user-form');expect(form.locator('[name=workAccess]')).to_have_count(0);expect(form).to_contain_text('Não é necessário liberar obra por usuário.');form.locator('#security-user-role').select_option('engenharia');form.locator('[name=reason]').fill('Cargo sem vínculo manual de obra');form.get_by_role('button',name='Salvar usuário',exact=True).click();done(admin)
    pending.get_by_role('button',name='Verificar acesso').click();expect(pending.get_by_role('heading',name='Painel de suprimentos')).to_be_visible();assert any(w['id']==work['id'] for w in pending.request.get(url+'/api/state').json()['works'])
    admin.get_by_role('tab',name='Obras',exact=True).click();form=admin.locator('#security-work-form');form.locator('[name=name]').fill(name);form.locator('[name=reason]').fill('Verificar duplicidade');form.get_by_role('button',name='Cadastrar obra',exact=True).click();expect(admin.locator('#security-error')).to_contain_text('já está cadastrada');assert len([w for w in admin.request.get(url+'/api/security').json()['works'] if w['name']==name])==1
    admin.get_by_role('tab',name='Usuários',exact=True).click();admin.locator('#security-user').select_option('test-unassigned');form=admin.locator('#security-user-form');form.locator('#security-user-role').select_option('none');form.locator('[name=reason]').fill('Restaurar fixture pendente');form.get_by_role('button',name='Salvar usuário',exact=True).click();done(admin)
    assert not errors,errors
    b.close()
print('PASS: obra única; código automático; todos os cargos veem; solicitação compartilhada; sem vínculos manuais; cargo basta para novo usuário; obra duplicada recusada.')
