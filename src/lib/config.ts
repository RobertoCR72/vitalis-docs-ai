// Configuração central do Nexo. Ajuste aqui e recompile.
export const NEXO_CONFIG = {
  chatModel: "openai/gpt-5.5",
  embeddingModel: "google/gemini-embedding-2",
  embeddingDims: 3072,
  maxQuestionChars: 1500,
  topKCandidates: 12,
  finalChunks: 6,
  minSimilarity: 0.35,
  rateLimit: {
    perHour: 15,
    perDay: 40,
  },
  upload: {
    maxBytes: 10 * 1024 * 1024,
    allowedExtensions: [".pdf", ".txt"] as const,
    allowedMimes: ["application/pdf", "text/plain"] as const,
  },
  disclaimer:
    "Respostas geradas por IA com base em documentos demonstrativos. Confirme decisões relevantes com a área responsável.",
} as const;

export const APP_NAME = "Nexo — Copiloto Corporativo";
export const APP_TAGLINE = "Copiloto corporativo com IA para políticas e procedimentos";
