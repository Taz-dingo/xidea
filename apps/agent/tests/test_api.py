from pathlib import Path
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from xidea_agent.api import create_app
from xidea_agent.repository import SQLiteRepository
from xidea_agent.state import KnowledgePoint, KnowledgePointState

from conftest import build_mock_llm, build_mock_llm_for_review, build_mock_llm_for_teach


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(llm=build_mock_llm()))


@pytest.fixture
def persisted_client(tmp_path: Path) -> TestClient:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    return TestClient(create_app(repository=repository, llm=build_mock_llm_for_review()))


@pytest.fixture
def persisted_client_with_suggestion(tmp_path: Path) -> TestClient:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    return TestClient(create_app(repository=repository, llm=build_mock_llm()))


@pytest.fixture
def persisted_client_with_archive_candidate(tmp_path: Path) -> TestClient:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    now = datetime.now(timezone.utc)
    repository.save_knowledge_points(
        [
            KnowledgePoint(
                id="kp-rag-boundary",
                project_id="rag-demo",
                title="retrieval 与 reranking 的边界",
                description="说明 retrieval 与 reranking 在 RAG 里的职责边界。",
                status="active",
                origin_type="seed",
                source_material_refs=["asset-1"],
                created_at=now,
                updated_at=now,
            )
        ],
        states=[
            KnowledgePointState(
                knowledge_point_id="kp-rag-boundary",
                mastery=94,
                learning_status="stable",
                review_status="stable",
                next_review_at=now + timedelta(days=21),
                archive_suggested=False,
                updated_at=now,
            )
        ],
    )
    return TestClient(create_app(repository=repository, llm=build_mock_llm_for_teach()))


def test_schemas_endpoint_exposes_stream_event_schema(client: TestClient) -> None:
    response = client.get("/schemas")

    assert response.status_code == 200
    payload = response.json()
    assert "stream_event" in payload
    assert "discriminator" in payload["stream_event"]


def test_run_v0_endpoint_returns_structured_result(client: TestClient) -> None:
    response = client.post(
        "/runs/v0",
        json={
            "project_id": "rag-demo",
            "thread_id": "thread-1",
            "entry_mode": "chat-question",
            "topic": "RAG retrieval design",
            "target_unit_id": "unit-rag-retrieval",
            "messages": [
                {"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"}
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["graph_state"]["diagnosis"]["recommended_action"] == "clarify"
    assert payload["graph_state"]["activity"]["kind"] == "quiz"
    assert payload["events"][-1]["event"] == "done"


def test_persisted_run_is_queryable_from_storage_endpoints(
    persisted_client: TestClient,
) -> None:
    run_response = persisted_client.post(
        "/runs/v0",
        json={
            "project_id": "rag-demo",
            "thread_id": "thread-1",
            "entry_mode": "chat-question",
            "topic": "RAG retrieval design",
            "target_unit_id": "unit-rag-retrieval",
            "messages": [
                {"role": "user", "content": "我最近总忘这些概念，想做一次复习巩固"}
            ],
        },
    )

    assert run_response.status_code == 200

    storage_response = persisted_client.get("/storage/status")
    messages_response = persisted_client.get("/threads/thread-1/recent-messages")
    state_response = persisted_client.get("/threads/thread-1/units/unit-rag-retrieval")
    context_response = persisted_client.get("/threads/thread-1/context")
    bootstrap_response = persisted_client.get(
        "/threads/thread-1/inspector-bootstrap",
        params={"unit_id": "unit-rag-retrieval"},
    )
    review_response = persisted_client.get("/threads/thread-1/units/unit-rag-retrieval/review-inspector")
    asset_response = persisted_client.get("/assets/summary", params={"asset_ids": "asset-1,asset-2"})

    assert storage_response.status_code == 200
    assert storage_response.json()["enabled"] is True

    assert messages_response.status_code == 200
    messages = messages_response.json()
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"

    assert state_response.status_code == 200
    assert state_response.json()["recommended_action"] == "review"

    assert context_response.status_code == 200
    assert context_response.json()["entry_mode"] == "chat-question"

    assert bootstrap_response.status_code == 200
    bootstrap_payload = bootstrap_response.json()
    assert bootstrap_payload["thread_context"]["entry_mode"] == "chat-question"
    assert bootstrap_payload["learner_state"]["recommended_action"] == "review"
    assert bootstrap_payload["review_inspector"]["reviewCount"] == 1

    assert review_response.status_code == 200
    review_payload = review_response.json()
    assert review_payload["reviewCount"] == 1
    assert [event["event_kind"] for event in review_payload["events"]] == ["reviewed", "scheduled"]

    assert asset_response.status_code == 200
    asset_payload = asset_response.json()
    assert asset_payload["assetIds"] == ["asset-1", "asset-2"]
    assert len(asset_payload["assets"]) == 2


_SAMPLE_REQUEST = {
    "project_id": "rag-demo",
    "thread_id": "thread-1",
    "entry_mode": "chat-question",
    "topic": "RAG retrieval design",
    "target_unit_id": "unit-rag-retrieval",
    "messages": [
        {"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"}
    ],
}

_SUGGESTION_REQUEST = {
    "project_id": "rag-demo",
    "thread_id": "thread-project-1",
    "entry_mode": "chat-question",
    "topic": "RAG 系统设计",
    "messages": [
        {
            "role": "user",
            "content": "我搞不清楚 embedding 和 reranking 是不是同一回事，它们的边界到底是什么？",
        }
    ],
}

_ARCHIVE_REQUEST = {
    "project_id": "rag-demo",
    "thread_id": "thread-project-archive",
    "entry_mode": "chat-question",
    "topic": "RAG 系统设计",
    "messages": [
        {
            "role": "user",
            "content": "继续看看这个 project 现在还剩什么要处理。",
        }
    ],
}


def test_stream_endpoint_returns_sse_events(client: TestClient) -> None:
    response = client.post("/runs/v0/stream", json=_SAMPLE_REQUEST)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    raw = response.text
    event_types = []
    for line in raw.splitlines():
        if line.startswith("event: "):
            event_types.append(line[len("event: "):])

    assert event_types[0] == "diagnosis"
    assert event_types[1] == "text-delta"
    assert "plan" in event_types[1:-2]
    assert "activity" in event_types[1:-2]
    assert event_types[-2:] == ["state-patch", "done"]
    assert event_types.count("text-delta") >= 1


def test_stream_endpoint_events_are_valid_json(client: TestClient) -> None:
    import json

    response = client.post("/runs/v0/stream", json=_SAMPLE_REQUEST)
    raw = response.text

    data_lines = [line[len("data: "):] for line in raw.splitlines() if line.startswith("data: ")]
    assert len(data_lines) >= 5

    for data_line in data_lines:
        parsed = json.loads(data_line)
        assert "event" in parsed


def test_stream_endpoint_emits_activity_payload(client: TestClient) -> None:
    import json

    response = client.post("/runs/v0/stream", json=_SAMPLE_REQUEST)
    raw = response.text

    data_lines = [line[len("data: "):] for line in raw.splitlines() if line.startswith("data: ")]
    activity_payload = next(
        json.loads(data_line) for data_line in data_lines if json.loads(data_line)["event"] == "activity"
    )

    assert activity_payload["activity"]["kind"] == "quiz"
    assert activity_payload["activity"]["knowledge_point_id"] == "unit-rag-retrieval"


def test_stream_endpoint_emits_knowledge_point_suggestion_payload(client: TestClient) -> None:
    import json

    response = client.post("/runs/v0/stream", json=_SUGGESTION_REQUEST)
    raw = response.text

    data_lines = [line[len("data: "):] for line in raw.splitlines() if line.startswith("data: ")]
    suggestion_payload = next(
        json.loads(data_line)
        for data_line in data_lines
        if json.loads(data_line)["event"] == "knowledge-point-suggestion"
    )

    assert suggestion_payload["suggestions"][0]["kind"] == "create"
    assert suggestion_payload["suggestions"][0]["title"] == "embedding 与 reranking 的边界"


def test_stream_endpoint_off_topic_does_not_emit_activity_or_suggestion(client: TestClient) -> None:
    import json

    response = client.post(
        "/runs/v0/stream",
        json={
            "project_id": "rag-demo",
            "thread_id": "thread-off-topic",
            "entry_mode": "chat-question",
            "topic": "RAG 系统设计",
            "messages": [{"role": "user", "content": "上海明天天气怎么样？"}],
        },
    )
    raw = response.text
    data_lines = [json.loads(line[len("data: "):]) for line in raw.splitlines() if line.startswith("data: ")]

    event_types = [item["event"] for item in data_lines]
    assert event_types[0] == "diagnosis"
    assert event_types[-3:] == ["plan", "state-patch", "done"]
    assert "activity" not in event_types
    assert "knowledge-point-suggestion" not in event_types


def test_stream_diagnosis_contains_action_scores(client: TestClient) -> None:
    import json

    response = client.post("/runs/v0/stream", json=_SAMPLE_REQUEST)
    raw = response.text

    data_lines = [line[len("data: "):] for line in raw.splitlines() if line.startswith("data: ")]
    diagnosis_data = json.loads(data_lines[0])
    assert diagnosis_data["event"] == "diagnosis"
    assert diagnosis_data["diagnosis"]["recommended_action"] == "clarify"


def test_stream_endpoint_persists_to_repository(persisted_client: TestClient) -> None:
    response = persisted_client.post("/runs/v0/stream", json=_SAMPLE_REQUEST)
    assert response.status_code == 200

    messages = persisted_client.get("/threads/thread-1/recent-messages").json()
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"


def test_confirm_knowledge_point_suggestion_endpoint_is_idempotent(
    persisted_client_with_suggestion: TestClient,
) -> None:
    run_response = persisted_client_with_suggestion.post("/runs/v0", json=_SUGGESTION_REQUEST)
    assert run_response.status_code == 200
    suggestion_id = run_response.json()["graph_state"]["knowledge_point_suggestions"][0]["id"]

    confirm_response = persisted_client_with_suggestion.post(
        f"/projects/rag-demo/knowledge-point-suggestions/{suggestion_id}/confirm"
    )
    assert confirm_response.status_code == 200
    payload = confirm_response.json()
    assert payload["suggestion"]["status"] == "accepted"
    assert payload["knowledge_point"]["title"] == "embedding 与 reranking 的边界"
    assert payload["knowledge_point_state"]["learning_status"] == "new"

    second_confirm = persisted_client_with_suggestion.post(
        f"/projects/rag-demo/knowledge-point-suggestions/{suggestion_id}/confirm"
    )
    assert second_confirm.status_code == 200
    assert second_confirm.json()["suggestion"]["status"] == "accepted"
    assert second_confirm.json()["knowledge_point"]["id"] == payload["knowledge_point"]["id"]


def test_dismiss_knowledge_point_suggestion_endpoint_is_idempotent(
    persisted_client_with_suggestion: TestClient,
) -> None:
    run_response = persisted_client_with_suggestion.post("/runs/v0", json=_SUGGESTION_REQUEST)
    assert run_response.status_code == 200
    suggestion_id = run_response.json()["graph_state"]["knowledge_point_suggestions"][0]["id"]

    dismiss_response = persisted_client_with_suggestion.post(
        f"/projects/rag-demo/knowledge-point-suggestions/{suggestion_id}/dismiss"
    )
    assert dismiss_response.status_code == 200
    payload = dismiss_response.json()
    assert payload["suggestion"]["status"] == "dismissed"
    assert payload["knowledge_point"] is None
    assert payload["knowledge_point_state"] is None

    second_dismiss = persisted_client_with_suggestion.post(
        f"/projects/rag-demo/knowledge-point-suggestions/{suggestion_id}/dismiss"
    )
    assert second_dismiss.status_code == 200
    assert second_dismiss.json()["suggestion"]["status"] == "dismissed"


def test_confirm_archive_knowledge_point_suggestion_endpoint_updates_state(
    persisted_client_with_archive_candidate: TestClient,
) -> None:
    run_response = persisted_client_with_archive_candidate.post("/runs/v0", json=_ARCHIVE_REQUEST)
    assert run_response.status_code == 200
    suggestion = run_response.json()["graph_state"]["knowledge_point_suggestions"][0]
    assert suggestion["kind"] == "archive"

    confirm_response = persisted_client_with_archive_candidate.post(
        f"/projects/rag-demo/knowledge-point-suggestions/{suggestion['id']}/confirm"
    )
    assert confirm_response.status_code == 200
    payload = confirm_response.json()
    assert payload["suggestion"]["status"] == "accepted"
    assert payload["knowledge_point"]["status"] == "archived"
    assert payload["knowledge_point_state"]["learning_status"] == "archived"
    assert payload["knowledge_point_state"]["review_status"] == "archived"


def test_thread_context_returns_no_content_before_first_persist(
    persisted_client: TestClient,
) -> None:
    response = persisted_client.get("/threads/thread-missing/context")
    assert response.status_code == 204


def test_create_app_fails_without_api_key() -> None:
    """Without any supported LLM API key, create_app should raise RuntimeError."""
    import os
    from unittest.mock import patch

    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(RuntimeError, match="LLM API key is required"):
            create_app()
