import json
import os
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import TypeAdapter
from starlette.responses import StreamingResponse

from xidea_agent.graph import describe_graph
from xidea_agent.llm import LLMClient, build_llm_client
from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import iter_agent_v0_events, run_agent_v0
from xidea_agent.state import (
    AgentRequest,
    AgentRunResult,
    CreateProjectRequest,
    CreateSessionRequest,
    Diagnosis,
    GraphState,
    KnowledgePointRecord,
    KnowledgePointSuggestionResolution,
    Project,
    ProjectBootstrap,
    ProjectMaterial,
    ProjectMemory,
    ProjectLearningProfile,
    Session,
    SessionDetail,
    SessionAttachment,
    StatePatch,
    StreamEvent,
    StudyPlan,
    ThreadContextRecord,
    UpdateKnowledgePointRequest,
    UpdateProjectRequest,
    UpdateSessionRequest,
    build_initial_graph_state,
)
from xidea_agent.tools import build_asset_summary_payload, build_review_context_payload


def create_app(
    repository: SQLiteRepository | None = None,
    llm: LLMClient | None = None,
) -> FastAPI:
    repository = repository or _build_default_repository()
    if llm is None:
        llm = build_llm_client()  # raises RuntimeError if LLM API key is missing
    app = FastAPI(title="Xidea Agent")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_load_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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
            "project": Project.model_json_schema(),
            "session": Session.model_json_schema(),
            "project_material": ProjectMaterial.model_json_schema(),
            "session_attachment": SessionAttachment.model_json_schema(),
            "project_memory": ProjectMemory.model_json_schema(),
            "project_learning_profile": ProjectLearningProfile.model_json_schema(),
            "create_project_request": CreateProjectRequest.model_json_schema(),
            "update_project_request": UpdateProjectRequest.model_json_schema(),
            "create_session_request": CreateSessionRequest.model_json_schema(),
            "update_session_request": UpdateSessionRequest.model_json_schema(),
            "knowledge_point_record": KnowledgePointRecord.model_json_schema(),
            "update_knowledge_point_request": UpdateKnowledgePointRequest.model_json_schema(),
            "project_bootstrap": ProjectBootstrap.model_json_schema(),
            "thread_context_record": ThreadContextRecord.model_json_schema(),
            "session_detail": SessionDetail.model_json_schema(),
        }

    @app.post("/graph/initialize")
    def initialize_graph(request: AgentRequest) -> GraphState:
        return build_initial_graph_state(request)

    @app.post("/runs/v0")
    def run_v0(request: AgentRequest) -> AgentRunResult:
        result = run_agent_v0(request, repository=repository, llm=llm)
        if repository is not None:
            repository.save_run(request, result)
        return result

    @app.post("/runs/v0/stream")
    def run_v0_stream(request: AgentRequest) -> StreamingResponse:
        return StreamingResponse(
            _iter_agent_run_sse(request, repository=repository, llm=llm),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    @app.get("/storage/status")
    def storage_status() -> dict[str, object]:
        return {
            "enabled": repository is not None,
            "db_path": str(repository.db_path) if repository is not None else None,
        }

    @app.get("/projects", response_model=list[Project])
    def list_projects() -> list[Project]:
        repo = _require_repository(repository)
        return repo.list_projects()

    @app.post(
        "/projects",
        response_model=ProjectBootstrap,
        status_code=status.HTTP_201_CREATED,
    )
    def create_project(request: CreateProjectRequest) -> ProjectBootstrap:
        repo = _require_repository(repository)
        try:
            return repo.create_project(request)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.get("/projects/{project_id}", response_model=ProjectBootstrap)
    def get_project(project_id: str) -> ProjectBootstrap:
        repo = _require_repository(repository)
        bootstrap = repo.get_project_bootstrap(project_id)
        if bootstrap is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return bootstrap

    @app.patch("/projects/{project_id}", response_model=ProjectBootstrap)
    def update_project(project_id: str, request: UpdateProjectRequest) -> ProjectBootstrap:
        repo = _require_repository(repository)
        bootstrap = repo.update_project(project_id, request)
        if bootstrap is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return bootstrap

    @app.get("/projects/{project_id}/sessions", response_model=list[Session])
    def list_project_sessions(project_id: str) -> list[Session]:
        repo = _require_repository(repository)
        if repo.get_project(project_id) is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return repo.list_project_sessions(project_id)

    @app.post(
        "/projects/{project_id}/sessions",
        response_model=SessionDetail,
        status_code=status.HTTP_201_CREATED,
    )
    def create_project_session(
        project_id: str,
        request: CreateSessionRequest,
    ) -> SessionDetail:
        repo = _require_repository(repository)
        try:
            detail = repo.create_session(project_id, request)
        except ValueError as exc:
            detail_text = str(exc)
            error_status = 409 if detail_text.startswith("Session already exists") else 400
            raise HTTPException(status_code=error_status, detail=detail_text) from exc
        if detail is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return detail

    @app.get("/projects/{project_id}/sessions/{session_id}", response_model=SessionDetail)
    def get_project_session(project_id: str, session_id: str) -> SessionDetail:
        repo = _require_repository(repository)
        detail = repo.get_session_detail(project_id, session_id)
        if detail is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return detail

    @app.patch("/projects/{project_id}/sessions/{session_id}", response_model=SessionDetail)
    def update_project_session(
        project_id: str,
        session_id: str,
        request: UpdateSessionRequest,
    ) -> SessionDetail:
        repo = _require_repository(repository)
        try:
            detail = repo.update_session(project_id, session_id, request)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if detail is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return detail

    @app.get("/projects/{project_id}/knowledge-points", response_model=list[KnowledgePointRecord])
    def list_project_knowledge_points(project_id: str) -> list[KnowledgePointRecord]:
        repo = _require_repository(repository)
        if repo.get_project(project_id) is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return repo.list_project_knowledge_point_records(project_id)

    @app.get(
        "/projects/{project_id}/knowledge-points/{knowledge_point_id}",
        response_model=KnowledgePointRecord,
    )
    def get_project_knowledge_point(
        project_id: str,
        knowledge_point_id: str,
    ) -> KnowledgePointRecord:
        repo = _require_repository(repository)
        record = repo.get_project_knowledge_point_record(project_id, knowledge_point_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Knowledge point not found")
        return record

    @app.patch(
        "/projects/{project_id}/knowledge-points/{knowledge_point_id}",
        response_model=KnowledgePointRecord,
    )
    def update_project_knowledge_point(
        project_id: str,
        knowledge_point_id: str,
        request: UpdateKnowledgePointRequest,
    ) -> KnowledgePointRecord:
        repo = _require_repository(repository)
        try:
            record = repo.update_knowledge_point(project_id, knowledge_point_id, request)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if record is None:
            raise HTTPException(status_code=404, detail="Knowledge point not found")
        return record

    @app.get("/assets/summary")
    def asset_summary(asset_ids: str = "") -> dict[str, object]:
        asset_id_list = [asset_id.strip() for asset_id in asset_ids.split(",") if asset_id.strip()]
        return build_asset_summary_payload(asset_id_list)

    @app.get("/projects/{project_id}/sessions/{session_id}/recent-messages")
    def session_recent_messages(
        project_id: str,
        session_id: str,
        limit: int = 8,
    ) -> list[dict[str, str]]:
        repo = _require_repository(repository)
        _require_project_session(repo, project_id, session_id)
        return [message.model_dump() for message in repo.list_recent_messages(session_id, limit)]

    @app.get("/projects/{project_id}/sessions/{session_id}/context", response_model=None)
    def session_context(project_id: str, session_id: str) -> dict[str, object] | Response:
        repo = _require_repository(repository)
        _require_project_session(repo, project_id, session_id)
        context = repo.get_thread_context(session_id)
        if context is None:
            return Response(status_code=204)
        return context

    @app.get("/projects/{project_id}/sessions/{session_id}/inspector-bootstrap")
    def session_inspector_bootstrap(
        project_id: str,
        session_id: str,
        unit_id: str,
        days: int = 35,
    ) -> dict[str, object]:
        repo = _require_repository(repository)
        _require_project_session(repo, project_id, session_id)
        return _build_inspector_bootstrap_payload(repo, session_id, unit_id, days)

    @app.get("/projects/{project_id}/sessions/{session_id}/units/{unit_id}")
    def session_learner_unit_state(
        project_id: str,
        session_id: str,
        unit_id: str,
    ) -> dict[str, object]:
        repo = _require_repository(repository)
        _require_project_session(repo, project_id, session_id)
        learner_state = repo.get_learner_unit_state(session_id, unit_id)
        if learner_state is None:
            raise HTTPException(status_code=404, detail="Learner unit state not found")
        return learner_state.model_dump(mode="json")

    @app.get("/projects/{project_id}/sessions/{session_id}/units/{unit_id}/review-inspector")
    def session_review_inspector(
        project_id: str,
        session_id: str,
        unit_id: str,
        days: int = 35,
    ) -> dict[str, object]:
        repo = _require_repository(repository)
        _require_project_session(repo, project_id, session_id)
        return _build_review_inspector_payload(repo, session_id, unit_id, days)

    @app.get("/threads/{thread_id}/recent-messages")
    def recent_messages(thread_id: str, limit: int = 8) -> list[dict[str, str]]:
        repo = _require_repository(repository)
        return [message.model_dump() for message in repo.list_recent_messages(thread_id, limit)]

    @app.get("/threads/{thread_id}/context", response_model=None)
    def thread_context(thread_id: str) -> dict[str, object] | Response:
        repo = _require_repository(repository)
        context = repo.get_thread_context(thread_id)
        if context is None:
            return Response(status_code=204)
        return context

    @app.get("/threads/{thread_id}/inspector-bootstrap")
    def inspector_bootstrap(thread_id: str, unit_id: str, days: int = 35) -> dict[str, object]:
        repo = _require_repository(repository)
        return _build_inspector_bootstrap_payload(repo, thread_id, unit_id, days)

    @app.get("/threads/{thread_id}/units/{unit_id}")
    def learner_unit_state(thread_id: str, unit_id: str) -> dict[str, object]:
        repo = _require_repository(repository)
        learner_state = repo.get_learner_unit_state(thread_id, unit_id)
        if learner_state is None:
            raise HTTPException(status_code=404, detail="Learner unit state not found")
        return learner_state.model_dump(mode="json")

    @app.get("/threads/{thread_id}/units/{unit_id}/review-inspector")
    def review_inspector(thread_id: str, unit_id: str, days: int = 35) -> dict[str, object]:
        repo = _require_repository(repository)
        return _build_review_inspector_payload(repo, thread_id, unit_id, days)

    @app.post(
        "/projects/{project_id}/knowledge-point-suggestions/{suggestion_id}/confirm",
        response_model=KnowledgePointSuggestionResolution,
    )
    def confirm_knowledge_point_suggestion(
        project_id: str,
        suggestion_id: str,
    ) -> KnowledgePointSuggestionResolution:
        repo = _require_repository(repository)
        resolution = repo.resolve_knowledge_point_suggestion(project_id, suggestion_id, "confirm")
        if resolution is None:
            raise HTTPException(status_code=404, detail="Knowledge point suggestion not found")
        return resolution

    @app.post(
        "/projects/{project_id}/knowledge-point-suggestions/{suggestion_id}/dismiss",
        response_model=KnowledgePointSuggestionResolution,
    )
    def dismiss_knowledge_point_suggestion(
        project_id: str,
        suggestion_id: str,
    ) -> KnowledgePointSuggestionResolution:
        repo = _require_repository(repository)
        resolution = repo.resolve_knowledge_point_suggestion(project_id, suggestion_id, "dismiss")
        if resolution is None:
            raise HTTPException(status_code=404, detail="Knowledge point suggestion not found")
        return resolution

    return app


def _build_default_repository() -> SQLiteRepository | None:
    db_path = os.getenv("XIDEA_AGENT_DB_PATH")
    if not db_path:
        return None

    repository = SQLiteRepository(db_path)
    repository.initialize()
    return repository


def _load_allowed_origins() -> list[str]:
    configured = os.getenv("XIDEA_AGENT_ALLOW_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    return [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]


def _require_repository(repository: SQLiteRepository | None) -> SQLiteRepository:
    if repository is None:
        raise HTTPException(status_code=503, detail="Repository is not configured")

    return repository


def _require_project_session(
    repository: SQLiteRepository,
    project_id: str,
    session_id: str,
) -> Session:
    session = repository.get_session(project_id, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _build_review_inspector_payload(
    repository: SQLiteRepository,
    thread_id: str,
    unit_id: str,
    days: int,
) -> dict[str, object]:
    since = (
        datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 120)))
    ).isoformat()
    payload = build_review_context_payload(thread_id, unit_id, repository)
    payload["events"] = repository.list_review_events(thread_id, unit_id, since=since, limit=64)
    return payload


def _build_inspector_bootstrap_payload(
    repository: SQLiteRepository,
    thread_id: str,
    unit_id: str,
    days: int,
) -> dict[str, object]:
    learner_state = repository.get_learner_unit_state(thread_id, unit_id)
    thread_context = repository.get_thread_context(thread_id)
    review_payload = _build_review_inspector_payload(repository, thread_id, unit_id, days)
    has_review_data = bool(
        review_payload["events"]
        or review_payload["scheduledAt"]
        or review_payload["reviewCount"]
        or review_payload["lastReviewOutcome"]
    )

    return {
        "thread_context": thread_context,
        "learner_state": learner_state.model_dump(mode="json") if learner_state is not None else None,
        "review_inspector": review_payload if has_review_data else None,
    }


def _iter_agent_run_sse(
    request: AgentRequest,
    repository: SQLiteRepository | None,
    llm: LLMClient,
) -> Iterator[str]:
    # Send an opening SSE comment immediately so clients know the stream is live
    # before the first LLM-bound step finishes.
    yield ": stream-open\n\n"

    for stream_event in iter_agent_v0_events(request, repository=repository, llm=llm):
        event_type = stream_event.event
        payload = stream_event.model_dump(mode="json")
        data = json.dumps(payload, ensure_ascii=False)
        yield f"event: {event_type}\ndata: {data}\n\n"
