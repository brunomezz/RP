import { effectivePermissions } from './shared/permissions.mjs';
const view={tab:'users',user:'',role:'almoxarifado'};
const groups={
 'Solicitações e engenharia':['create','edit','engineering','rejectEngineering'],
 'Cotações e contratação':['quote','suggest','send','director','rejectDirector','arrival','quoteFiles','orderFiles'],
 'Estoque e medições':['receive','withdraw','measure'],
 'Cadastros, relatórios e documentos':['material','supplier','reportsExport','reportsEmail','documentsImport'],
};
export function mountSecurity(root,snapshot,{esc,submit}){
 const {roles,capabilities,users,memberships,works,grants,overrides=[],userRoles:assigned=[]}=snapshot;
 const ordinary=Object.entries(roles).filter(([id])=>id!=='admin');
 const userRoles=u=>u.admin?['admin']:[...new Set(assigned.filter(r=>r.user_id===u.id).map(r=>r.role))];
 const roleText=u=>userRoles(u).map(id=>roles[id]).join(' + ')||'Sem cargo';
 const options=(entries,value)=>entries.map(([id,name])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(name)}</option>`).join('');
 if(!users.some(u=>u.id===view.user))view.user=users[0]?.id||'';
 root.innerHTML=`<div class="page-heading"><div><p class="eyebrow">ADMINISTRAÇÃO</p><h1>Segurança</h1><p class="subtitle">Escolha quem pode entrar, qual é o cargo e o que cada pessoa pode fazer.</p></div></div>
 <div class="security-tabs" role="tablist" aria-label="Configurações de segurança">${[['users','Usuários'],['roles','Poderes por cargo'],['works','Obras'],['audit','Histórico']].map(([id,label])=>`<button type="button" role="tab" id="security-tab-${id}" aria-controls="security-panel-${id}" aria-selected="${view.tab===id}" data-security-tab="${id}">${label}</button>`).join('')}</div>
 <section class="panel" id="security-panel-users" role="tabpanel" aria-labelledby="security-tab-users"><div class="panel-head"><h2>Quem é cada usuário?</h2></div><div class="panel-body">
 <p class="subtitle">A pessoa entra uma vez com sua conta e aparece nesta lista. Depois, você escolhe o cargo. As obras são compartilhadas por toda a empresa.</p>
 <div class="fields"><label>Buscar pessoa<input id="security-search" type="search" placeholder="Nome ou identificador"></label><label>Usuário<select id="security-user">${options(users.map(u=>[u.id,u.name+' · '+roleText(u)+(u.disabled?' · suspenso':'')]),view.user)}</select></label></div>
 <form id="security-user-form"></form></div></section>
 <section class="panel" id="security-panel-roles" role="tabpanel" aria-labelledby="security-tab-roles"><div class="panel-head"><h2>O que cada cargo pode fazer?</h2></div><div class="panel-body"><label>Cargo<select id="security-role">${options(Object.entries(roles),view.role)}</select></label><p class="note">O cargo é o padrão para todos os seus usuários. Em Usuários, você pode permitir ou bloquear um poder somente para uma pessoa e uma obra. Uma exceção individual tem prioridade sobre o cargo.</p><form id="security-role-form"></form></div></section>
 <section class="panel" id="security-panel-works" role="tabpanel" aria-labelledby="security-tab-works"><div class="panel-head"><h2>Obras cadastradas</h2></div><div class="panel-body">${works.length?`<ul>${works.map(w=>`<li><strong>${esc(w.name)}</strong> · ${esc(w.id)}</li>`).join('')}</ul>`:'<p>Nenhuma obra cadastrada.</p>'}<h3>Cadastrar uma obra para toda a empresa</h3><p class="note">Cadastre apenas uma vez. Todos os usuários com cargo ativo terão acesso a esta obra automaticamente.</p><form id="security-work-form"><div class="fields"><label>Nome da obra<input name="name" maxlength="300" required></label><label>Código da obra (opcional)<input name="workId" pattern="[A-Za-z0-9_-]{1,60}" maxlength="60" placeholder="Gerado automaticamente pelo nome"></label><label class="wide">Motivo<input name="reason" maxlength="2000" required></label></div><p class="subtitle">A engenharia precisa justificar despesas não previstas até configurar o orçamento.</p><div class="actions"><button class="primary">Cadastrar obra</button></div></form></div></section>
 <section class="panel" id="security-panel-audit" role="tabpanel" aria-labelledby="security-tab-audit"><div class="panel-head"><h2>Histórico de segurança</h2><small>100 MAIS RECENTES</small></div><div class="panel-body">${snapshot.audit.length?`<div class="table-wrap"><table><thead><tr><th>Data e autor</th><th>Alteração</th><th>Motivo e detalhes</th></tr></thead><tbody>${snapshot.audit.map(a=>`<tr><td>${esc(new Date(a.at).toLocaleString('pt-BR'))}<small>${esc(a.actor_name)}</small></td><td>${esc(({user:'Cargo e poderes do usuário',role:'Poderes do cargo',work:'Cadastro de obra'})[a.action]||a.action)}<small>${esc(a.target)}</small></td><td>${esc(a.reason)}<details><summary>Antes e depois</summary><pre>${esc(JSON.stringify({antes:JSON.parse(a.before_json),depois:JSON.parse(a.after_json)},null,2))}</pre></details></td></tr>`).join('')}</tbody></table></div>`:'<p>Nenhuma alteração registrada.</p>'}</div></section><p id="security-error" class="error" role="alert"></p>`;
 function tab(id){view.tab=id;root.querySelectorAll('[data-security-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.securityTab===id)));root.querySelectorAll('[role="tabpanel"]').forEach(panel=>panel.hidden=panel.id!=='security-panel-'+id);}
 root.querySelectorAll('[data-security-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.securityTab));tab(view.tab);
 const userSelect=root.querySelector('#security-user'),roleSelect=root.querySelector('#security-role');
 const powerGroups=render=>Object.entries(groups).map(([title,ids])=>`<fieldset class="security-powers"><legend>${title}</legend>${ids.map(id=>render(id,capabilities[id])).join('')}</fieldset>`).join('');
 function userForm(){
  view.user=userSelect.value;const u=users.find(u=>u.id===view.user),form=root.querySelector('#security-user-form');
  if(!u){form.innerHTML='<p>Nenhuma pessoa encontrada.</p>';return;}
  const assigned=userRoles(u),main=u.admin?'admin':assigned.length===1?assigned[0]:assigned.length?'custom':'';
  const drafts=new Map(overrides.filter(p=>p.user_id===u.id).map(p=>[p.work_id+':'+p.permission,{workId:p.work_id,permission:p.permission,effect:p.effect}]));
  const initialRoles=userRoles(u).filter(role=>role!=='admin');
  form.innerHTML=`<div class="security-person"><strong>${esc(u.name)}</strong><span>Cargo atual: ${esc(roleText(u))}</span></div>
  <details class="security-identity"><summary>Identificação da conta</summary><p>${esc(u.id)}</p></details><div class="fields"><label>Qual é o cargo deste usuário?<select name="cargo" id="security-user-role" required>${options([['','Selecione o cargo'],...Object.entries(roles),['none','Sem cargo — acesso pendente'],['custom','Mais de um cargo']],main)}</select></label><label>E-mail do colaborador<input name="email" type="email" maxlength="254" value="${esc(u.email||'')}" placeholder="nome@empresa.com.br"></label></div>
  <label class="security-check"><input type="checkbox" name="disabled" ${u.disabled?'checked':''}> Suspender acesso ao ERP</label>
  <p class="note" id="security-admin-help" hidden><strong>Admin tem acesso total:</strong> todas as obras atuais e futuras, todos os poderes e administração de usuários. As regras de aprovação, etapas e integridade continuam valendo.</p>
  <div id="security-work-access"><fieldset id="security-extra-roles" hidden><legend>Cargos deste usuário</legend>${ordinary.map(([id,name])=>`<label class="security-check"><input type="checkbox" name="extraRole" value="${id}" ${initialRoles.includes(id)?'checked':''}> ${name}</label>`).join('')}</fieldset><h3>Obras da empresa</h3><p class="note">Todas as ${works.length} obra(s) cadastradas ficam disponíveis para quem tem cargo ativo. Uma obra nova aparece para todos automaticamente. Não é necessário liberar obra por usuário.</p>
  <details id="security-individual" ${drafts.size?'open':''}><summary>Personalizar poderes deste usuário</summary><p class="note">Seguir cargo usa o padrão. Permitir ou Bloquear altera somente esta pessoa nesta obra. Bloquear prevalece mesmo quando a pessoa tem vários cargos.</p><label>Obra para personalizar<select id="security-user-power-work">${options(works.map(w=>[w.id,w.name]),[...drafts.values()][0]?.workId||works[0]?.id)}</select></label><div id="security-user-powers"></div><button type="button" id="security-reset-powers">Usar somente os poderes do cargo nesta obra</button></details></div>
  <label>Motivo da alteração<textarea name="reason" maxlength="2000" required></textarea></label><div class="actions"><button class="primary">Salvar usuário</button></div>`;
  const role=form.querySelector('#security-user-role'),powerWork=form.querySelector('#security-user-power-work');
  const chosenRoles=()=>role.value==='custom'?[...form.querySelectorAll('[name="extraRole"]:checked')].map(el=>el.value):role.value&& !['admin','none'].includes(role.value)?[role.value]:[];
  function powers(){
   const work=powerWork.value,active=chosenRoles(),box=form.querySelector('#security-user-powers');
   if(!work||!active.length){box.innerHTML='<p class="note">Escolha o cargo e cadastre uma obra antes de personalizar os poderes.</p>';return;}
   const result=effectivePermissions(grants,[...drafts.values()].map(p=>({...p,user_id:u.id,work_id:p.workId})),u.id,work,active);
   box.innerHTML=powerGroups((id,label)=>`<div class="security-power-row"><label for="user-power-${id}">${label}</label><select id="user-power-${id}" data-user-power="${id}" aria-label="${label}">${options([['inherit','Seguir cargo'],['allow','Permitir'],['deny','Bloquear']],drafts.get(work+':'+id)?.effect||'inherit')}</select><span class="badge ${result.includes(id)?'received':'returned'}">${result.includes(id)?'Permitido':'Bloqueado'}</span></div>`);
   box.querySelectorAll('[data-user-power]').forEach(select=>select.onchange=()=>{const key=work+':'+select.dataset.userPower;if(select.value==='inherit')drafts.delete(key);else drafts.set(key,{workId:work,permission:select.dataset.userPower,effect:select.value});powers();});
  }
  function cargo(){
   const admin=role.value==='admin';form.querySelector('#security-admin-help').hidden=!admin;form.querySelector('#security-work-access').hidden=admin;
   form.querySelectorAll('#security-work-access input,#security-work-access select').forEach(el=>el.disabled=admin||!role.value);
   form.querySelector('#security-extra-roles').hidden=role.value!=='custom';
   powers();
  }
  role.onchange=cargo;form.querySelectorAll('[name="extraRole"]').forEach(el=>el.onchange=powers);powerWork.onchange=powers;
  form.querySelector('#security-reset-powers').onclick=()=>{for(const [key,p] of drafts)if(p.workId===powerWork.value)drafts.delete(key);powers();};
  cargo();
  form.onsubmit=e=>{e.preventDefault();const f=new FormData(form),roles=chosenRoles();submit({action:'user',userId:u.id,email:f.get('email'),disabled:f.has('disabled'),admin:role.value==='admin',roles,overrides:role.value==='admin'?[]:roles.length?[...drafts.values()]:[],reason:f.get('reason')});};
 }
 function roleForm(){
  view.role=roleSelect.value;const role=view.role,form=root.querySelector('#security-role-form');
  if(role==='admin'){form.innerHTML='<p class="note"><strong>Admin tem todos os poderes em todas as obras, incluindo Segurança.</strong> Este cargo não pode ser restringido. Para limitar uma pessoa, escolha outro cargo e personalize os poderes em Usuários.</p>';return;}
  form.innerHTML=powerGroups((id,label)=>`<label class="security-check"><input type="checkbox" name="permission" value="${id}" ${grants.some(g=>g.role===role&&g.permission===id)?'checked':''}> ${label}</label>`)+`<label>Motivo da alteração<textarea name="reason" maxlength="2000" required></textarea></label><div class="actions"><button class="primary">Salvar poderes do cargo</button></div>`;
  form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);submit({action:'role',role,permissions:f.getAll('permission'),reason:f.get('reason')});};
 }
 root.querySelector('#security-search').oninput=e=>{const term=e.target.value.toLocaleLowerCase('pt-BR');userSelect.innerHTML=options(users.filter(u=>(u.name+' '+u.id).toLocaleLowerCase('pt-BR').includes(term)).map(u=>[u.id,u.name+' · '+roleText(u)]),view.user);userForm();};
 userSelect.onchange=userForm;roleSelect.onchange=roleForm;userForm();roleForm();
 root.querySelector('#security-work-form').onsubmit=e=>{e.preventDefault();submit({action:'work',...Object.fromEntries(new FormData(e.target))});};
}
