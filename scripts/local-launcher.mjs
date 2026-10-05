// Personal testing only. Never included in the Sites worker.
import { mkdir, readFile, writeFile, open, unlink, cp, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline';
import { startDevServer } from './dev-server.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const {version}=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const base=process.env.LOCALAPPDATA||join(homedir(),'.local','share');
const dataDir=resolve(process.env.FES_DEV_DATA_DIR||join(base,'FasoloSimon','RP-Testes','data'));
const lockPath=dataDir+'.lock';
let ownsLock=false,app;
await mkdir(resolve(dataDir,'..'),{recursive:true});
async function acquire(){
 try{
  const lock=await open(lockPath,'wx');ownsLock=true;
  await lock.writeFile(JSON.stringify({pid:process.pid}));await lock.close();
 }catch(e){
  if(e.code!=='EEXIST')throw e;
  let prior;
  try{prior=JSON.parse(await readFile(lockPath,'utf8'));}catch{throw Error('Outro início está em andamento. Feche o RP — Testes e tente novamente.');}
  try{process.kill(prior.pid,0);}catch(error){
   if(error.code!=='ESRCH')throw error;
   await unlink(lockPath);return acquire();
  }
  throw Error('O RP — Testes já está aberto. Use a janela existente.');
 }
}
let stopping;
function stop(){return stopping||=(async()=>{
 await app?.close();
 if(ownsLock){await unlink(lockPath);ownsLock=false;}
})();}
try{
 await acquire();
 const marker=join(dataDir,'rp-version.json');
 let previous;
 try{previous=JSON.parse(await readFile(marker,'utf8')).version;}catch(e){if(e.code!=='ENOENT')throw e;}
 const exists=await stat(dataDir).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});
 if(exists&&previous!==version){
  const backup=dataDir+'-backup-'+new Date().toISOString().replace(/[:.]/g,'-');
  await cp(dataDir,backup,{recursive:true,errorOnExist:true,force:false});
  console.log('Backup antes da atualização: '+backup);
 }
 try{app=await startDevServer({dataDir,personal:true});}
 catch(e){if(e.code!=='EADDRINUSE')throw e;app=await startDevServer({dataDir,personal:true,port:0});}
 await writeFile(marker,JSON.stringify({version})+'\n');
 console.log('RP_READY '+app.url);
 console.log('Dados de teste: '+dataDir);
 const input=createInterface({input:process.stdin});
 input.on('line',line=>{if(line.trim()==='stop')stop().then(()=>process.exit(0)).catch(fail);});
 input.on('close',()=>stop().then(()=>process.exit(0)).catch(fail));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop().then(()=>process.exit(0)).catch(fail));
 if(!process.argv.includes('--no-browser')){
  const command=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';
  execFile(command,[app.url],error=>{if(error)console.error('Abra o navegador neste endereço: '+app.url);});
 }
}catch(error){await stop();fail(error);}
function fail(error){console.error('Não foi possível abrir o RP — Testes: '+error.message);process.exit(1);}
