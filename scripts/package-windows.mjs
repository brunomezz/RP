import { cp, copyFile, mkdir, rm, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
if(process.platform!=='win32'||process.arch!=='x64')throw Error('Gerar o pacote no Windows x64; use o workflow Pacote pessoal Windows do GitHub.');
const out=resolve('dist/windows/RP-Testes');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const files=['index.html','app.js','security-ui.js','communication-ui.js','domain.mjs','styles.css','assets','shared','migrations','package.json','package-lock.json','node_modules','desktop/smoke-local.mjs','scripts/dev-server.mjs','scripts/local-launcher.mjs','tests/integration/harness.mjs','tests/integration/fixture-worker.mjs'];
for(const file of files){const target=join(out,file);await mkdir(dirname(target),{recursive:true});await cp(file,target,{recursive:true});}
await mkdir(join(out,'runtime'));await copyFile(process.execPath,join(out,'runtime','node.exe'));
// Preserve the official runtime license; npm dependency licenses are retained in node_modules.
await copyFile(join(dirname(process.execPath),'LICENSE'),join(out,'runtime','LICENSE'));
const powershell=join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
execFileSync(powershell,['-NoProfile','-File',resolve('desktop/build-launcher.ps1'),'-OutputFile',join(out,'RP-Testes.exe')],{stdio:'inherit'});
await access(join(out,'RP-Testes.exe'));
await writeFile(join(out,'LEIA-ME.txt'),await readFile('desktop/LEIA-ME.txt'));
console.log('Pacote Windows gerado em '+out+'; validar RP-Testes.exe --check antes de publicar.');
