from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from xidea_agent.api import create_app
from xidea_agent.repository import SQLiteRepository

from conftest import build_mock_llm, build_mock_llm_for_review


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(llm=build_mock_llm()))


@pytest.fixture
def persisted_client(tmp_path: Path) -> TestClient:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    return TestClient(create_app(repository=repository, llm=build_mock_llm_for_review()))


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
