#!/usr/bin/env node
// aig - AI-persona sitcom report CLI
//   aig init [dir]                 scaffold a working dir (cast/config/example)
//   aig write --topic "..." [-m material-file] -o draft.json
//   aig paint --prompt "..." -o img.png
//   aig build draft.json -o report.pdf [--keep-html]
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");

function parse(argv) {
  const [cmd, ...rest] = argv;
  const opt = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--") || /^-[a-zA-Z]$/.test(a)) {
      const k = a.replace(/^--?/, "");
      if (i + 1 < rest.length && !rest[i + 1].startsWith("-")) opt[k] = rest[++i];
      else opt[k] = true;
    } else opt._.push(a);
  }
  return { cmd, opt };
}

function die(msg, code = 1) {
  console.error(`[aig] ${msg}`);
  process.exit(code);
}

const { cmd, opt } = parse(process.argv.slice(2));

switch (cmd) {
  case "init": {
    const dir = resolve(opt._[0] || ".");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const from = (rel, to) => {
      const dst = join(dir, to || rel);
      if (!existsSync(dst)) {
        mkdirSync(dirname(dst), { recursive: true });
        copyFileSync(join(PKG, rel), dst);
        console.log(`[aig] created ${dst}`);
      }
    };
    from("cast/default.cast.json", "cast.json");
    from("examples/sample-report.json", "examples/sample-report.json");
    from("aig.config.example.json", "aig.config.json");
    from("assets/README.txt", "assets/README.txt");
    console.log("[aig] next: put avatars in assets/, edit cast.json, then `aig build examples/sample-report.json -o out.pdf`");
    break;
  }

  case "write": {
    const topic = opt.topic || opt._[0];
    if (!topic) die("usage: aig write --topic \"本期议题\" [-m material.txt] [-o draft.json] [--cast cast.json] [--config aig.config.json]");
    const { loadConfig, loadCast } = await import("../src/config.js");
    const { writeDraft } = await import("../src/writer.js");
    const cfg = loadConfig(opt.config);
    const cast = loadCast(opt.cast);
    let material = opt.m;
    if (material) {
      const { readFileSync } = await import("node:fs");
      material = readFileSync(resolve(material), "utf8");
    }
    const out = opt.o || "draft.json";
    await writeDraft({ topic, material, cast, cfg, out, verbose: true }).catch((e) => {
      if (e.hint === "key") die(`${e.message}\n(tip: export the key or fix provider.apiKeyEnv)`);
      die(e.message);
    });
    break;
  }

  case "paint": {
    const prompt = opt.prompt || opt._[0];
    if (!prompt) die("usage: aig paint --prompt \"image prompt\" -o img.png [--config aig.config.json]");
    const { loadConfig } = await import("../src/config.js");
    const { paint } = await import("../src/painter.js");
    const cfg = loadConfig(opt.config);
    const out = opt.o || "image.png";
    await paint({ prompt, cfg, out }).catch((e) => {
      if (e.fallback) {
        die(
          `${e.message}\n` +
            `This provider does not serve /images. Fallback: draw/insert the picture yourself,\n` +
            `save it next to your draft, and reference it via draft.illustration = {"mode":"image","path":"..."}.`
        );
      }
      if (e.message.includes("not set")) die(`${e.message}\n(tip: export the key or fix provider.apiKeyEnv)`);
      die(e.message);
    });
    break;
  }

  case "build": {
    const draftPath = opt._[0] || opt.draft;
    if (!draftPath) die("usage: aig build <draft.json> -o report.pdf [--cast cast.json] [--config aig.config.json] [--keep-html]");
    const { build } = await import("../src/build.js");
    const out = opt.o || "report.pdf";
    await build({
      draftPath,
      castPath: opt.cast,
      configPath: opt.config,
      out,
      keepHtml: !!opt["keep-html"],
    }).catch((e) => die(e.message));
    break;
  }

  case undefined:
  case "help":
  case "--help":
  default: {
    console.log(`aig - AI-persona sitcom report generator

  init [dir]          scaffold cast.json / config / example
  write --topic ".."  generate a dialogue draft via your LLM provider
  paint --prompt ".." generate an illustration via your provider's image API
  build <draft.json>  typeset draft + avatars -> PDF
                      [--keep-html] keeps the intermediate HTML

Docs: README.md`);
    if (cmd && cmd !== "help" && cmd !== "--help") process.exitCode = 0;
  }
}
