import anthropic
from models.schemas import AgentConfig
from core.tool_registry import REGISTRY

_client = anthropic.AsyncAnthropic()

_TOOL_SCHEMA = {
    "name": "create_agent_config",
    "description": "Produce a complete configuration for the requested agent.",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "Short, memorable agent name (2-4 words)"},
            "description": {"type": "string", "description": "One sentence describing what this agent does"},
            "system_prompt": {
                "type": "string",
                "description": "Detailed instructions that define the agent's role, behaviour, and constraints",
            },
            "tools": {
                "type": "array",
                "items": {"type": "string", "enum": list(REGISTRY.keys())},
                "description": "Tool IDs the agent needs. Only include what is genuinely required.",
            },
        },
        "required": ["name", "description", "system_prompt", "tools"],
    },
}

_SYSTEM = """\
You are an expert agent designer. Given a description of what an agent should do, produce a
tight, precise configuration for it.

Available tools and when to use them:
{tools}

Guidelines:
- Prefer MCP-type tools (web_search) over cli-type tools when both could work — they are sandboxed.
- Only add run_shell when the task genuinely requires arbitrary command execution.
- Write a system_prompt that is specific and task-focused, not generic.
- Choose the minimum set of tools that covers the task.
"""


async def generate_agent_config(description: str) -> AgentConfig:
    tool_lines = "\n".join(
        f"  {k} ({v['type']}): {v['description']}" for k, v in REGISTRY.items()
    )
    response = await _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=_SYSTEM.format(tools=tool_lines),
        tools=[_TOOL_SCHEMA],
        tool_choice={"type": "tool", "name": "create_agent_config"},
        messages=[{"role": "user", "content": f"Design an agent that: {description}"}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    data = tool_use.input
    return AgentConfig(
        name=data["name"],
        description=data["description"],
        system_prompt=data["system_prompt"],
        tools=data["tools"],
    )
