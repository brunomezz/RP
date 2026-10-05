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
