import {readFile,mkdir,writeFile} from 'node:fs/promises';
const root=new URL('../prototype/',import.meta.url);
const outputRoot=new URL('../',import.meta.url);
const html=await readFile(new URL('index.html',root),'utf8');
const css=await readFile(new URL('styles.css',root),'utf8');
const domain=(await readFile(new URL('domain.mjs',root),'utf8')).replace(/\bexport /g,'');
const app=(await readFile(new URL('app.js',root),'utf8')).replace(/^import .*?;\n/,'');
let output=html.replace('<link rel="stylesheet" href="./styles.css">',`<style>${css}</style>`).replace('<script type="module" src="./app.js"></script>',`<script type="module">${domain}\n${app}</script>`);
for(const asset of ['fasolo-simon-logo.png','fasolo-simon-simbolo.png']){const data=await readFile(new URL('assets/'+asset,root));output=output.replaceAll('./assets/'+asset,'data:image/png;base64,'+data.toString('base64'));}
await mkdir(new URL('dist/',outputRoot),{recursive:true});
await writeFile(new URL('dist/ERP_FeS_Demonstracao.html',outputRoot),output);
console.log('Gerado: dist/ERP_FeS_Demonstracao.html');
