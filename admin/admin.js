// Studio console for Hectic Software: pipeline, opportunities, estate, and HECTIC, the voice assistant.
// Everything shown comes from hectic-api with the studio key; values are always set as text, never as HTML.
(() => {
  if (window.top !== window.self) { document.documentElement.hidden = true; return } // never inside a frame
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const store = { get: k => { try { return localStorage.getItem(k) } catch { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch {} } };
  let key = ""; try { key = sessionStorage.getItem("hs-admin") || "" } catch {}

  const STAGES = [["new", "New"], ["reviewing", "Reviewing"], ["quoted", "Quoted"], ["accepted", "Accepted"], ["in_progress", "Building"], ["beta", "Beta"], ["live", "Live"], ["closed", "Closed"]];
  const stageName = s => (STAGES.find(x => x[0] === s) || [s, s])[1];
  const OPP = [["new", "New"], ["saved", "Saved"], ["pitching", "Pitching"], ["submitted", "Submitted"], ["won", "Won"], ["lost", "Lost"], ["ignored", "Ignored"]];
  const REPLIES = [
    ["Book a call", "Thanks for the brief. The quickest next step is a 15-minute call so I can ask a few questions and get you a fixed written quote. What times suit you this week?\n\nRomeo, Hectic Software"],
    ["Quote ready", "Your fixed written quote is now in your project page. It lists exactly what's included, the timeline and the payment stages. Any questions, just reply here.\n\nRomeo, Hectic Software"],
    ["Beta ready", "A working beta is ready to install on your phone. I've added the install link to your project page. Have a play and send me anything that feels off.\n\nRomeo, Hectic Software"],
  ];

  // ---------- API ----------
  const api = (p, o = {}) => fetch(HS_API + "/api/admin" + p, { ...o, headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" } })
    .then(async r => { if (r.status === 401) { lock(); throw 401 } if (!r.ok) throw r.status; return r.json() });
  const post = (p, body) => api(p, { method: "POST", body: JSON.stringify(body) });

  // ---------- tiny DOM helpers (text only) ----------
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }
  const fill = (node, ...kids) => node.replaceChildren(...kids.flat().filter(k => k != null && k !== false));
  const icon = id => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", "#i-" + id); s.append(u); return s };
  const ago = t => { if (!t) return ""; const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d` };
  const until = t => { const d = Math.ceil((t - Date.now()) / 86400000); return d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days` };
  const money = n => n ? "£" + Number(n).toLocaleString("en-GB") : "";
  const safeUrl = u => /^https:\/\/[^\s"'<>]+$/i.test(u || "") ? u : null;
  const download = async f => {
    const r = await fetch(`${HS_API}/api/file?id=${encodeURIComponent(f.id)}`, { headers: { Authorization: "Bearer " + key } });
    if (!r.ok) return toast("Couldn't download that file");
    const a = el("a", { href: URL.createObjectURL(await r.blob()), download: f.name }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const toast = msg => { const t = el("div", { class: "toast", text: msg }); document.body.append(t); setTimeout(() => t.remove(), 2400) };

  // ---------- session ----------
  function lock() { key = ""; try { sessionStorage.removeItem("hs-admin") } catch {} $("#app").hidden = true; $("#login").hidden = false; $("#key").focus() }
  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault(); key = $("#key").value.trim();
    try { await api("/stats"); try { sessionStorage.setItem("hs-admin", key) } catch {} start() } catch { $("#loginNote").textContent = "That key didn't work." }
  });
  $("#logout").onclick = lock;

  // ---------- theme + clock ----------
  const applyTheme = t => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme };
  applyTheme(store.get("hs-theme"));
  $("#themeBtn").onclick = () => { const dark = getComputedStyle(document.documentElement).colorScheme === "dark"; const t = dark ? "light" : "dark"; applyTheme(t); store.set("hs-theme", t) };
  setInterval(() => { $("#clock").textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }, 1000);

  // ---------- tabs ----------
  let tab = store.get("hs-tab") || "overview";
  function showTab(t) {
    tab = t; store.set("hs-tab", t);
    $$(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
    $$("[data-panel]").forEach(p => p.hidden = p.dataset.panel !== t);
    ({ overview: loadOverview, clients: loadClients, opps: loadOpps, estate: loadEstate })[t]();
  }
  $$(".tabs button").forEach(b => b.onclick = () => showTab(b.dataset.tab));

  // ---------- drawer ----------
  function openDrawer(...content) { fill($("#drawerBody"), ...content); $("#drawer").hidden = false; $("#scrim").hidden = false; $("#drawer").scrollTop = 0 }
  function closeDrawer() { $("#drawer").hidden = true; $("#scrim").hidden = true }
  $("#drawerClose").onclick = closeDrawer; $("#scrim").onclick = closeDrawer;
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer() });

  // ---------- overview ----------
  let stats = null, projects = [], opps = [];
  const kpi = (v, l, ic, cls) => el("div", { class: "kpi " + (cls || "") }, el("div", { class: "v", text: v ?? "–" }), el("div", { class: "l" }, icon(ic), l));
  async function loadOverview() {
    const [s, p, o] = await Promise.all([api("/stats"), api("/projects"), api("/opps?min=35")]);
    stats = s; projects = p; opps = o.rows;
    fill($("#kpis"), 
      kpi(s.awaitingReply, "Waiting on you", "chat", s.awaitingReply ? "hot" : ""),
      kpi(s.enquiriesThisWeek, `New this week · ${s.enquiriesLastWeek} last`, "person"),
      kpi(s.quoted, "Quotes out", "file"),
      kpi(s.active, "In build", "stack", s.active ? "good" : ""),
      kpi(s.medianFirstReplyHours == null ? "–" : s.medianFirstReplyHours + "h", "Median first reply", "clock"),
      kpi(s.oppsNewThisWeek, "Leads found this week", "target", s.oppsNewThisWeek ? "good" : ""),
      kpi(s.oppsClosingSoon, "Closing this week", "clock", s.oppsClosingSoon ? "hot" : ""),
      kpi(s.oppsWon, "Won from leads", "check", s.oppsWon ? "good" : ""));
    const needs = [];
    for (const x of p.filter(x => x.last_author === "client" && x.status !== "closed")) needs.push(row("chat", x.name + (x.company ? " · " + x.company : ""), "Client replied, waiting on you", ago(x.updated_at), "hot", () => openProject(x.id)));
    for (const x of p.filter(x => x.status === "new" && !x.last_author)) needs.push(row("person", x.name + (x.company ? " · " + x.company : ""), `New brief: ${x.project_type || "project"}${x.budget ? ", " + x.budget : ""}`, ago(x.created_at), "hot", () => openProject(x.id)));
    for (const x of opps.filter(x => ["new", "saved", "pitching"].includes(x.status) && x.deadline && x.deadline < Date.now() + 7 * 86400000).slice(0, 5))
      needs.push(row("target", x.title, `${x.buyer || x.source} · closes in ${until(x.deadline)}`, x.score, "", () => openOpp(x)));
    if (!needs.length) needs.push(el("div", { class: "empty", text: "Nothing needs you right now." }));
    fill($("#needs"), ...needs);
    fill($("#pushes"), ...(s.pushes.length ? s.pushes.slice(0, 8).map(x => row("up", x.repo.split("/")[1] + " · " + x.branch, x.message.split("\n")[0], ago(x.at), "good", () => window.open("https://github.com/" + x.repo, "_blank", "noopener,noreferrer")))
      : [el("div", { class: "empty", text: "Pushes appear here the moment they reach GitHub." })]));
  }
  function row(ic, title, sub, meta, cls, onclick) {
    return el("button", { class: "row", onclick }, el("span", { class: "dot " + (cls || "") }), el("div", {}, el("div", { class: "t", text: title }), el("div", { class: "s", text: sub })), el("div", { class: "meta" }, icon(ic), String(meta ?? "")));
  }

  // ---------- clients ----------
  let cStage = "", cType = "", cView = store.get("hs-cview") || "list";
  async function loadClients() { projects = await api("/projects"); renderClients() }
  function renderClients() {
    const q = $("#cSearch").value.trim().toLowerCase();
    const match = x => !q || [x.name, x.company, x.email, x.id, x.project_type].join(" ").toLowerCase().includes(q);
    const base = projects.filter(match);
    const types = [...new Set(base.map(x => x.project_type).filter(Boolean))].sort();
    const shown = base.filter(x => (!cStage || x.status === cStage) && (!cType || x.project_type === cType));
    fill($("#cChips"), el("button", { "aria-pressed": !cStage && !cType, onclick: () => { cStage = ""; cType = ""; renderClients() } }, `All ${base.length}`),
      ...STAGES.map(([k, n]) => { const c = base.filter(x => x.status === k).length; return c ? el("button", { "aria-pressed": cStage === k, onclick: () => { cStage = k; renderClients() } }, `${n} ${c}`) : null }),
      ...types.map(t => { const c = base.filter(x => x.project_type === t).length; return el("button", { "aria-pressed": cType === t, onclick: () => { cType = cType === t ? "" : t; renderClients() } }, `${t} ${c}`) }));
    $$("#cView button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === cView));
    $("#cList").hidden = cView !== "list"; $("#cBoard").hidden = cView !== "board";
    const typeGroups = [...new Set(shown.map(x => x.project_type || "Uncategorised"))].sort();
    const clientChunks = [];
    for (const t of typeGroups) {
      const items = shown.filter(x => (x.project_type || "Uncategorised") === t);
      if (typeGroups.length > 1) clientChunks.push(el("h2", { class: "group-h", text: `${t} · ${items.length}` }));
      for (const x of items) clientChunks.push(el("button", { class: "row", onclick: () => openProject(x.id) },
        el("span", { class: "dot " + (x.last_author === "client" ? "hot" : ["accepted", "in_progress", "beta", "live"].includes(x.status) ? "good" : "") }),
        el("div", {}, el("div", { class: "t", text: `${x.name}${x.company ? " · " + x.company : ""}` }), el("div", { class: "s", text: [x.project_type, x.platforms, x.budget].filter(Boolean).join(" · ") })),
        el("div", { class: "meta" }, el("span", { class: "badge " + (x.last_author === "client" ? "hot" : ""), text: x.last_author === "client" ? "Waiting" : stageName(x.status) }), ago(x.updated_at))));
    }
    fill($("#cList"), ...(clientChunks.length ? clientChunks : [el("div", { class: "empty", text: projects.length ? "No clients match." : "No briefs yet. They arrive from hecticsoftware.com/start and the app." })]));
    fill($("#cBoard"), ...STAGES.filter(([k]) => k !== "closed").map(([k, n]) => {
      const items = base.filter(x => x.status === k);
      return el("div", { class: "col" }, el("h3", {}, n, el("span", { text: items.length })), ...items.map(x => el("button", { class: "card", onclick: () => openProject(x.id) }, el("div", { class: "t", text: x.name }), el("div", { class: "s", text: [x.project_type, x.budget].filter(Boolean).join(" · ") }))));
    }));
  }
  $("#cSearch").oninput = renderClients;
  $$("#cView button").forEach(b => b.onclick = () => { cView = b.dataset.v; store.set("hs-cview", cView); renderClients() });
  $("#cCsv").onclick = () => {
    const cols = ["id", "name", "company", "email", "project_type", "platforms", "budget", "timeline", "status", "created_at", "updated_at"];
    const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = projects.filter(x => !cStage || x.status === cStage).map(x => cols.map(c => c.endsWith("_at") ? cell(new Date(x[c]).toISOString()) : cell(x[c])).join(","));
    const a = el("a", { href: URL.createObjectURL(new Blob([[cols.join(","), ...rows].join("\n")], { type: "text/csv" })), download: `hectic-clients-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  async function openProject(id) {
    const d = await api("/project?id=" + encodeURIComponent(id)), p = d.project;
    const idx = STAGES.findIndex(s => s[0] === p.status), next = STAGES[idx + 1];
    const quote = el("textarea", {}, p.quote || ""), notes = el("textarea", { placeholder: "Private notes" }, p.admin_notes || ""), reply = el("textarea", { placeholder: "Reply to the client (shows in their project page and app)" });
    const status = el("select", {}, ...STAGES.map(([k, n]) => el("option", { value: k, selected: k === p.status }, n)));
    const save = async (extra = {}) => { await post("/update", { id, status: status.value, quote: quote.value, notes: notes.value, reply: reply.value.trim() || null, ...extra }); toast("Saved"); openProject(id); if (tab === "clients") loadClients(); else loadOverview() };
    const research = el("div", { class: "brief", text: "Press Research brief for market fit, named shipped work, and gaps. Facts only." });
    const spark = (label, run) => {
      const b = el("button", { class: "btn ghost", onclick: async () => {
        b.disabled = true; const s = b.querySelector("span"); const old = s.textContent; s.textContent = "Working…";
        try { await run() } catch { toast("AI is busy, try again shortly") }
        s.textContent = old; b.disabled = false;
      } }, icon("spark"), el("span", { text: label }));
      return b;
    };
    const draftBtn = spark("Draft quote", async () => { const r = await post("/draft-quote", { id }); quote.value = r.quote; toast("Draft ready: check every line before saving") });
    const researchBtn = spark("Research brief", async () => { const r = await post("/brief-research", { id }); research.textContent = r.research; toast("Research ready — check every claim") });
    const notesBtn = spark("Key points", async () => { const r = await post("/brief-notes", { id }); notes.value = (notes.value ? notes.value + "\n\n" : "") + r.notes; toast("Key points added to notes") });
    const packBtn = spark("Research + notes", async () => {
      const r = await post("/brief-pack", { id });
      research.textContent = r.research;
      notes.value = (notes.value ? notes.value + "\n\n" : "") + r.notes;
      toast("Research and key points ready — check every claim");
    });
    openDrawer(
      el("div", { class: "mono", text: `${p.id} · ${stageName(p.status)} · ${new Date(p.created_at).toLocaleDateString("en-GB")}` }),
      el("h1", { text: p.name }), p.company ? el("div", { class: "muted", text: p.company }) : null,
      el("div", { class: "d-actions", style: "margin-top:14px" },
        el("a", { class: "btn ghost", href: "mailto:" + p.email + "?subject=" + encodeURIComponent("Your Hectic project " + p.id) }, icon("mail"), "Email"),
        p.phone ? el("a", { class: "btn ghost", href: "tel:" + p.phone.replace(/[^+\d]/g, "") }, icon("phone"), "Call") : null,
        next ? el("button", { class: "btn accent", onclick: () => { status.value = next[0]; save() } }, "Move to " + next[1]) : null),
      el("div", { class: "d-sec" }, el("h2", { text: "Brief" }),
        el("dl", { class: "facts" }, ...[["Type", p.project_type], ["Devices", p.platforms], ["Features", p.features], ["Budget", p.budget], ["Launch", p.timeline], ["Guide", `${money(d.guide.low)}–${money(d.guide.high)}, ${d.guide.weeks}`], ["Links", p.links]].filter(r => r[1]).flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })])),
        el("div", { class: "brief", text: p.description || "" }),
        el("div", { class: "d-actions" }, researchBtn, notesBtn, packBtn, d.files.length ? d.files.map(f => el("button", { class: "badge", onclick: () => download(f) }, icon("file"), f.name)) : null)),
      el("div", { class: "d-sec" }, el("h2", { text: "Research" }), research, el("p", { class: "small muted", text: "Typical UK practice is labelled typical. Shipped work is only what is on record." })),
      el("div", { class: "d-sec" }, el("h2", { text: "Quote" }), quote, el("div", { class: "d-actions" }, draftBtn)),
      el("div", { class: "d-sec" }, el("h2", { text: "Conversation" }),
        el("div", { class: "thread" }, ...(d.messages.length ? d.messages.map(m => el("div", { class: "msg " + m.author, text: m.body })) : [el("div", { class: "muted small", text: "No messages yet." })])),
        el("div", { class: "d-actions" }, ...REPLIES.map(([n, t]) => el("button", { class: "badge", onclick: () => { reply.value = t; reply.focus() } }, n))), reply),
      el("div", { class: "d-sec" }, el("h2", { text: "Stage and notes" }), status, notes),
      el("div", { class: "d-actions", style: "margin-top:16px" }, el("button", { class: "btn", onclick: () => save() }, "Save and send")),
      d.history.length ? el("div", { class: "d-sec" }, el("h2", { text: "History" }), el("div", { class: "timeline" }, ...d.history.map(h => el("div", {}, el("span", { text: new Date(h.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) + "  " }), h.body)))) : null);
  }

  // ---------- opportunities ----------
  let oBiz = store.get("hs-obiz") || "", oStatus = "", oKind = "", profiles = {};
  async function loadOpps() {
    const r = await api(`/opps?min=${$("#oMin").value}${oBiz ? "&business=" + oBiz : ""}`);
    opps = r.rows; profiles = r.profiles;
    fill($("#oBiz"), el("button", { "aria-pressed": !oBiz, onclick: () => { oBiz = ""; store.set("hs-obiz", ""); loadOpps() } }, "All"),
      ...Object.entries(profiles).map(([k, n]) => el("button", { "aria-pressed": oBiz === k, onclick: () => { oBiz = k; store.set("hs-obiz", k); loadOpps() } }, n)));
    const s = stats || await api("/stats"); stats = s;
    const f = s.finder; $("#oInfo").textContent = f ? `Last search ${ago(f.at)} ago: checked ${f.checked}, kept ${f.kept}.${f.errors.length ? " Unavailable: " + f.errors.join("; ") : ""} Runs every hour.` : "The finder runs every hour.";
    renderOpps();
  }
  const isLocalOpp = x => /hertford|watford|st albans|dacorum|hertsmere|broxbourne|stevenage|welwyn|three rivers|bedford|luton|buckingham|essex|cambridge|london|barnet|enfield|harrow|hillingdon/i.test([x.buyer, x.region, x.why, x.title].join(" "));
  function renderOpps() {
    const open = opps.filter(x => !["ignored", "lost"].includes(x.status));
    fill($("#oChips"), el("button", { "aria-pressed": !oStatus && !oKind, onclick: () => { oStatus = ""; oKind = ""; renderOpps() } }, `Open ${open.length}`),
      el("button", { "aria-pressed": oKind === "tender", onclick: () => { oKind = oKind === "tender" ? "" : "tender"; renderOpps() } }, `Tenders ${opps.filter(x => x.kind === "tender").length}`),
      el("button", { "aria-pressed": oKind === "post", onclick: () => { oKind = oKind === "post" ? "" : "post"; renderOpps() } }, `Hiring posts ${opps.filter(x => x.kind === "post").length}`),
      el("button", { "aria-pressed": oKind === "win", onclick: () => { oKind = oKind === "win" ? "" : "win"; renderOpps() } }, `Major wins ${opps.filter(x => x.score >= 65 && ["new", "saved", "pitching"].includes(x.status)).length}`),
      el("button", { "aria-pressed": oKind === "local", onclick: () => { oKind = oKind === "local" ? "" : "local"; renderOpps() } }, `Local councils ${opps.filter(isLocalOpp).length}`),
      ...OPP.map(([k, n]) => { const c = opps.filter(x => x.status === k).length; return c ? el("button", { "aria-pressed": oStatus === k, onclick: () => { oStatus = k; renderOpps() } }, `${n} ${c}`) : null }));
    const shown = opps.filter(x => (oStatus ? x.status === oStatus : !["ignored", "lost"].includes(x.status)) && (oKind === "win" ? x.score >= 65 && ["new", "saved", "pitching"].includes(x.status) : oKind === "local" ? isLocalOpp(x) : !oKind || x.kind === oKind));
    const groups = [["tender", "Tenders"], ["post", "Hiring posts"]];
    const chunks = [];
    for (const [k, n] of groups) {
      const items = shown.filter(x => (x.kind || "tender") === k);
      if (!items.length) continue;
      chunks.push(el("h2", { class: "group-h", text: `${n} · ${items.length}` }));
      for (const x of items) chunks.push(el("button", { class: "row", onclick: () => openOpp(x) },
        el("div", { class: "score " + (x.score >= 65 ? "good" : x.score >= 50 ? "" : ""), text: x.score }),
        el("div", {}, el("div", { class: "t", text: x.title }), el("div", { class: "s", text: [profiles[x.business], x.buyer || x.source, money(x.value_low)].filter(Boolean).join(" · ") })),
        el("div", { class: "meta" }, x.deadline ? el("span", { class: "badge " + (x.deadline < Date.now() + 7 * 86400000 ? "hot" : "") }, icon("clock"), until(x.deadline)) : el("span", { class: "badge", text: x.kind === "post" ? "Post" : "Tender" }),
          x.status !== "new" ? el("span", { class: "badge " + (x.status === "won" ? "good" : ""), text: (OPP.find(o => o[0] === x.status) || [, x.status])[1] }) : null)));
    }
    fill($("#oList"), ...(chunks.length ? chunks : [el("div", { class: "empty", text: "No open leads at this score yet. The finder keeps looking every hour." })]));
  }
  $("#oMin").onchange = loadOpps;
  $("#oRun").onclick = async () => { const b = $("#oRun"); b.disabled = true; try { const r = await post("/finder/run", {}); toast(`Checked ${r.checked}, kept ${r.kept}`) } catch { toast("Search limit reached, try later") } b.disabled = false; stats = null; loadOpps() };

  function openOpp(x) {
    const pitch = el("textarea", { placeholder: "Pitch or expression of interest" }, x.pitch || ""), notes = el("textarea", { placeholder: "Notes" }, x.notes || "");
    const set = async status => { await post("/opp", { id: x.id, status, notes: notes.value, pitch: pitch.value }); toast("Saved"); closeDrawer(); stats = null; tab === "opps" ? loadOpps() : loadOverview() };
    const research = el("div", { class: "brief", text: "Press Research for a go / maybe / no from the facts on record." });
    const spark = (label, run) => {
      const b = el("button", { class: "btn ghost", onclick: async () => {
        b.disabled = true; const s = b.querySelector("span"); const old = s.textContent; s.textContent = "Working…";
        try { await run() } catch { toast("AI is busy, try again shortly") }
        s.textContent = old; b.disabled = false;
      } }, icon("spark"), el("span", { text: label }));
      return b;
    };
    const draft = spark(x.kind === "tender" ? "Bid check + draft" : "Draft reply", async () => { const r = await post("/opp/pitch", { id: x.id }); pitch.value = r.pitch; x.pitch = r.pitch; toast("Draft ready — check every claim") });
    const researchBtn = spark("Research", async () => { const r = await post("/opp/research", { id: x.id }); research.textContent = r.research; toast("Research ready") });
    const notesBtn = spark("Key points", async () => { const r = await post("/opp/notes", { id: x.id }); notes.value = (notes.value ? notes.value + "\n\n" : "") + r.notes; toast("Key points added to notes") });
    openDrawer(
      el("div", { class: "mono", text: `${profiles[x.business] || x.business} · ${x.source}${x.stage === "pre-market" ? " · pre-market" : ""}` }),
      el("h1", { text: x.title }),
      el("dl", { class: "facts" }, ...[["Buyer", x.buyer], ["Value", money(x.value_low) || "Not stated"], ["Closes", x.deadline ? new Date(x.deadline).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" }) : "No deadline"], ["Where", x.region], ["Score", `${x.score}: ${x.why}`]].filter(r => r[1]).flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })])),
      el("div", { class: "d-actions", style: "margin-top:14px" }, safeUrl(x.url) ? el("a", { class: "btn", href: safeUrl(x.url), target: "_blank", rel: "noopener noreferrer" }, icon("link"), "Open the notice") : null, researchBtn, notesBtn, draft),
      el("div", { class: "d-sec" }, el("h2", { text: "Summary" }), el("div", { class: "brief", text: x.summary || "" })),
      el("div", { class: "d-sec" }, el("h2", { text: "Research" }), research, el("p", { class: "small muted", text: "Only facts on record. Anything else is marked not on record." })),
      el("div", { class: "d-sec" }, el("h2", { text: "Pitch" }), pitch, el("p", { class: "small muted", text: "Drafts use only facts on record. Check every claim before you send or submit anything." })),
      el("div", { class: "d-sec" }, el("h2", { text: "Notes" }), notes),
      el("div", { class: "d-sec" }, el("h2", { text: "Move to" }), el("div", { class: "d-actions" }, ...OPP.filter(([k]) => k !== "new").map(([k, n]) => el("button", { class: "btn " + (k === "won" ? "teal" : k === "ignored" || k === "lost" ? "ghost" : k === x.status ? "" : "ghost"), onclick: () => set(k) }, n)))));
  }

  // ---------- estate ----------
  async function loadEstate() {
    const e = await api("/estate");
    if (!e) { $("#eInfo").textContent = "No snapshot yet. On the Mac, run: node ~/HecticSoftwareSite/tools/estate.mjs"; fill($("#eKpis"), ); fill($("#eSites"), ); fill($("#eRepos"), ); return }
    $("#eInfo").textContent = `Snapshot from the Mac, ${ago(e.at)} ago. It refreshes every few hours while the Mac is on.`;
    const repos = e.repos || [], sites = e.sites || [];
    const dirty = repos.filter(r => r.dirty), ahead = repos.filter(r => r.ahead), down = sites.filter(s => !s.ok);
    fill($("#eKpis"), kpi(repos.length, "Repositories", "stack"), kpi(sites.length - down.length + "/" + sites.length, "Sites up", "check", down.length ? "hot" : "good"),
      kpi(dirty.length, "With local changes", "file", dirty.length ? "hot" : ""), kpi(ahead.length, "Not pushed", "up", ahead.length ? "hot" : ""));
    fill($("#eSites"), ...sites.map(s => row(s.ok ? "check" : "x", s.name, s.url, s.ok ? `${s.ms} ms` : `Down (${s.status})`, s.ok ? "good" : "hot", () => safeUrl(s.url) && window.open(s.url, "_blank", "noopener,noreferrer"))));
    fill($("#eRepos"), ...repos.map(r => row("stack", r.name, [r.visibility, r.local ? "on this Mac" : "GitHub only", r.branch, r.lastCommit].filter(Boolean).join(" · "),
      r.dirty ? `${r.dirty} changed` : r.ahead ? `${r.ahead} unpushed` : ago(r.pushedAt), r.dirty || r.ahead ? "hot" : "", () => safeUrl(r.url) && window.open(r.url, "_blank", "noopener,noreferrer"))));
  }

  // ---------- HECTIC assistant ----------
  const history = [];
  let speak = store.get("hs-voice") !== "off", browserAI = null;
  $("#voiceBtn").setAttribute("aria-pressed", speak);
  $("#voiceBtn").onclick = () => { speak = !speak; store.set("hs-voice", speak ? "on" : "off"); $("#voiceBtn").setAttribute("aria-pressed", speak); if (!speak) speechSynthesis.cancel() };
  const bubble = (who, text) => { const b = el("div", { class: "bubble " + who, text }); $("#chat").append(b); $("#chat").scrollTop = $("#chat").scrollHeight; return b };
  function voice() { const v = speechSynthesis.getVoices(); return v.find(x => /Daniel|Arthur|Serena|Google UK English Male/.test(x.name) && x.lang === "en-GB") || v.find(x => x.lang === "en-GB") || null }
  function say(text) {
    if (!speak || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*#_`>|]/g, "")); u.lang = "en-GB"; u.rate = 1.04; const v = voice(); if (v) u.voice = v;
    u.onstart = () => $("#orb").classList.add("speaking"); u.onend = u.onerror = () => $("#orb").classList.remove("speaking");
    speechSynthesis.speak(u);
  }
  // Chrome's built-in model runs on this machine for free; the studio's own AI is the fallback.
  async function localAI() {
    if (browserAI !== null) return browserAI;
    browserAI = false;
    try {
      if (!("LanguageModel" in self) || (await LanguageModel.availability()) !== "available") return false;
      const ctx = await api("/context");
      browserAI = await LanguageModel.create({ initialPrompts: [{ role: "system", content: `${ctx.system}\n<studio>\n${ctx.studio}\n</studio>` }] });
      $("#brain").textContent = "On this computer (Chrome AI)";
    } catch { browserAI = false }
    return browserAI;
  }
  async function ask(q) {
    q = q.trim(); if (!q) return;
    bubble("me", q); history.push({ role: "user", content: q });
    $("#orb").classList.add("thinking");
    const out = bubble("ai", "…");
    let reply;
    try {
      const local = await localAI();
      reply = local ? await local.prompt(q) : (await post("/jarvis", { messages: history })).reply;
      if (!local) $("#brain").textContent = "Studio AI (Cloudflare, free tier)";
    } catch { reply = "I couldn't reach the studio brain just now, Romeo. Try again in a moment." }
    $("#orb").classList.remove("thinking");
    out.textContent = reply; history.push({ role: "assistant", content: reply }); $("#chat").scrollTop = $("#chat").scrollHeight;
    say(reply);
  }
  $("#askForm").addEventListener("submit", e => { e.preventDefault(); const i = $("#askInput"); const q = i.value; i.value = ""; ask(q) });
  $$("#quick button").forEach(b => b.onclick = () => ask(b.dataset.q));
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) $("#micBtn").hidden = true;
  else $("#micBtn").onclick = () => {
    const r = new Rec(); r.lang = "en-GB"; r.interimResults = false;
    $("#micBtn").classList.add("live"); speechSynthesis.cancel();
    r.onresult = e => ask(e.results[0][0].transcript);
    r.onend = r.onerror = () => $("#micBtn").classList.remove("live");
    r.start();
  };

  // ---------- live ----------
  // Every 30 seconds: new briefs, client replies and pushes are announced (and spoken if voice is on).
  let seen = null;
  async function pulse() {
    if (!key || document.hidden) return;
    try {
      const s = await api("/stats");
      const sig = { briefs: s.newUnanswered, waiting: s.awaitingReply, push: s.pushes[0]?.at || 0 };
      if (seen) {
        const news = [];
        if (sig.briefs > seen.briefs) news.push("New brief just came in, Romeo.");
        if (sig.waiting > seen.waiting) news.push("A client has replied and is waiting on you.");
        if (sig.push > seen.push) news.push(`Pushed to ${s.pushes[0].repo.split("/")[1]}.`);
        if (news.length) { toast(news.join(" ")); if (news[0] !== `Pushed to ${s.pushes[0]?.repo.split("/")[1]}.`) say(news.join(" ")); stats = s; if (tab === "overview") loadOverview() }
      }
      seen = sig;
    } catch {}
  }
  setInterval(pulse, 30000);

  // ---------- start ----------
  function start() {
    $("#login").hidden = true; $("#app").hidden = false;
    const h = new Date().getHours();
    bubble("ai", `Good ${h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"}, Romeo. Ask me anything, tap Brief for today's priorities, or press the mic and talk.`);
    showTab(tab); pulse();
  }
  if (key) api("/stats").then(start).catch(() => lock()); else lock();
})();
