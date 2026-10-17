# hecticsoftware.com — handover for AI agents and developers

Public site, client portal, studio console and API for **Hectic Software Ltd** (company 17514067, Watford WD24 7UB; contact hello@hecticsoftware.com). Owner: Romeo Valentine. This repo is **PUBLIC**: never commit secrets, client data or private notes.

## Rules (read first)
- **Facts only.** No invented clients, numbers, awards or reviews. Never "guarantee", "always", "100%". British English.
- **Design:** Archivo only, restrained sizes (hero ≤60px, section titles ≤40px), no serif, no italics, no uppercase monospace labels. Paper `#f6f5f2`, ink `#0d0d0d`, orange `#ff4d2e` (text `#cc3518`), teal `#0e7c7b` for good news. Show screenshots and get the owner's OK before any restyle.
- **The assistant is "Romeo"**: first person, professional, straight, light banter, **always labelled AI**, admits it's his AI if asked.
- **Git:** `main` deploys live on GitHub Pages. Unapproved work goes on a branch. Commit and push each finished piece. No GitHub Actions minutes (Pages' own build is free for this public repo).
- Everything runs on free tiers. Clean up processes and scratch files you create.

## Map
| Path | What | Deploy |
|---|---|---|
| `index.html`, `work/`, `start/`, `portal/`, `privacy/`, `404.html` | Public site (static) | push `main` |
| `tools/work.json` → `node tools/gen.mjs` | Generates the 23 `/work/<id>/` pages, hub, sitemap entries | push `main` |
| `tools/kb.mjs` | Builds the assistant's knowledge sheet (`kb.txt`, `api/src/kb.js`) from the site. **Run after any content change**, then deploy the API | push + API deploy |
| `chat.js` | "Ask Romeo" chat bubble (Chrome built-in AI first, API fallback). Bump `?v=` in pages when changed | push `main` |
| `live.js` | "Updated 2h ago" on work tiles from `/api/live` | push `main` |
| `admin/` | Studio console: KPIs, Needs you, Clients (list/board/CSV, drawer with AI quote draft), Opportunities, Estate, Romeo voice assistant. Key = `ADMIN_TOKEN` | push `main` |
| `api/` | Cloudflare Worker **hectic-api** + D1 `hectic-portal`, KV `FILES` + `RATE`, Workers AI | `cd api && CLOUDFLARE_ACCOUNT_ID=0b5fa03aa419a3d6a23f4307478db5d9 npx wrangler deploy` |
| `api/schema.sql` | D1 tables: projects, messages, files, activity, opportunities, pushes (all `IF NOT EXISTS`) | `npx wrangler d1 execute hectic-portal --remote --file schema.sql` |
| `api/src/finder.js` | Opportunity finder, hourly cron `23 * * * *`: Contracts Finder, Find a Tender (cursor in KV), HN, Reddit. Profiles: hectic, forged, ghost. **Finds and scores only; never contacts anyone** (PECR) | API deploy |
| `tools/estate.mjs` | Mac-side snapshot of GitHub repos, local git state and site health → `/api/admin/estate`. Runs every 3 h via `~/Library/LaunchAgents/com.hecticsoftware.estate.plist` (not in repo) | local |
| `tools/indexnow.mjs` | Pings Bing/Yandex IndexNow with every sitemap URL (key file at root). Run after big site changes | local |
| `.well-known/apple-app-site-association` | Universal links `/portal/*` → app `CC9Q9BH5NT.com.hecticsoftware.app` (app entitlement still to add) | push |

## API routes (hectic-api)
Public (Origin must be the site or the app): `POST /api/enquiry`, `GET /api/portal`, `POST /api/portal/message|file|delete`, `POST /api/ask`, `GET /api/file`, `GET /api/live`, `GET /api/health`.
Signed webhook: `POST /api/hook/github` (HMAC with `GITHUB_WEBHOOK_SECRET`; push hooks on 33 richhabits repos).
Admin (Bearer `ADMIN_TOKEN`, 10 wrong tries/hour locks the address): `/api/admin/projects|project|update|stats|opps|opp|opp/pitch|finder/run|draft-quote|estate|context|jarvis|kb`.

## Secrets (names and where they live, never values)
| Secret | Where |
|---|---|
| `ADMIN_TOKEN` (studio key) | Worker secret + macOS Keychain "Hectic Software admin token" |
| `GITHUB_WEBHOOK_SECRET` | Worker secret + Keychain "Hectic GitHub webhook secret" |
| Cloudflare | `wrangler` logged in on the Mac as the owner; account id above |
| App Store Connect API key | `~/.appstoreconnect/private_keys/AuthKey_KTG7Z46KBW.p8` |

## DNS, mail, hosting
GitHub Pages (CNAME `hecticsoftware.com`), DNS at IONOS. Mail: iCloud+ Custom Email Domain (`hello@`). `.co.uk/.uk/.online` redirect at IONOS. Client PIN pages (`/biteclub`, `/freshface`) are sealed from sources in the private repo `richhabits/hectic-client-pages`: never edit the sealed files directly.

## Open items
- Smart App Banner (`apple-itunes-app`, app id 6823141749) once the app is live (TODO comment in `index.html`).
- Pricing headline decision (research: London MVPs from £8k–£15k; estimator base £4k).
- Sourced London: confirm whether to keep it listed as Live (its old link was removed).
