// Local validation ONLY. Uses Cloudflare's local D1/R2 runtime and test personas.
// This Node server is not the Sites deployment entrypoint.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness, personas } from "../tests/integration/harness.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
export async function startDevServer({port=Number(process.env.PORT || 3010),dataDir=process.env.FES_DEV_DATA_DIR || root + "/.dev-data",personal=false}={}) {
const harness = await createHarness(
  resolve(dataDir),
  {mail:personal||process.env.FES_TEST_MAIL==='1'},
);
const files = new Set([
  "index.html",
  "app.js", "security-ui.js", "communication-ui.js",
  "domain.mjs", "shared/permissions.mjs",
  "styles.css",
  "assets/fasolo-simon-logo.png",
  "assets/fasolo-simon-simbolo.png",
]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};
const login = `<style>#dev-access{flex-wrap:wrap}#dev-access strong{flex:1;min-width:200px}#dev-access select{max-width:100%}</style><div class="demo" id="dev-access"><strong>${personal?'TESTE PESSOAL — dados apenas neste computador':'DESENVOLVIMENTO LOCAL — identidades fictícias'}${personal||process.env.FES_TEST_MAIL==='1'?' · e-mails simulados, sem entrega':''}</strong><select id="dev-persona">${Object.entries(
  personas,
)
  .map(([key, p]) => `<option value="${key}" ${personal&&key==='admin'?'selected':''}>${p.name}</option>`)
  .join(
    "",
  )}</select><button id="dev-login">${personal?'Usar cargo':'Entrar no teste'}</button><button id="dev-logout" ${personal?'hidden':''}>Sair do teste</button></div><script type="module">document.querySelector('#dev-login').onclick=async()=>{await fetch('/dev/login',{method:'POST',body:new URLSearchParams({persona:document.querySelector('#dev-persona').value})});location.reload();};document.querySelector('#dev-logout').onclick=async()=>{await fetch('/dev/logout',{method:'POST'});location.reload();};${personal?`fetch('/api/identity').then(r=>r.json()).then(u=>{const ids=${JSON.stringify(Object.fromEntries(Object.entries(personas).map(([k,v])=>[v.id,k])))};if(ids[u.id])document.querySelector('#dev-persona').value=ids[u.id];});`:''}</script>`;
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;
    if (pathname === "/dev/status") {
      res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});
      res.end(JSON.stringify({app:"RP-Testes",personal,version:JSON.parse(await readFile(resolve(root,"package.json"),"utf8")).version}));return;
    }
    if (pathname.startsWith("/api/") || pathname.startsWith("/dev/")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const r = await harness.mf.dispatchFetch(
        "http://" + req.headers.host + req.url,
        {
          method: req.method,
          headers: req.headers,
          ...(!["GET", "HEAD"].includes(req.method)
            ? { body: Buffer.concat(chunks) }
            : {}),
        },
      );
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    const name = pathname === "/" ? "index.html" : pathname.slice(1);
    if (!files.has(name)) {
      res.writeHead(404);
      res.end();
      return;
    }
    if(personal&&name==="index.html") {
      const identity=await harness.mf.dispatchFetch("http://"+req.headers.host+"/api/identity",{headers:req.headers});
      if(identity.status===401){
        const login=await harness.mf.dispatchFetch("http://"+req.headers.host+"/dev/login",{method:"POST",body:new URLSearchParams({persona:"admin"})});
        res.setHeader("Set-Cookie",login.headers.get("set-cookie"));
      }
    }
    let data = await readFile(resolve(root, name));
    if (name === "index.html")
      data = Buffer.from(
        data
          .toString()
          .replace('<section id="content">', login + '<section id="content">'),
      );
    res.writeHead(200, {
      "Content-Type": types[extname(name)],
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end("Falha no desenvolvimento.");
    console.error(e.message);
  }
});
try {
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,"127.0.0.1",ok);});
} catch(error){await harness.close();throw error;}
const address=server.address();
console.log("ERP desenvolvimento: D1/R2 locais; porta "+address.port);
let closing;
return {server,url:"http://127.0.0.1:"+address.port,close(){
  return closing||=(async()=>{await new Promise(ok=>{server.close(ok);server.closeIdleConnections();});await harness.close();})();
}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=await startDevServer();
 for(const signal of ["SIGINT","SIGTERM"])process.on(signal,async()=>{await app.close();process.exit(0);});
}
