// Generates /work/ pages, sitemap.xml and llms.txt from tools/work.json. Run: node tools/gen.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const work = JSON.parse(readFileSync(root + "tools/work.json", "utf8"));
const site = "https://hecticsoftware.com";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const today = new Date().toISOString().slice(0, 10);

const css = `:root{--paper:#f6f5f2;--ink:#0d0d0d;--grey:#6b6966;--rule:#d8d5cf;--red:#ff4d2e;--didone:"Bodoni Moda","Didot","Bodoni 72",Georgia,serif;--sans:"Archivo","Helvetica Neue",Arial,sans-serif;--mono:"JetBrains Mono",ui-monospace,monospace;color-scheme:light}
@media(prefers-color-scheme:dark){:root{--paper:#0d0d0d;--ink:#f6f5f2;--grey:#9a978f;--rule:#2a2826;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit}
.wrap{max-width:1320px;margin:0 auto;padding-left:max(20px,env(safe-area-inset-left,0px));padding-right:max(20px,env(safe-area-inset-right,0px))}
.bar{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--ink)}
.bar .wrap{display:flex;justify-content:space-between;align-items:center;height:54px}
.mark{font:900 22px/1 var(--sans);letter-spacing:-.04em;text-decoration:none;color:var(--red)}.mark i{color:var(--ink);font-style:normal}
.bar nav{display:flex;gap:20px}.bar nav a{text-decoration:none;font:600 11px var(--sans);letter-spacing:.2em;text-transform:uppercase}
.kicker{font:600 11px/1.3 var(--sans);letter-spacing:.24em;text-transform:uppercase;color:var(--red)}
.folio{font:500 11px var(--mono);letter-spacing:.08em;color:var(--grey)}
.head{display:flex;justify-content:space-between;padding-block:14px;border-bottom:1px solid var(--ink)}
h1{font:400 clamp(56px,11vw,170px)/.86 var(--didone);letter-spacing:-.045em;margin:28px 0 18px}
.stand{font:400 clamp(20px,2.4vw,30px)/1.3 var(--didone);font-style:italic;max-width:30ch;margin:0 0 28px}
.grid{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;padding-block:28px 56px;border-bottom:1px solid var(--ink)}
.body{font-size:19px;max-width:62ch}
.facts{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--ink)}
.facts div{padding:14px 0;border-bottom:1px solid var(--rule)}.facts b{display:block;font:600 11px var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--grey)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.chips span{border:1px solid var(--ink);padding:6px 12px;font:600 12px var(--sans);letter-spacing:.06em;text-transform:uppercase}
.shots{display:flex;gap:16px;overflow-x:auto;padding-block:32px;scroll-snap-type:x mandatory}.shots img{height:min(70vh,620px);width:auto;scroll-snap-align:start;border:1px solid var(--rule)}
.art{aspect-ratio:16/10;max-width:100%;background:linear-gradient(135deg,var(--red),#ff8a6e);display:grid;place-items:center;font:400 clamp(64px,10vw,140px)/1 var(--didone);color:#fff;font-style:italic}
.btn{display:inline-flex;gap:10px;background:var(--ink);color:var(--paper);text-decoration:none;font:600 11px var(--sans);letter-spacing:.2em;text-transform:uppercase;padding:14px 20px;margin-top:24px}.btn:hover{background:var(--red)}
.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0;border-top:1px solid var(--ink)}
.list a{display:block;padding:22px 20px 26px 0;border-bottom:1px solid var(--rule);text-decoration:none;min-width:0}
.list h2{font:400 34px/1 var(--didone);margin:8px 0 6px}.list p{color:var(--grey);font-size:15px;margin:0}
.next{display:flex;justify-content:space-between;gap:16px;padding-block:28px;flex-wrap:wrap}
footer{border-top:1px solid var(--ink);padding-block:22px;font:500 12px var(--mono);color:var(--grey)}
@media(max-width:860px){.grid{grid-template-columns:1fr}.bar nav{display:none}}`;

const shell = (title, desc, path, body, ld) => `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${site}${path}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${site}${path}">
<meta property="og:image" content="${site}/og.png"><meta property="og:type" content="article"><meta property="og:site_name" content="Hectic Software"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#f6f5f2">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..700&family=Archivo:wdth,wght@62..125,400..900&family=JetBrains+Mono:wght@500&display=swap">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>${css}</style></head><body>
<header class="bar"><div class="wrap"><a class="mark" href="/">HECTIC<i>.</i></a><nav><a href="/work/">Work</a><a href="/#ecosystems">Ecosystems</a><a href="/#platforms">Platforms</a><a href="/start/">Start a project</a></nav></div></header>
<main>${body}</main>
<footer><div class="wrap">© 2026 Hectic Software Ltd · London · <a href="/">hecticsoftware.com</a></div></footer></body></html>`;

const crumbs = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x[0], item: site + x[1] })) });

mkdirSync(root + "work", { recursive: true });
work.forEach((w, i) => {
  const path = `/work/${w.id}/`;
  const next = work[(i + 1) % work.length], prev = work[(i - 1 + work.length) % work.length];
  const isApp = w.platforms.some(p => !["Web"].includes(p));
  const title = `${w.name} · ${w.kind} ${isApp ? "app" : "website"} by Hectic Software`;
  const desc = `${w.blurb} ${w.stage === "Live" ? "Live now" : w.stage === "Concept" ? "A concept" : "In production"} for ${w.platforms.join(", ")}. Designed and built in London by Hectic Software.`;
  const shots = w.shots.length
    ? `<div class="wrap shots">${w.shots.map((s, n) => `<img src="/img/${s}.webp" alt="${esc(w.name)} app screenshot ${n + 1} of ${w.shots.length}" loading="${n ? "lazy" : "eager"}" decoding="async">`).join("")}</div>`
    : `<div class="wrap" style="padding-block:32px"><div class="art" role="img" aria-label="${esc(w.name)}">${esc(w.name)}</div></div>`;
  const body = `<div class="wrap head"><span class="kicker">${esc(w.stage)} · ${esc(w.kind)}</span><span class="folio">No. ${String(i + 1).padStart(2, "0")}</span></div>
<article><div class="wrap"><h1>${esc(w.name)}</h1><p class="stand">${esc(w.blurb)}</p></div>
${shots}
<div class="wrap grid"><div><p class="body">${esc(w.body)}</p>${w.link ? `<a class="btn" href="${w.link}" rel="noopener">Visit ${esc(w.name)} →</a>` : ""}<a class="btn" href="/start/" style="margin-left:8px;background:var(--red)">Build something like this</a></div>
<div><div class="facts"><div><b>Stage</b>${esc(w.stage)}</div><div><b>Status</b>${esc(w.status)}</div><div><b>Type</b>${esc(w.kind)}</div><div><b>Studio</b>Hectic Software</div></div>
<div class="chips">${w.platforms.map(p => `<span>${esc(p)}</span>`).join("")}</div></div></div></article>
<nav class="wrap next" aria-label="More work"><a href="/work/${prev.id}/">← ${esc(prev.name)}</a><a href="/work/">All work</a><a href="/work/${next.id}/">${esc(next.name)} →</a></nav>`;
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": isApp ? "SoftwareApplication" : "WebSite", name: w.name, description: w.body, url: w.link || site + path,
      ...(isApp ? { applicationCategory: w.kind, operatingSystem: w.platforms.join(", ") } : {}),
      creator: { "@type": "Organization", name: "Hectic Software Ltd", url: site },
      ...(w.shots[0] ? { image: `${site}/img/${w.shots[0]}.webp` } : {}) },
    crumbs([["Hectic Software", "/"], ["Work", "/work/"], [w.name, path]]) ] };
  mkdirSync(root + "work/" + w.id, { recursive: true });
  writeFileSync(root + "work/" + w.id + "/index.html", shell(title, desc, path, body, ld));
});

const groups = ["Live", "In production", "Concept"];
const hub = `<div class="wrap head"><span class="kicker">The Archive · Everything we've made</span><span class="folio">${work.length} pieces</span></div>
<div class="wrap"><h1>The work.</h1><p class="stand">Apps, platforms and websites designed and built in London, for Apple, Android, the web and the big screen.</p></div>
${groups.map(g => `<section class="wrap" style="padding-block:20px 40px"><p class="kicker">${g === "Concept" ? "Concepts" : g}</p><div class="list">${work.filter(w => w.stage === g).map(w => `<a href="/work/${w.id}/"><span class="folio">${esc(w.kind)} · ${esc(w.status)}</span><h2>${esc(w.name)}</h2><p>${esc(w.blurb)}</p></a>`).join("")}</div></section>`).join("")}`;
writeFileSync(root + "work/index.html", shell("Work · Apps, platforms and websites by Hectic Software, London",
  `The full archive of Hectic Software: ${work.filter(w => w.stage === "Live").length} live products, ${work.filter(w => w.stage === "In production").length} in production and concepts, across iPhone, iPad, Mac, Apple TV, Watch, Vision Pro, Android and the web.`,
  "/work/", hub, { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", name: "Hectic Software work", url: site + "/work/", hasPart: work.map(w => ({ "@type": "CreativeWork", name: w.name, url: `${site}/work/${w.id}/` })) },
    crumbs([["Hectic Software", "/"], ["Work", "/work/"]]) ] }));

const urls = [["/", "1.0", "weekly"], ["/work/", "0.9", "weekly"], ["/start/", "0.8", "monthly"], ["/privacy/", "0.3", "yearly"], ...work.map(w => [`/work/${w.id}/`, w.stage === "Live" ? "0.8" : "0.6", "monthly"])];
writeFileSync(root + "sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, p, f]) => `<url><loc>${site}${u}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join("\n")}\n</urlset>\n`);

writeFileSync(root + "llms.txt", `# Hectic Software\n\n> London app studio founded by Romeo Valentine. Designs, builds and launches native apps for iPhone, iPad, Mac, Apple Watch, Apple TV and Vision Pro, and Android, with the websites and platforms behind them (accounts, payments, booking, chat, admin panels, client portals, on-device AI).\n\nContact: hello@hecticsoftware.com · Start a project: ${site}/start/\n\n## Work\n${work.map(w => `- [${w.name}](${site}/work/${w.id}/): ${w.blurb} (${w.stage}; ${w.platforms.join(", ")})`).join("\n")}\n`);
console.log("generated", work.length, "pages");
