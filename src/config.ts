import { EmbeddingProviderType } from "./embeddings.js";

export interface Config {
  /** ChromaDB server URL */
  chromaUrl: string;

  /** Which embedding backend to use */
  embeddingProvider: EmbeddingProviderType;

  /** Model name for the chosen provider */
  embeddingModel: string;

  /** OpenAI API key (required when provider = openai) */
  openaiApiKey?: string;

  /** Ollama base URL (defaults to http://localhost:11434) */
  ollamaBaseUrl?: string;
}

function resolveProvider(raw: string | undefined): EmbeddingProviderType {
  const v = (raw ?? "local").toLowerCase();
  if (v === "openai" || v === "ollama" || v === "local") return v;
  console.error(
    `[mcp-memory] Unknown EMBEDDING_PROVIDER "${raw}", falling back to "local"`
  );
  return "local";
}

function resolveModel(provider: EmbeddingProviderType, raw: string | undefined): string {
  if (raw) return raw;
  switch (provider) {
    case "openai":
      return "text-embedding-3-small";
    case "ollama":
      return "nomic-embed-text";
    case "local":
      return "hash-384";
  }
}

export const config: Config = {
  chromaUrl: process.env.CHROMA_URL ?? "http://localhost:8000",
  embeddingProvider: resolveProvider(process.env.EMBEDDING_PROVIDER),
  embeddingModel: resolveModel(
    resolveProvider(process.env.EMBEDDING_PROVIDER),
    process.env.EMBEDDING_MODEL
  ),
  openaiApiKey: process.env.OPENAI_API_KEY,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
};
