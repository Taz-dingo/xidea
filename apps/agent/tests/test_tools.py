from pathlib import Path

from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import run_agent_v0
from xidea_agent.state import (
    AgentRequest,
    KnowledgePoint,
    ProjectLearningProfile,
    ProjectMemory,
    SourceAsset,
)
from xidea_agent.tools import (
    build_project_context,
    describe_tool_registry,
    build_material_read_payload,
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


def test_asset_summary_includes_enrichment(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.save_project_material(
        SourceAsset(
            id="material-1",
            title="uploaded-1.md",
            kind="note",
            topic="RAG 检索设计",
            summary="候选召回之后，还需要判断排序是否把真正相关的证据顶到前面。",
            status="ready",
        ),
        project_id="rag-demo",
    )
    repository.save_project_material(
        SourceAsset(
            id="material-2",
            title="uploaded-2.md",
            kind="note",
            topic="RAG 上下文构造",
            summary="上下文组织和截断策略会直接影响模型是否抓对证据。",
            status="ready",
        ),
        project_id="rag-demo",
    )
    request = _build_request(
        entry_mode="material-import",
        source_asset_ids=["material-1", "material-2"],
    )
    result = resolve_tool_result("asset-summary", request, repository=repository)

    assert result is not None
    assert result.kind == "asset-summary"
    payload = result.payload

    assert len(payload["assets"]) == 2
    assert payload["assets"][0]["contentExcerpt"]
    assert len(payload["assets"][0]["keyConcepts"]) > 0
    assert payload["assets"][0]["relevanceHint"]
    assert len(payload["keyConcepts"]) > 0
    assert "核心概念" in payload["summary"]


def test_asset_summary_ignores_unknown_asset() -> None:
    request = _build_request(source_asset_ids=["unknown-asset"])
    result = resolve_tool_result("asset-summary", request)

    assert result is not None
    payload = result.payload
    assert payload["assets"] == []
    assert payload["assetIds"] == []
    assert payload["keyConcepts"] == []


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


def test_asset_summary_prefers_knowledge_point_candidates_over_filename_slug(tmp_path: Path) -> None:
    material_path = tmp_path / "xidea-multimodal-demo.md"
    material_path.write_text(
        "# 多模态大模型学习梳理\n\n"
        "- 一个可学习的知识点是：为什么万物皆可 Token 化会让多模态与具身智能共享同一套建模范式。\n"
        "- 第二个知识点是：DiT 和 Transformer 范式如何从文本迁移到图像视频。\n"
        "- 第三个知识点是：LLM 作为具身智能常识大脑的边界。\n",
        encoding="utf-8",
    )
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.save_project_material(
        SourceAsset(
            id="material-2",
            title="xidea-multimodal-demo.md",
            kind="note",
            topic="多模态学习编排",
            summary="不该优先把文件名 slug 当成知识点。",
            content_ref=str(material_path),
            status="ready",
        ),
        project_id="rag-demo",
    )

    request = _build_request(
        entry_mode="material-import",
        source_asset_ids=["material-2"],
    )
    result = resolve_tool_result("asset-summary", request, repository=repository)

    assert result is not None
    concepts = result.payload["assets"][0]["keyConcepts"]
    assert concepts[:3] == [
        "为什么万物皆可 Token 化会让多模态与具身智能共享同一套建模范式",
        "DiT 和 Transformer 范式如何从文本迁移到图像视频",
        "LLM 作为具身智能常识大脑的边界",
    ]
    assert "xidea-multimodal-demo" not in concepts


def test_material_read_returns_chunked_sections_with_citations(tmp_path: Path) -> None:
    material_path = tmp_path / "rag-notes.md"
    material_path.write_text(
        "# RAG 设计笔记\n\n"
        "第一段：检索命中不等于模型最终会用好证据。\n\n"
        "第二段：排序、截断和上下文组织都会影响回答质量。\n\n"
        "第三段：重排的价值在于把最回答问题的证据排到前面。\n",
        encoding="utf-8",
    )
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.save_project_material(
        SourceAsset(
            id="material-read-1",
            title="rag-notes.md",
            kind="note",
            topic="RAG 设计",
            summary="RAG 相关笔记",
            content_ref=str(material_path),
            status="ready",
        ),
        project_id="rag-demo",
    )

    payload = build_material_read_payload(
        ["material-read-1"],
        repository=repository,
        project_id="rag-demo",
        query="为什么重排有价值",
        mode="targeted",
    )

    assert payload["materialIds"] == ["material-read-1"]
    assert len(payload["materials"]) == 1
    assert len(payload["chunks"]) >= 1
    assert len(payload["citations"]) >= 1
    assert payload["chunks"][0]["materialId"] == "material-read-1"
    assert payload["chunks"][0]["text"]
    assert "rag-notes.md" in payload["citations"][0]["label"]


def test_unit_detail_returns_generic_structure_without_catalog() -> None:
    request = _build_request(target_unit_id="unit-rag-retrieval")
    result = resolve_tool_result("unit-detail", request)

    assert result is not None
    assert result.kind == "unit-detail"
    payload = result.payload

    assert payload["focusUnitId"] == "unit-rag-retrieval"
    assert payload["title"] == "RAG retrieval design"
    assert len(payload["prerequisites"]) >= 2
    assert len(payload["commonMisconceptions"]) >= 2
    assert len(payload["coreQuestions"]) >= 2
    assert payload["relatedUnits"] == []
    assert payload["difficulty"] == 3


def test_unit_detail_all_units_have_generic_detail() -> None:
    for unit_id in ["unit-rag-retrieval", "unit-rag-core", "unit-rag-explain"]:
        request = _build_request(target_unit_id=unit_id)
        result = resolve_tool_result("unit-detail", request)
        assert result is not None

        payload = result.payload
        assert len(payload["prerequisites"]) > 0, f"{unit_id} missing prerequisites"
        assert len(payload["commonMisconceptions"]) > 0, f"{unit_id} missing misconceptions"
        assert len(payload["coreQuestions"]) > 0, f"{unit_id} missing core questions"
        assert payload["relatedUnits"] == []


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
    assert "chunks" in registry["material-read"]["returns"]
    assert "citations" in registry["material-read"]["returns"]

    assert "prerequisites" in registry["unit-detail"]["returns"]
    assert "commonMisconceptions" in registry["unit-detail"]["returns"]
    assert "coreQuestions" in registry["unit-detail"]["returns"]

    assert "learningProgress" in registry["thread-memory"]["returns"]
    assert "lastDiagnosis" in registry["thread-memory"]["returns"]

    assert "performanceTrend" in registry["review-context"]["returns"]
    assert "decayRisk" in registry["review-context"]["returns"]


def test_retrieve_source_assets_requires_repository() -> None:
    assets = retrieve_source_assets(["asset-1", "asset-2", "asset-3"])
    assert assets == []


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
    assert unit.id == "current-topic"
    assert unit.title == "RAG 基础"

    unit = retrieve_learning_unit(None, "重排策略")
    assert unit.id == "current-topic"
    assert unit.title == "重排策略"

    unit = retrieve_learning_unit(None, "答辩准备")
    assert unit.id == "current-topic"
    assert unit.title == "答辩准备"


def test_retrieve_learning_unit_reads_project_knowledge_point(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.save_knowledge_points(
        [
            KnowledgePoint(
                id="kp-multimodal-shared-space",
                project_id="rag-demo",
                title="多模态共享 token 空间",
                description="围绕文本、图像和动作都能映射到统一 token 表示空间建立理解。",
                status="active",
                origin_type="session-suggestion",
                origin_session_id="thread-1",
                source_material_refs=["material-1"],
            )
        ]
    )

    unit = retrieve_learning_unit(
        "kp-multimodal-shared-space",
        "围绕多模态建立学习理解",
        repository=repository,
        project_id="rag-demo",
    )

    assert unit.id == "kp-multimodal-shared-space"
    assert unit.title == "多模态共享 token 空间"
    assert "统一 token 表示空间" in unit.summary
    assert "材料迁移" in unit.weakness_tags


def test_unit_detail_reads_project_knowledge_point(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.save_knowledge_points(
        [
            KnowledgePoint(
                id="kp-embodied-llm",
                project_id="rag-demo",
                title="LLM 作为具身智能常识大脑的边界",
                description="理解 LLM 在任务拆解、语义理解和执行闭环中的职责边界。",
                status="active",
                origin_type="session-suggestion",
                origin_session_id="thread-1",
                source_material_refs=["material-1"],
            )
        ]
    )
    request = _build_request(
        topic="围绕具身智能建立知识点",
        target_unit_id="kp-embodied-llm",
    )

    result = resolve_tool_result("unit-detail", request, repository=repository)

    assert result is not None
    payload = result.payload
    assert payload["focusUnitId"] == "kp-embodied-llm"
    assert payload["title"] == "LLM 作为具身智能常识大脑的边界"
    assert "边界" in payload["summary"]
    assert payload["difficulty"] == 3
    assert payload["prerequisites"]
    assert payload["commonMisconceptions"]
    assert payload["coreQuestions"]
    assert payload["teachingNote"]


def test_resolve_none_intent() -> None:
    request = _build_request()
    result = resolve_tool_result("none", request)
    assert result is None
