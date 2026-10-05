import test from 'node:test';
import assert from 'node:assert/strict';
import {validTaxId,formatTaxId,nextMaterialCode,materialLabel,stockStatement,stockPosition,lastEntry} from '../domain.mjs';
test('CNPJ e CPF são conferidos pelos dígitos verificadores',()=>{
 assert.ok(validTaxId('11.222.333/0001-81'));assert.ok(validTaxId('529.982.247-25'));
 for(const v of ['11.222.333/0001-82','529.982.247-24','00000000000','11111111111111','123',''])assert.equal(validTaxId(v),false,v);
 assert.equal(formatTaxId('11222333000181'),'11.222.333/0001-81');assert.equal(formatTaxId('52998224725'),'529.982.247-25');
});
test('código automático segue o maior INS existente',()=>{
 assert.equal(nextMaterialCode([]),'INS-0001');
 assert.equal(nextMaterialCode([{code:'INS-0007'},{code:'CIM-01'},{}]),'INS-0008');
 assert.equal(materialLabel({code:'INS-0001',name:'Cimento'}),'INS-0001 · Cimento');assert.equal(materialLabel({name:'Areia'}),'Areia');
});
test('extrato calcula saldo anterior, saldo acumulado, posição na data e última entrada',()=>{
 const state={orders:[{id:'PED-1',supplier:'Casa do Construtor'}],movements:[
  {work:'A',material:'m',kind:'in',qty:10,at:'2026-10-01T12:00:00Z',orderId:'PED-1',nf:'100'},
  {work:'A',material:'m',kind:'out',qty:0.3,at:'2026-10-03T12:00:00Z',who:'João'},
  {work:'B',material:'m',kind:'in',qty:99,at:'2026-10-03T12:00:00Z'},
  {work:'A',material:'m',kind:'in',qty:0.1,at:'2026-10-05T12:00:00Z',orderId:'PED-1',nf:'101'},
  {work:'A',material:'m',kind:'out',qty:0.2,at:'2026-10-07T12:00:00Z',who:'Maria'}]};
 const st=stockStatement(state,'A','m',{from:'2026-10-02',to:'2026-10-06'});
 assert.equal(st.opening,10);assert.equal(st.closing,9.8);
 assert.deepEqual(st.rows.map(r=>r.balance),[9.7,9.8]);assert.equal(st.rows[1].supplier,'Casa do Construtor');
 assert.equal(stockPosition(state,'A','m'),9.6);assert.equal(stockPosition(state,'A','m','2026-10-02'),10);
 assert.equal(lastEntry(state,'A','m','2026-10-04').nf,'100');assert.equal(lastEntry(state,'A','m').nf,'101');
 assert.equal(lastEntry(state,'A','x'),null);
});
import {parseCSV,planImport,applyImport,reserve,release,transfer,returnToStock,initStock,closePeriod,reopenPeriod,available,withdraw,closedThrough} from '../domain.mjs';
test('CSV do Sienge: separador, aspas, BOM, colunas por sinônimo e plano de importação',()=>{
 const rows=parseCSV('﻿Código;Descrição;Unidade de medida;Grupo;Detalhe\r\nINS-0001;"Cimento; CP II";saco;Aglomerantes;50 kg\r\n;Areia;m³;;\r\n;areia;m³;;\r\n');
 assert.equal(rows.length,3);assert.equal(rows[0]['Descrição'],'Cimento; CP II');assert.equal(rows[0].line,2);
 const state={catalog:[{id:'x',code:'INS-0001',name:'Cimento antigo',unit:'kg'}],suppliers:[],movements:[{material:'x'}],requests:[]};
 const plan=planImport(state,'materials',rows);
 assert.deepEqual(plan.map(p=>p.action),['skip','create','skip']);assert.match(plan[0].reason,/Unidade/);assert.match(plan[2].reason,/Repetido/);
 const r=applyImport(state,'materials',plan);assert.equal(r.created,1);assert.equal(state.catalog[1].code,'INS-0002');
 const sup=planImport({suppliers:[{id:'s',name:'Casa',document:'11.222.333/0001-81'}],catalog:[],movements:[],requests:[]},'suppliers',parseCSV('Fornecedor,CNPJ,Cidade\nCasa Nova,11222333000181,Chapecó\nOutro,529.982.247-25,\n'));
 assert.equal(sup[0].action,'update');assert.equal(sup[0].data.name,'Casa');assert.equal(sup[1].data.document,'529.982.247-25');
});
test('reservas, transferência, devolução, saldo inicial e fechamento no domínio',()=>{
 const s={movements:[],reservations:[],closings:[],orders:[]};
 initStock(s,{work:'A',material:'m',qty:10,date:'2026-10-01',who:'x'});assert.throws(()=>initStock(s,{work:'A',material:'m',qty:1,date:'2026-10-01'}),/saldo inicial/);
 const r=reserve(s,{work:'A',material:'m',qty:6,who:'x'});assert.equal(available(s,'A','m'),4);assert.throws(()=>reserve(s,{work:'A',material:'m',qty:5}),/disponível/);
 assert.throws(()=>withdraw(s,{work:'A',material:'m',qty:5,who:'J',service:'s'}),/disponível/);
 withdraw(s,{work:'A',material:'m',qty:6,who:'J',service:'s',reservation:r});assert.equal(r.status,'consumed');assert.equal(available(s,'A','m'),4);
 assert.throws(()=>release(r,'x'),/encerrada/);
 transfer(s,{work:'A',toWork:'B',material:'m',qty:4,who:'x'});assert.equal(available(s,'A','m'),0);assert.equal(available(s,'B','m'),4);
 assert.throws(()=>transfer(s,{work:'B',toWork:'B',material:'m',qty:1}),/destino/);
 const out=s.movements.find(m=>m.type==='withdraw');returnToStock(s,{work:'A',material:'m',qty:2,who:'J',reason:'sobra',returnOf:out.id});
 assert.throws(()=>returnToStock(s,{work:'A',material:'m',qty:5,who:'J',reason:'sobra',returnOf:out.id}),/maior/);
 const c=closePeriod(s,{work:'A',through:'2026-10-02',who:'d'});assert.equal(c.balances[0].qty,10);assert.equal(closedThrough(s,'A'),'2026-10-02');
 assert.throws(()=>closePeriod(s,{work:'A',through:'2026-10-01'}),/posterior/);
 reopenPeriod(s,{work:'A',reason:'ajuste',who:'adm'});assert.equal(closedThrough(s,'A'),'');
});
