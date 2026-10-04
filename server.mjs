import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8'};
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root)||!['index.html','styles.css','app.js','domain.mjs'].includes(path.relative(root,file))){res.writeHead(404);res.end('Não encontrado');return;}const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Não encontrado');}}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Protótipo FeS iniciado na porta '+(process.env.PORT||3000)));
