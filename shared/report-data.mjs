import { statusLabels, balance, quantitySum, normalizeText } from '../domain.mjs';
export const reportStages = {solicitacoes:'Solicitações',engenharia:'Validação da engenharia',cotacoes:'Cotações',aprovacoes:'Decisões da diretoria',pedidos:'Pedidos de compra',recebimentos:'Recebimentos',contratos:'Contratos',medicoes:'Medições',estoque:'Estoque',movimentos:'Movimentações',orcamento:'Orçamento'};
const qty=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:8});
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=d=>d?String(d).slice(0,10).split('-').reverse().join('/'):'—';
export function buildReport(state,work,filters,actor){
 const {stage,from='',to='',query=''}=filters;
 if(!Object.hasOwn(reportStages,stage))throw Object.assign(Error('Etapa de relatório inválida.'),{status:400});
 for(const d of [from,to])if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))throw Object.assign(Error('Período inválido.'),{status:400});
 if(from&&to&&from>to)throw Object.assign(Error('Data inicial deve ser anterior à final.'),{status:400});
 const requests=state.requests.filter(r=>r.work===work.id),orders=state.orders.filter(r=>r.work===work.id),contracts=state.contracts.filter(r=>r.work===work.id);
 const entries=[],add=(at,cells)=>{if((from&&(!at||at.slice(0,10)<from))||(to&&(!at||at.slice(0,10)>to)))return;if(query&&!normalizeText(cells.join(' ')).includes(normalizeText(query)))return;entries.push(cells.map(v=>String(v??'—')));};
 let headers,note,period='Data da ação';
 if(['solicitacoes','engenharia','aprovacoes'].includes(stage)){
  headers=['Solicitação / etapa','Finalidade / autor','Item / vínculo','Quantidade','Necessidade / local'];period='Data necessária de cada item';
  for(const r of requests.filter(r=>stage==='engenharia'?['engineering','returned'].includes(r.status):stage==='aprovacoes'?r.status==='director':true))
   for(const i of r.items)add(i.neededDate,[`${r.id}\n${statusLabels[r.status]}`,`${r.purpose}\n${r.requester}`,`${i.name}\n${i.service||'Sem vínculo'}`,`${qty(i.qty)} ${i.unit}`,`${date(i.neededDate)}\n${i.location}`]);
  note=stage==='solicitacoes'?'Inclui solicitações em todas as etapas.':stage==='engenharia'?'Pendências atuais de validação técnica.':'Contratações atualmente aguardando decisão explícita do diretor.';
 }else if(stage==='cotacoes'){
  headers=['Solicitação / item','Fornecedor','Preço unitário','Quantidade / total do item','Sugestão / decisão'];period='Data necessária do item';
  for(const r of requests)for(const q of r.quotes)r.items.forEach((i,n)=>add(i.neededDate,[`${r.id}\n${i.name}`,`${q.supplier}\nFrete da proposta: ${money(q.freight)}\n${q.payment}`,money(q.prices[n]),`${qty(i.qty)} ${i.unit}\n${money(i.qty*q.prices[n])}`,`${r.allocations?.[n]===q.id||(!r.allocations?.[n]&&q.selected)?'Sugerido':'—'} / ${r.decisions?.[n]===q.id?'Escolhido pelo diretor':'—'}`]));
  note='Propostas vigentes. Frete é da proposta inteira e não deve ser somado por linha. Sugestão não representa aprovação.';
 }else if(['pedidos','contratos'].includes(stage)){
  const kind=stage==='pedidos';headers=['Documento / fornecedor','Item / local','Contratado','Recebido ou medido / saldo','Valores / previsão'];period='Data estimada de chegada';
  for(const r of kind?orders:contracts)for(const i of r.items)add(i.estimatedArrival,[`${r.id}\n${r.supplier}`,`${i.name}\n${i.location}`,`${qty(i.qty)} ${i.unit}`,`${qty(kind?i.received:i.measured)} / ${qty(quantitySum(i.qty,-(kind?i.received:i.measured)))}`,`${money(i.price)} un. / ${money(i.qty*i.price)}\n${date(i.estimatedArrival)}\nFrete do documento: ${money(r.freight||0)}`]);
  note='Valores por item; o frete pertence ao documento inteiro. Contratação e execução não representam pagamento.';
 }else if(stage==='recebimentos'){
  headers=['Pedido / fornecedor','NF / data','Item','Recebido','Operador / observação'];
  for(const o of orders)for(const r of o.receipts)r.quantities.forEach((q,n)=>{if(q)add(r.at,[`${o.id}\n${o.supplier}`,`${r.nf}\n${date(r.at)}`,o.items[n].name,`${qty(q)} ${o.items[n].unit}`,`${r.who||'—'}\n${r.note||''}`]);});note='Entregas registradas; os recebimentos já compõem o estoque.';
 }else if(stage==='medicoes'){
  headers=['Contrato / fornecedor','Período / data','Item','Quantidade / valor','Operador'];
  for(const c of contracts)for(const m of c.measurements)m.quantities.forEach((q,n)=>{if(q)add(m.at,[`${c.id}\n${c.supplier}`,`${m.period}\n${date(m.at)}`,c.items[n].name,`${qty(q)} ${c.items[n].unit}\n${money(q*c.items[n].price)}`,m.who||'—']);});note='Execução medida, sem movimentação de estoque ou pagamento.';
 }else if(stage==='movimentos'){
  headers=['Data / tipo','Material','Quantidade','Destino / documento','Retirante / operador'];
  for(const m of state.movements.filter(m=>m.work===work.id))add(m.at,[`${date(m.at)}\n${m.kind==='in'?'Entrada':'Saída'}`,state.catalog.find(c=>c.id===m.material)?.name||m.material,qty(m.qty),`${m.service}\n${m.nf||m.orderId||m.floor||'—'}`,`${m.who}\n${m.actorName||'—'}`]);note='Retirante e operador autenticado são identificados separadamente.';
 }else if(stage==='estoque'){
  if(from)throw Object.assign(Error('Estoque usa somente a data final para consultar o saldo.'),{status:400});
  headers=['Código','Material','Unidade','Saldo físico'];period='Saldo até a data final, ou saldo atual';
  const snapshot={...state,movements:state.movements.filter(m=>!to||m.at.slice(0,10)<=to)};
  for(const m of state.catalog)if(!query||normalizeText(m.name+' '+m.id).includes(normalizeText(query)))entries.push([m.id,m.name,m.unit,qty(balance(snapshot,work.id,m.id))]);note='Saldo registrado, sem reservas. Data de corte em UTC.';
 }else{
  if(from||to)throw Object.assign(Error('Orçamento apresenta a posição atual; remova as datas.'),{status:400});
  headers=['Serviço','Referência','Comprometido','Saldo'];period='Posição atual';
  for(const b of state.budgetServices?.[work.id]||[]){const used=[...orders,...contracts].flatMap(r=>r.items).filter(i=>i.service===b.id).reduce((s,i)=>s+i.qty*i.price,0);add('',[b.name,b.budget==null?'Não definido':money(b.budget),money(used),b.budget==null?'—':money(b.budget-used)]);}note='Comprometido considera itens contratados, sem frete. Não soma recebimentos novamente.';
 }
 if(entries.length>2000)throw Object.assign(Error('O relatório excede 2.000 linhas. Restrinja os filtros.'),{status:413});
 return {title:reportStages[stage],stage,work,filters:{from,to,query},period,note,headers,rows:entries,generatedAt:new Date().toISOString(),generatedBy:actor.name};
}
