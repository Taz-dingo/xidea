import os

from fastapi import FastAPI, HTTPException
from pydantic import TypeAdapter

from xidea_agent.graph import describe_graph
from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import run_agent_v0
from xidea_agent.state import (
    AgentRequest,
    AgentRunResult,
    Diagnosis,
    GraphState,
    StatePatch,
    StreamEvent,
    StudyPlan,
    build_initial_graph_state,
)


def create_app(repository: SQLiteRepository | None = None) -> FastAPI:
    repository = repository or _build_default_repository()
    app = FastAPI(title="Xidea Agent")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/graph")
    def graph() -> dict[str, object]:
        return describe_graph()

    @app.get("/schemas")
    def schemas() -> dict[str, object]:
        return {
            "agent_request": AgentRequest.model_json_schema(),
            "graph_state": GraphState.model_json_schema(),
            "diagnosis": Diagnosis.model_json_schema(),
            "study_plan": StudyPlan.model_json_schema(),
            "state_patch": StatePatch.model_json_schema(),
            "stream_event": TypeAdapter(StreamEvent).json_schema(),
        }

    @app.post("/graph/initialize")
    def initialize_graph(request: AgentRequest) -> GraphState:
        return build_initial_graph_state(request)

    @app.post("/runs/v0")
    def run_v0(request: AgentRequest) -> AgentRunResult:
        result = run_agent_v0(request, repository=repository)
        if repository is not None:
            repository.save_run(request, result)
        return result

    @app.get("/storage/status")
    def storage_status() -> dict[str, object]:
        return {
            "enabled": repository is not None,
            "db_path": str(repository.db_path) if repository is not None else None,
        }

    @app.get("/threads/{thread_id}/recent-messages")
    def recent_messages(thread_id: str, limit: int = 8) -> list[dict[str, str]]:
        repo = _require_repository(repository)
        return [message.model_dump() for message in repo.list_recent_messages(thread_id, limit)]

    @app.get("/threads/{thread_id}/units/{unit_id}")
    def learner_unit_state(thread_id: str, unit_id: str) -> dict[str, object]:
        repo = _require_repository(repository)
        learner_state = repo.get_learner_unit_state(thread_id, unit_id)
        if learner_state is None:
            raise HTTPException(status_code=404, detail="Learner unit state not found")
        return learner_state.model_dump(mode="json")

    return app


def _build_default_repository() -> SQLiteRepository | None:
    db_path = os.getenv("XIDEA_AGENT_DB_PATH")
    if not db_path:
        return None

    repository = SQLiteRepository(db_path)
    repository.initialize()
    return repository


def _require_repository(repository: SQLiteRepository | None) -> SQLiteRepository:
    if repository is None:
        raise HTTPException(status_code=503, detail="Repository is not configured")

    return repository
