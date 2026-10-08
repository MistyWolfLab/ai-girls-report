// Painter: OpenAI-compatible image generation, with a honest fallback.
// POST {base}/images/generations  (works with OpenAI, and relays that expose /images)
import { writeFileSync } from "node:fs";

export async function paint({ prompt, cfg, out, size }) {
  const key = process.env[cfg.provider.apiKeyEnv];
  if (!key) throw new Error(`env ${cfg.provider.apiKeyEnv} not set`);
  const base = cfg.provider.baseURL.replace(/\/$/, "");
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: cfg.provider.imageModel,
      prompt,
      size: size || "1536x1024",
      n: 1,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    const err = new Error(`image ${res.status}: ${t.slice(0, 300)}`);
    err.fallback = "provider-has-no-images";
    throw err;
  }
  const data = await res.json();
  const item = data.data?.[0];
  if (!item) throw new Error("image response has no data[0]");
  if (item.b64_json) {
    writeFileSync(out, Buffer.from(item.b64_json, "base64"));
  } else if (item.url) {
    const img = await fetch(item.url);
    writeFileSync(out, Buffer.from(await img.arrayBuffer()));
  } else {
    throw new Error("image response has neither b64_json nor url");
  }
  console.log(`[aig] image saved: ${out}`);
}
