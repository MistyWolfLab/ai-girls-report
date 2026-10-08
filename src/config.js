// Config loading + validation for aig.
// Priority: CLI flags > ./aig.config.json > built-in defaults.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

export const DEFAULT_CONFIG = {
  provider: {
    baseURL: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY", // env var that holds the key; key never lives in config
    model: "gpt-5",
    imageModel: "gpt-image-1",
  },
  page: {
    width: "210mm",   // A4 portrait
    height: "297mm",
    margin: "14mm 14mm 16mm 14mm",
    lang: "zh",
  },
  style: {
    theme: "light",   // light | dark
    accent: "#4c8dff",
    font: '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif',
  },
  write: {
    // knobs passed to the writer prompt
    targetPages: 2,
    ban: ["色情露骨内容", "现实政治攻击", "对真实个人的诽谤"],
  },
};

export function loadJson(path, what) {
  const p = resolve(path);
  if (!existsSync(p)) fail(`${what} not found: ${p}`);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`${what} is not valid JSON: ${p}\n${e.message}`);
  }
}

export function loadConfig(explicit) {
  const fromFile = explicit && existsSync(resolve(explicit))
    ? loadJson(explicit, "config")
    : existsSync("aig.config.json")
      ? loadJson("aig.config.json", "config")
      : {};
  // shallow-merge per top-level key; user wins
  const cfg = { ...DEFAULT_CONFIG };
  for (const k of Object.keys(DEFAULT_CONFIG)) {
    if (fromFile[k] && typeof fromFile[k] === "object" && !Array.isArray(fromFile[k])) {
      cfg[k] = { ...DEFAULT_CONFIG[k], ...fromFile[k] };
    } else if (fromFile[k] !== undefined) {
      cfg[k] = fromFile[k];
    }
  }
  cfg.__dir = explicit ? dirname(resolve(explicit)) : process.cwd();
  return cfg;
}

export function loadCast(explicit) {
  const p = resolve(explicit || "cast.json");
  if (!existsSync(p)) fail(`cast file not found: ${p}`);
  const cast = loadJson(p, "cast");
  validateCast(cast, p);
  cast.__dir = dirname(p);
  return cast;
}

export function validateCast(cast, p) {
  if (!Array.isArray(cast.roles) || cast.roles.length === 0) {
    fail(`cast file needs a non-empty "roles" array: ${p}`);
  }
  const ids = new Set();
  for (const r of cast.roles) {
    for (const f of ["id", "name", "persona"]) {
      if (!r[f]) fail(`cast role missing "${f}": ${JSON.stringify(r).slice(0, 120)}`);
    }
    if (ids.has(r.id)) fail(`duplicate role id: ${r.id}`);
    ids.add(r.id);
    if (!r.color) r.color = "#4c8dff"; // ring fallback
  }
  if (!cast.tone) cast.tone = {};
  if (!cast.tone.global) {
    cast.tone.global = DEFAULT_TONE;
  }
}

export const DEFAULT_TONE =
  "单元生活剧语气：有人抛话题、有人接梗、可以良性互怼和玩梗，但只说真话、不做人身攻击，不输出 banned 内容。" +
  "每个人用自己的人设口癖说话，句子里带动作和表情，禁止书面报告腔。";

export const DRAFT_BLOCK_TYPES = ["chapter", "say", "note", "table"];
export const DRAFT_MODES = ["chat", "debate", "companion"];

export function validateDraft(draft, cast) {
  if (!draft || typeof draft !== "object") fail("draft must be an object");
  if (!draft.meta || !draft.meta.title) fail("draft.meta.title is required");
  const mode = draft.mode ?? "chat";
  if (!DRAFT_MODES.includes(mode)) fail(`draft.mode must be one of ${DRAFT_MODES.join("/")}, got: ${mode}`);
  if (mode === "companion") {
    validateCompanion(draft, cast);
    return { ...draft, mode };
  }
  if (!Array.isArray(draft.blocks) || draft.blocks.length === 0) {
    fail("draft.blocks must be a non-empty array");
  }
  const ids = new Set(cast.roles.map((r) => r.id));
  draft.blocks.forEach((b, i) => {
    if (!DRAFT_BLOCK_TYPES.includes(b.type)) fail(`block[${i}] unknown type: ${b.type}`);
    if (b.type === "say") {
      if (!ids.has(b.role)) fail(`block[${i}] unknown role: ${b.role} (not in cast)`);
      if (!b.text) fail(`block[${i}] say block needs text`);
      if (mode === "debate" && b.side !== undefined && !["a", "b"].includes(b.side)) {
        fail(`block[${i}] debate side must be "a" or "b"`);
      }
    }
    if (b.type === "chapter" && !b.title) fail(`block[${i}] chapter needs title`);
    if (b.type === "table") {
      if (!Array.isArray(b.columns) || !Array.isArray(b.rows)) {
        fail(`block[${i}] table needs columns[] and rows[]`);
      }
    }
  });
  return { ...draft, mode };
}

function validateCompanion(draft, cast) {
  const src = draft.source;
  if (!src) fail('companion mode needs draft.source: {title, segments:[{heading?,text}]} or {path}');
  if (!src.segments && !src.path) fail('companion source needs segments[] or path');
  const anns = draft.annotations;
  if (!Array.isArray(anns) || anns.length === 0) {
    fail("companion mode needs a non-empty draft.annotations array");
  }
  const ids = new Set(cast.roles.map((r) => r.id));
  anns.forEach((a, i) => {
    if (!ids.has(a.role)) fail(`annotation[${i}] unknown role: ${a.role}`);
    if (typeof a.at !== "number" || a.at < 0) fail(`annotation[${i}] needs at: <segment index>`);
    if (!a.text) fail(`annotation[${i}] needs text`);
  });
}

export function fail(msg) {
  console.error(`[aig] ${msg}`);
  process.exit(1);
}
