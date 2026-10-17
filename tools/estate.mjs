#!/usr/bin/env node
// Estate snapshot for the Studio console: every GitHub repo, every local clone's git state, and live-site health.
// Sends names, branches, counts and commit titles only (never code, diffs or secrets) to hectic-api with the studio key.
// Run by hand (`node tools/estate.mjs`) or every few hours by launchd (tools/com.hecticsoftware.estate.plist).
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://hectic-api.forged-landscapes.workers.dev";
const HOME = homedir();
const OWNERS = ["richhabits", "HecticRomeo"];
const SITES = [
  ["Hectic Software", "https://hecticsoftware.com/"], ["Hectic API", `${API}/api/health`], ["DJ Danny Hectic B", "https://djdannyhecticb.com/"],
  ["Volero", "https://volero.app/"], ["HecticTV", "https://hectictv.co.uk/"], ["Hectic Radio", "https://radiohectic.com/"],
  ["Main Line Provisions", "https://mainlineprovisions.co.uk/"], ["Forged Landscapes", "https://forgedlandscapes.co.uk/"],
  ["Ghost Detail", "https://ghostdetail.autos/"], ["Bite Club LDN", "https://thebiteclubldn.com/"], ["StreamAll", "https://streamall-639.pages.dev/"],
];
const SKIP = new Set(["Library", "node_modules", ".Trash", "Applications", "Pictures", "Music", "Movies", ".cache", ".npm", ".gradle", ".android", ".cocoapods", "DerivedData"]);

const run = (cmd, args, cwd) => { try { return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 30000 }).trim() } catch { return "" } };

function findRepos(dir, depth) {
  if (depth < 0) return [];
  let out = [];
  let entries; try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  if (entries.some(e => e.name === ".git")) return [dir];
  for (const e of entries) {
    if (!e.isDirectory() || SKIP.has(e.name) || (e.name.startsWith(".") && e.name !== ".claude")) continue;
    out = out.concat(findRepos(join(dir, e.name), depth - 1));
  }
  return out;
}

function local(dir) {
  const remote = run("git", ["remote", "get-url", "origin"], dir);
  const m = remote.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
  const porcelain = run("git", ["status", "--porcelain"], dir);
  return {
    path: dir.replace(HOME, "~"), slug: m ? `${m[1]}/${m[2]}`.toLowerCase() : null,
    branch: run("git", ["branch", "--show-current"], dir),
    dirty: porcelain ? porcelain.split("\n").length : 0,
    ahead: parseInt(run("git", ["rev-list", "--count", "@{u}..HEAD"], dir) || "0") || 0,
    lastCommit: run("git", ["log", "-1", "--format=%s (%cr)"], dir).slice(0, 140),
  };
}

const remote = OWNERS.flatMap(o => { try { return JSON.parse(run("gh", ["repo", "list", o, "--limit", "200", "--json", "name,owner,visibility,pushedAt,url,description,isArchived"]) || "[]") } catch { return [] } });
const clones = findRepos(HOME, 3).map(local);
const bySlug = new Map(clones.filter(c => c.slug).map(c => [c.slug, c]));

const repos = remote.filter(r => !r.isArchived).map(r => {
  const c = bySlug.get(`${r.owner.login}/${r.name}`.toLowerCase());
  return { name: `${r.owner.login}/${r.name}`, url: r.url, visibility: r.visibility.toLowerCase(), pushedAt: Date.parse(r.pushedAt), description: (r.description || "").slice(0, 140),
    local: !!c, path: c?.path, branch: c?.branch, dirty: c?.dirty || 0, ahead: c?.ahead || 0, lastCommit: c?.lastCommit };
}).sort((a, b) => (b.dirty + b.ahead) - (a.dirty + a.ahead) || b.pushedAt - a.pushedAt);
const orphans = clones.filter(c => !c.slug || !remote.some(r => `${r.owner.login}/${r.name}`.toLowerCase() === c.slug));

const sites = [];
for (const [name, url] of SITES) {
  const t = Date.now();
  try { const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) }); sites.push({ name, url, ok: r.ok, status: r.status, ms: Date.now() - t }) }
  catch (e) { sites.push({ name, url, ok: false, status: e.name === "TimeoutError" ? "timeout" : "error", ms: Date.now() - t }) }
}

const day = t => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const text = [
  `Sites: ${sites.filter(s => s.ok).length}/${sites.length} up.${sites.filter(s => !s.ok).map(s => ` DOWN: ${s.name} (${s.status}).`).join("")}`,
  `GitHub: ${repos.length} active repos (${repos.filter(r => r.visibility === "public").length} public). On this Mac: ${repos.filter(r => r.local).length} cloned.`,
  ...repos.map(r => `- ${r.name}${r.description ? ` — ${r.description}` : ""}. Last push ${day(r.pushedAt)}.${r.local ? ` Local ${r.branch || "?"}${r.dirty ? `, ${r.dirty} uncommitted files` : ""}${r.ahead ? `, ${r.ahead} commits not pushed` : ""}. Last commit: ${r.lastCommit}` : " Not cloned on this Mac."}`),
  orphans.length ? `Local folders not on GitHub under these accounts: ${orphans.map(o => `${o.path}${o.dirty ? ` (${o.dirty} changes)` : ""}`).join(", ")}` : "",
].join("\n");

const key = run("security", ["find-generic-password", "-s", "Hectic Software admin token", "-w"]) || run("security", ["find-generic-password", "-l", "Hectic Software admin token", "-w"]);
if (!key) { console.error("Studio key not found in the Keychain."); process.exit(1) }
const r = await fetch(`${API}/api/admin/estate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ text, repos, sites }) });
console.log(r.ok ? `Estate synced: ${repos.length} repos, ${clones.length} local clones, ${sites.filter(s => s.ok).length}/${sites.length} sites up.` : `Sync failed: ${r.status}`);
if (!r.ok) process.exit(1);
