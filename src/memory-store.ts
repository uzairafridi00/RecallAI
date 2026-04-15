import { ChromaClient, Collection } from "chromadb";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config.js";

export interface MemoryEntry {
  id: string;
  content: string;
  metadata: Record<string, string>;
  namespace: string;
  createdAt: string;
  updatedAt: string;
  score?: number;
}

interface AddParams {
  content: string;
  embedding: number[];
  metadata: Record<string, string>;
  namespace: string;
}

interface SearchParams {
  embedding: number[];
  topK: number;
  namespace: string;
  minScore: number;
  filter?: Record<string, string>;
}

interface UpdateParams {
  id: string;
  content?: string;
  embedding?: number[];
  metadata?: Record<string, string>;
  namespace: string;
}

interface ListParams {
  namespace: string;
  limit: number;
  offset: number;
  filter?: Record<string, string>;
}

export class VectorMemoryStore {
  private client: ChromaClient;
  private collections: Map<string, Collection> = new Map();

  constructor() {
    this.client = new ChromaClient({ path: config.chromaUrl });
  }

  async initialize(): Promise<void> {
    // Eagerly load the default namespace
    await this.getOrCreateCollection("default");
  }

  private async getOrCreateCollection(namespace: string): Promise<Collection> {
    if (this.collections.has(namespace)) {
      return this.collections.get(namespace)!;
    }
    // Collection names must be 3–63 chars, alphanumeric + hyphens
    const safeName = `mem_${namespace.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 55)}`;
    const collection = await this.client.getOrCreateCollection({
      name: safeName,
      metadata: { namespace },
    });
    this.collections.set(namespace, collection);
    return collection;
  }

  async add(params: AddParams): Promise<string> {
    const { content, embedding, metadata, namespace } = params;
    const id = uuidv4();
    const now = new Date().toISOString();
    const collection = await this.getOrCreateCollection(namespace);

    await collection.add({
      ids: [id],
      embeddings: [embedding],
      documents: [content],
      metadatas: [{ ...metadata, _createdAt: now, _updatedAt: now }],
    });

    return id;
  }

  async search(params: SearchParams): Promise<MemoryEntry[]> {
    const { embedding, topK, namespace, minScore, filter } = params;

    const namespaces =
      namespace === "*"
        ? await this.listNamespaces()
        : [namespace];

    const allResults: MemoryEntry[] = [];

    for (const ns of namespaces) {
      try {
        const collection = await this.getOrCreateCollection(ns);
        const count = await collection.count();
        if (count === 0) continue;

        const where = filter && Object.keys(filter).length > 0 ? filter : undefined;
        const results = await collection.query({
          queryEmbeddings: [embedding],
          nResults: Math.min(topK, count),
          where,
        });

        if (!results.ids[0]) continue;

        results.ids[0].forEach((id, i) => {
          const distance = results.distances?.[0]?.[i] ?? 1;
          // ChromaDB returns L2 distance; convert to a 0-1 similarity score
          const score = Math.max(0, 1 - distance / 2);
          if (score < minScore) return;

          const meta = (results.metadatas?.[0]?.[i] ?? {}) as Record<string, string>;
          allResults.push({
            id,
            content: results.documents?.[0]?.[i] ?? "",
            metadata: Object.fromEntries(
              Object.entries(meta).filter(([k]) => !k.startsWith("_"))
            ),
            namespace: ns,
            createdAt: meta._createdAt ?? "",
            updatedAt: meta._updatedAt ?? "",
            score,
          });
        });
      } catch {
        // namespace may not exist yet — skip
      }
    }

    return allResults.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, topK);
  }

  async get(id: string, namespace: string): Promise<MemoryEntry | null> {
    try {
      const collection = await this.getOrCreateCollection(namespace);
      const result = await collection.get({
        ids: [id],
        include: ["documents", "metadatas"] as any,
      });

      if (!result.ids.length) return null;

      const meta = (result.metadatas?.[0] ?? {}) as Record<string, string>;
      return {
        id: result.ids[0],
        content: result.documents?.[0] ?? "",
        metadata: Object.fromEntries(
          Object.entries(meta).filter(([k]) => !k.startsWith("_"))
        ),
        namespace,
        createdAt: meta._createdAt ?? "",
        updatedAt: meta._updatedAt ?? "",
      };
    } catch {
      return null;
    }
  }

  async update(params: UpdateParams): Promise<boolean> {
    const { id, content, embedding, metadata, namespace } = params;
    try {
      const existing = await this.get(id, namespace);
      if (!existing) return false;

      const collection = await this.getOrCreateCollection(namespace);
      const now = new Date().toISOString();
      const mergedMeta = {
        ...existing.metadata,
        ...(metadata ?? {}),
        _createdAt: existing.createdAt,
        _updatedAt: now,
      };

      await collection.update({
        ids: [id],
        embeddings: embedding ? [embedding] : undefined,
        documents: content ? [content] : undefined,
        metadatas: [mergedMeta],
      });
      return true;
    } catch {
      return false;
    }
  }

  async delete(id: string, namespace: string): Promise<boolean> {
    try {
      const collection = await this.getOrCreateCollection(namespace);
      await collection.delete({ ids: [id] });
      return true;
    } catch {
      return false;
    }
  }

  async list(params: ListParams): Promise<MemoryEntry[]> {
    const { namespace, limit, offset, filter } = params;
    try {
      const collection = await this.getOrCreateCollection(namespace);
      const where = filter && Object.keys(filter).length > 0 ? filter : undefined;

      const result = await collection.get({
        where,
        limit,
        offset,
        include: ["documents", "metadatas"] as any,
      });

      return result.ids.map((id, i) => {
        const meta = (result.metadatas?.[i] ?? {}) as Record<string, string>;
        return {
          id,
          content: result.documents?.[i] ?? "",
          metadata: Object.fromEntries(
            Object.entries(meta).filter(([k]) => !k.startsWith("_"))
          ),
          namespace,
          createdAt: meta._createdAt ?? "",
          updatedAt: meta._updatedAt ?? "",
        };
      });
    } catch {
      return [];
    }
  }

  async clearNamespace(namespace: string): Promise<number> {
    try {
      const collection = await this.getOrCreateCollection(namespace);
      const count = await collection.count();
      const safeName = `mem_${namespace.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 55)}`;
      await this.client.deleteCollection({ name: safeName });
      this.collections.delete(namespace);
      return count;
    } catch {
      return 0;
    }
  }

  async stats(namespace?: string): Promise<object> {
    if (namespace) {
      try {
        const collection = await this.getOrCreateCollection(namespace);
        const count = await collection.count();
        return { namespace, count };
      } catch {
        return { namespace, count: 0 };
      }
    }

    const namespaces = await this.listNamespaces();
    const breakdown: Record<string, number> = {};
    let total = 0;

    for (const ns of namespaces) {
      try {
        const col = await this.getOrCreateCollection(ns);
        const c = await col.count();
        breakdown[ns] = c;
        total += c;
      } catch {
        breakdown[ns] = 0;
      }
    }

    return { total, namespaces: breakdown };
  }

  private async listNamespaces(): Promise<string[]> {
    const raw: unknown[] = await this.client.listCollections();
    const names: string[] = raw.map((c) =>
      typeof c === "string" ? c : (c as { name: string }).name
    );
    return names
      .filter((n) => n.startsWith("mem_"))
      .map((n) => {
        const cached = [...this.collections.entries()].find(
          ([, col]) => (col as unknown as { name: string }).name === n
        );
        return cached ? cached[0] : n.replace(/^mem_/, "");
      });
  }
}
