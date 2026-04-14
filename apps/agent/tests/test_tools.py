from pathlib import Path

from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import run_agent_v0
from xidea_agent.state import AgentRequest
from xidea_agent.tools import (
    describe_tool_registry,
    resolve_tool_result,
    retrieve_learning_unit,
    retrieve_source_assets,
)

from conftest import build_mock_llm, build_mock_llm_for_review


def _build_request(**overrides) -> AgentRequest:
    payload = {
        "project_id": "rag-demo",
        "thread_id": "thread-1",
        "entry_mode": "chat-question",
        "topic": "RAG retrieval design",
        "target_unit_id": "unit-rag-retrieval",
        "messages": [
            {"role": "user", "content": "测试消息"},
        ],
    }
    payload.update(overrides)
    return AgentRequest(**payload)


def test_asset_summary_includes_enrichment() -> None:
    request = _build_request(
        entry_mode="material-import",
        source_asset_ids=["asset-1", "asset-2"],
    )
    result = resolve_tool_result("asset-summary", request)

    assert result is not None
    assert result.kind == "asset-summary"
    payload = result.payload

    assert len(payload["assets"]) == 2
    assert payload["assets"][0]["contentExcerpt"]
    assert len(payload["assets"][0]["keyConcepts"]) > 0
    assert payload["assets"][0]["relevanceHint"]
    assert len(payload["keyConcepts"]) > 0
    assert "核心概念" in payload["summary"]


def test_asset_summary_handles_unknown_asset() -> None:
    request = _build_request(source_asset_ids=["unknown-asset"])
    result = resolve_tool_result("asset-summary", request)

    assert result is not None
    payload = result.payload
    assert len(payload["assets"]) == 1
    assert payload["assets"][0]["id"] == "unknown-asset"
    assert "暂未提取" in payload["assets"][0]["contentExcerpt"]
    assert payload["assets"][0]["keyConcepts"] == []


def test_unit_detail_includes_enrichment() -> None:
    request = _build_request(target_unit_id="unit-rag-retrieval")
    result = resolve_tool_result("unit-detail", request)

    assert result is not None
    assert result.kind == "unit-detail"
    payload = result.payload

    assert payload["focusUnitId"] == "unit-rag-retrieval"
    assert len(payload["prerequisites"]) >= 2
    assert len(payload["commonMisconceptions"]) >= 2
    assert len(payload["coreQuestions"]) >= 2
    assert "unit-rag-core" in payload["relatedUnits"]
    assert payload["difficulty"] == 3


def test_unit_detail_all_units_have_enrichment() -> None:
    for unit_id in ["unit-rag-retrieval", "unit-rag-core", "unit-rag-explain"]:
        request = _build_request(target_unit_id=unit_id)
        result = resolve_tool_result("unit-detail", request)
        assert result is not None

        payload = result.payload
        assert len(payload["prerequisites"]) > 0, f"{unit_id} missing prerequisites"
        assert len(payload["commonMisconceptions"]) > 0, f"{unit_id} missing misconceptions"
        assert len(payload["coreQuestions"]) > 0, f"{unit_id} missing core questions"
        assert len(payload["relatedUnits"]) > 0, f"{unit_id} missing related units"


def test_thread_memory_without_repository() -> None:
    request = _build_request(entry_mode="coach-followup")
    result = resolve_tool_result("thread-memory", request)

    assert result is not None
    payload = result.payload
    assert payload["recentMessages"] == []
    assert payload["learningProgress"] is None
    assert payload["lastDiagnosis"] is None


def test_thread_memory_with_repository(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    first_request = _build_request(
        messages=[{"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"}],
    )
    first_result = run_agent_v0(first_request, repository=repository, llm=build_mock_llm())
    repository.save_run(first_request, first_result)

    second_request = _build_request(entry_mode="coach-followup")
    result = resolve_tool_result("thread-memory", second_request, repository=repository)

    assert result is not None
    payload = result.payload
    assert len(payload["recentMessages"]) >= 1
    assert payload["learningProgress"] is not None
    assert payload["learningProgress"]["unitId"] == "unit-rag-retrieval"
    assert payload["lastDiagnosis"] is not None
    assert payload["lastDiagnosis"]["action"] == "clarify"


def test_review_context_without_repository() -> None:
    request = _build_request()
    result = resolve_tool_result("review-context", request)

    assert result is not None
    payload = result.payload
    assert payload["decayRisk"] == "unknown"
    assert payload["performanceTrend"] is None
    assert payload["lastReviewOutcome"] is None


def test_review_context_with_repository(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    request = _build_request(
        messages=[{"role": "user", "content": "我最近总忘这些概念，想做一次复习巩固"}],
    )
    result = run_agent_v0(request, repository=repository, llm=build_mock_llm_for_review())
    repository.save_run(request, result)

    review_result = resolve_tool_result("review-context", request, repository=repository)

    assert review_result is not None
    payload = review_result.payload
    assert payload["focusUnitId"] == "unit-rag-retrieval"
    assert payload["performanceTrend"] is not None
    assert payload["performanceTrend"]["trendHint"]
    assert payload["decayRisk"] in ("low", "medium", "high", "critical")
    assert payload["lastReviewOutcome"] is not None


def test_describe_tool_registry_reflects_enriched_fields() -> None:
    registry = describe_tool_registry()

    assert "assets" in registry["asset-summary"]["returns"]
    assert "keyConcepts" in registry["asset-summary"]["returns"]

    assert "prerequisites" in registry["unit-detail"]["returns"]
    assert "commonMisconceptions" in registry["unit-detail"]["returns"]
    assert "coreQuestions" in registry["unit-detail"]["returns"]

    assert "learningProgress" in registry["thread-memory"]["returns"]
    assert "lastDiagnosis" in registry["thread-memory"]["returns"]

    assert "performanceTrend" in registry["review-context"]["returns"]
    assert "decayRisk" in registry["review-context"]["returns"]


def test_retrieve_source_assets_returns_all() -> None:
    assets = retrieve_source_assets(["asset-1", "asset-2", "asset-3"])
    assert len(assets) == 3
    assert all(a.id.startswith("asset-") for a in assets)


def test_retrieve_learning_unit_fallback() -> None:
    unit = retrieve_learning_unit(None, "RAG 基础")
    assert unit.id == "unit-rag-core"

    unit = retrieve_learning_unit(None, "重排策略")
    assert unit.id == "unit-rag-retrieval"

    unit = retrieve_learning_unit(None, "答辩准备")
    assert unit.id == "unit-rag-explain"


def test_resolve_none_intent() -> None:
    request = _build_request()
    result = resolve_tool_result("none", request)
    assert result is None
