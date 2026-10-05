import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './harness.mjs';
async function command(h,c,body){return h.fetch('/api/commands',c,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)});}
async function ok(h,c,body){const r=await command(h,c,body);assert.equal(r.status,200,await r.clone().text());return r.json();}
async function snapshot(h,c){return (await h.fetch('/api/state',c)).json();}
test('insumos: código automático, edição, código único e unidade preservada após uso',async()=>{
 const h=await createHarness();
 try{
  const p=await h.login('procurement'),a=await h.login('user1');
  await ok(h,p,{action:'material',work:'ELYSIUM',name:'Areia média',unit:'m³',category:'Agregados',spec:'Lavada',brand:''});
  let s=await snapshot(h,p);const areia=s.catalog.find(m=>m.name==='Areia média');
  assert.equal(areia.code,'INS-0001');assert.equal(areia.category,'Agregados');assert.equal(areia.spec,'Lavada');
  await ok(h,p,{action:'material',work:'ELYSIUM',code:'cim-01',name:'Cimento CP II',unit:'saco'});
  s=await snapshot(h,p);assert.equal(s.catalog.find(m=>m.name==='Cimento CP II').code,'CIM-01');
  assert.equal((await command(h,p,{action:'material',work:'ELYSIUM',code:'INS-0001',name:'Brita 1',unit:'m³'})).status,409);
  await ok(h,p,{action:'material',work:'ELYSIUM',id:areia.id,name:'Areia média lavada',unit:'m',brand:'Jazida X'});
  s=await snapshot(h,p);const edited=s.catalog.find(m=>m.id===areia.id);
  assert.equal(edited.name,'Areia média lavada');assert.equal(edited.unit,'m');assert.equal(edited.code,'INS-0001');assert.equal(edited.brand,'Jazida X');
  await ok(h,a,{action:'create',work:'ELYSIUM',purpose:'Uso do insumo',items:[{kind:'material',material:areia.id,qty:2,service:'alvenaria',neededDate:'2026-11-10',location:'Torre A'}]});
  assert.equal((await command(h,p,{action:'material',work:'ELYSIUM',id:areia.id,name:'Areia média lavada',unit:'kg'})).status,409);
  await ok(h,p,{action:'material',work:'ELYSIUM',id:areia.id,name:'Areia média lavada',unit:'m',category:'Agregados finos'});
  assert.equal((await command(h,p,{action:'material',work:'ELYSIUM',id:'nao-existe',name:'X',unit:'un'})).status,404);
  assert.equal((await command(h,a,{action:'material',work:'ELYSIUM',name:'Sem poder',unit:'un'})).status,403);
 }finally{await h.close();}
});
test('fornecedor: CNPJ conferido e formatado, endereço, UF e pagamento padrão',async()=>{
 const h=await createHarness();
 try{
  const p=await h.login('procurement');
  assert.equal((await command(h,p,{action:'supplier',work:'ELYSIUM',name:'Fornecedor inválido',document:'11.222.333/0001-82'})).status,400);
  assert.equal((await command(h,p,{action:'supplier',work:'ELYSIUM',name:'UF inválida',uf:'S1'})).status,400);
  await ok(h,p,{action:'supplier',work:'ELYSIUM',name:'Casa do Construtor',legalName:'Casa do Construtor Ltda',document:'11222333000181',address:'Rua A, 10',city:'Chapecó',uf:'sc',paymentTerms:'28 dias',contact:'Ana'});
  let s=await snapshot(h,p);const f=s.suppliers.find(x=>x.name==='Casa do Construtor');
  assert.equal(f.document,'11.222.333/0001-81');assert.equal(f.uf,'SC');assert.equal(f.city,'Chapecó');assert.equal(f.paymentTerms,'28 dias');assert.equal(f.legalName,'Casa do Construtor Ltda');
  assert.equal((await command(h,p,{action:'supplier',work:'ELYSIUM',name:'Outro nome',document:'11.222.333/0001-81'})).status,409);
  await ok(h,p,{action:'supplier',work:'ELYSIUM',id:f.id,name:'Casa do Construtor',document:'11.222.333/0001-81',city:'Xanxerê',uf:'SC'});
  s=await snapshot(h,p);assert.equal(s.suppliers.find(x=>x.id===f.id).city,'Xanxerê');
 }finally{await h.close();}
});
test('importação de planilha: cria, atualiza, ignora inválidos e exige o poder do cadastro',async()=>{
 const h=await createHarness();
 try{
  const p=await h.login('procurement'),a=await h.login('user1');
  const rows=[{line:2,'Código':'','Descrição':'Areia média','Unidade':'m³','Grupo':'Agregados'},{line:3,'Código':'','Descrição':'Bloco · catálogo de teste','Unidade':'un','Marca':'Cerâmica X'},{line:4,'Descrição':'Sem unidade'}];
  assert.equal((await command(h,a,{action:'import',kind:'materials',work:'ELYSIUM',rows})).status,403);
  const r=await ok(h,p,{action:'import',kind:'materials',work:'ELYSIUM',rows});
  assert.deepEqual([r.created,r.updated,r.skipped.map(s=>s.line)],[1,1,[4]]);
  const s=await snapshot(h,p);assert.equal(s.catalog.find(m=>m.id==='bloco').brand,'Cerâmica X');assert.equal(s.catalog.find(m=>m.name==='Areia média').category,'Agregados');
  const f=await ok(h,p,{action:'import',kind:'suppliers',work:'ELYSIUM',rows:[{line:2,'Nome fantasia':'Casa do Construtor','CNPJ':'11222333000181','UF':'sc'},{line:3,'Fornecedor':'Inválido','CNPJ':'1'}]});
  assert.deepEqual([f.created,f.skipped.length],[1,1]);
  assert.equal((await command(h,p,{action:'import',kind:'outro',work:'ELYSIUM',rows})).status,400);
 }finally{await h.close();}
});
