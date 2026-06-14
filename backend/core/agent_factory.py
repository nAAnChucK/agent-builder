import json
from typing import AsyncIterator, Any

from langchain_anthropic import ChatAnthropic
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

from models.schemas import AgentConfig
from core.tool_registry import get_tool_instances

# In-memory cache: agent_id → compiled graph
_cache: dict[str, Any] = {}
_checkpointers: dict[str, MemorySaver] = {}


def _get_or_build(agent_id: str, config: AgentConfig) -> tuple[Any, MemorySaver]:
    if agent_id not in _cache:
        model = ChatAnthropic(model=config.model, temperature=0, streaming=True)
        tools = get_tool_instances(config.tools)
        checkpointer = MemorySaver()
        graph = create_react_agent(
            model=model,
            tools=tools,
            prompt=config.system_prompt,
            checkpointer=checkpointer,
        )
        _cache[agent_id] = graph
        _checkpointers[agent_id] = checkpointer
    return _cache[agent_id], _checkpointers[agent_id]


def evict(agent_id: str):
    _cache.pop(agent_id, None)
    _checkpointers.pop(agent_id, None)


async def run_agent_stream(
    agent_id: str,
    config: AgentConfig,
    message: str,
    thread_id: str,
) -> AsyncIterator[str]:
    graph, _ = _get_or_build(agent_id, config)
    run_cfg = {"configurable": {"thread_id": thread_id}}

    async for event in graph.astream_events(
        {"messages": [("human", message)]},
        config=run_cfg,
        version="v2",
    ):
        kind = event["event"]

        if kind == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            text = ""
            if isinstance(content, str):
                text = content
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text += block.get("text", "")
            if text:
                yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"

        elif kind == "on_tool_start":
            payload = {
                "type": "tool_start",
                "tool": event["name"],
                "input": event["data"].get("input", {}),
            }
            yield f"data: {json.dumps(payload)}\n\n"

        elif kind == "on_tool_end":
            raw = event["data"].get("output", "")
            output_str = raw.content if hasattr(raw, "content") else str(raw)
            payload = {
                "type": "tool_end",
                "tool": event["name"],
                "output": output_str[:800],
            }
            yield f"data: {json.dumps(payload)}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
