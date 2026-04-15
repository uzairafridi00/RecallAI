#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { VectorMemoryStore } from "./memory-store.js";
import { EmbeddingProvider } from "./embeddings.js";
import { config } from "./config.js";

const store = new VectorMemoryStore();
const embedder = new EmbeddingProvider(config);

const server = new Server(
  {
    name: "mcp-vector-memory",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool Definitions ────────────────────────────────────────────────────────

const tools: Tool[] = [
  {
    name: "memory_store",
    description:
      "Store a piece of information in long-term vector memory. Use this to remember facts, context, preferences, or any content the user wants recalled later. Returns the ID of the stored memory.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The text content to store in memory.",
        },
        metadata: {
          type: "object",
          description:
            "Optional key-value metadata (tags, source, category, etc.) to attach to this memory.",
          additionalProperties: { type: "string" },
        },
        namespace: {
          type: "string",
          description:
            "Optional namespace / collection to store this memory in (default: 'default'). Useful for separating memories by user, project, or topic.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "memory_search",
    description:
      "Search long-term vector memory using semantic similarity. Returns the most relevant memories for a given query, even if the wording differs. Use this before answering questions to surface relevant context.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The natural-language search query.",
        },
        top_k: {
          type: "number",
          description: "Maximum number of results to return (default: 5).",
        },
        namespace: {
          type: "string",
          description:
            "Namespace to search within (default: 'default'). Use '*' to search all namespaces.",
        },
        min_score: {
          type: "number",
          description:
            "Minimum similarity score threshold between 0 and 1 (default: 0.0).",
        },
        filter: {
          type: "object",
          description: "Optional metadata key-value filter to narrow results.",
          additionalProperties: { type: "string" },
        },
      },
      required: ["query"],
    },
  },
  {
    name: "memory_get",
    description: "Retrieve a specific memory by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the memory to retrieve.",
        },
        namespace: {
          type: "string",
          description: "Namespace the memory lives in (default: 'default').",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "memory_update",
    description:
      "Update the content and/or metadata of an existing memory by ID. The embedding is regenerated automatically.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the memory to update.",
        },
        content: {
          type: "string",
          description: "New text content (optional — omit to keep existing).",
        },
        metadata: {
          type: "object",
          description: "New metadata to merge with existing metadata.",
          additionalProperties: { type: "string" },
        },
        namespace: {
          type: "string",
          description: "Namespace the memory lives in (default: 'default').",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "memory_delete",
    description: "Delete a specific memory by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the memory to delete.",
        },
        namespace: {
          type: "string",
          description: "Namespace the memory lives in (default: 'default').",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "memory_list",
    description:
      "List all memories in a namespace, with optional metadata filtering and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Namespace to list memories from (default: 'default').",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 20, max: 100).",
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0).",
        },
        filter: {
          type: "object",
          description: "Optional metadata key-value filter.",
          additionalProperties: { type: "string" },
        },
      },
    },
  },
  {
    name: "memory_clear_namespace",
    description:
      "Delete ALL memories in a given namespace. This is irreversible. Useful for resetting a session or project context.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "The namespace to clear.",
        },
        confirm: {
          type: "boolean",
          description:
            "Must be true to proceed (safety guard against accidental deletion).",
        },
      },
      required: ["namespace", "confirm"],
    },
  },
  {
    name: "memory_stats",
    description:
      "Return statistics about memory usage: total count, namespace breakdown, and embedding provider info.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description:
            "Optional: get stats for a specific namespace only. Omit for global stats.",
        },
      },
    },
  },
];

// ─── Tool Handlers ───────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "memory_store": {
        const { content, metadata = {}, namespace = "default" } = args as {
          content: string;
          metadata?: Record<string, string>;
          namespace?: string;
        };
        const embedding = await embedder.embed(content);
        const id = await store.add({ content, embedding, metadata, namespace });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, id, namespace }),
            },
          ],
        };
      }

      case "memory_search": {
        const {
          query,
          top_k = 5,
          namespace = "default",
          min_score = 0.0,
          filter,
        } = args as {
          query: string;
          top_k?: number;
          namespace?: string;
          min_score?: number;
          filter?: Record<string, string>;
        };
        const queryEmbedding = await embedder.embed(query);
        const results = await store.search({
          embedding: queryEmbedding,
          topK: top_k,
          namespace,
          minScore: min_score,
          filter,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ results, count: results.length }),
            },
          ],
        };
      }

      case "memory_get": {
        const { id, namespace = "default" } = args as {
          id: string;
          namespace?: string;
        };
        const memory = await store.get(id, namespace);
        if (!memory) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Memory not found", id }),
              },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(memory) }],
        };
      }

      case "memory_update": {
        const { id, content, metadata, namespace = "default" } = args as {
          id: string;
          content?: string;
          metadata?: Record<string, string>;
          namespace?: string;
        };
        const embedding = content ? await embedder.embed(content) : undefined;
        const updated = await store.update({
          id,
          content,
          embedding,
          metadata,
          namespace,
        });
        if (!updated) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Memory not found", id }),
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify({ success: true, id }) },
          ],
        };
      }

      case "memory_delete": {
        const { id, namespace = "default" } = args as {
          id: string;
          namespace?: string;
        };
        const deleted = await store.delete(id, namespace);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: deleted, id }),
            },
          ],
        };
      }

      case "memory_list": {
        const { namespace = "default", limit = 20, offset = 0, filter } =
          args as {
            namespace?: string;
            limit?: number;
            offset?: number;
            filter?: Record<string, string>;
          };
        const results = await store.list({
          namespace,
          limit: Math.min(limit, 100),
          offset,
          filter,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ results, count: results.length }),
            },
          ],
        };
      }

      case "memory_clear_namespace": {
        const { namespace, confirm } = args as {
          namespace: string;
          confirm: boolean;
        };
        if (!confirm) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Confirmation required. Set confirm: true to proceed.",
                }),
              },
            ],
            isError: true,
          };
        }
        const count = await store.clearNamespace(namespace);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, deleted: count, namespace }),
            },
          ],
        };
      }

      case "memory_stats": {
        const { namespace } = args as { namespace?: string };
        const stats = await store.stats(namespace);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ...stats,
                embeddingProvider: embedder.providerName,
                embeddingModel: embedder.modelName,
              }),
            },
          ],
        };
      }

      default:
        return {
          content: [
            { type: "text", text: `Unknown tool: ${name}` },
          ],
          isError: true,
        };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  await store.initialize();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Vector Memory Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
