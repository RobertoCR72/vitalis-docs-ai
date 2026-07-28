// Servidor apenas — não importar do cliente.
// Cliente do Lovable AI Gateway (OpenAI-compatível).

const BASE_URL = "https://ai.gateway.lovable.dev/v1";

function getKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente no ambiente do servidor.");
  return key;
}

export async function embedText(input: string): Promise<number[]> {
  const maxAttempts = 5;
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": getKey(),
      },
      body: JSON.stringify({ model: "google/gemini-embedding-2", input }),
    });
    if (res.ok) {
      const data = (await res.json()) as { data: { embedding: number[] }[] };
      return data.data[0].embedding;
    }
    const body = await res.text();
    lastErr = `${res.status}: ${body.slice(0, 200)}`;
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(30_000, 1000 * 2 ** (attempt - 1)) + Math.random() * 500;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
    }
    throw new Error(`Embedding falhou (${lastErr})`);
  }
  throw new Error(`Embedding falhou após ${maxAttempts} tentativas (${lastErr})`);
}

export async function chatComplete(params: {
  system: string;
  user: string;
  model?: string;
  responseJson?: boolean;
}): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": getKey(),
    },
    body: JSON.stringify({
      model: params.model ?? "openai/gpt-5.5",
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      ...(params.responseJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429) throw new Error("RATE_LIMITED_UPSTREAM");
  if (res.status === 402) throw new Error("CREDITS_EXHAUSTED");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Chat completions falhou (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}
