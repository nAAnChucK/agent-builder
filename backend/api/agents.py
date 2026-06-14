from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from core.agent_factory import evict, run_agent_stream
from core.store import store
from models.schemas import AgentRecord, RunRequest

router = APIRouter()


@router.get("/agents", response_model=list[AgentRecord])
def list_agents():
    return store.all()


@router.get("/agents/{agent_id}", response_model=AgentRecord)
def get_agent(agent_id: str):
    record = store.get(agent_id)
    if not record:
        raise HTTPException(status_code=404, detail="Agent not found")
    return record


@router.delete("/agents/{agent_id}", status_code=204)
def delete_agent(agent_id: str):
    if not store.delete(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    evict(agent_id)


@router.post("/agents/{agent_id}/run")
async def run_agent(agent_id: str, request: RunRequest):
    record = store.get(agent_id)
    if not record:
        raise HTTPException(status_code=404, detail="Agent not found")

    return StreamingResponse(
        run_agent_stream(agent_id, record.config, request.message, request.thread_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
