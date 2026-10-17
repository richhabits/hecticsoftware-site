#!/usr/bin/env node
// Submits every URL in sitemap.xml to IndexNow (Bing, Yandex, Seznam; Google ignores it).
// Run manually after a deploy: `node tools/indexnow.mjs`  (add --dry to print the payload only).
import { readFileSync } from "node:fs";
const host = "hecticsoftware.com";
const key = "933a6dac0acc0b7eb699badb807b337e";
const root = new URL("..", import.meta.url).pathname;
const urlList = [...readFileSync(root + "sitemap.xml", "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const body = { host, key, keyLocation: `https://${host}/${key}.txt`, urlList };
if (process.argv.includes("--dry")) { console.log(JSON.stringify(body, null, 2)); process.exit(0); }
const res = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
console.log(res.status, res.statusText, `(${urlList.length} URLs)`);
if (!res.ok && res.status !== 202) process.exit(1);
