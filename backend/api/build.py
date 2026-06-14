from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from core.meta_agent import generate_agent_config
from core.store import store
from core.tool_registry import get_tool_catalog
from models.schemas import AgentRecord, BuildRequest

router = APIRouter()


@router.get("/tools")
def list_tools():
    return get_tool_catalog()


@router.post("/build", response_model=AgentRecord, status_code=201)
async def build_agent(request: BuildRequest):
    try:
        config = await generate_agent_config(request.description)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    record = AgentRecord(
        id=str(uuid4()),
        config=config,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    store.add(record)
    return record
