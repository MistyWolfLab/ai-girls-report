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

export async function build({ draftPath, castPath, configPath, out, keepHtml }) {
  const cfg = loadConfig(configPath);
  const cast = loadCast(castPath);
  const draft = validateDraft(loadJson(draftPath, "draft"), cast);
  const baseDir = dirname(resolve(draftPath));

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

  const outPath = resolve(out);
  await htmlToPdf(html, { cfg, out: outPath, title: draft.meta.title, author: draft.meta.author });
  console.log(`[aig] PDF written: ${outPath}`);

  if (keepHtml) {
    const htmlPath = outPath.replace(/\.pdf$/i, "") + ".html";
    writeFileSync(htmlPath, html, "utf8");
    console.log(`[aig] HTML kept: ${htmlPath}`);
  }
  return outPath;
}
