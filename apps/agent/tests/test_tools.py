from pathlib import Path

from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import run_agent_v0
from xidea_agent.state import AgentRequest, ProjectLearningProfile, ProjectMemory, SourceAsset
from xidea_agent.tools import (
    build_project_context,
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


def test_asset_summary_strips_markdown_frontmatter_from_uploaded_material(tmp_path: Path) -> None:
    material_path = tmp_path / "material.md"
    material_path.write_text(
        "---\ncreated: 2026-04-19\nmodified: 2026-04-20\n---\n"
        "# 多模态编排\n\n"
        "- 核心概念一：音视频联合检索\n"
        "- 核心概念二：具身交互反馈\n",
        encoding="utf-8",
    )
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.save_project_material(
        SourceAsset(
            id="material-1",
            title="multimodal.md",
            kind="note",
            topic="多模态学习编排",
            summary="frontmatter 不该进入正文摘要",
            content_ref=str(material_path),
            status="ready",
        ),
        project_id="rag-demo",
    )

    request = _build_request(
        entry_mode="material-import",
        source_asset_ids=["material-1"],
    )
    result = resolve_tool_result("asset-summary", request, repository=repository)

    assert result is not None
    excerpt = result.payload["assets"][0]["contentExcerpt"]
    concepts = result.payload["assets"][0]["keyConcepts"]
    assert "created:" not in excerpt.lower()
    assert "modified:" not in excerpt.lower()
    assert "音视频联合检索" in excerpt
    assert all("created:" not in concept.lower() for concept in concepts)


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


def test_build_project_context_includes_project_memory_and_learning_profile(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    repository.create_or_update_project_memory(
        ProjectMemory(
            project_id="rag-demo",
            summary="最近一次 exercise 已完成，系统已安排短间隔复盘。",
        )
    )
    repository.create_or_update_project_learning_profile(
        ProjectLearningProfile(
            project_id="rag-demo",
            current_stage="stabilizing",
            primary_weaknesses=["weak-recall"],
            learning_preferences=["guided-qa"],
            freshness="fresh",
        )
    )

    context = build_project_context(_build_request(), repository=repository)

    assert context.project_memory_summary is not None
    assert "project memory" in context.project_memory_summary
    assert context.project_learning_profile_summary is not None
    assert "project learning profile" in context.project_learning_profile_summary
    assert "project memory" in context.summary


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


def test_retrieve_source_assets_reads_uploaded_project_materials(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.save_project_material(
        SourceAsset(
            id="material-1",
            title="uploaded-notes.md",
            kind="note",
            topic="RAG 上传材料",
            summary="记录了上传材料里的判断标准。",
            status="ready",
        ),
        project_id="rag-demo",
    )

    assets = retrieve_source_assets(["material-1"], repository=repository, project_id="rag-demo")

    assert len(assets) == 1
    assert assets[0].title == "uploaded-notes.md"
    assert assets[0].summary is not None


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
