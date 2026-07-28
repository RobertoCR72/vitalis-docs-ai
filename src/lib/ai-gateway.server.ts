// Servidor apenas — não importar do cliente.
// Cliente do Lovable AI Gateway (OpenAI-compatível).

const BASE_URL = "https://ai.gateway.lovable.dev/v1";

function getKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente no ambiente do servidor.");
  return key;
}

export async function embedText(input: string): Promise<number[]> {
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": getKey(),
    },
    body: JSON.stringify({
      model: "google/gemini-embedding-2",
      input,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding falhou (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
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
