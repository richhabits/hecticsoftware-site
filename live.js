// "Updated 2h ago" on work tiles, live from GitHub pushes (product and time only).
(() => {
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago` };
  const paint = rows => rows.forEach(r => document.querySelectorAll(`a[href="/work/${r.product}/"] .meta`).forEach(meta => {
    let s = meta.querySelector(".live"); if (!s) { s = document.createElement("span"); s.className = "live"; meta.append(s) }
    s.textContent = ` · Updated ${ago(r.at)}`;
  }));
  const load = () => fetch((window.HS_API || "") + "/api/live").then(r => r.ok ? r.json() : null).then(d => d && paint(d.updated)).catch(() => {});
  load(); setInterval(() => { if (!document.hidden) load() }, 120000);
})();
