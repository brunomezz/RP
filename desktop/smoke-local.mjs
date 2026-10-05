// Exercise the real personal launcher/runtime. Works on Linux and the packaged Windows build.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { mkdtemp, rm, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=await mkdtemp(join(tmpdir(),'RP Testes pacote '));
const data=join(dir,'dados');
const node=process.platform==='win32'?join(root,'runtime','node.exe'):process.execPath;
const env={...process.env,FES_DEV_DATA_DIR:data,PORT:'0'};
let app;
async function boot(){
 const proc=spawn(node,[join(root,'scripts','local-launcher.mjs'),'--no-browser'],{env,stdio:['pipe','pipe','pipe']});
 const exit=once(proc,'exit');let logs='';proc.stderr.on('data',b=>logs+=b);
 const url=await new Promise((ok,fail)=>{
  const timer=setTimeout(()=>{proc.stdin.end();fail(Error('Inicialização excedeu 60 segundos: '+logs));},60000);
  createInterface({input:proc.stdout}).on('line',line=>{logs+=line+'\n';if(line.startsWith('RP_READY ')){clearTimeout(timer);ok(line.slice(9));}});
  proc.once('error',e=>{clearTimeout(timer);fail(e);});
  exit.then(([code])=>{clearTimeout(timer);fail(Error('Programa encerrou antes de abrir ('+code+'): '+logs));});
 });
 return {proc,url,async stop(){proc.stdin.write('stop\n');const [code]=await exit;assert.equal(code,0,logs);}};
}
async function get(path,cookie){return fetch(app.url+path,{headers:cookie?{Cookie:cookie}:{}});}
async function login(persona){
 const r=await fetch(app.url+'/dev/login',{method:'POST',body:new URLSearchParams({persona})});assert.equal(r.status,200);
 return r.headers.get('set-cookie').split(';')[0];
}
async function command(cookie,body){return fetch(app.url+'/api/commands',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)});}
try{
 app=await boot();
 const status=await (await get('/dev/status')).json();assert.equal(status.personal,true);
 assert.equal((await get('/api/state')).status,401);
 const html=await get('/');assert.equal(html.status,200);assert.match(await html.text(),/TESTE PESSOAL/);
 const admin=html.headers.get('set-cookie').split(';')[0];assert.equal((await (await get('/api/session',admin)).json()).isAdmin,true);
 assert.equal((await get('/api/state',await login('unassigned'))).status,403);
 let a=await login('user1'),e=await login('user2');
 const r=await command(a,{action:'create',work:'ELYSIUM',purpose:'Persistência do pacote pessoal',items:[{kind:'material',material:'bloco',qty:2,service:'alvenaria',neededDate:'2026-11-10',location:'Teste local'}]});
 assert.equal(r.status,200,await r.clone().text());const {id}=await r.json();
 const request=(await (await get('/api/state',e)).json()).requests.find(x=>x.id===id);assert.ok(request);
 assert.equal((await command(a,{action:'engineering',id,expectedRevision:request.revision,services:['alvenaria']})).status,403);
 const second=spawn(node,[join(root,'scripts','local-launcher.mjs'),'--no-browser'],{env,stdio:['pipe','pipe','pipe']});
 const [code]=await once(second,'exit');assert.equal(code,1,'Segundo processo não deve abrir o mesmo banco');
 await app.stop();app=null;
 // Simulate receiving an upgrade. Existing D1 must be backed up and preserved.
 await writeFile(join(data,'rp-version.json'),JSON.stringify({version:'versao-anterior'}));
 app=await boot();e=await login('user2');
 assert.ok((await (await get('/api/state',e)).json()).requests.some(x=>x.id===id));
 const backups=(await readdir(dir)).filter(n=>n.startsWith('dados-backup-'));assert.equal(backups.length,1);
 await access(join(dir,backups[0],'d1'));
 assert.equal(JSON.parse(await readFile(join(data,'rp-version.json'),'utf8')).version,status.version);
 await app.stop();app=null;
 console.log('PASS: pacote inicia, entra como Admin, troca cargos, valida permissões, bloqueia abertura duplicada, encerra, reinicia e preserva dados com backup de atualização.');
}finally{if(app)await app.stop();await rm(dir,{recursive:true,force:true});}
