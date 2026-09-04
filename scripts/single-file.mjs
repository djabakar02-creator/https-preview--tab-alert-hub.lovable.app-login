/**
 * Produit dist/beac-drc.html : l'application entière dans un seul fichier
 * (JS, CSS et polices inclus), utilisable sans serveur ni accès Internet.
 *
 *   VITE_ROUTER=hash npx vite build && node scripts/single-file.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve("dist");
let html = readFileSync(resolve(dist, "index.html"), "utf8");

// Feuilles de style → <style>
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_m, href) => {
  let css = readFileSync(resolve(dist, "." + href), "utf8");
  css = css.replace(/url\(["']?(\/fonts\/[^"')]+)["']?\)/g, (m, p) => {
    const f = resolve("public", "." + p);
    if (!existsSync(f)) return m;
    return `url(data:font/woff2;base64,${readFileSync(f).toString("base64")})`;
  });
  return `<style>${css}</style>`;
});

// Scripts → inline (le bundle Vite ne contient plus d'import externe)
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_m, src) => {
  const js = readFileSync(resolve(dist, "." + src), "utf8").replace(/<\/script/g, "<\\/script");
  return `<script type="module">${js}</script>`;
});

// Préchargements de polices locales devenus inutiles
html = html.replace(/\s*<link rel="preload"[^>]*\/fonts\/[^>]*>/g, "");
// Préchargement de modules Vite (déjà inline)
html = html.replace(/\s*<link rel="modulepreload"[^>]*>/g, "");

writeFileSync(resolve(dist, "beac-drc.html"), html);
console.log(`dist/beac-drc.html : ${(Buffer.byteLength(html) / 1024).toFixed(0)} Ko`);
