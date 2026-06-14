import json
import os
from pathlib import Path
from models.schemas import AgentRecord

# DATA_DIR is set to a Railway volume path in production (e.g. /data)
_DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).parent.parent))
_STORE_PATH = _DATA_DIR / "agents_store.json"


class AgentStore:
    def __init__(self):
        self._agents: dict[str, AgentRecord] = {}
        self._load()

    def _load(self):
        if _STORE_PATH.exists():
            data = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
            self._agents = {k: AgentRecord(**v) for k, v in data.items()}

    def _save(self):
        _STORE_PATH.write_text(
            json.dumps({k: v.model_dump() for k, v in self._agents.items()}, indent=2),
            encoding="utf-8",
        )

    def add(self, agent: AgentRecord):
        self._agents[agent.id] = agent
        self._save()

    def get(self, agent_id: str) -> AgentRecord | None:
        return self._agents.get(agent_id)

    def all(self) -> list[AgentRecord]:
        return sorted(self._agents.values(), key=lambda a: a.created_at, reverse=True)

    def delete(self, agent_id: str) -> bool:
        if agent_id in self._agents:
            del self._agents[agent_id]
            self._save()
            return True
        return False


store = AgentStore()
