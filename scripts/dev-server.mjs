// Local validation ONLY. Uses Cloudflare's local D1/R2 runtime and test personas.
// This Node server is not the Sites deployment entrypoint.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness, personas } from "../tests/integration/harness.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const harness = await createHarness(
  resolve(process.env.FES_DEV_DATA_DIR || root + "/.dev-data"),
  {mail:process.env.FES_TEST_MAIL==='1'},
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
const login = `<div class="demo" id="dev-access"><strong>DESENVOLVIMENTO LOCAL — identidades fictícias${process.env.FES_TEST_MAIL==='1'?' · e-mails simulados, sem entrega':''}</strong><select id="dev-persona">${Object.entries(
  personas,
)
  .map(([key, p]) => `<option value="${key}">${p.name}</option>`)
  .join(
    "",
  )}</select><button id="dev-login">Entrar no teste</button><button id="dev-logout">Sair do teste</button></div><script type="module">document.querySelector('#dev-login').onclick=async()=>{await fetch('/dev/login',{method:'POST',body:new URLSearchParams({persona:document.querySelector('#dev-persona').value})});location.reload();};document.querySelector('#dev-logout').onclick=async()=>{await fetch('/dev/logout',{method:'POST'});location.reload();};</script>`;
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;
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
server.listen(Number(process.env.PORT || 3010), "127.0.0.1", () =>
  console.log(
    "ERP desenvolvimento: D1/R2 locais; porta " + (process.env.PORT || 3010),
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await harness.close();
      process.exit(0);
    }),
  );
