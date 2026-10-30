const apiKey = process.env.RESONARA_AI_API_KEY;
const baseUrl = (
  process.env.RESONARA_AI_BASE_URL ?? "https://api.deepseek.com"
).replace(/\/+$/, "");
const model = process.env.RESONARA_AI_MODEL ?? "deepseek-flash";

if (!apiKey) {
  console.error(
    "Set RESONARA_AI_API_KEY in the process environment before running ai:smoke.",
  );
  process.exit(1);
}

const startedAt = performance.now();
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 20_000);

try {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: 'Reply with this JSON only: {"ok":true}',
        },
      ],
    }),
    signal: controller.signal,
  });
  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;

  if (!response.ok || typeof content !== "string" || !content.trim()) {
    throw new Error(
      body?.error?.message ?? `AI provider returned HTTP ${response.status}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        status: response.status,
        model: body.model ?? model,
        latencyMs: Math.round(performance.now() - startedAt),
        content,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown failure";
  console.error(`AI provider smoke test failed: ${message}`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
