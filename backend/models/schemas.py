from pydantic import BaseModel, Field
from uuid import uuid4


class BuildRequest(BaseModel):
    description: str = Field(..., min_length=5)


class AgentConfig(BaseModel):
    name: str
    description: str
    system_prompt: str
    tools: list[str]
    model: str = "claude-sonnet-4-6"


class AgentRecord(BaseModel):
    id: str
    config: AgentConfig
    created_at: str


class RunRequest(BaseModel):
    message: str
    thread_id: str = Field(default_factory=lambda: str(uuid4()))
