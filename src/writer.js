// Writer mode: cast + topic -> draft JSON via any OpenAI-compatible chat API.
import { writeFileSync } from "node:fs";
import { makeClient } from "./client.js";
import { validateDraft } from "./config.js";

// Post-process a generated draft to the requested block budget.
// Over budget: drop say blocks from the middle (keep opening, closing, all chapters).
// Under budget: pad with footer notes. This makes the prompt's size hint enforceable.
export function blockGuard(blocks, { min = 16, max = 24 } = {}) {
  let b = blocks.slice();
  if (b.length > max) {
    const sayIdx = b.map((x, i) => (x.type === "say" ? i : -1)).filter((i) => i > 2 && i < b.length - 1);
    let excess = b.length - max;
    const drop = new Set();
    for (const i of sayIdx) {
      if (excess <= 0) break;
      drop.add(i);
      excess--;
    }
    b = b.filter((_, i) => !drop.has(i));
  }
  while (b.length < min) {
    b.push({ type: "note", text: "（本页由写稿模式自动补足篇幅；增补素材后可删。）" });
  }
  return b;
}

function buildSystemPrompt(cast, cfg) {
  const cards = cast.roles
    .map((r) => {
      const extra = [
        r.title ? `头衔: ${r.title}` : "",
        r.speak?.catchphrase ? `口癖: ${r.speak.catchphrase}` : "",
        r.speak?.ban ? `禁说: ${r.speak.ban.join("；")}` : "",
      ].filter(Boolean).join("\n");
      return `【${r.id}｜${r.name}】\n人设: ${r.persona}${extra ? "\n" + extra : ""}`;
    })
    .join("\n\n");
  const ban = [...(cast.tone?.ban || []), ...(cfg.write?.ban || [])];
  return [
    `你是「${cast.title || "AI 少女会议室"}」的编剧。出场角色：`,
    cards,
    `语气总纲：${cast.tone.global}`,
    ban.length ? `禁止内容：${ban.join("；")}。` : "",
    `交付格式：只输出 JSON（不要 markdown 代码块），结构：`,
    `{"meta":{"title":"报告标题","subtitle":"副标题","date":"YYYY-MM-DD","author":"署名"},"blocks":[...]}`,
    `block 类型（硬约束：blocks 总数控制在 16-24 个，台词总数 18-26 句，写约 ${cfg.write?.targetPages ?? 2} 页纸的量，人均至少开口 2 次）：`,
    `- {"type":"chapter","title":"小节标题"}：划话题，全篇 2-4 个`,
    `- {"type":"say","role":"<角色id>","text":"台词","aside":"可选旁白/动作"}：对话主体`,
    `- {"type":"note","text":"资料卡文字"}：角色们展示的数据/知识点，用 1-3 句人话说`,
    `- {"type":"table","title":"可选","columns":["列1"],"rows":[["值1"]]}：数据表，最多 1-2 张`,
    `规则：数值引用必须来自用户给的素材或你确知的事实，不许编数据；有人提问、有人回答、有人吐槽；最后一幕收在全员共识或一句吐槽上。`,
  ].filter(Boolean).join("\n\n");
}

export async function writeDraft({ topic, material, cast, cfg, out, verbose }) {
  const client = makeClient(cfg);
  const sys = buildSystemPrompt(cast, cfg);
  const user = [`本期议题：${topic}`, material ? `素材（事实依据，优先使用）：\n${material}` : ""]
    .filter(Boolean).join("\n\n");
  if (verbose) console.log(`[aig] writer: model=${cfg.provider.model} topic=${topic.slice(0, 40)}`);
  let raw = await client.chat(
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { json: true, temperature: 0.9, maxTokens: cfg.write?.maxTokens }
  );
  if (!raw || !raw.trim()) {
    throw new Error(
      "writer returned empty content (reasoning likely ate the token budget). " +
        "Raise write.maxTokens in aig.config.json (e.g. 32768) or pick a non-reasoning model."
    );
  }
  raw = raw.trim().replace(/^```(json)?\s*|\s*```$/g, "");
  let draft;
  try {
    draft = JSON.parse(raw);
  } catch {
    throw new Error(`writer did not return valid JSON (first 200 chars): ${raw.slice(0, 200)}`);
  }
  validateDraft(draft, cast);
  const before = draft.blocks.length;
  draft.blocks = blockGuard(draft.blocks, {
    min: cfg.write?.minBlocks ?? 16,
    max: cfg.write?.maxBlocks ?? 24,
  });
  const trimmed = before - draft.blocks.length;
  draft.__cast = undefined;
  writeFileSync(out, JSON.stringify(draft, null, 2), "utf8");
  const says = draft.blocks.filter((b) => b.type === "say").length;
  console.log(`[aig] draft written: ${out} (${draft.blocks.length} blocks, ${says} lines of dialogue${trimmed > 0 ? `, blockGuard trimmed ${trimmed}` : ""})`);
  return draft;
}
