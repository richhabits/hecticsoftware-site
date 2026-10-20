// Opportunity finder: public tenders and public "hiring" posts for each of Romeo's businesses.
// Sources are official open APIs and public feeds only (Contracts Finder, Find a Tender, Hacker News, Reddit RSS).
// It finds and scores; it never contacts anyone. Runs hourly on a Cron Trigger, bounded so it fits the free plan.

const UA = "HecticSoftware-OpportunityFinder/1.0 (+https://hecticsoftware.com; hello@hecticsoftware.com)";
const DAY = 86400000;

// One profile per business. Terms are matched on whole words in title + description.
export const PROFILES = {
  hectic: {
    name: "Hectic Software",
    search: ["mobile app", "app development", "application development", "website", "web application", "digital platform", "booking system", "software development", "client portal", "loyalty app", "ordering app"],
    strong: ["ios", "iphone", "ipad", "swift", "swiftui", "android", "kotlin", "mobile app", "mobile apps", "mobile application", "app development", "app developer", "native app", "apple watch", "app store", "google play", "apple pay"],
    medium: ["website", "web app", "web application", "web portal", "client portal", "booking system", "digital platform", "software development", "ux", "user experience", "prototype", "mvp", "startup", "react", "progressive web app", "chatbot", "ai assistant", "loyalty", "ordering", "payments", "booking"],
    cpv: { "72": 15, "7221": 20, "7222": 10, "72413": 20, "48": 5 },
    near: null,
  },
  forged: {
    name: "Forged Landscapes",
    search: ["grounds maintenance", "landscaping", "hard landscaping", "paving", "tree works"],
    strong: ["landscaping", "hard landscaping", "soft landscaping", "grounds maintenance", "paving", "patio", "driveway", "driveways", "resin", "block paving", "fencing", "turfing", "artificial grass"],
    medium: ["grounds", "garden", "gardens", "planting", "hedge", "tree works", "playground", "open spaces", "public realm", "groundworks", "kerbing", "drainage"],
    cpv: { "77": 15, "45112": 15, "45236": 10, "45233": 5 },
    near: { lat: 51.656, lon: -0.396, miles: 30 }, // Watford WD17; Forged covers ~20 miles
  },
  ghost: {
    name: "Ghost Detail",
    search: ["vehicle valeting", "car valeting"],
    strong: ["valeting", "vehicle valeting", "car valeting", "fleet cleaning", "vehicle cleaning", "detailing", "ceramic coating"],
    medium: ["fleet", "vehicle", "vehicles", "car wash"],
    cpv: { "50112300": 25, "98351": 5 },
    near: { lat: 51.656, lon: -0.396, miles: 30 },
  },
};

// Work none of the businesses should chase: products, staffing, hardware, heavy IT, huge frameworks.
// Hertfordshire, neighbouring counties, and London — local council and public-body buyers.
const LOCAL_REGIONS = "London,East of England,South East";
const LOCAL_BUYER = /\b(hertfordshire|watford|st albans|dacorum|hertsmere|broxbourne|stevenage|welwyn hatfield|three rivers|east hertfordshire|north hertfordshire|bedford(?:shire)?|central bedfordshire|luton|buckinghamshire|essex county|southend|thurrock|cambridgeshire|peterborough|greater london|transport for london|london borough|city of london|westminster|barnet|enfield|harrow|hillingdon|ealing|haringey|hertsmere|welwyn)\b/i;
const LOCAL_PLACE = /\b(hertfordshire|bedfordshire|buckinghamshire|cambridgeshire|essex|greater london|london|watford|luton|st albans)\b/i;
const LOCAL_BUYER_SEARCH = [
  "Hertfordshire County Council", "Watford Borough Council", "St Albans City and District",
  "Dacorum Borough Council", "Hertsmere Borough Council", "Stevenage Borough Council",
  "Welwyn Hatfield Borough Council", "Three Rivers District Council", "Broxbourne Borough Council",
  "East Hertfordshire District Council", "North Hertfordshire District Council",
  "Bedford Borough Council", "Central Bedfordshire Council", "Luton Borough Council",
  "Buckinghamshire Council", "Essex County Council", "Cambridgeshire County Council",
  "Greater London Authority", "Transport for London", "London Borough", "City of London Corporation",
];

function isLocalCouncil(o) {
  const blob = `${o.buyer || ""} ${o.region || ""} ${o.title || ""}`;
  return LOCAL_BUYER.test(blob) || LOCAL_PLACE.test(blob);
}

const NEGATIVE = ["licence", "licences", "license", "licenses", "subscription renewal", "hardware", "laptops", "printers", "telephony", "telecoms", "network infrastructure", "cctv", "telematics",
  "erp", "sap", "oracle", "microsoft 365", "managed service", "cyber security", "penetration testing", "recruitment", "staffing", "agency workers", "temporary staff", "insurance", "catering", "cleaning services", "for hire]"];

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hit = (text, term) => new RegExp(`(^|[^a-z0-9])${esc(term)}([^a-z0-9]|$)`, "i").test(text);
const strip = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();
function miles(a, b) {
  const r = x => x * Math.PI / 180, R = 3958.8;
  const d = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(d));
}

/** Scores one opportunity against one business. Returns { score 0–100, why[] }. */
export function score(profile, o) {
  const text = `${o.title} ${o.summary}`.toLowerCase();
  let s = 0; const why = [];
  const strong = profile.strong.filter(t => hit(text, t)), medium = profile.medium.filter(t => hit(text, t));
  if (strong.length) { s += Math.min(55, 30 + 10 * (strong.length - 1)); why.push(...strong.slice(0, 4)); }
  if (medium.length) { s += Math.min(25, 10 * medium.length); why.push(...medium.slice(0, 3)); }
  for (const code of (o.cpv || [])) {
    const best = Object.entries(profile.cpv).filter(([p]) => code.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
    if (best) { s += best[1]; why.push(`CPV ${code}`); break; }
  }
  const neg = NEGATIVE.filter(t => hit(text, t));
  if (neg.length) { s -= 30; why.push(`not for us: ${neg[0]}`); }
  if (o.kind === "tender") {
    if (o.sme) { s += 5; why.push("SME-suitable"); }
    if (o.value_high > 2_000_000 || o.value_low > 2_000_000) { s -= 15; why.push("very large contract"); }
    else if (o.value_low && o.value_low <= 150_000) { s += 5; }
    if (o.deadline && o.deadline < Date.now() + 3 * DAY) { s -= 10; why.push("closes within 3 days"); }
  }
  if (profile.near) {
    if (o.lat == null) { if (o.kind === "tender") s -= 10; }
    else {
      const m = miles(profile.near, { lat: o.lat, lon: o.lon });
      if (m <= profile.near.miles) { s += 10; why.push(`${Math.round(m)} miles away`); } else { s -= 40; why.push(`${Math.round(m)} miles away`); }
    }
  }
  if (o.kind === "tender" && isLocalCouncil(o)) {
    s += 18; why.push("Herts / neighbouring / London council");
  }
  return { score: Math.max(0, Math.min(100, s)), why };
}

// ---------- sources ----------

function noticeRow(n, source = "Contracts Finder") {
  const [lat, lon] = (n.coordinates || "").split(",").map(Number);
  return {
    id: `cf:${n.id}`, source, kind: "tender", title: strip(n.title), buyer: strip(n.organisationName),
    url: `https://www.contractsfinder.service.gov.uk/Notice/${n.id}`, summary: strip(n.description).slice(0, 1500),
    value_low: n.valueLow || 0, value_high: n.valueHigh || 0, deadline: Date.parse(n.deadlineDate) || null,
    published: Date.parse(n.publishedDate) || Date.now(), region: n.regionText || n.postcode || "",
    cpv: (n.cpvCodes || "").split(/\s+/).filter(Boolean), sme: !!n.isSuitableForSme,
    lat: Number.isFinite(lat) ? lat : null, lon: Number.isFinite(lon) ? lon : null,
  };
}

async function cfSearch(criteria, size = 50) {
  const r = await fetch("https://www.contractsfinder.service.gov.uk/api/rest/2/search_notices/json", {
    method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ searchCriteria: criteria, size }),
  });
  if (!r.ok) throw new Error(`contracts_finder ${r.status}`);
  return ((await r.json()).noticeList || []).map(x => x.item).filter(Boolean);
}

async function contractsFinder(profile) {
  const from = new Date(Date.now() - 21 * DAY).toISOString().slice(0, 19);
  const out = [];
  for (const keyword of profile.search) {
    out.push(...(await cfSearch({ keyword, statuses: ["Open"], publishedFrom: from })).map(n => noticeRow(n)));
  }
  return out;
}

/** Open notices for Herts, Beds, Bucks, Essex, Cambs, and London councils. */
async function localCouncilTenders({ buyers = true } = {}) {
  const from = new Date(Date.now() - 28 * DAY).toISOString().slice(0, 19);
  const out = [];
  for (const keyword of ["software development", "website", "mobile app", "digital platform", "grounds maintenance", "landscaping"]) {
    out.push(...(await cfSearch({ keyword, statuses: ["Open"], publishedFrom: from, regions: LOCAL_REGIONS, suitableForSme: true }, 80))
      .map(n => noticeRow(n, "Contracts Finder · local")));
  }
  if (buyers) {
    for (const keyword of LOCAL_BUYER_SEARCH) {
      out.push(...(await cfSearch({ keyword, statuses: ["Open"], publishedFrom: from }, 40))
        .map(n => noticeRow(n, "Contracts Finder · council")));
    }
  }
  return out;
}

// Find a Tender has no keyword search, so it is read as a stream with the cursor kept in KV, a few small pages per run.
async function findATender(env, pages = 3) {
  let next = await env.RATE.get("finder:fts:next");
  if (!next) {
    const from = new Date(Date.now() - 2 * DAY).toISOString().slice(0, 19);
    next = `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?updatedFrom=${from}&stages=planning,tender&limit=20`;
  }
  const out = [];
  for (let i = 0; i < pages && next; i++) {
    const r = await fetch(next, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!r.ok) throw new Error(`find_a_tender ${r.status}`);
    const d = await r.json();
    for (const x of d.releases || []) {
      const t = x.tender || {};
      const cpv = [t.classification?.id, ...(t.items || []).flatMap(it => (it.additionalClassifications || []).map(c => c.id))].filter(Boolean);
      const addr = (x.parties || []).find(p => (p.roles || []).includes("buyer"))?.address || {};
      out.push({
        id: `fts:${x.ocid}`, source: "Find a Tender", kind: "tender", title: strip(t.title), buyer: strip(x.buyer?.name),
        url: `https://www.find-tender.service.gov.uk/Notice/${x.id}`, summary: strip(t.description).slice(0, 1500),
        value_low: t.value?.amountGross || t.value?.amount || 0, value_high: 0, deadline: Date.parse(t.tenderPeriod?.endDate) || null,
        published: Date.parse(x.date) || Date.now(), region: [addr.locality, addr.postalCode].filter(Boolean).join(" "),
        cpv, sme: !!(t.lots || []).some(l => l.suitability?.sme), lat: null, lon: null,
        stage: (x.tag || []).includes("planning") ? "pre-market" : "tender",
      });
    }
    next = d.links?.next || null;
  }
  // When the stream is exhausted, restart from the last hour next time.
  if (next) await env.RATE.put("finder:fts:next", next, { expirationTtl: 3 * 86400 });
  else await env.RATE.delete("finder:fts:next");
  return out;
}

async function hackerNews() {
  const s = await fetch("https://hn.algolia.com/api/v1/search_by_date?query=%22Freelancer%3F%20Seeking%20freelancer%3F%22&tags=story,ask_hn&hitsPerPage=1", { headers: { "User-Agent": UA } });
  if (!s.ok) throw new Error(`hn ${s.status}`);
  const story = (await s.json()).hits?.[0];
  if (!story) return [];
  const r = await fetch(`https://hn.algolia.com/api/v1/search?tags=comment,story_${story.objectID}&query=SEEKING%20FREELANCER&hitsPerPage=200`, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`hn ${r.status}`);
  return ((await r.json()).hits || []).filter(h => /seeking freelancer/i.test(h.comment_text || "")).map(h => {
    const text = strip(h.comment_text);
    return { id: `hn:${h.objectID}`, source: "Hacker News", kind: "post", title: text.slice(0, 120), buyer: h.author, url: `https://news.ycombinator.com/item?id=${h.objectID}`,
      summary: text.slice(0, 1500), published: Date.parse(h.created_at) || Date.now(), value_low: 0, value_high: 0, deadline: null, region: /\b(uk|london|europe|remote)\b/i.exec(text)?.[0] || "", cpv: [], lat: null, lon: null };
  });
}

async function reddit() {
  const out = [], failed = [];
  for (const sub of ["forhire", "hireaprogrammer"]) {
    const r = await fetch(`https://www.reddit.com/r/${sub}/new/.rss?limit=50`, { headers: { "User-Agent": UA } });
    if (!r.ok) { failed.push(`${sub} ${r.status}`); continue; } // Reddit throttles shared cloud IPs; keep what we got
    const xml = await r.text();
    for (const e of xml.split("<entry>").slice(1)) {
      const title = strip((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
      if (sub === "forhire" && !/\[\s*hiring\s*\]/i.test(title)) continue;
      if (/\[\s*for hire\s*\]/i.test(title)) continue;
      const link = (e.match(/<link href="([^"]+)"/) || [])[1] || "";
      const id = (e.match(/<id>([^<]+)<\/id>/) || [])[1] || link;
      const body = strip(strip((e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1]));
      out.push({ id: `rd:${id}`, source: `Reddit r/${sub}`, kind: "post", title, buyer: strip((e.match(/<name>([\s\S]*?)<\/name>/) || [])[1]), url: link,
        summary: body.slice(0, 1500), published: Date.parse((e.match(/<updated>([^<]+)/) || [])[1]) || Date.now(), value_low: 0, value_high: 0, deadline: null, region: "", cpv: [], lat: null, lon: null });
    }
  }
  if (failed.length && !out.length) throw new Error(`reddit ${failed.join(", ")}`);
  return out;
}

// ---------- run ----------

/** One finder pass. Light sources every run; keyword searches every 6 hours (or when forced). */
export async function runFinder(env, { force = false } = {}) {
  const hour = new Date().getUTCHours();
  const jobs = [["Find a Tender", () => findATender(env, force ? 8 : 3)]];
  if (force || hour % 3 === 0) jobs.push(["Hacker News", hackerNews], ["Reddit", reddit]);
  if (force || hour % 6 === 0) {
    for (const p of Object.values(PROFILES)) jobs.push([`Contracts Finder (${p.name})`, () => contractsFinder(p)]);
    jobs.push(["Local councils (Herts, neighbours, London)", () => localCouncilTenders({ buyers: force || hour % 12 === 0 })]);
  }

  const found = [], errors = [];
  for (const [name, job] of jobs) {
    try { found.push(...await job()); } catch (e) { errors.push(`${name}: ${e.message}`); }
  }
  const now = Date.now(), seen = new Set(), rows = [];
  for (const o of found) {
    if (seen.has(o.id) || !o.title || !/^https:\/\//i.test(o.url || "")) continue;
    seen.add(o.id);
    if (o.deadline && o.deadline < now) continue;
    if (o.kind === "post" && o.published < now - 45 * DAY) continue;
    // Best-matching business wins.
    let best = null;
    for (const [key, p] of Object.entries(PROFILES)) {
      if (o.kind === "post" && key !== "hectic") continue; // hiring posts are developer work
      const r = score(p, o);
      if (!best || r.score > best.score) best = { key, ...r };
    }
    if (best.score < 35) continue;
    rows.push(env.DB.prepare(`INSERT INTO opportunities (id, business, source, kind, stage, title, buyer, url, summary, value_low, value_high, deadline, published, region, score, why, status, found_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?,?) ON CONFLICT(id) DO UPDATE SET deadline = excluded.deadline, score = excluded.score, why = excluded.why, updated_at = excluded.updated_at`)
      .bind(o.id, best.key, o.source, o.kind, o.stage || (o.kind === "tender" ? "tender" : "post"), o.title.slice(0, 300), (o.buyer || "").slice(0, 200), o.url, o.summary,
        o.value_low || 0, o.value_high || 0, o.deadline, o.published, (o.region || "").slice(0, 120), best.score, best.why.join(", ").slice(0, 400), now, now));
  }
  for (let i = 0; i < rows.length; i += 50) await env.DB.batch(rows.slice(i, i + 50));
  const summary = { at: now, checked: found.length, kept: rows.length, errors };
  await env.RATE.put("finder:last", JSON.stringify(summary));
  return summary;
}
