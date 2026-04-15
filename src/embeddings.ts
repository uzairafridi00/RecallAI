import { Config } from "./config.js";

export type EmbeddingProviderType = "openai" | "ollama" | "local";

/**
 * EmbeddingProvider is a unified interface that supports:
 *  - OpenAI (text-embedding-3-small / ada-002)
 *  - Ollama (local models: nomic-embed-text, mxbai-embed-large, etc.)
 *  - Local fallback (simple TF-IDF-style hash embedding — for testing only)
 *
 * The provider is selected via the EMBEDDING_PROVIDER env var.
 */
export class EmbeddingProvider {
  public readonly providerName: EmbeddingProviderType;
  public readonly modelName: string;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.providerName = config.embeddingProvider;
    this.modelName = config.embeddingModel;
  }

  async embed(text: string): Promise<number[]> {
    switch (this.providerName) {
      case "openai":
        return this.embedOpenAI(text);
      case "ollama":
        return this.embedOllama(text);
      case "local":
        return this.embedLocal(text);
      default:
        throw new Error(`Unknown embedding provider: ${this.providerName}`);
    }
  }

  // ─── OpenAI ─────────────────────────────────────────────────────────────────

  private async embedOpenAI(text: string): Promise<number[]> {
    if (!this.config.openaiApiKey) {
      throw new Error(
        "OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai"
      );
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName || "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI embedding error: ${err}`);
    }

    const data = (await response.json()) as {
      data: { embedding: number[] }[];
    };
    return data.data[0].embedding;
  }

  // ─── Ollama ──────────────────────────────────────────────────────────────────

  private async embedOllama(text: string): Promise<number[]> {
    const baseUrl = this.config.ollamaBaseUrl || "http://localhost:11434";
    const model = this.modelName || "nomic-embed-text";

    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama embedding error: ${err}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }

  // ─── Local (deterministic hash — testing only) ───────────────────────────────

  private embedLocal(text: string): number[] {
    const DIMS = 384;
    const vector = new Array(DIMS).fill(0) as number[];
    const normalized = text.toLowerCase().trim();
    const tokens = normalized.split(/\s+/);

    for (const token of tokens) {
      for (let i = 0; i < token.length; i++) {
        const charCode = token.charCodeAt(i);
        const idx = (charCode * 31 + i * 17) % DIMS;
        vector[idx] += 1 / tokens.length;
      }
    }

    // L2 normalize
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
    return vector.map((v) => v / norm);
  }
}
