// The server remains authoritative; this module only renders the administration forms.
export function mountSecurity(root, snapshot, { esc, submit }) {
  const { roles, capabilities, users, memberships, works, grants } = snapshot;
  const options = users.map(u => `<option value="${esc(u.id)}">${esc(u.name)}${u.disabled ? ' · suspenso' : !u.admin && !memberships.some(m=>m.user_id===u.id) ? ' · acesso pendente' : ''}</option>`).join('');
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">ADMINISTRAÇÃO</p><h1>Segurança</h1><p class="subtitle">Libere pessoas por obra e defina o que cada cargo pode fazer.</p></div></div>
    <div class="note">O login identifica a pessoa. O acesso às obras e os poderes abaixo definem suas ações no ERP. Administradores gerenciam esta aba; para operar a obra, também precisam de um cargo.</div>
    <div class="security-grid">
      <section class="panel"><div class="panel-head"><h2>Usuários e obras</h2></div><div class="panel-body">
        <p class="subtitle">Peça à pessoa para entrar uma vez. Ela aparecerá aqui, mesmo com acesso pendente. Confira o nome e o identificador antes de liberar.</p>
        <label>Buscar pessoa<input id="security-search" type="search" placeholder="Nome ou identificador"></label>
        <label>Usuário<select id="security-user">${options}</select></label><form id="security-user-form"></form>
      </div></section>
      <section class="panel"><div class="panel-head"><h2>Poderes dos cargos</h2></div><div class="panel-body">
        <label>Cargo<select id="security-role">${Object.entries(roles).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label>
        <p class="subtitle">A alteração vale para todas as pessoas com este cargo nas obras autorizadas. Pessoas com vários cargos acumulam seus poderes. A leitura dos registros da obra continua disponível para quem tiver vínculo ativo.</p>
        <form id="security-role-form"></form>
      </div></section>
    </div>
    <section class="panel"><div class="panel-head"><h2>Cadastrar obra</h2></div><div class="panel-body"><form id="security-work-form"><div class="fields"><label>Código da obra<input name="workId" pattern="[A-Za-z0-9_-]{1,60}" maxlength="60" placeholder="ELYSIUM" required></label><label>Nome da obra<input name="name" maxlength="300" required></label><label class="wide">Motivo<input name="reason" maxlength="2000" required></label></div><p class="subtitle">A obra começa sem orçamento configurado. Até a configuração do orçamento, a engenharia deve justificar as despesas não previstas.</p><div class="actions"><button class="primary">Cadastrar obra</button></div></form></div></section>
    <section class="panel"><div class="panel-head"><h2>Histórico de segurança</h2><small>100 ALTERAÇÕES MAIS RECENTES</small></div><div class="panel-body">${snapshot.audit.length ? `<div class="table-wrap"><table><thead><tr><th>Data e autor</th><th>Alteração</th><th>Motivo e detalhes</th></tr></thead><tbody>${snapshot.audit.map(a=>`<tr><td>${esc(new Date(a.at).toLocaleString('pt-BR'))}<small>${esc(a.actor_name)}</small></td><td>${esc(({user:'Acesso de usuário',role:'Poderes do cargo',work:'Cadastro de obra'})[a.action]||a.action)}<small>${esc(a.target)}</small></td><td>${esc(a.reason)}<details><summary>Antes e depois</summary><pre>${esc(JSON.stringify({antes:JSON.parse(a.before_json),depois:JSON.parse(a.after_json)},null,2))}</pre></details></td></tr>`).join('')}</tbody></table></div>` : '<p class="subtitle">Nenhuma alteração registrada.</p>'}</div></section><p id="security-error" class="error" role="alert"></p>`;
  const userSelect = root.querySelector('#security-user'), roleSelect = root.querySelector('#security-role');
  function userForm() {
    const u = users.find(u=>u.id===userSelect.value), form=root.querySelector('#security-user-form');
    if (!u) { form.innerHTML='<p>Nenhuma pessoa encontrada.</p>';return; }
    form.innerHTML=`<p class="security-identity">Identificador: <strong>${esc(u.id)}</strong></p><label class="security-check"><input type="checkbox" name="disabled" ${u.disabled?'checked':''}> Suspender acesso ao ERP</label><label class="security-check"><input type="checkbox" name="admin" ${u.admin?'checked':''}> Administrador de segurança</label>
      <p class="subtitle">Marque os cargos em cada obra. Para remover o acesso à obra, desmarque todos os cargos dela.</p>
      ${works.length ? works.map(w=>`<fieldset><legend>${esc(w.name)}</legend>${Object.entries(roles).map(([role,label])=>`<label class="security-check"><input type="checkbox" name="membership" value="${esc(JSON.stringify({workId:w.id,role}))}" ${memberships.some(m=>m.user_id===u.id&&m.work_id===w.id&&m.role===role)?'checked':''}> ${label}</label>`).join('')}</fieldset>`).join('') : '<p class="note">Cadastre a primeira obra abaixo e depois vincule as pessoas.</p>'}
      <label>Motivo da alteração<textarea name="reason" maxlength="2000" required></textarea></label><div class="actions"><button class="primary">Salvar acesso do usuário</button></div>`;
    form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);submit({action:'user',userId:u.id,disabled:f.has('disabled'),admin:f.has('admin'),memberships:f.getAll('membership').map(JSON.parse),reason:f.get('reason')});};
  }
  function roleForm() {
    const role=roleSelect.value,form=root.querySelector('#security-role-form');
    form.innerHTML=Object.entries(capabilities).map(([id,label])=>`<label class="security-check"><input type="checkbox" name="permission" value="${id}" ${grants.some(g=>g.role===role&&g.permission===id)?'checked':''}> ${label}</label>`).join('')+`<label>Motivo da alteração<textarea name="reason" maxlength="2000" required></textarea></label><div class="actions"><button class="primary">Salvar poderes do cargo</button></div>`;
    form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);submit({action:'role',role,permissions:f.getAll('permission'),reason:f.get('reason')});};
  }
  root.querySelector('#security-search').oninput=e=>{
    const term=e.target.value.toLocaleLowerCase('pt-BR');
    userSelect.innerHTML=users.filter(u=>(u.name+' '+u.id).toLocaleLowerCase('pt-BR').includes(term)).map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');userForm();
  };
  userSelect.onchange=userForm;roleSelect.onchange=roleForm;userForm();roleForm();
  root.querySelector('#security-work-form').onsubmit=e=>{e.preventDefault();submit({action:'work',...Object.fromEntries(new FormData(e.target))});};
}
