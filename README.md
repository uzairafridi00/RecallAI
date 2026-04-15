# 🧠 RecallAI (MCP Vector Memory Server)

<p>
  <img src="https://img.shields.io/github/stars/uzairafridi00/RecallAI?style=social" />
  <img src="https://img.shields.io/github/forks/uzairafridi00/RecallAI?style=social" />
  <img src="https://img.shields.io/github/license/uzairafridi00/RecallAI" />
  <img src="https://img.shields.io/github/issues/uzairafridi00/RecallAI" />
  <img src="https://img.shields.io/github/last-commit/uzairafridi00/RecallAI" />
</p>

> Give your LLM **memory that actually remembers.**

**RecallAI** is a lightweight, production-ready **MCP Vector Memory Server** that enables long-term, semantic memory for any LLM using **ChromaDB**.

It allows models like Claude, OpenAI, Gemini, and Mistral to **store, recall, and reason over past interactions**, making them smarter over time instead of stateless.

---

### ⭐ Support the Project

If you find this useful:

- ⭐ **Star the repo** to support the project  
- 🍴 **Fork it** to build your own memory-powered systems  
- 🔔 **Follow me** for more AI + LLM engineering content  

---

### 🚀 Why RecallAI?

LLMs are powerful, but they forget everything between sessions.

**RecallAI fixes that.**

- 🧠 Persistent long-term memory  
- 🔍 Semantic recall (not just keyword search)  
- ⚡ Works with any MCP-compatible LLM  
- 🔌 Plug-and-play with OpenAI, Claude, Ollama, and more  

---

> Build AI systems that **learn, adapt, and remember.**

A **Model Context Protocol (MCP) server** that gives any LLM persistent, semantic long-term memory using [ChromaDB](https://www.trychroma.com/) as the vector database backend.

Works with **Claude**, **OpenAI**, **Gemini**, **Mistral**, or any LLM that supports MCP-compatible tool calling.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Starting ChromaDB](#starting-chromadb)
- [Building & Running](#building--running)
- [Connecting to LLMs](#connecting-to-llms)
  - [Claude (claude.ai / Claude Desktop)](#claude-claudeai--claude-desktop)
  - [OpenAI (via compatible client)](#openai-via-compatible-client)
  - [Cursor / Continue / Other IDEs](#cursor--continue--other-ides)
- [Available Tools](#available-tools)
- [Embedding Providers](#embedding-providers)
  - [OpenAI](#openai)
  - [Ollama (local, free)](#ollama-local-free)
  - [Local fallback](#local-fallback-testing-only)
- [Namespaces](#namespaces)
- [Example Workflows](#example-workflows)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)

---

## How It Works

```
User ──► LLM ──► MCP Tool Call
                    │
                    ▼
         mcp-vector-memory server
                    │
           embed text via provider
           (OpenAI / Ollama / local)
                    │
                    ▼
              ChromaDB
         (persistent vector store)
                    │
           similarity search /
           CRUD on memories
                    │
                    ▼
         Results returned to LLM
```

When an LLM wants to remember or recall something, it calls one of the memory tools. The server converts text into a vector embedding, stores it in ChromaDB, and returns semantically relevant results on retrieval — even when the exact wording differs.

---

## Features

- 🧠 **Semantic search** — recall memories by meaning, not just keywords
- 🗂️ **Namespaces** — isolate memories by user, project, or session
- 🏷️ **Metadata filtering** — tag memories and filter on retrieval
- 🔌 **Multi-provider embeddings** — OpenAI, Ollama, or local hash fallback
- 🔄 **Full CRUD** — store, get, update, delete, list, and clear memories
- 📊 **Stats** — inspect memory counts per namespace
- ✅ **LLM-agnostic** — works with any client that supports MCP tool calling

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | ≥ 18 | Required for the MCP server |
| npm | ≥ 9 | Comes with Node.js |
| Docker | any recent | Easiest way to run ChromaDB |
| ChromaDB | ≥ 0.4 | Can also install via `pip` |

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/uzairafridi00/RecallAI.git
cd RecallAI

# 2. Install dependencies
npm install

# 3. Copy and edit the environment file
cp .env.example .env
```

---

## Configuration

Edit `.env` to suit your setup:

```env
# ChromaDB URL (default shown)
CHROMA_URL=http://localhost:8000

# Embedding provider: openai | ollama | local
EMBEDDING_PROVIDER=openai

# Model to use (defaults are applied per provider if omitted)
EMBEDDING_MODEL=text-embedding-3-small

# Required when EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Required when EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
```

All environment variables can also be passed directly at runtime (see [Building & Running](#building--running)).

---

## Starting ChromaDB

### Option A — Docker Compose (recommended)

```bash
docker compose up -d
```

This starts ChromaDB at `http://localhost:8000` with persistent storage in a named Docker volume.

### Option B — Docker directly

```bash
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  -v chroma-data:/chroma/chroma \
  -e ALLOW_RESET=true \
  chromadb/chroma:latest
```

### Option C — Python (no Docker)

```bash
pip install chromadb
chroma run --path ./chroma-data --port 8000
```

Verify ChromaDB is running:

```bash
curl http://localhost:8000/api/v1/heartbeat
# → {"nanosecond heartbeat": ...}
```

---

## Building & Running

```bash
# Build TypeScript → JavaScript
npm run build

# Start the server (reads from .env automatically)
npm start

# Or pass env vars inline
EMBEDDING_PROVIDER=ollama \
OLLAMA_BASE_URL=http://localhost:11434 \
npm start
```

The server communicates over **stdio** (standard MCP transport). It does not bind to a port itself — your MCP client connects to it as a child process.

---

## Connecting to LLMs

### Claude (claude.ai / Claude Desktop)

Add the server to your Claude Desktop `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vector-memory": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-vector-memory/dist/index.js"],
      "env": {
        "CHROMA_URL": "http://localhost:8000",
        "EMBEDDING_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

Restart Claude Desktop. You should see the memory tools appear in the tools panel.

---

### OpenAI (via compatible client)

For use with GPT-4o or other OpenAI models via a tool-calling client, register the MCP server tools manually. Each tool maps to a standard OpenAI function definition.

Example using the OpenAI Node SDK:

```javascript
import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// 1. Start the MCP server as a child process
const transport = new StdioClientTransport({
  command: "node",
  args: ["./dist/index.js"],
  env: {
    CHROMA_URL: "http://localhost:8000",
    EMBEDDING_PROVIDER: "openai",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
});

const mcpClient = new Client({ name: "my-app", version: "1.0.0" }, {});
await mcpClient.connect(transport);

// 2. List available tools
const { tools } = await mcpClient.listTools();

// 3. Convert MCP tools to OpenAI function format
const openaiTools = tools.map((t) => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description,
    parameters: t.inputSchema,
  },
}));

// 4. Pass tools to OpenAI
const openai = new OpenAI();
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Remember that my favourite color is blue." }],
  tools: openaiTools,
});

// 5. If the model calls a tool, execute it via MCP
const toolCall = response.choices[0].message.tool_calls?.[0];
if (toolCall) {
  const result = await mcpClient.callTool({
    name: toolCall.function.name,
    arguments: JSON.parse(toolCall.function.arguments),
  });
  console.log(result);
}
```

---

### Cursor / Continue / Other IDEs

Any IDE extension that supports MCP (Cursor, Continue, Cline, etc.) can connect using a config similar to the Claude Desktop format. Consult your extension's documentation for the exact config file location, then add:

```json
{
  "mcpServers": {
    "vector-memory": {
      "command": "node",
      "args": ["/path/to/mcp-vector-memory/dist/index.js"],
      "env": {
        "CHROMA_URL": "http://localhost:8000",
        "EMBEDDING_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| `memory_store` | Store text + optional metadata in a namespace |
| `memory_search` | Semantic similarity search with optional score threshold and filters |
| `memory_get` | Retrieve a specific memory by ID |
| `memory_update` | Update content and/or metadata of an existing memory |
| `memory_delete` | Delete a memory by ID |
| `memory_list` | List all memories in a namespace with pagination |
| `memory_clear_namespace` | Delete all memories in a namespace (requires `confirm: true`) |
| `memory_stats` | Return total count and per-namespace breakdown |

### Tool Input Examples

**Store a memory**
```json
{
  "content": "The user prefers dark mode and uses VS Code.",
  "metadata": { "category": "preferences", "source": "conversation" },
  "namespace": "user-alice"
}
```

**Search memories**
```json
{
  "query": "editor settings",
  "top_k": 3,
  "namespace": "user-alice",
  "min_score": 0.7
}
```

**Search with metadata filter**
```json
{
  "query": "project deadline",
  "filter": { "category": "tasks" },
  "namespace": "work"
}
```

**Update a memory**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "The user now prefers light mode.",
  "namespace": "user-alice"
}
```

**Clear a namespace**
```json
{
  "namespace": "user-alice",
  "confirm": true
}
```

---

## Embedding Providers

### OpenAI

Best quality. Requires an OpenAI API key and incurs a small cost per embedding.

```env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small   # or text-embedding-3-large, text-embedding-ada-002
```

| Model | Dimensions | Notes |
|-------|-----------|-------|
| `text-embedding-3-small` | 1536 | Best cost/quality ratio (default) |
| `text-embedding-3-large` | 3072 | Highest quality |
| `text-embedding-ada-002` | 1536 | Legacy, still solid |

---

### Ollama (local, free)

Run embeddings entirely on your machine — no API key, no cost.

```bash
# Install Ollama: https://ollama.com
ollama pull nomic-embed-text   # recommended
```

```env
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text   # or mxbai-embed-large, all-minilm
```

| Model | Dimensions | Notes |
|-------|-----------|-------|
| `nomic-embed-text` | 768 | Great quality, fast (default) |
| `mxbai-embed-large` | 1024 | Highest quality local option |
| `all-minilm` | 384 | Very fast, lower quality |

---

### Local fallback (testing only)

No external dependencies. Uses a deterministic character-hash projection — useful for development and CI, but **not suitable for production** as semantic similarity is not meaningful.

```env
EMBEDDING_PROVIDER=local
```

---

## Namespaces

Namespaces let you logically partition the memory store without running multiple servers.

Common patterns:

| Pattern | Example namespace |
|---------|------------------|
| Per user | `user-alice`, `user-bob` |
| Per session | `session-2024-01-15` |
| Per project | `project-website`, `project-api` |
| Per topic | `meetings`, `preferences`, `tasks` |
| Global shared | `default` |

Use `namespace: "*"` in `memory_search` to search across all namespaces at once.

---

## Example Workflows

### Personal assistant memory

```
User: "Remember I have a dentist appointment on the 20th."

LLM calls:
  memory_store({
    content: "Dentist appointment on the 20th of this month.",
    metadata: { category: "calendar" },
    namespace: "personal"
  })

---

User: "Do I have anything coming up this month?"

LLM calls:
  memory_search({
    query: "upcoming appointments or events this month",
    namespace: "personal",
    top_k: 5
  })
```

### Code assistant context

```
LLM calls memory_store to save:
  - Project architecture decisions
  - User's preferred code style
  - Known bugs and their resolutions
  - API keys / config values (be careful with secrets)

On each new conversation, LLM calls:
  memory_search({ query: user_message, namespace: "project-x" })
  → injects relevant context before generating a response
```

---

## Architecture

```
src/
├── index.ts          # MCP server, tool definitions, request handlers
├── memory-store.ts   # ChromaDB CRUD + vector search abstraction
├── embeddings.ts     # Multi-provider embedding (OpenAI / Ollama / local)
└── config.ts         # Environment variable loading and defaults

docker-compose.yml    # ChromaDB container
.env.example          # Environment variable template
tsconfig.json         # TypeScript configuration
```

---

## Troubleshooting

**`Connection refused` on ChromaDB**  
Make sure ChromaDB is running: `curl http://localhost:8000/api/v1/heartbeat`  
If using Docker: `docker compose up -d` or `docker ps` to check the container.

**`OPENAI_API_KEY is required` error**  
Set `OPENAI_API_KEY` in your `.env` file, or switch to `EMBEDDING_PROVIDER=ollama` / `local`.

**Ollama embedding fails**  
Ensure Ollama is running (`ollama serve`) and the model is pulled: `ollama pull nomic-embed-text`.

**Memories found but scores are low**  
Try lowering `min_score` or switching to a higher-quality embedding model. The `local` provider does not produce meaningful similarity scores.

**MCP server not appearing in Claude Desktop**  
Check the absolute path in `claude_desktop_config.json` is correct, and restart Claude Desktop after any config change.

**TypeScript compile errors after pulling updates**  
Run `npm install` again — a dependency may have changed. Then `npm run build`.
