"""Regression for visible request action, real work selection and header layout; local only."""
import os
from playwright.sync_api import sync_playwright,expect
url='http://127.0.0.1:'+os.environ.get('PORT','3010')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('FES_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
    errors=[]
    def login(persona):
        page=browser.new_context(viewport={'width':1366,'height':900}).new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url);page.locator('#dev-persona').select_option(persona);page.locator('#dev-login').click()
        page.wait_for_function("document.querySelector('#identity').textContent.startsWith('Teste')")
        return page
    def done(page):page.wait_for_function("document.body.getAttribute('aria-busy') !== 'true'")
    admin=login('admin');expect(admin.get_by_role('heading',name='Painel de suprimentos')).to_be_visible()
    expect(admin.get_by_role('button',name='Nova solicitação')).to_be_enabled();expect(admin.locator('#work')).to_be_enabled()
    admin.locator('#work').select_option('BLEND');expect(admin.get_by_role('button',name='Nova solicitação')).to_be_enabled()
    a=login('user1');expect(a.get_by_role('heading',name='Painel de suprimentos')).to_be_visible();expect(a.get_by_role('button',name='Nova solicitação')).to_be_enabled()
    expect(a.locator('#work')).to_be_enabled();a.locator('#work').select_option('ELYSIUM');a.locator('#refresh').click();done(a);expect(a.locator('#work')).to_have_value('ELYSIUM')
    a.get_by_role('button',name='Nova solicitação').click();expect(a.get_by_role('heading',name='Nova solicitação',exact=True)).to_be_visible();expect(a.locator('#form-work')).to_have_value('ELYSIUM');a.get_by_role('button',name='Fechar',exact=True).click()
    for width in [1366,1024,768,390]:
        a.set_viewport_size({'width':width,'height':900})
        controls=[a.locator('#work'),a.locator('#refresh'),a.locator('[data-action="audit"]'),a.locator('#notifications')]
        boxes=[c.bounding_box() for c in controls]
        assert all(b and b['x']>=0 and b['x']+b['width']<=width+1 for b in boxes),(width,boxes)
        for i,b in enumerate(boxes):
            for c in boxes[i+1:]:assert not (max(b['x'],c['x'])<min(b['x']+b['width'],c['x']+c['width']) and max(b['y'],c['y'])<min(b['y']+b['height'],c['y']+c['height'])),(width,b,c)
        assert a.locator('header').bounding_box()['y']+a.locator('header').bounding_box()['height']<=a.locator('main > .demo').first.bounding_box()['y']
    a.set_viewport_size({'width':1366,'height':900});a.screenshot(path='/tmp/fes-navigation-header.png',full_page=True)
    a.goto(url+'/#central-relatorios');expect(a.get_by_role('heading',name='Central de relatórios')).to_be_visible();expect(a.locator('#work-filter')).to_be_hidden();expect(a.locator('#work-help')).to_contain_text('formulário do relatório');expect(a.locator('#stage-report-form [name="work"]')).to_be_enabled()
    a.goto(url+'/#solicitacoes');expect(a.get_by_role('heading',name='Solicitações',exact=True)).to_be_visible();expect(a.locator('#work')).to_be_enabled();expect(a.get_by_role('button',name='Nova solicitação')).to_be_enabled()
    e=login('user2');expect(e.get_by_role('heading',name='Painel de suprimentos')).to_be_visible();expect(e.get_by_role('button',name='Nova solicitação')).to_be_visible();expect(e.get_by_role('button',name='Nova solicitação')).to_be_disabled();expect(e.locator('#new-request-help')).to_contain_text('Criar solicitações')
    assert not errors,errors
    browser.close()
print('PASS: ação visível e bloqueio explicado; Admin com acesso total; seleção real e persistência do filtro; formulário com obra selecionada; sem sobreposição em 4 larguras; filtro próprio dos relatórios; permissões preservadas.')
