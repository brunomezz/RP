import { build } from "esbuild";
import { mkdir, copyFile, cp, rm } from "node:fs/promises";
await mkdir("dist/sites/public", { recursive: true });
for (const file of ["index.html", "app.js", "domain.mjs", "styles.css"])
  await copyFile(file, "dist/sites/public/" + file);
await cp("assets", "dist/sites/public/assets", { recursive: true });
await build({
  entryPoints: ["hosting/worker.mjs"],
  outfile: "dist/sites/worker.mjs",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
console.log(
  "Bundle D1/R2 preparado. Login do Sites requer adapter oficial; publicação NÃO executada.",
);
