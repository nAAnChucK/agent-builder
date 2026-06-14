import math
import os
import subprocess
from pathlib import Path
from typing import Annotated

import httpx
from langchain_core.tools import tool

WORKSPACE = Path(os.getenv("DATA_DIR", Path(__file__).parent.parent)) / "workspace"
WORKSPACE.mkdir(exist_ok=True)


def _safe_path(relative: str) -> Path:
    target = (WORKSPACE / relative).resolve()
    if not target.is_relative_to(WORKSPACE.resolve()):
        raise ValueError("Path traversal not allowed")
    return target


@tool
def calculator(expression: Annotated[str, "Mathematical expression to evaluate"]) -> str:
    """Evaluate a mathematical expression. Supports standard math functions."""
    allowed = {k: v for k, v in math.__dict__.items() if not k.startswith("_")}
    allowed["abs"] = abs
    try:
        result = eval(expression, {"__builtins__": {}}, allowed)  # noqa: S307
        return str(result)
    except Exception as e:
        return f"Error: {e}"


@tool
def read_file(path: Annotated[str, "File path relative to workspace"]) -> str:
    """Read a file from the workspace."""
    try:
        return _safe_path(path).read_text(encoding="utf-8")
    except FileNotFoundError:
        return f"Error: '{path}' not found"
    except ValueError as e:
        return f"Error: {e}"


@tool
def write_file(
    path: Annotated[str, "File path relative to workspace"],
    content: Annotated[str, "Content to write"],
) -> str:
    """Write content to a file in the workspace."""
    try:
        target = _safe_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} bytes to '{path}'"
    except ValueError as e:
        return f"Error: {e}"


@tool
def list_files(
    directory: Annotated[str, "Directory relative to workspace, use '.' for root"] = ".",
) -> str:
    """List files and directories in the workspace."""
    try:
        target = _safe_path(directory)
        if not target.is_dir():
            return f"Error: '{directory}' is not a directory"
        entries = sorted(target.iterdir(), key=lambda p: (p.is_file(), p.name))
        lines = [f"{'[dir] ' if p.is_dir() else '      '}{p.relative_to(WORKSPACE)}" for p in entries]
        return "\n".join(lines) if lines else "(empty)"
    except ValueError as e:
        return f"Error: {e}"


@tool
def run_shell(command: Annotated[str, "Shell command to execute in the workspace"]) -> str:
    """Execute a shell command in the workspace directory."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(WORKSPACE),
        )
        out = result.stdout or ""
        if result.stderr:
            out += f"\nSTDERR:\n{result.stderr}"
        return out.strip() or "(no output)"
    except subprocess.TimeoutExpired:
        return "Error: command timed out after 30s"
    except Exception as e:
        return f"Error: {e}"


@tool
def web_search(query: Annotated[str, "Search query"]) -> str:
    """Search the web for current information using Brave Search.
    Requires BRAVE_API_KEY environment variable.
    In production, replace with an MCP server (e.g. mcp-server-brave-search).
    """
    api_key = os.getenv("BRAVE_API_KEY")
    if not api_key:
        return (
            "web_search unavailable: set BRAVE_API_KEY in .env, "
            "or connect a Brave Search MCP server."
        )
    try:
        resp = httpx.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers={"Accept": "application/json", "X-Subscription-Token": api_key},
            params={"q": query, "count": 5},
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json().get("web", {}).get("results", [])
        if not results:
            return "No results found."
        return "\n\n".join(
            f"**{r['title']}**\n{r['url']}\n{r.get('description', '')}" for r in results[:5]
        )
    except Exception as e:
        return f"Search error: {e}"


# Registry: tool_id → metadata + langchain tool instance
REGISTRY: dict[str, dict] = {
    "calculator": {
        "description": "Evaluate mathematical expressions",
        "category": "utility",
        "type": "builtin",
        "instance": calculator,
    },
    "read_file": {
        "description": "Read files from the workspace directory",
        "category": "filesystem",
        "type": "cli",
        "instance": read_file,
    },
    "write_file": {
        "description": "Write files to the workspace directory",
        "category": "filesystem",
        "type": "cli",
        "instance": write_file,
    },
    "list_files": {
        "description": "List files and folders in the workspace",
        "category": "filesystem",
        "type": "cli",
        "instance": list_files,
    },
    "run_shell": {
        "description": "Execute shell commands (use cautiously)",
        "category": "system",
        "type": "cli",
        "instance": run_shell,
    },
    "web_search": {
        "description": "Search the web for current information (requires BRAVE_API_KEY or MCP)",
        "category": "information",
        "type": "mcp",
        "instance": web_search,
    },
}


def get_tool_catalog() -> list[dict]:
    return [
        {"id": k, "description": v["description"], "category": v["category"], "type": v["type"]}
        for k, v in REGISTRY.items()
    ]


def get_tool_instances(tool_ids: list[str]) -> list:
    return [REGISTRY[tid]["instance"] for tid in tool_ids if tid in REGISTRY]
