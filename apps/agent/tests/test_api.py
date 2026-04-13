from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from xidea_agent.api import create_app
from xidea_agent.repository import SQLiteRepository


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


@pytest.fixture
def persisted_client(tmp_path: Path) -> TestClient:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    return TestClient(create_app(repository=repository))


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
    assert payload["graph_state"]["plan"]["selected_mode"] == "contrast-drill"
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

    assert storage_response.status_code == 200
    assert storage_response.json()["enabled"] is True

    assert messages_response.status_code == 200
    messages = messages_response.json()
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"

    assert state_response.status_code == 200
    assert state_response.json()["recommended_action"] == "review"
