import json
import os
import base64
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, TypeAdapter
from starlette.responses import StreamingResponse

from xidea_agent.consolidation import build_consolidation_preview
from xidea_agent.graph import describe_graph
from xidea_agent.llm import LLMClient, build_llm_client
from xidea_agent.material_content import summarize_uploaded_material
from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import iter_agent_v0_events, run_agent_v0
from xidea_agent.state import (
    AgentRequest,
    AgentRunResult,
    Diagnosis,
    GraphState,
    KnowledgePoint,
    KnowledgePointState,
    KnowledgePointSuggestionResolution,
    StatePatch,
    StreamEvent,
    StudyPlan,
    SourceAsset,
    build_initial_graph_state,
)
from xidea_agent.tools import build_asset_summary_payload, build_review_context_payload


class ProjectMaterialUploadRequest(BaseModel):
    filename: str = Field(min_length=1)
    content_base64: str = Field(min_length=1)
    topic: str | None = None


class ThreadRecordResponse(BaseModel):
    thread_id: str
    project_id: str
    topic: str
    session_type: str
    knowledge_point_id: str | None = None
    title: str
    summary: str
    status: str
    entry_mode: str
    source_asset_ids: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str


class KnowledgePointRecordResponse(BaseModel):
    knowledge_point: KnowledgePoint
    knowledge_point_state: KnowledgePointState | None = None
    linked_session_ids: list[str] = Field(default_factory=list)
    linked_session_message_ids: dict[str, int] = Field(default_factory=dict)


class ThreadActivityDeckRecordResponse(BaseModel):
    deck_id: str
    session_id: str
    session_type: str
    knowledge_point_id: str | None = None
    completed_at: str
    cards: list[dict[str, object]] = Field(default_factory=list)


def _normalize_agent_request(request: AgentRequest) -> AgentRequest:
    updates: dict[str, object] = {}

    if request.activity_result is not None and request.entry_mode != "coach-followup":
        updates["entry_mode"] = "coach-followup"
    elif (
        request.session_type == "project"
        and request.source_asset_ids
        and request.entry_mode != "material-import"
    ):
        updates["entry_mode"] = "material-import"

    if not updates:
        return request

    return request.model_copy(update=updates)


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
        }

    @app.post("/graph/initialize")
    def initialize_graph(request: AgentRequest) -> GraphState:
        normalized_request = _normalize_agent_request(request)
        return build_initial_graph_state(normalized_request)

    @app.post("/runs/v0")
    def run_v0(request: AgentRequest) -> AgentRunResult:
        normalized_request = _normalize_agent_request(request)
        result = run_agent_v0(normalized_request, repository=repository, llm=llm)
        if repository is not None:
            repository.save_run(normalized_request, result)
        return result

    @app.post("/runs/v0/stream")
    def run_v0_stream(request: AgentRequest) -> StreamingResponse:
        normalized_request = _normalize_agent_request(request)
        return StreamingResponse(
            _iter_agent_run_sse(normalized_request, repository=repository, llm=llm),
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

    @app.get("/projects/{project_id}/consolidation-preview")
    def consolidation_preview(project_id: str, limit: int = 5) -> dict[str, object]:
        repo = _require_repository(repository)
        preview = build_consolidation_preview(project_id, repo, limit=max(1, min(limit, 20)))
        if preview is None:
            raise HTTPException(status_code=404, detail="Project consolidation state not found")
        return preview

    @app.get("/projects/{project_id}/materials", response_model=list[SourceAsset])
    def list_project_materials(project_id: str) -> list[SourceAsset]:
        repo = _require_repository(repository)
        return repo.list_project_materials(project_id)

    @app.get("/projects/{project_id}/threads", response_model=list[ThreadRecordResponse])
    def list_project_threads(project_id: str) -> list[dict[str, object]]:
        repo = _require_repository(repository)
        return repo.list_project_threads(project_id)

    @app.get(
        "/projects/{project_id}/knowledge-points",
        response_model=list[KnowledgePointRecordResponse],
    )
    def list_project_knowledge_points(project_id: str) -> list[KnowledgePointRecordResponse]:
        repo = _require_repository(repository)
        linked_session_ids_by_point: dict[str, set[str]] = {}
        linked_session_message_ids_by_point: dict[str, dict[str, int]] = {}
        for suggestion in repo.list_knowledge_point_suggestions(project_id, statuses=["accepted"]):
            if suggestion.kind != "create" or suggestion.knowledge_point_id is None:
                continue
            linked_session_ids_by_point.setdefault(suggestion.knowledge_point_id, set()).add(
                suggestion.session_id
            )
            if suggestion.origin_message_id is not None:
                linked_session_message_ids_by_point.setdefault(suggestion.knowledge_point_id, {})[
                    suggestion.session_id
                ] = suggestion.origin_message_id
        records: list[KnowledgePointRecordResponse] = []
        for point in repo.list_project_knowledge_points(project_id):
            linked_session_ids = linked_session_ids_by_point.get(point.id, set()).copy()
            if point.origin_session_id is not None:
                linked_session_ids.add(point.origin_session_id)
            records.append(
                KnowledgePointRecordResponse(
                    knowledge_point=point,
                    knowledge_point_state=repo.get_knowledge_point_state(point.id),
                    linked_session_ids=sorted(linked_session_ids),
                    linked_session_message_ids=linked_session_message_ids_by_point.get(point.id, {}),
                )
            )
        return records

    @app.delete("/projects/{project_id}/knowledge-points/{knowledge_point_id}")
    def delete_project_knowledge_point(project_id: str, knowledge_point_id: str) -> dict[str, bool]:
        repo = _require_repository(repository)
        deleted = repo.delete_knowledge_point(project_id, knowledge_point_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Knowledge point not found")
        return {"ok": True}

    @app.post("/projects/{project_id}/materials/upload", response_model=SourceAsset)
    def upload_project_material(
        project_id: str,
        payload: ProjectMaterialUploadRequest,
    ) -> SourceAsset:
        repo = _require_repository(repository)
        try:
            file_bytes = base64.b64decode(payload.content_base64.encode("utf-8"), validate=True)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid material content encoding") from exc

        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded material is empty")
        if len(file_bytes) > 4 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Uploaded material exceeds 4MB limit")

        material = _build_uploaded_material(
            project_id=project_id,
            filename=payload.filename,
            topic=payload.topic,
            file_bytes=file_bytes,
            repository=repo,
        )
        repo.save_project_material(material, project_id=project_id)
        return material

    @app.get("/assets/summary")
    def asset_summary(asset_ids: str = "", project_id: str | None = None) -> dict[str, object]:
        asset_id_list = [asset_id.strip() for asset_id in asset_ids.split(",") if asset_id.strip()]
        return build_asset_summary_payload(
            asset_id_list,
            repository=repository,
            project_id=project_id,
        )

    @app.get("/threads/{thread_id}/recent-messages")
    def recent_messages(thread_id: str, limit: int = 8) -> list[dict[str, str]]:
        repo = _require_repository(repository)
        return [message.model_dump() for message in repo.list_recent_messages(thread_id, limit)]

    @app.get("/threads/{thread_id}/messages")
    def thread_messages(thread_id: str, limit: int | None = None) -> list[dict[str, object]]:
        repo = _require_repository(repository)
        return repo.list_thread_message_records(thread_id, limit=limit)

    @app.get(
        "/threads/{thread_id}/activity-decks",
        response_model=list[ThreadActivityDeckRecordResponse],
    )
    def thread_activity_decks(thread_id: str) -> list[dict[str, object]]:
        repo = _require_repository(repository)
        return repo.list_thread_activity_decks(thread_id)

    @app.delete("/threads/{thread_id}")
    def delete_thread(thread_id: str) -> dict[str, bool]:
        repo = _require_repository(repository)
        repo.delete_thread(thread_id)
        return {"ok": True}

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
        learner_state = repo.get_learner_unit_state(thread_id, unit_id)
        thread_context = repo.get_thread_context(thread_id)
        review_payload = build_review_context_payload(thread_id, unit_id, repo)
        since = (
            datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 120)))
        ).isoformat()
        review_payload["events"] = repo.list_review_events(thread_id, unit_id, since=since, limit=64)
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
        since = (
            datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 120)))
        ).isoformat()
        payload = build_review_context_payload(thread_id, unit_id, repo)
        payload["events"] = repo.list_review_events(thread_id, unit_id, since=since, limit=64)
        return payload

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


def _build_uploaded_material(
    *,
    project_id: str,
    filename: str,
    topic: str | None,
    file_bytes: bytes,
    repository: SQLiteRepository,
) -> SourceAsset:
    suffix = Path(filename).suffix.lower()
    material_id = f"material-{uuid4().hex[:10]}"
    stored_dir = repository.db_path.parent / "materials" / project_id
    stored_dir.mkdir(parents=True, exist_ok=True)
    stored_path = stored_dir / f"{material_id}{suffix}"
    stored_path.write_bytes(file_bytes)

    kind = _infer_material_kind(filename)
    summary = summarize_uploaded_material(filename, kind, file_bytes)
    now = datetime.now(timezone.utc)
    normalized_topic = (topic or "").strip() or Path(filename).stem or "新上传材料"

    return SourceAsset(
        id=material_id,
        title=filename,
        kind=kind,
        topic=normalized_topic,
        summary=summary,
        source_uri=filename,
        content_ref=str(stored_path),
        status="ready",
        created_at=now,
        updated_at=now,
    )


def _infer_material_kind(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return "pdf"
    if suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        return "image"
    if suffix in {".mp3", ".wav", ".m4a"}:
        return "audio"
    if suffix in {".mp4", ".mov", ".webm"}:
        return "video"
    if suffix in {".html", ".htm"}:
        return "web"
    return "note"
