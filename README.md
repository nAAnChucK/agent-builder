# Agent Builder

A web app where you describe an agent in plain English and it gets built, configured, and made runnable instantly.

## Stack

| Layer | Tech |
|---|---|
| Meta-agent (NL → config) | Claude API (tool use / structured output) |
| Agent runtime | LangGraph `create_react_agent` |
| Backend | FastAPI + SSE streaming |
| Frontend | React + Vite + Tailwind |

## Quick start

### 1. Backend

```powershell
cd backend
copy .env.example .env        # add your ANTHROPIC_API_KEY
.\.venv\Scripts\activate
uvicorn main:app --reload
```

### 2. Frontend

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173

## How it works

1. **Describe** your agent in the text box ("an assistant that searches the web and saves summaries to files")
2. The **meta-agent** (Claude) reads the description and selects tools + writes a system prompt
3. A **LangGraph ReAct agent** is compiled from that config and stored
4. Click the agent in the sidebar to open a **streaming chat** interface

## Available tools

| Tool | Type | Notes |
|---|---|---|
| `calculator` | builtin | Safe math evaluation |
| `read_file` | cli | Reads from `backend/workspace/` |
| `write_file` | cli | Writes to `backend/workspace/` |
| `list_files` | cli | Lists `backend/workspace/` |
| `run_shell` | cli | Subprocess in workspace dir |
| `web_search` | mcp | Requires `BRAVE_API_KEY` in `.env` |

> **MCP note**: `web_search` is wired as an HTTP call to Brave Search today. Swap the implementation in `core/tool_registry.py` with an MCP client (e.g. `mcp-server-brave-search`) for a fully sandboxed integration.

## Adding a new tool

1. Add a `@tool` function to `backend/core/tool_registry.py`
2. Add it to the `REGISTRY` dict
3. The meta-agent will automatically consider it when building new agents

## Project structure

```
agent-builder/
├── backend/
│   ├── core/
│   │   ├── meta_agent.py      # NL description → AgentConfig via Claude
│   │   ├── tool_registry.py   # Tool catalog + LangChain implementations
│   │   ├── agent_factory.py   # AgentConfig → compiled LangGraph graph
│   │   └── store.py           # JSON persistence for agent records
│   ├── api/
│   │   ├── build.py           # POST /api/build
│   │   └── agents.py          # GET|POST|DELETE /api/agents/*
│   └── workspace/             # Agent file operations are sandboxed here
└── frontend/
    └── src/
        ├── components/
        │   ├── AgentBuilder.tsx   # NL input + build button
        │   ├── Sidebar.tsx        # Agent list
        │   └── AgentRunner.tsx    # Streaming chat interface
        └── api/client.ts          # Typed API + SSE stream consumer
```
