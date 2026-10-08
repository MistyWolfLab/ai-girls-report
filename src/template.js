// HTML template engine: draft + resolved assets -> standalone HTML.
// All styling is inline CSS driven by cfg.style (theme vars).

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

function cssVars(cfg) {
  const dark = cfg.style.theme === "dark";
  return dark
    ? `--bg:#14161a;--paper:#1c1f26;--ink:#e8eaf0;--muted:#9aa3b2;--line:#2c313c;--card:#232833;--accent:${cfg.style.accent}`
    : `--bg:#ffffff;--paper:#ffffff;--ink:#1c2333;--muted:#667085;--line:#e4e8ef;--card:#f6f8fc;--accent:${cfg.style.accent}`;
}

function headHtml(draft, cast, assets, cfg) {
  const d = draft.meta || {};
  const avs = cast.roles
    .map((r) => {
      const src = assets.avatars[r.id];
      return `<span class="cast-chip"><span class="dot" style="background:${esc(r.color)}"></span>${esc(r.name)}${r.title ? `<i>${esc(r.title)}</i>` : ""}</span>`;
    })
    .join("");
  return `<header class="report-head">
    <div class="kicker">${esc(d.date || "")}${d.author ? " · " + esc(d.author) : ""}</div>
    <h1>${esc(d.title)}</h1>
    ${d.subtitle ? `<p class="sub">${esc(d.subtitle)}</p>` : ""}
    <div class="cast-row">${avs}</div>
  </header>`;
}

function groupHtml(cast, assets, cfg) {
  const img = assets.group;
  const members = cast.roles
    .map((r) => {
      const src = assets.avatars[r.id];
      return `<figure><div class="g-ava" style="border-color:${esc(r.color)}">${
        src ? `<img src="${src}">` : `<span>${esc(r.name[0])}</span>`
      }</div><figcaption>${esc(r.name)}</figcaption></figure>`;
    })
    .join("");
  const imgBlock = img
    ? `<div class="group-img"><img src="${img}"></div>`
    : `<div class="group-img ph">插图位：放入群像图（aig paint 或手工）后重出</div>`;
  return `<section class="group-page">
    <h2>${esc(cast.groupTitle || "全员到齐")}</h2>
    ${imgBlock}
    <div class="group-cast">${members}</div>
  </section>`;
}

function blocksHtml(draft, cast, assets, cfg) {
  const byId = Object.fromEntries(cast.roles.map((r) => [r.id, r]));
  return draft.blocks
    .map((b) => {
      if (b.type === "chapter") {
        return `<h2 class="chapter"><span>${esc(b.title)}</span></h2>`;
      }
      if (b.type === "say") {
        const r = byId[b.role];
        const src = assets.avatars[r.id];
        return `<div class="say">
          <div class="ava" style="border-color:${esc(r.color)}">${
            src ? `<img src="${src}" style="${cropStyle(r)}">` : `<span>${esc(r.name[0])}</span>`
          }</div>
          <div class="bubble">
            <div class="who"><b style="color:${esc(r.color)}">${esc(r.name)}</b>${
              r.title ? `<i>${esc(r.title)}</i>` : ""
            }${b.aside ? `<em>${esc(b.aside)}</em>` : ""}</div>
            <p>${esc(b.text)}</p>
          </div>
        </div>`;
      }
      if (b.type === "note") {
        return `<aside class="note"><span class="tag">资料卡</span><p>${esc(b.text)}</p></aside>`;
      }
      if (b.type === "table") {
        const cols = b.columns.map((c) => `<th>${esc(c)}</th>`).join("");
        const rows = b.rows
          .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("");
        return `<figure class="tbl">${b.title ? `<figcaption>${esc(b.title)}</figcaption>` : ""}
          <table><thead><tr>${cols}</tr></thead><tbody>${rows}</tbody></table></figure>`;
      }
      return "";
    })
    .join("\n");
}

// avatarCrop: {x:0-100, y:0-100, scale:1+} in percent units for object positioning
function cropStyle(role) {
  const c = role.avatarCrop;
  if (!c) return "";
  const pos = `${c.x ?? 50}% ${c.y ?? 20}%`;
  const scale = c.scale ?? 1;
  return `object-position:${pos};transform:scale(${scale});`;
}

export function renderHtml({ draft, cast, assets, cfg }) {
  const withGroup = assets.groupWanted !== false && (assets.group || cast.groupTitle || true);
  return `<!doctype html>
<html lang="${esc(cfg.page.lang)}"><head><meta charset="utf-8">
<style>
@page { size: ${cfg.page.width} ${cfg.page.height}; margin: ${cfg.page.margin}; }
* { box-sizing: border-box; }
html,body { margin:0; padding:0; background:var(--bg); color:var(--ink);
  font-family:${cfg.style.font}; font-size:10.5pt; line-height:1.72; }
:root { ${cssVars(cfg)} }
h1,h2,h3 { break-after: avoid; }
/* header */
.report-head { padding: 10mm 2mm 6mm; border-bottom: 2px solid var(--accent); margin-bottom: 7mm; }
.report-head .kicker { color: var(--muted); font-size: 9pt; letter-spacing: .08em; }
.report-head h1 { font-size: 24pt; margin: 3mm 0 2mm; line-height: 1.25; }
.report-head .sub { color: var(--muted); font-size: 11pt; margin: 0 0 4mm; }
.cast-row { display: flex; flex-wrap: wrap; gap: 2mm 4mm; }
.cast-chip { font-size: 9pt; color: var(--muted); }
.cast-chip .dot { display:inline-block; width: 2.4mm; height: 2.4mm; border-radius: 50%; margin-right: 1.2mm; vertical-align: middle; }
.cast-chip i { font-style: normal; color: var(--muted); opacity: .8; margin-left: 1mm; }
/* chapter */
h2.chapter { font-size: 15pt; margin: 8mm 0 4mm; padding-left: 3mm; border-left: 4px solid var(--accent); }
/* dialogue */
.say { display: flex; gap: 3.5mm; margin: 3.2mm 0; break-inside: avoid; }
.ava { flex: 0 0 12mm; width: 12mm; height: 12mm; border-radius: 50%; overflow: hidden;
  border: 1.6px solid var(--accent); background: var(--card); display:flex; align-items:center; justify-content:center; }
.ava img { width: 100%; height: 100%; object-fit: cover; }
.ava span { font-weight: 700; color: var(--muted); }
.bubble { flex: 1; background: var(--card); border: 1px solid var(--line); border-radius: 0 3mm 3mm 3mm; padding: 2.6mm 4mm; }
.who { font-size: 8.5pt; margin-bottom: 1mm; }
.who i { font-style: normal; color: var(--muted); margin-left: 1.6mm; }
.who em { font-style: normal; color: var(--muted); margin-left: 1.6mm; opacity: .85; }
.bubble p { margin: 0; }
/* note card */
.note { display: flex; gap: 3mm; align-items: flex-start; background: var(--card);
  border: 1px dashed var(--line); border-radius: 2.5mm; padding: 3mm 4mm; margin: 3.5mm 0; break-inside: avoid; }
.note .tag { flex: 0 0 auto; font-size: 8pt; color: var(--accent); border: 1px solid var(--accent);
  border-radius: 99px; padding: .4mm 2.4mm; margin-top: .6mm; }
.note p { margin: 0; color: var(--ink); }
/* table */
figure.tbl { margin: 4mm 0; break-inside: avoid; }
figure.tbl figcaption { font-size: 9pt; color: var(--muted); margin-bottom: 1.6mm; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
th,td { border: 1px solid var(--line); padding: 1.8mm 2.6mm; text-align: left; }
thead th { background: var(--card); }
tbody tr:nth-child(even) { background: var(--card); opacity: .75; }
/* group page */
.group-page { break-before: auto; text-align: center; padding: 10mm 0 14mm; break-inside: avoid; }
.group-page h2 { font-size: 18pt; margin-bottom: 6mm; }
.group-img { margin: 0 auto 6mm; max-width: 160mm; max-height: 110mm; display: flex; justify-content: center; }
.group-img img { max-width: 100%; max-height: 110mm; object-fit: contain; border-radius: 3mm; border: 1px solid var(--line); }
.group-img.ph { border: 2px dashed var(--line); border-radius: 3mm; color: var(--muted);
  padding: 12mm 6mm; font-size: 10pt; }
.group-cast { display: grid; grid-template-columns: repeat(4, 26mm); justify-content: center; gap: 5mm; }
.group-cast figure { margin: 0; width: 24mm; }
.g-ava { width: 18mm; height: 18mm; margin: 0 auto 1.6mm; border-radius: 50%; overflow: hidden;
  border: 2px solid var(--accent); background: var(--card); display:flex; align-items:center; justify-content:center; }
.g-ava img { width:100%; height:100%; object-fit: cover; }
.g-ava span { font-weight: 700; color: var(--muted); }
.group-cast figcaption { font-size: 8.5pt; color: var(--muted); }
</style></head>
<body>
${headHtml(draft, cast, assets, cfg)}
${blocksHtml(draft, cast, assets, cfg)}
${withGroup ? groupHtml(cast, assets, cfg) : ""}
</body></html>`;
}
