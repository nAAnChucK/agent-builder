# Agent Builder

A web app where you describe an agent in plain English and it gets built, configured, and made runnable instantly.

## Stack

| Layer | Tech |
|---|---|
| Meta-agent (NL → config) | Claude API (forced tool use for structured output) |
| Agent runtime | LangGraph `create_react_agent` |
| Backend | FastAPI + SSE streaming |
| Frontend | React + Vite + Tailwind |
| Hosting | Render (single service — FastAPI serves the React build) |

---

## Solution architecture

### Infrastructure

```
Browser
  │
  │  HTTPS
  ▼
Render (single service)
  │
  ├── FastAPI
  │     ├── Serves React UI (static files)
  │     ├── HTTP Basic Auth middleware (guards everything)
  │     └── /api/* routes
  │           ├── POST /api/build
  │           ├── GET  /api/agents
  │           └── POST /api/agents/{id}/run  ← streaming SSE
  │
  ├── Render Disk (/data)
  │     ├── agents_store.json  ← persists built agents across deploys
  │     └── workspace/         ← agent file operations land here
  │
  └── In-memory
        └── LangGraph agent cache (rebuilt from config on first run after restart)
```

### Build flow — turning a description into an agent

```
Your natural language description
  │
  ▼
Meta-Agent (Claude API call with forced tool use)
  │  reads description, selects tools from registry, writes system prompt
  ▼
AgentConfig { name, description, system_prompt, tools[] }
  │
  ▼
agents_store.json  ← saved to Render Disk
```

The meta-agent uses Claude's **forced tool use** feature — it is required to respond by calling a `create_agent_config` tool with a strict JSON schema. This guarantees structured output with no parsing or prompt hacking needed.

### Run flow — chatting with an agent

```
Your message
  │
  ▼
AgentFactory
  │  loads config from store → compiles LangGraph ReAct graph (cached in memory)
  ▼
LangGraph ReAct loop:
  ┌─────────────────────────────────┐
  │  Claude (LLM)                   │
  │    decides: respond or use tool │
  │         │                       │
  │         ▼                       │
  │  Tool execution                 │
  │  (calculator / read_file / etc) │
  │         │                       │
  │         └──── result back to LLM│
  └─────────────────────────────────┘
  │  streams tokens + tool events via SSE
  ▼
Browser → chat UI renders tokens and tool call panels in real time
```

### Key design decisions

| Decision | Reason |
|---|---|
| Single Render service | FastAPI serves both the API and the React build — no CORS, one URL, one deploy |
| Forced tool use for meta-agent | Guarantees structured JSON config from Claude with no output parsing |
| LangGraph ReAct | Handles the think → act → observe loop automatically; tool calls are built in |
| SSE streaming | Shows tokens and tool calls as they happen, not all at once after completion |
| Render Disk | Containers are ephemeral — without the disk, agents reset on every deploy |
| HTTP Basic Auth as middleware | Protects both the UI and API with one layer, no frontend changes needed |
| `DATA_DIR` env var | Decouples storage path from code — `/data` in production, local dir in dev |

---

## Quick start (local)

### 1. Backend

```powershell
cd backend
copy .env.example .env        # add your ANTHROPIC_API_KEY
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `AUTH_USERNAME` | No | Basic auth username (default: `admin`) |
| `AUTH_PASSWORD` | No | Basic auth password — leave empty to disable auth |
| `BRAVE_API_KEY` | No | Enables the `web_search` tool |
| `DATA_DIR` | No | Storage path for agents and workspace (default: `backend/`) |

---

## Available tools

| Tool | Type | Notes |
|---|---|---|
| `calculator` | builtin | Safe math evaluation via Python's `math` module |
| `read_file` | cli | Reads files from `workspace/` |
| `write_file` | cli | Writes files to `workspace/` |
| `list_files` | cli | Lists contents of `workspace/` |
| `run_shell` | cli | Runs shell commands inside `workspace/` with 30s timeout |
| `web_search` | mcp | HTTP call to Brave Search API — swap for MCP server in production |

> `web_search` is currently implemented as a direct HTTP call to Brave Search. Replace the implementation in `core/tool_registry.py` with an MCP client (e.g. `mcp-server-brave-search`) for a fully sandboxed integration.

All file and shell tools are sandboxed to the `workspace/` directory — path traversal is blocked.

---

## Adding a new tool

1. Add a `@tool` decorated function to `backend/core/tool_registry.py`
2. Register it in the `REGISTRY` dict with `id`, `description`, `category`, `type`, and `instance`
3. The meta-agent will automatically consider it when building new agents — no other changes needed

---

## Deployment (Render)

The app is deployed as a single Docker service on Render. The Dockerfile uses a multi-stage build:
- **Stage 1**: Node builds the React app (`npm run build`)
- **Stage 2**: Python installs dependencies and copies the React `dist/` into `static/` — FastAPI serves it

On deploy, Render injects a `PORT` env var which uvicorn picks up automatically.

A **Render Disk** is mounted at `/data` (set via `DATA_DIR=/data`) to persist `agents_store.json` and the `workspace/` directory across deploys and restarts.

To redeploy after a code change:
```powershell
git push
```
Render auto-deploys on every push to `master`.

---

## Project structure

```
agent-builder/
├── Dockerfile                 # Multi-stage: Node (React build) + Python (runtime)
├── render.yaml                # Render deployment blueprint
├── backend/
│   ├── main.py                # FastAPI app, Basic Auth middleware, static file serving
│   ├── core/
│   │   ├── meta_agent.py      # NL description → AgentConfig via Claude forced tool use
│   │   ├── tool_registry.py   # Tool catalog + LangChain tool implementations
│   │   ├── agent_factory.py   # AgentConfig → compiled LangGraph ReAct graph + SSE stream
│   │   └── store.py           # JSON persistence for agent records
│   ├── api/
│   │   ├── build.py           # POST /api/build, GET /api/tools
│   │   └── agents.py          # GET|POST|DELETE /api/agents/*
│   └── workspace/             # Sandboxed directory for agent file operations
└── frontend/
    └── src/
        ├── App.tsx                # Layout: sidebar + builder/runner view
        ├── components/
        │   ├── AgentBuilder.tsx   # NL input form + agent preview card
        │   ├── Sidebar.tsx        # Agent list with delete
        │   └── AgentRunner.tsx    # Streaming chat with tool call panels
        └── api/client.ts          # Typed API calls + SSE stream consumer
```

---

## Roadmap

- **v1** (current): Single agents, natural language builder, streaming chat
- **v2** (planned): Multi-agent orchestration — supervisor agent delegates to specialist sub-agents via LangGraph handoffs
