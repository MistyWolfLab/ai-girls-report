// Build mode: draft JSON -> assets resolved -> HTML -> PDF.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { loadConfig, loadCast, loadJson, validateDraft } from "./config.js";
import { renderHtml } from "./template.js";
import { htmlToPdf } from "./render.js";

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

function toDataUri(path) {
  if (!path) return null;
  const p = resolve(path);
  if (!existsSync(p)) return null;
  const ext = p.slice(p.lastIndexOf(".")).toLowerCase();
  const b64 = readFileSync(p).toString("base64");
  return `data:${MIME[ext] || "image/png"};base64,${b64}`;
}

// Split a plain-text/markdown document into companion segments:
// blank-line separated paragraphs; lines starting with # treated as headings.
export function splitSegments(text) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const segs = [];
  let buf = [], heading = null;
  const flush = () => {
    const body = buf.join(" ").trim();
    if (body) segs.push({ heading, text: body });
    buf = [];
  };
  for (const ln of lines) {
    const h = ln.match(/^#{1,3}\s+(.+)/);
    if (h) {
      flush();
      heading = h[1].trim();
    } else if (ln.trim() === "") {
      flush();
      heading = null;
    } else {
      buf.push(ln.trim());
    }
  }
  flush();
  return segs;
}

export async function build({ draftPath, castPath, configPath, out, keepHtml }) {
  const cfg = loadConfig(configPath);
  const cast = loadCast(castPath);
  const draft = validateDraft(loadJson(draftPath, "draft"), cast);
  const baseDir = dirname(resolve(draftPath));

  // companion mode: resolve source.path into segments
  if (draft.mode === "companion" && draft.source?.path) {
    const srcFile = resolve(baseDir, draft.source.path);
    if (!existsSync(srcFile)) throw new Error(`companion source file not found: ${srcFile}`);
    const raw = readFileSync(srcFile, "utf8");
    draft.source = { title: draft.source.title ?? draft.meta.title, segments: splitSegments(raw) };
  }
  if (draft.mode === "companion") {
    const n = draft.source.segments.length;
    const bad = draft.annotations.filter((a) => a.at >= n);
    if (bad.length) {
      console.warn(`[aig] ${bad.length} annotation(s) point beyond ${n} segments; dropped`);
      draft.annotations = draft.annotations.filter((a) => a.at < n);
    }
  }

  // companion pages: side gutters hold the standing figures, extra bottom for their feet
  // (must happen BEFORE renderHtml: the @page margin is baked into the HTML css)
  if (draft.mode === "companion") {
    cfg.page = { ...cfg.page, margin: "12mm 30mm 52mm 30mm" };
  }

  // resolve avatars relative to the cast file dir, illustration relative to draft dir
  const avatars = {};
  for (const r of cast.roles) {
    if (!r.avatar) continue;
    const uri = toDataUri(resolve(cast.__dir, r.avatar));
    if (!uri) console.warn(`[aig] avatar missing for ${r.id}: ${r.avatar} (using initial letter)`);
    avatars[r.id] = uri;
  }

  const illu = draft.illustration || {};
  let group = null, groupWanted = true;
  if (illu.mode === "image" && illu.path) {
    group = toDataUri(resolve(baseDir, illu.path));
    if (!group) console.warn(`[aig] illustration not found: ${illu.path} (placeholder rendered)`);
  } else if (illu.mode === "none") {
    groupWanted = false;
  }

  const assets = { avatars, group, groupWanted };
  const html = renderHtml({ draft, cast, assets, cfg });

  // companion standing figures: first two distinct annotators, printed via the footer
  let mascots;
  if (draft.mode === "companion") {
    const seen = [];
    for (const a of draft.annotations) if (!seen.includes(a.role)) seen.push(a.role);
    mascots = [seen[0], seen[1] ?? seen[0]].map((id) => avatars[id] ?? null);
  }

  const outPath = resolve(out);
  await htmlToPdf(html, { cfg, out: outPath, title: draft.meta.title, author: draft.meta.author, mascots });
  console.log(`[aig] PDF written: ${outPath}`);

  if (keepHtml) {
    const htmlPath = outPath.replace(/\.pdf$/i, "") + ".html";
    writeFileSync(htmlPath, html, "utf8");
    console.log(`[aig] HTML kept: ${htmlPath}`);
  }
  return outPath;
}
