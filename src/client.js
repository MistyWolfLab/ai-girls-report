// OpenAI-compatible chat client (works with any /v1 provider).
export function makeClient(cfg) {
  const key = process.env[cfg.provider.apiKeyEnv];
  if (!key) {
    const err = new Error(
      `env ${cfg.provider.apiKeyEnv} not set (configure provider.apiKeyEnv in aig.config.json)`
    );
    err.hint = "key";
    throw err;
  }
  const base = cfg.provider.baseURL.replace(/\/$/, "");
  return {
    base,
    key,
    async chat(messages, { json = false, temperature, maxTokens } = {}) {
      const body = {
        model: cfg.provider.model,
        messages,
        max_tokens: maxTokens ?? 32768, // reasoning models can burn 10-25x the body on thinking
      };
      if (json) body.response_format = { type: "json_object" };
      if (temperature !== undefined) body.temperature = temperature;
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`chat ${res.status}: ${t.slice(0, 400)}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}
