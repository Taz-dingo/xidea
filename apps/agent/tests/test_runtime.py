import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import (
    _boost,
    _multi_turn_frequency,
    _score_actions,
    build_signals,
    estimate_learner_state,
    iter_agent_v0_events,
    run_agent_v0,
)
from xidea_agent.review_engine import ReviewDecision
from xidea_agent.llm import LLMClient
from xidea_agent.state import (
    AgentRequest,
    KnowledgePoint,
    KnowledgePointState,
    LearnerUnitState,
    Message,
    Observation,
    ProjectLearningProfile,
    ProjectMemory,
    Signal,
    SourceAsset,
)

from conftest import (
    build_mock_llm,
    build_mock_llm_for_material_import,
    build_mock_llm_for_review,
    build_mock_llm_for_teach,
)


def build_request(**overrides) -> AgentRequest:
    payload = {
        "project_id": "rag-demo",
        "thread_id": "thread-1",
        "entry_mode": "chat-question",
        "topic": "RAG retrieval design",
        "target_unit_id": "unit-rag-retrieval",
        "messages": [
            {"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"},
        ],
    }
    payload.update(overrides)
    return AgentRequest(**payload)


def test_run_agent_v0_prefers_clarify_for_confusion() -> None:
    result = run_agent_v0(build_request(), llm=build_mock_llm())

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.plan is not None
    assert result.graph_state.activity is not None
    assert result.graph_state.state_patch is not None
    assert result.graph_state.diagnosis.recommended_action == "clarify"
    assert result.graph_state.diagnosis.primary_issue == "concept-confusion"
    assert result.graph_state.plan.selected_mode == "contrast-drill"
    assert result.graph_state.activity.kind == "quiz"
    assert result.graph_state.activity.title == "先判断什么时候该补重排"
    assert "该补的是重排" in result.graph_state.activity.prompt
    assert len(result.graph_state.activities) == 2
    assert result.graph_state.activities[1].kind == "coach-followup"
    assert result.graph_state.activity.input.type == "choice"
    choice_labels = [choice.label for choice in result.graph_state.activity.input.choices]
    assert any("正确文档通常已经进 top-k" in label for label in choice_labels)
    assert all("最容易混淆的两个判断对象" not in label for label in choice_labels)
    correct_indexes = [
        index
        for index, choice in enumerate(result.graph_state.activity.input.choices)
        if choice.is_correct
    ]
    assert len(correct_indexes) == 1
    assert correct_indexes[0] != 0
    assert all(
        result.graph_state.activity.input.choices[index].is_correct is False
        for index in range(len(result.graph_state.activity.input.choices))
        if index != correct_indexes[0]
    )
    first_wrong_choice = next(
        choice
        for choice in result.graph_state.activity.input.choices
        if not choice.is_correct
    )
    assert len(first_wrong_choice.feedback_layers) >= 3
    assert first_wrong_choice.analysis is not None
    assert [event.event for event in result.events] == [
        "diagnosis",
        "text-delta",
        "plan",
        "activities",
        "state-patch",
        "done",
    ]


def test_run_agent_v0_falls_back_to_rule_diagnosis_when_llm_unavailable(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.save_project_material(
        SourceAsset(
            id="material-1",
            title="uploaded-multimodal.md",
            kind="note",
            topic="多模态学习编排",
            summary="为什么万物皆可 Token 化会让多模态与具身智能共享同一套建模范式。",
            status="ready",
        ),
        project_id="rag-demo",
    )
    result = run_agent_v0(
        build_request(
            session_type="project",
            entry_mode="material-import",
            target_unit_id=None,
            topic="围绕材料推进多模态学习编排",
            source_asset_ids=["material-1"],
            messages=[{"role": "user", "content": "请根据材料帮我沉淀一个知识点"}],
        ),
        repository=repository,
        llm=build_mock_llm(side_effect=RuntimeError("401 auth failed")),
    )

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.recommended_action == "clarify"
    assert result.graph_state.plan is not None
    assert result.graph_state.activity is None
    assert result.graph_state.knowledge_point_suggestions == []
    assert "uploaded-multimodal.md" in (result.graph_state.assistant_message or "")
    assert "不能只凭材料标题或一段很薄的摘要" in (result.graph_state.assistant_message or "")
    assert any("rule-based fallback diagnosis" in item for item in result.graph_state.rationale)


def test_iter_agent_v0_events_yields_incrementally() -> None:
    events = list(iter_agent_v0_events(build_request(), llm=build_mock_llm()))

    event_types = [event.event for event in events]
    assert event_types[:2] == ["status", "status"]
    assert event_types[2] == "diagnosis"
    assert event_types[3] == "status"
    assert event_types[4] == "text-delta"
    assert "plan" in event_types[4:-2]
    assert "activities" in event_types[4:-2]
    assert event_types[-2:] == ["state-patch", "done"]
    assert event_types.count("text-delta") >= 1
    assert [event.phase for event in events if event.event == "status"] == [
        "loading-context",
        "making-decision",
        "composing-response",
        "preparing-followup",
        "writing-state",
    ]


def test_iter_agent_v0_events_reuses_bundled_reply_when_main_decision_is_complete() -> None:
    import json
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from xidea_agent.llm import LLMClient

    main_decision_response = json.dumps({
        "signals": [
            {"kind": "concept-confusion", "score": 0.85, "confidence": 0.88, "summary": "用户混淆"},
        ],
        "diagnosis": {
            "recommended_action": "clarify",
            "reason": "用户明确表达分不清两个概念的职责边界",
            "confidence": 0.88,
            "primary_issue": "concept-confusion",
            "needs_tool": False,
        },
        "reply": "先把 retrieval 和 reranking 的边界拉清楚，再继续往项目判断里迁移。",
        "plan": {
            "headline": "围绕 retrieval vs reranking 的辨析路径",
            "summary": "先辨析边界再追问验证",
            "selected_mode": "contrast-drill",
            "expected_outcome": "能清晰说出两者的职责差异",
            "steps": [
                {"id": "contrast-boundary", "title": "对比辨析", "mode": "contrast-drill",
                 "reason": "LLM-reason", "outcome": "LLM-outcome"},
            ],
        },
        "activities": [
            {
                "title": "先判断问题更像召回缺口还是排序缺口",
                "objective": "能识别什么时候该补重排。",
                "prompt": "哪种现象最说明候选已召回到位，但前排排序不够对口？",
                "support": "先把召回和排序边界拆开。",
                "input": {
                    "type": "choice",
                    "choices": [
                        {
                            "id": "rerank",
                            "label": "正确文档通常已经进 top-k，但前几条经常答非所问。",
                            "detail": "这说明候选已在集合里，主要问题落在排序。",
                            "is_correct": True,
                            "feedback_layers": ["对，这更像该补重排。"],
                            "analysis": "命中了“候选已在集合里但前排顺序不对”的信号。",
                        },
                        {
                            "id": "recall",
                            "label": "top-k 里经常完全找不到正确文档，所以先补重排。",
                            "detail": "这更像召回覆盖不足。",
                            "is_correct": False,
                            "feedback_layers": ["如果文档没进候选集，重排没有对象可排。"],
                            "analysis": "把召回缺口误判成排序缺口。",
                        },
                        {
                            "id": "stuff",
                            "label": "只要多塞上下文，就能替代重排。",
                            "detail": "这会把排序问题伪装成堆料问题。",
                            "is_correct": False,
                            "feedback_layers": ["多塞内容不等于把最对口的证据排前面。"],
                            "analysis": "把排序问题误写成覆盖率问题。",
                        },
                    ],
                },
            }
        ],
    })

    def _response(content: str):
        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    def _stream_chunk(content: str):
        delta = SimpleNamespace(content=content)
        choice = SimpleNamespace(delta=delta)
        return SimpleNamespace(choices=[choice])

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _response(main_decision_response),
        iter([
            _stream_chunk("先把 retrieval 和 reranking 的边界"),
            _stream_chunk("拉清楚，再继续往项目判断里迁移。"),
        ]),
    ]
    llm = LLMClient(client=mock_client, model="GLM-4.1V-Thinking-Flash", provider="zhipu")

    events = list(iter_agent_v0_events(build_request(), llm=llm))
    event_types = [event.event for event in events]

    assert event_types[:4] == ["status", "status", "diagnosis", "status"]
    assert event_types[-2:] == ["state-patch", "done"]
    assert any(event.event == "plan" for event in events)
    assert "".join(event.delta for event in events if event.event == "text-delta").startswith("先把 retrieval")
    assert [event.phase for event in events if event.event == "status"] == [
        "loading-context",
        "making-decision",
        "composing-response",
        "preparing-followup",
        "writing-state",
    ]
    assert mock_client.chat.completions.create.call_count == 1


def test_run_agent_v0_emits_knowledge_point_suggestion_for_project_chat() -> None:
    request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[
            {
                "role": "user",
                "content": "我搞不清楚 embedding 和 reranking 是不是同一回事，它们的边界到底是什么？",
            }
        ],
    )

    result = run_agent_v0(request, llm=build_mock_llm())

    assert result.graph_state.activity is None
    assert len(result.graph_state.knowledge_point_suggestions) == 1
    suggestion = result.graph_state.knowledge_point_suggestions[0]
    assert suggestion.kind == "create"
    assert suggestion.status == "pending"
    assert suggestion.title == "embedding 与 reranking 的边界"
    assert [event.event for event in result.events] == [
        "diagnosis",
        "text-delta",
        "plan",
        "knowledge-point-suggestion",
        "state-patch",
        "done",
    ]


def test_material_import_project_session_emits_multiple_knowledge_point_suggestions(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    material_path = tmp_path / "materials.md"
    material_path.write_text(
        "视频理解 pipeline。音频时间对齐。具身交互反馈。",
        encoding="utf-8",
    )
    repository.save_project_material(
        SourceAsset(
            id="material-uploaded-1",
            title="llm-multimodal-notes.md",
            kind="note",
            topic="LLM、音视频、具身智能",
            summary="视频理解、音频时间对齐与具身交互反馈。",
            source_uri="llm-multimodal-notes.md",
            content_ref=str(material_path),
            status="ready",
        ),
        project_id="rag-demo",
    )

    request = build_request(
        session_type="project",
        entry_mode="material-import",
        target_unit_id=None,
        topic="围绕材料推进多模态学习编排",
        source_asset_ids=["material-uploaded-1"],
        messages=[{"role": "user", "content": "我想学这个，你帮我编排下吧"}],
    )

    result = run_agent_v0(
        request,
        repository=repository,
        llm=build_mock_llm_for_material_import(),
    )

    assert len(result.graph_state.knowledge_point_suggestions) == 3
    titles = [suggestion.title for suggestion in result.graph_state.knowledge_point_suggestions]
    assert titles == [
        "万物皆可Token化",
        "DiT架构",
        "LLM作为具身智能的“常识大脑”",
    ]
    assert all(suggestion.kind == "create" for suggestion in result.graph_state.knowledge_point_suggestions)
    assert all(suggestion.status == "pending" for suggestion in result.graph_state.knowledge_point_suggestions)
    assert all(
        suggestion.source_material_refs == ["material-uploaded-1"]
        for suggestion in result.graph_state.knowledge_point_suggestions
    )
    assert all(
        "围绕材料《" not in suggestion.description
        for suggestion in result.graph_state.knowledge_point_suggestions
    )
    assert any(
        "统一表示空间" in suggestion.reason or "统一表示空间" in suggestion.description
        for suggestion in result.graph_state.knowledge_point_suggestions
    )


def test_material_import_uses_asset_knowledge_point_candidates_when_reply_is_generic(
    tmp_path: Path,
) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    material_path = tmp_path / "materials.md"
    material_path.write_text(
        "# 多模态大模型学习梳理\n\n"
        "- 一个可学习的知识点是：为什么万物皆可 Token 化会让多模态与具身智能共享同一套建模范式。\n"
        "- 第二个知识点是：DiT 和 Transformer 范式如何从文本迁移到图像视频。\n"
        "- 第三个知识点是：LLM 作为具身智能常识大脑的边界。\n",
        encoding="utf-8",
    )
    repository.save_project_material(
        SourceAsset(
            id="material-uploaded-2",
            title="xidea-multimodal-demo.md",
            kind="note",
            topic="大模型、音视频、具身智能",
            summary="用于验证材料正文里的知识点提炼，不依赖 reply 显式列出三条。",
            source_uri="xidea-multimodal-demo.md",
            content_ref=str(material_path),
            status="ready",
        ),
        project_id="rag-demo",
    )

    request = build_request(
        session_type="project",
        entry_mode="material-import",
        target_unit_id=None,
        topic="围绕材料推进多模态学习编排",
        source_asset_ids=["material-uploaded-2"],
        messages=[{"role": "user", "content": "根据这份材料生成知识点"}],
    )

    def _response(content: str):
        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    generic_main_decision = json.dumps({
        "signals": [
            {"kind": "project-relevance", "score": 0.92, "confidence": 0.86, "summary": "材料与当前项目高度相关"},
        ],
        "diagnosis": {
            "recommended_action": "clarify",
            "reason": "先围绕材料收敛知识点，再决定后续学习安排。",
            "confidence": 0.86,
            "primary_issue": "missing-context",
            "needs_tool": False,
        },
        "reply": "我先按这份材料收敛学习主题，再继续往知识点沉淀和后续编排推进。",
        "plan": {
            "headline": "围绕材料收敛学习方向",
            "summary": "先沉淀知识点，再决定学习与复习安排。",
            "selected_mode": "guided-qa",
            "expected_outcome": "明确下一轮最值得沉淀的学习对象。",
            "steps": [
                {
                    "id": "clarify-material",
                    "title": "围绕材料收敛主题",
                    "mode": "guided-qa",
                    "reason": "先把材料里的稳定判断拉出来。",
                    "outcome": "明确后续要沉淀的知识点。",
                }
            ],
        },
        "activities": [],
    })
    fallback_plan = json.dumps(
        {
            "headline": "围绕材料收敛学习方向",
            "summary": "先沉淀知识点，再决定学习与复习安排。",
            "selected_mode": "guided-qa",
            "expected_outcome": "明确下一轮最值得沉淀的学习对象。",
            "steps": [
                {
                    "id": "clarify-material",
                    "title": "围绕材料收敛主题",
                    "mode": "guided-qa",
                    "reason": "先把材料里的稳定判断拉出来。",
                    "outcome": "明确后续要沉淀的知识点。",
                }
            ],
        },
        ensure_ascii=False,
    )
    fallback_response_bundle = json.dumps(
        {
            "reply": "我先按这份材料收敛学习主题。",
            "plan": json.loads(fallback_plan),
        },
        ensure_ascii=False,
    )
    enrichment_payload = json.dumps(
        [
            {
                "title": "为什么万物皆可 Token 化会让多模态与具身智能共享同一套建模范式",
                "description": "这条知识点解释多模态与具身智能为什么能共享统一建模范式：文本、图像、视频与动作都需要先被压成一致的 token 表示，再进入同一套推理接口。",
                "reason": "材料正文已经把“统一表示空间”明确提出来，先沉淀这条判断，后续学习才不会把多模态扩展误解成几条割裂路线。",
            },
            {
                "title": "DiT 和 Transformer 范式如何从文本迁移到图像视频",
                "description": "这条知识点关注 Transformer 为什么能从文本建模扩展到图像与视频生成，关键在于表示组织和长程依赖建模方式的迁移。",
                "reason": "材料已经把 DiT 当作关键线索，如果不单独沉淀，后续容易把“模型结构迁移”与“任务目标变化”混成一件事。",
            },
            {
                "title": "LLM 作为具身智能常识大脑的边界",
                "description": "这条知识点强调 LLM 在具身系统里更像高层常识与规划模块，负责任务拆解和语义理解，而不是替代感知与底层控制。",
                "reason": "材料把 LLM 和具身智能并置讨论，先收住这条分工边界，后面才能判断哪些问题属于规划层，哪些属于执行层。",
            },
        ],
        ensure_ascii=False,
    )

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _response(generic_main_decision),
        _response(fallback_response_bundle),
        _response(fallback_plan),
        _response(enrichment_payload),
        _response(enrichment_payload),
        _response(enrichment_payload),
    ]
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    result = run_agent_v0(request, repository=repository, llm=llm)

    titles = [suggestion.title for suggestion in result.graph_state.knowledge_point_suggestions]
    assert titles == [
        "为什么万物皆可 Token 化会让多模态与具身智能共享同一套建模范式",
        "DiT 和 Transformer 范式如何从文本迁移到图像视频",
        "LLM 作为具身智能常识大脑的边界",
    ]
    assert "统一建模范式" in result.graph_state.knowledge_point_suggestions[0].description


def test_material_import_uses_llm_title_extraction_when_material_has_only_paragraph_judgments(
    tmp_path: Path,
) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    material_path = tmp_path / "materials.md"
    material_path.write_text(
        "你的观察非常敏锐！这三个领域在近几年的爆发性进步绝非偶然，它们在底层逻辑上有着极深的血缘关系。"
        "简单来说：LLM不仅是另外两者的催化剂，更是它们的底层大脑或架构模板。"
        "现在的 AI 正在经历一场从文本、多模态到具身智能的统一建模。\n",
        encoding="utf-8",
    )
    repository.save_project_material(
        SourceAsset(
            id="material-uploaded-llm-fallback",
            title="LLM、音视频、具身智能.md",
            kind="note",
            topic="大模型、音视频、具身智能",
            summary="验证段落型材料也能提炼知识点。",
            source_uri="LLM、音视频、具身智能.md",
            content_ref=str(material_path),
            status="ready",
        ),
        project_id="rag-demo",
    )

    request = build_request(
        session_type="project",
        entry_mode="material-import",
        target_unit_id=None,
        topic="围绕材料推进多模态学习编排",
        source_asset_ids=["material-uploaded-llm-fallback"],
        messages=[{"role": "user", "content": "你现在能看到完整上下文吗？可以根据材料生成知识点了吗"}],
    )

    def _response(content: str):
        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    generic_main_decision = json.dumps(
        {
            "signals": [
                {
                    "kind": "project-relevance",
                    "score": 0.94,
                    "confidence": 0.88,
                    "summary": "材料与当前项目高度相关",
                },
            ],
            "diagnosis": {
                "recommended_action": "clarify",
                "reason": "先围绕材料收敛知识点，再决定后续学习安排。",
                "confidence": 0.86,
                "primary_issue": "missing-context",
                "needs_tool": False,
            },
            "reply": "我先按这份材料收敛学习主题，再继续往知识点沉淀和后续编排推进。",
            "plan": {
                "headline": "围绕材料收敛学习方向",
                "summary": "先沉淀知识点，再决定学习与复习安排。",
                "selected_mode": "guided-qa",
                "expected_outcome": "明确下一轮最值得沉淀的学习对象。",
                "steps": [
                    {
                        "id": "clarify-material",
                        "title": "围绕材料收敛主题",
                        "mode": "guided-qa",
                        "reason": "先把材料里的稳定判断拉出来。",
                        "outcome": "明确后续要沉淀的知识点。",
                    }
                ],
            },
            "activities": [],
        },
        ensure_ascii=False,
    )
    fallback_plan = json.dumps(
        {
            "headline": "围绕材料收敛学习方向",
            "summary": "先沉淀知识点，再决定学习与复习安排。",
            "selected_mode": "guided-qa",
            "expected_outcome": "明确下一轮最值得沉淀的学习对象。",
            "steps": [
                {
                    "id": "clarify-material",
                    "title": "围绕材料收敛主题",
                    "mode": "guided-qa",
                    "reason": "先把材料里的稳定判断拉出来。",
                    "outcome": "明确后续要沉淀的知识点。",
                }
            ],
        },
        ensure_ascii=False,
    )
    fallback_response_bundle = json.dumps(
        {
            "reply": "我先按这份材料收敛学习主题。",
            "plan": json.loads(fallback_plan),
        },
        ensure_ascii=False,
    )
    title_extraction_payload = json.dumps(
        [
            "LLM 是音视频与具身智能的底层大脑",
            "多模态与具身智能正在共享统一建模范式",
        ],
        ensure_ascii=False,
    )
    enrichment_payload = json.dumps(
        [
            {
                "title": "LLM 是音视频与具身智能的底层大脑",
                "description": "这条知识点强调 LLM 不只是文本模型，而是在多模态和具身系统里逐渐承担统一语义接口、高层推理和任务组织的角色。",
                "reason": "材料正文已经明确把 LLM 提到“底层大脑/架构模板”的位置，先沉淀这条判断，后面才能继续拆清多模态与具身智能为什么会向同一底层靠拢。",
            },
            {
                "title": "多模态与具身智能正在共享统一建模范式",
                "description": "这条知识点解释为什么文本、多模态和具身智能不是彼此割裂的路线，而是在表示、推理接口和系统组织上逐步汇入同一套建模思路。",
                "reason": "材料已经把“三者不是偶然并进”说成稳定判断，如果不先收成知识点，后续讨论很容易重新退回成三个分散话题。",
            },
        ],
        ensure_ascii=False,
    )

    prefix_responses = iter([
        _response(generic_main_decision),
        _response(fallback_response_bundle),
        _response(fallback_plan),
    ])

    def _side_effect(*args, **kwargs):
        messages = kwargs.get("messages", [])
        system_prompt = messages[0]["content"] if messages else ""
        if "材料知识点提炼模块" in system_prompt:
            return _response(title_extraction_payload)
        if "知识点沉淀模块" in system_prompt:
            return _response(enrichment_payload)
        return next(prefix_responses, _response(fallback_plan))

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = _side_effect
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    result = run_agent_v0(request, repository=repository, llm=llm)

    titles = [suggestion.title for suggestion in result.graph_state.knowledge_point_suggestions]
    assert titles == [
        "LLM 是音视频与具身智能的底层大脑",
        "多模态与具身智能正在共享统一建模范式",
    ]
    assert all(suggestion.description for suggestion in result.graph_state.knowledge_point_suggestions)
    assert "不能只凭材料标题或一段很薄的摘要" not in (result.graph_state.assistant_message or "")


def test_material_import_allows_more_than_three_suggestions_for_dense_material(
    tmp_path: Path,
) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    material_path = tmp_path / "dense-materials.md"
    material_path.write_text(
        "# RAG 学习提纲\n\n"
        "1. RAG不是简单检索+拼接\n"
        "2. 为什么需要重排\n"
        "3. 上下文构造如何影响最终答案质量\n"
        "4. 什么时候该回到业务场景解释方案取舍\n",
        encoding="utf-8",
    )
    repository.save_project_material(
        SourceAsset(
            id="material-uploaded-dense",
            title="rag-learning-outline.md",
            kind="note",
            topic="RAG 学习编排",
            summary="验证 dense material 可以沉淀超过 3 条知识点。",
            source_uri="rag-learning-outline.md",
            content_ref=str(material_path),
            status="ready",
        ),
        project_id="rag-demo",
    )

    request = build_request(
        session_type="project",
        entry_mode="material-import",
        target_unit_id=None,
        topic="围绕材料推进 RAG 学习编排",
        source_asset_ids=["material-uploaded-dense"],
        messages=[{"role": "user", "content": "根据这份材料生成知识点"}],
    )

    def _response(content: str):
        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    generic_main_decision = json.dumps(
        {
            "signals": [
                {
                    "kind": "project-relevance",
                    "score": 0.92,
                    "confidence": 0.86,
                    "summary": "材料与当前项目高度相关",
                },
            ],
            "diagnosis": {
                "recommended_action": "clarify",
                "reason": "先围绕材料收敛知识点，再决定后续学习安排。",
                "confidence": 0.86,
                "primary_issue": "missing-context",
                "needs_tool": False,
            },
            "reply": "我先按这份材料收敛学习主题，再继续往知识点沉淀和后续编排推进。",
            "plan": {
                "headline": "围绕材料收敛学习方向",
                "summary": "先沉淀知识点，再决定学习与复习安排。",
                "selected_mode": "guided-qa",
                "expected_outcome": "明确下一轮最值得沉淀的学习对象。",
                "steps": [
                    {
                        "id": "clarify-material",
                        "title": "围绕材料收敛主题",
                        "mode": "guided-qa",
                        "reason": "先把材料里的稳定判断拉出来。",
                        "outcome": "明确后续要沉淀的知识点。",
                    }
                ],
            },
            "activities": [],
        },
        ensure_ascii=False,
    )
    fallback_plan = json.dumps(
        {
            "headline": "围绕材料收敛学习方向",
            "summary": "先沉淀知识点，再决定学习与复习安排。",
            "selected_mode": "guided-qa",
            "expected_outcome": "明确下一轮最值得沉淀的学习对象。",
            "steps": [
                {
                    "id": "clarify-material",
                    "title": "围绕材料收敛主题",
                    "mode": "guided-qa",
                    "reason": "先把材料里的稳定判断拉出来。",
                    "outcome": "明确后续要沉淀的知识点。",
                }
            ],
        },
        ensure_ascii=False,
    )
    fallback_response_bundle = json.dumps(
        {
            "reply": "我先按这份材料收敛学习主题。",
            "plan": json.loads(fallback_plan),
        },
        ensure_ascii=False,
    )
    enrichment_payload = json.dumps(
        [
            {
                "title": "RAG不是简单检索+拼接",
                "description": "这条知识点解释为什么 RAG 的质量不只取决于把文档塞进上下文，而取决于检索、排序和组织是否共同服务于问题。",
                "reason": "材料已经把这条判断直接列成提纲，如果不先沉淀，后面很容易继续把 RAG 误解成机械拼接。",
            },
            {
                "title": "为什么需要重排",
                "description": "这条知识点关注候选文档已经召回后，为什么还需要再按问题相关性重新排序，才能把真正有用的证据推到前面。",
                "reason": "材料把重排列成独立主题，说明它不是召回细节，而是影响最终答案质量的独立判断点。",
            },
            {
                "title": "上下文构造如何影响最终答案质量",
                "description": "这条知识点强调最终回答质量不仅依赖召回，还依赖截断、组织顺序和证据拼装方式。",
                "reason": "如果不把上下文构造单独收住，后续学习时很容易把回答质量问题全部归因到检索阶段。",
            },
            {
                "title": "什么时候该回到业务场景解释方案取舍",
                "description": "这条知识点关注技术方案解释不能停在机制层，而要在合适时机回到具体业务问题、约束和评审标准上说明取舍。",
                "reason": "材料已经把这一点列成独立提纲，说明这不是表达补充，而是面向项目迁移的关键学习对象。",
            },
        ],
        ensure_ascii=False,
    )

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _response(generic_main_decision),
        _response(fallback_response_bundle),
        _response(fallback_plan),
        _response(enrichment_payload),
        _response(enrichment_payload),
        _response(enrichment_payload),
    ]
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    result = run_agent_v0(request, repository=repository, llm=llm)

    titles = [suggestion.title for suggestion in result.graph_state.knowledge_point_suggestions]
    assert titles == [
        "RAG不是简单检索+拼接",
        "为什么需要重排",
        "上下文构造如何影响最终答案质量",
        "什么时候该回到业务场景解释方案取舍",
    ]


def test_iter_agent_v0_events_material_import_reply_matches_generated_suggestions(
    tmp_path: Path,
) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    material_path = tmp_path / "materials.md"
    material_path.write_text(
        "# 多模态大模型学习梳理\n\n"
        "- 一个可学习的知识点是：为什么万物皆可 Token 化会让多模态与具身智能共享同一套建模范式。\n"
        "- 第二个知识点是：DiT 和 Transformer 范式如何从文本迁移到图像视频。\n"
        "- 第三个知识点是：LLM 作为具身智能常识大脑的边界。\n",
        encoding="utf-8",
    )
    repository.save_project_material(
        SourceAsset(
            id="material-uploaded-3",
            title="xidea-multimodal-demo.md",
            kind="note",
            topic="大模型、音视频、具身智能",
            summary="用于验证 stream 回复会和生成出的知识点建议保持一致。",
            source_uri="xidea-multimodal-demo.md",
            content_ref=str(material_path),
            status="ready",
        ),
        project_id="rag-demo",
    )

    request = build_request(
        session_type="project",
        entry_mode="material-import",
        target_unit_id=None,
        topic="围绕材料推进多模态学习编排",
        source_asset_ids=["material-uploaded-3"],
        messages=[{"role": "user", "content": "根据这份材料生成知识点"}],
    )

    def _response(content: str):
        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    generic_main_decision = json.dumps(
        {
            "signals": [
                {
                    "kind": "project-relevance",
                    "score": 0.92,
                    "confidence": 0.86,
                    "summary": "材料与当前项目高度相关",
                },
            ],
            "diagnosis": {
                "recommended_action": "clarify",
                "reason": "先围绕材料收敛知识点，再决定后续学习安排。",
                "confidence": 0.86,
                "primary_issue": "missing-context",
                "needs_tool": False,
            },
            "reply": "我先按这份材料收敛学习主题，再继续往知识点沉淀和后续编排推进。",
            "plan": {
                "headline": "围绕材料收敛学习方向",
                "summary": "先沉淀知识点，再决定学习与复习安排。",
                "selected_mode": "guided-qa",
                "expected_outcome": "明确下一轮最值得沉淀的学习对象。",
                "steps": [
                    {
                        "id": "clarify-material",
                        "title": "围绕材料收敛主题",
                        "mode": "guided-qa",
                        "reason": "先把材料里的稳定判断拉出来。",
                        "outcome": "明确后续要沉淀的知识点。",
                    }
                ],
            },
            "activities": [],
        }
    )
    enrichment_payload = json.dumps(
        [
            {
                "title": "为什么万物皆可 Token 化会让多模态与具身智能共享同一套建模范式",
                "description": "这条知识点解释多模态与具身智能为什么能共享统一建模范式：文本、图像、视频与动作都会先被压成一致的 token 表示，再进入同一套推理接口。",
                "reason": "材料正文已经把“统一表示空间”明确提出来，先沉淀这条判断，后续学习才不会把多模态扩展误解成割裂路线。",
            },
            {
                "title": "DiT 和 Transformer 范式如何从文本迁移到图像视频",
                "description": "这条知识点关注 Transformer 为什么能从文本建模扩展到图像与视频生成，关键在于表示组织和长程依赖建模方式的迁移。",
                "reason": "材料已经把 DiT 当作关键线索，如果不单独沉淀，后续容易把模型结构迁移与任务目标变化混成一件事。",
            },
            {
                "title": "LLM 作为具身智能常识大脑的边界",
                "description": "这条知识点强调 LLM 在具身系统里更像高层常识与规划模块，负责任务拆解和语义理解，而不是替代感知与底层控制。",
                "reason": "材料把 LLM 和具身智能并置讨论，先收住这条分工边界，后面才能判断哪些问题属于规划层，哪些问题属于执行层。",
            },
        ],
        ensure_ascii=False,
    )

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _response(generic_main_decision),
        _response(enrichment_payload),
        _response(enrichment_payload),
    ]
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    events = list(iter_agent_v0_events(request, repository=repository, llm=llm))

    text = "".join(event.delta for event in events if event.event == "text-delta")
    assert "我已经先整理出 3 条候选知识点" in text
    assert "为什么万物皆可 Token 化会让多模态与具身智能共享同一套建模范式" in text
    assert "DiT 和 Transformer 范式如何从文本迁移到图像视频" in text
    assert "LLM 作为具身智能常识大脑的边界" in text


def test_iter_agent_v0_events_reuses_existing_material_suggestion_and_reply(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    material_path = tmp_path / "materials.md"
    material_path.write_text(
        "视频理解 pipeline。音频时间对齐。具身交互反馈。",
        encoding="utf-8",
    )
    repository.save_project_material(
        SourceAsset(
            id="material-uploaded-1",
            title="LLM、音视频、具身智能.md",
            kind="note",
            topic="LLM、音视频、具身智能",
            summary="视频理解、音频时间对齐与具身交互反馈。",
            source_uri="LLM、音视频、具身智能.md",
            content_ref=str(material_path),
            status="ready",
        ),
        project_id="rag-demo",
    )

    initial_request = build_request(
        thread_id="material-thread-1",
        session_type="project",
        entry_mode="material-import",
        target_unit_id=None,
        topic="围绕材料推进多模态学习编排",
        source_asset_ids=["material-uploaded-1"],
        messages=[{"role": "user", "content": "请根据材料帮我沉淀一个知识点"}],
    )
    initial_result = run_agent_v0(
        initial_request,
        repository=repository,
        llm=build_mock_llm(side_effect=RuntimeError("401 auth failed")),
    )
    repository.save_run(initial_request, initial_result)
    existing_suggestion = initial_result.graph_state.knowledge_point_suggestions[0]

    followup_request = build_request(
        thread_id="material-thread-2",
        session_type="project",
        entry_mode="material-import",
        target_unit_id=None,
        topic="围绕材料推进多模态学习编排",
        source_asset_ids=["material-uploaded-1"],
        messages=[{"role": "user", "content": "继续根据这份材料给我一个知识点方向"}],
    )
    events = list(
        iter_agent_v0_events(
            followup_request,
            repository=repository,
            llm=build_mock_llm(side_effect=RuntimeError("401 auth failed")),
        )
    )

    text_deltas = [event.delta for event in events if event.event == "text-delta"]
    suggestion_event = next(event for event in events if event.event == "knowledge-point-suggestion")

    assert "LLM、音视频、具身智能.md" in "".join(text_deltas)
    assert "LLM、音视频" in "".join(text_deltas)
    assert suggestion_event.suggestions[0].id == existing_suggestion.id
    assert suggestion_event.suggestions[0].title == existing_suggestion.title


def test_material_import_does_not_split_filename_tokens_into_fake_knowledge_points(
    tmp_path: Path,
) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    material_path = tmp_path / "thin-material.md"
    material_path.write_text("大模型学习", encoding="utf-8")
    repository.save_project_material(
        SourceAsset(
            id="material-uploaded-thin",
            title="LLM、音视频、具身智能.md",
            kind="note",
            topic="大模型学习",
            summary="大模型学习",
            source_uri="LLM、音视频、具身智能.md",
            content_ref=str(material_path),
            status="ready",
        ),
        project_id="rag-demo",
    )

    request = build_request(
        thread_id="material-thread-thin",
        session_type="project",
        entry_mode="material-import",
        target_unit_id=None,
        topic="围绕材料推进多模态学习编排",
        source_asset_ids=["material-uploaded-thin"],
        messages=[{"role": "user", "content": "先根据这份材料帮我整理一下"}],
    )

    result = run_agent_v0(
        request,
        repository=repository,
        llm=build_mock_llm(side_effect=RuntimeError("401 auth failed")),
    )

    assert result.graph_state.knowledge_point_suggestions == []
    assert "不能只凭材料标题" in (result.graph_state.assistant_message or "")
    assert "「LLM」" not in (result.graph_state.assistant_message or "")


def test_project_session_never_emits_activity_even_with_target_unit() -> None:
    request = build_request(session_type="project")

    result = run_agent_v0(request, llm=build_mock_llm())

    assert result.graph_state.activity is None
    assert result.graph_state.activities == []
    assert "activities" not in [event.event for event in result.events]
    assert any("skipped activity because project session" in item for item in result.graph_state.rationale)


def test_project_session_low_info_message_no_longer_short_circuits() -> None:
    llm = build_mock_llm()
    request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[{"role": "user", "content": "hi"}],
    )

    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.plan is not None
    assert result.graph_state.assistant_message is not None
    assert "project_chat low-info guardrail" not in " ".join(result.graph_state.rationale)
    assert llm.client.chat.completions.create.call_count > 0


def test_review_session_capability_message_short_circuits_without_calling_llm() -> None:
    llm = build_mock_llm()
    request = build_request(
        session_type="review",
        topic="RAG 系统设计",
        messages=[{"role": "user", "content": "hi，你可以做什么"}],
    )

    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.primary_issue == "missing-context"
    assert result.graph_state.activities == []
    assert result.graph_state.activity is None
    assert result.graph_state.assistant_message is not None
    assert "review session" in result.graph_state.assistant_message
    assert "主动回忆" in result.graph_state.assistant_message
    assert any("session_capability guard" in item for item in result.graph_state.rationale)
    assert [event.event for event in result.events] == [
        "diagnosis",
        "text-delta",
        "plan",
        "state-patch",
        "done",
    ]
    assert llm.client.chat.completions.create.call_count == 0


def test_project_session_does_not_write_learning_state_patch() -> None:
    request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[
            {
                "role": "user",
                "content": "我搞不清 retrieval 和 reranking 的边界，帮我先讲清楚它们分别控制什么。",
            }
        ],
    )

    result = run_agent_v0(request, llm=build_mock_llm())

    assert result.graph_state.state_patch is not None
    assert result.graph_state.state_patch.learner_state_patch is None
    assert result.graph_state.state_patch.review_patch is None


def test_run_agent_v0_blocks_off_topic_without_calling_llm() -> None:
    llm = build_mock_llm()
    request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[{"role": "user", "content": "上海明天天气怎么样？"}],
    )

    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.is_off_topic is True
    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.primary_issue == "off-topic"
    assert result.graph_state.activity is None
    assert result.graph_state.knowledge_point_suggestions == []
    assert result.graph_state.state_patch is not None
    assert result.graph_state.state_patch.learner_state_patch is None
    assert [event.event for event in result.events] == [
        "diagnosis",
        "text-delta",
        "plan",
        "state-patch",
        "done",
    ]
    assert llm.client.chat.completions.create.call_count == 0


def test_run_agent_v0_dedupes_boundary_suggestion_when_pair_order_changes(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    first_request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[
            {
                "role": "user",
                "content": "我搞不清楚 embedding 和 reranking 是不是同一回事，它们的边界到底是什么？",
            }
        ],
    )
    first_result = run_agent_v0(first_request, repository=repository, llm=build_mock_llm())
    repository.save_run(first_request, first_result)

    second_request = build_request(
        thread_id="thread-2",
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[
            {
                "role": "user",
                "content": "我还是分不清 reranking 和 embedding 的边界，怎么选？",
            }
        ],
    )
    second_result = run_agent_v0(second_request, repository=repository, llm=build_mock_llm())

    assert second_result.graph_state.knowledge_point_suggestions == []


def test_run_agent_v0_emits_archive_suggestion_for_stable_knowledge_point(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
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
                mastery=92,
                learning_status="stable",
                review_status="stable",
                next_review_at=now + timedelta(days=21),
                archive_suggested=False,
                updated_at=now,
            )
        ],
    )

    request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[{"role": "user", "content": "继续看看这个 project 现在还剩什么要处理。"}],
    )
    result = run_agent_v0(request, repository=repository, llm=build_mock_llm_for_teach())

    assert result.graph_state.activity is None
    assert len(result.graph_state.knowledge_point_suggestions) == 1
    suggestion = result.graph_state.knowledge_point_suggestions[0]
    assert suggestion.kind == "archive"
    assert suggestion.knowledge_point_id == "kp-rag-boundary"
    assert suggestion.title == "retrieval 与 reranking 的边界"


def test_iter_agent_v0_events_streams_reply_in_multiple_chunks() -> None:
    from unittest.mock import MagicMock
    import json

    from xidea_agent.llm import LLMClient

    main_decision_response = json.dumps({
        "signals": [
            {"kind": "concept-confusion", "score": 0.85, "confidence": 0.88, "summary": "用户混淆"},
        ],
        "diagnosis": {
            "recommended_action": "clarify",
            "reason": "用户明确表达分不清两个概念的职责边界",
            "confidence": 0.88,
            "primary_issue": "concept-confusion",
            "needs_tool": False,
        },
        "reply": "这不是简单拼接，因为检索、筛选、重排和上下文压缩各自承担不同职责，需要一起控制噪声、相关性和可解释性。",
        "plan": {
            "headline": "围绕 retrieval vs reranking 的辨析路径",
            "summary": "先辨析边界再追问验证",
            "selected_mode": "contrast-drill",
            "expected_outcome": "能清晰说出两者的职责差异",
            "steps": [
                {"id": "contrast-boundary", "title": "对比辨析", "mode": "contrast-drill",
                 "reason": "LLM-reason", "outcome": "LLM-outcome"},
            ],
        },
        "activities": [
            {
                "title": "先判断哪一层在决定回答质量",
                "objective": "能说明为什么 RAG 不只是检索加拼接。",
                "prompt": "哪句最准确说明 RAG 里真正决定回答质量的额外控制层？",
                "support": "先把检索命中和上下文构造拆开。",
                "input": {
                    "type": "choice",
                    "choices": [
                        {
                            "id": "context",
                            "label": "检索命中只是拿到候选，排序、筛选和上下文组织决定模型最终会不会抓对证据。",
                            "detail": "这句直接点出上下文构造层。",
                            "is_correct": True,
                            "feedback_layers": ["对，这才是 RAG 相比“检索+拼接”多出来的关键控制层。"],
                            "analysis": "准确指出上下文构造在回答质量里的作用。",
                        },
                        {
                            "id": "concat",
                            "label": "只要能检索到相关文档，把全文直接拼进 prompt 就够了。",
                            "detail": "会忽略上下文构造和噪音控制。",
                            "is_correct": False,
                            "feedback_layers": ["命中不等于可用，上下文还需要组织。"],
                            "analysis": "把 RAG 误简化成了机械拼接。",
                        },
                        {
                            "id": "more",
                            "label": "RAG 的核心只是让模型看到更多内容，所以内容越多越好。",
                            "detail": "这会把证据质量控制偷换成覆盖率直觉。",
                            "is_correct": False,
                            "feedback_layers": ["更多内容不是目标，更对口的证据才是目标。"],
                            "analysis": "忽略了排序、截断和噪音控制。",
                        },
                    ],
                },
            }
        ],
    })
    long_reply = "这不是简单拼接，因为检索、筛选、重排和上下文压缩各自承担不同职责，需要一起控制噪声、相关性和可解释性。"

    def _response(content: str):
        from types import SimpleNamespace

        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    def _stream_chunk(content: str):
        from types import SimpleNamespace

        delta = SimpleNamespace(content=content)
        choice = SimpleNamespace(delta=delta)
        return SimpleNamespace(choices=[choice])

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _response(main_decision_response),
        iter([
            _stream_chunk("这不是简单拼接，因为检索、筛选、重排"),
            _stream_chunk("和上下文压缩各自承担不同职责，需要一起控制噪声、相关性和可解释性。"),
        ]),
    ]
    llm = LLMClient(client=mock_client, model="GLM-4.1V-Thinking-Flash", provider="zhipu")

    events = list(iter_agent_v0_events(build_request(), llm=llm))

    event_types = [event.event for event in events]
    assert event_types[:2] == ["status", "status"]
    assert event_types[2] == "diagnosis"
    assert event_types[3] == "status"
    assert event_types[4] == "text-delta"
    text_deltas = [event.delta for event in events if event.event == "text-delta"]
    assert len(text_deltas) >= 2
    assert "".join(text_deltas) == long_reply


def test_run_agent_v0_uses_material_read_for_material_import(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.save_project_material(
        SourceAsset(
            id="material-1",
            title="rag-material.md",
            kind="note",
            topic="RAG 设计",
            summary="检索、重排和上下文构造的关系。",
            status="ready",
        ),
        project_id="rag-demo",
    )
    repository.save_project_material(
        SourceAsset(
            id="material-2",
            title="rerank-material.md",
            kind="note",
            topic="Rerank",
            summary="重排把最相关的证据排到前面。",
            status="ready",
        ),
        project_id="rag-demo",
    )
    request = build_request(
        entry_mode="material-import",
        source_asset_ids=["material-1", "material-2"],
        messages=[{"role": "user", "content": "帮我先看这份材料，再判断我下一步该怎么学"}],
        target_unit_id=None,
    )

    llm = build_mock_llm_for_material_import()
    result = run_agent_v0(request, repository=repository, llm=llm)

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.needs_tool is False
    assert result.graph_state.tool_intent == "none"
    assert result.graph_state.tool_result is not None
    assert result.graph_state.tool_result.kind == "material-read"
    assert len(result.graph_state.tool_result.payload["chunks"]) >= 1
    assert llm.client.chat.completions.create.call_count == 1


def test_run_agent_v0_schedules_review_for_recall_requests() -> None:
    request = build_request(
        messages=[{"role": "user", "content": "我最近总忘这些概念，想做一次复习巩固"}],
    )

    result = run_agent_v0(request, llm=build_mock_llm_for_review())

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.state_patch is not None
    assert result.graph_state.diagnosis.recommended_action == "review"
    assert result.graph_state.state_patch.review_patch is not None
    assert result.graph_state.state_patch.review_patch.due_unit_ids == ["unit-rag-retrieval"]


def test_run_agent_v0_preloads_review_context_for_review_requests() -> None:
    request = build_request(
        session_type="review",
        messages=[{"role": "user", "content": "我最近总忘这些概念，想做一次复习巩固"}],
    )
    llm = build_mock_llm_for_review()

    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.tool_result is not None
    assert result.graph_state.tool_result.kind == "review-context"
    assert result.graph_state.tool_intent == "none"
    assert llm.client.chat.completions.create.call_count == 1


def test_review_session_coerces_non_review_diagnosis_when_confusion_is_not_high() -> None:
    request = build_request(
        session_type="review",
        messages=[{"role": "user", "content": "继续这一轮吧，我想稳一下刚学过的内容。"}],
    )

    result = run_agent_v0(request, llm=build_mock_llm_for_teach())

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.activity is not None
    assert result.graph_state.diagnosis.recommended_action == "review"
    assert result.graph_state.diagnosis.primary_issue == "weak-recall"
    assert result.graph_state.activity.kind == "recall"


def test_run_agent_v0_reuses_preloaded_unit_detail_when_main_decision_requests_tool() -> None:
    import json
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from xidea_agent.llm import LLMClient

    main_decision_response = json.dumps({
        "signals": [
            {"kind": "concept-gap", "score": 0.82, "confidence": 0.85, "summary": "用户需要补单元细节"},
        ],
        "diagnosis": {
            "recommended_action": "teach",
            "reason": "需要补充当前学习单元的结构化细节后再继续",
            "confidence": 0.81,
            "primary_issue": "missing-context",
            "needs_tool": True,
        },
    })
    bundled_response = json.dumps({
        "reply": "我先把这个知识点的结构和常见误区拉出来，再带你过一遍核心判断。",
        "plan": {
            "headline": "围绕当前知识点结构化补全的教学路径",
            "summary": "先补骨架再追问验证",
            "selected_mode": "guided-qa",
            "expected_outcome": "能复述当前单元的关键框架",
            "steps": [
                {"id": "guided-model", "title": "导师问答", "mode": "guided-qa",
                 "reason": "先补结构化框架", "outcome": "能说清当前单元的关键判断"},
            ],
        },
        "activities": [
            {
                "title": "先抓住这个单元的主判断",
                "objective": "能说清当前单元最关键的结构判断。",
                "prompt": "下面哪一句最准确概括当前单元里 retrieval 和 reranking 的分工？",
                "support": "先把主框架搭起来，再进入细追问。",
                "input": {
                    "type": "choice",
                    "choices": [
                        {
                            "id": "split",
                            "label": "retrieval 先找候选，reranking 再把最对口的证据排前面。",
                            "detail": "这句把两层职责拆清楚了。",
                            "is_correct": True,
                            "feedback_layers": ["对，先把这个总框架搭起来。"],
                            "analysis": "准确概括了两阶段分工。",
                        },
                        {
                            "id": "same",
                            "label": "两者本质上都在做把漏掉的文档重新找回来。",
                            "detail": "这把召回和排序混成同一件事。",
                            "is_correct": False,
                            "feedback_layers": ["这里把召回和排序的职责混在一起了。"],
                            "analysis": "把两阶段职责错误地压成了同一个补漏动作。",
                        },
                        {
                            "id": "model",
                            "label": "主要还是看模型够不够强，链路分工不重要。",
                            "detail": "这会绕开当前真正要建立的结构理解。",
                            "is_correct": False,
                            "feedback_layers": ["先别把焦点跳去模型强弱，当前更重要的是搞清链路分工。"],
                            "analysis": "把结构理解问题偷换成模型能力问题。",
                        },
                    ],
                },
            }
        ],
    })

    def _response(content: str):
        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _response(main_decision_response),
        _response(bundled_response),
    ]
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    result = run_agent_v0(build_request(), llm=llm)

    assert result.graph_state.tool_result is not None
    assert result.graph_state.tool_result.kind == "unit-detail"
    assert result.graph_state.tool_intent == "unit-detail"
    assert any(
        "maybe_tool reused preloaded unit-detail context." in item
        for item in result.graph_state.rationale
    )
    assert mock_client.chat.completions.create.call_count == 2


def test_run_agent_v0_loads_recent_context_from_repository(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    first_request = build_request(
        messages=[{"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"}],
    )
    first_result = run_agent_v0(first_request, llm=build_mock_llm())
    repository.save_run(first_request, first_result)

    second_request = build_request(
        entry_mode="coach-followup",
        messages=[{"role": "user", "content": "继续吧，我想再确认一下我刚才混淆的点"}],
    )
    second_result = run_agent_v0(second_request, repository=repository, llm=build_mock_llm())

    assert len(second_result.graph_state.recent_messages) >= 3
    assert any(
        "load_context pulled recent thread messages from SQLite repository."
        in item
        for item in second_result.graph_state.rationale
    )


def test_project_context_is_loaded_from_repository_not_frontend_hint(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    first_request = build_request(topic="Persisted project topic")
    first_result = run_agent_v0(first_request, llm=build_mock_llm())
    repository.save_run(first_request, first_result)

    second_request = build_request(
        topic="Frontend hint topic",
        context_hint="前端拼出来的 project 叙事",
        messages=[{"role": "user", "content": "继续这个 project 的下一步"}],
    )
    second_result = run_agent_v0(second_request, repository=repository, llm=build_mock_llm())

    assert second_result.graph_state.project_context is not None
    assert second_result.graph_state.project_context.source == "repository"
    assert second_result.graph_state.project_context.topic == "Persisted project topic"
    assert second_result.graph_state.project_context.summary.startswith("当前 project 主题：Persisted project topic")


def test_run_agent_v0_applies_activity_result_writeback_and_preloads_project_state(
    tmp_path: Path,
) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    now = datetime.now(timezone.utc)
    repository.save_knowledge_points(
        [
            KnowledgePoint(
                id="kp-rag-boundary",
                project_id="rag-demo",
                title="retrieval 与 reranking 的边界",
                description="说明 retrieval 与 reranking 在 RAG 中的职责分工。",
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
                mastery=42,
                learning_status="learning",
                review_status="idle",
                updated_at=now,
            )
        ],
    )
    repository.create_or_update_project_memory(
        ProjectMemory(
            project_id="rag-demo",
            summary="最近一次 project session 暴露 retrieval 与 reranking 的边界混淆。",
            updated_at=now,
        )
    )
    repository.create_or_update_project_learning_profile(
        ProjectLearningProfile(
            project_id="rag-demo",
            current_stage="building-understanding",
            primary_weaknesses=["concept-confusion"],
            learning_preferences=["contrast-drill"],
            freshness="fresh",
            updated_at=now,
        )
    )

    request = build_request(
        messages=[{"role": "user", "content": "我已经做完这轮辨析，继续下一步。"}],
        activity_result={
            "run_id": "run-1",
            "project_id": "rag-demo",
            "session_id": "thread-1",
            "activity_id": "activity-unit-rag-retrieval-contrast-drill",
            "knowledge_point_id": "kp-rag-boundary",
            "result_type": "exercise",
            "action": "submit",
            "answer": "应该先判断问题出在召回、重排还是上下文构造，而不是盲目加 chunk。",
            "meta": {"correct": True},
        },
    )

    result = run_agent_v0(request, repository=repository, llm=build_mock_llm())

    assert result.graph_state.project_context is not None
    assert result.graph_state.project_context.project_memory_summary is not None
    assert result.graph_state.project_context.project_learning_profile_summary is not None
    assert any(observation.kind == "exercise-result" for observation in result.graph_state.observations)
    assert result.graph_state.state_patch is not None
    assert result.graph_state.state_patch.review_patch is not None
    assert result.graph_state.knowledge_point_state_writebacks[0].knowledge_point_id == "kp-rag-boundary"
    assert result.graph_state.project_memory_writeback is not None
    assert result.graph_state.project_learning_profile_writeback is not None


def test_run_agent_v0_stops_emitting_new_activities_when_orchestration_is_completed(
    tmp_path: Path,
) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    now = datetime.now(timezone.utc)
    repository.save_knowledge_points(
        [
            KnowledgePoint(
                id="kp-last-step",
                project_id="rag-demo",
                title="DiT 架构如何打通 LLM 与音视频生成",
                description="理解 DiT 如何复用 Transformer 训练基础设施。",
                status="active",
                origin_type="seed",
                source_material_refs=["asset-1"],
                created_at=now,
                updated_at=now,
            )
        ]
    )

    first_request = build_request(
        target_unit_id="kp-last-step",
        knowledge_point_id="kp-last-step",
        topic="DiT 架构如何打通 LLM 与音视频生成",
        messages=[{"role": "user", "content": "带我学一轮这个知识点"}],
    )
    first_result = run_agent_v0(first_request, repository=repository, llm=build_mock_llm())
    repository.save_run(first_request, first_result)

    followup_request = build_request(
        target_unit_id="kp-last-step",
        knowledge_point_id="kp-last-step",
        topic="DiT 架构如何打通 LLM 与音视频生成",
        messages=[{"role": "user", "content": "继续吧"}],
        activity_result={
            "run_id": "run-final-step",
            "project_id": "rag-demo",
            "session_id": "thread-1",
            "activity_id": "activity-final",
            "knowledge_point_id": "kp-last-step",
            "result_type": "exercise",
            "action": "submit",
            "answer": "DiT 用 Transformer 替代 U-Net，让音视频生成能复用 LLM 的训练基础设施和规模化经验。",
            "meta": {"correct": True},
        },
    )
    followup_result = run_agent_v0(
        followup_request,
        repository=repository,
        llm=build_mock_llm(),
    )

    assert followup_result.graph_state.session_orchestration is not None
    assert followup_result.graph_state.session_orchestration.status == "completed"
    assert followup_result.graph_state.request.target_unit_id is None
    assert followup_result.graph_state.request.knowledge_point_id is None
    assert followup_result.graph_state.activities == []
    assert followup_result.graph_state.activity is None
    assert "可以先结束这次学习" in (followup_result.graph_state.assistant_message or "")


# ---------------------------------------------------------------------------
# A. Multi-turn signal accumulation (rule-based helpers, tested directly)
# ---------------------------------------------------------------------------

def test_multi_turn_frequency_counts_user_messages() -> None:
    msgs = [
        Message(role="user", content="我分不清这两个概念"),
        Message(role="assistant", content="好的，来比较一下"),
        Message(role="user", content="我还是混淆，区别在哪"),
    ]
    count = _multi_turn_frequency(msgs, ("分不清", "混淆", "区别", "差别", "搞不清", "边界"))
    assert count == 2


def test_boost_single_turn_returns_base() -> None:
    assert _boost(0.82, 1) == 0.82


def test_boost_multi_turn_increases_score() -> None:
    boosted = _boost(0.82, 3)
    assert boosted > 0.82
    assert boosted <= 1.0


def test_build_signals_boosts_on_repeated_confusion() -> None:
    msgs = [
        Message(role="user", content="分不清 retrieval 和 reranking"),
        Message(role="assistant", content="区别在于..."),
        Message(role="user", content="还是搞不清区别"),
    ]
    obs = [Observation(observation_id="m1", kind="user-message", source="thread", summary="q")]
    signals = build_signals(msgs, obs, "chat-question")
    confusion_signals = [s for s in signals if s.kind == "concept-confusion"]
    assert len(confusion_signals) == 1
    assert confusion_signals[0].score > 0.82


def test_build_signals_adds_trend_when_prior_confusion_high() -> None:
    msgs = [Message(role="user", content="这边界我分不清")]
    obs = [Observation(observation_id="m1", kind="user-message", source="thread", summary="q")]
    prior = LearnerUnitState(
        unit_id="u1", mastery=50, understanding_level=48,
        memory_strength=58, confusion_level=55, transfer_readiness=50,
    )
    signals = build_signals(msgs, obs, "chat-question", prior_state=prior)
    confusion_signals = [s for s in signals if s.kind == "concept-confusion"]
    assert len(confusion_signals) == 2


def test_build_signals_adds_memory_trend_when_prior_weak() -> None:
    msgs = [Message(role="user", content="继续讲下一个知识点吧")]
    obs = [Observation(observation_id="m1", kind="user-message", source="thread", summary="q")]
    prior = LearnerUnitState(
        unit_id="u1", mastery=50, understanding_level=60,
        memory_strength=42, confusion_level=20, transfer_readiness=50,
    )
    signals = build_signals(msgs, obs, "chat-question", prior_state=prior)
    memory_signals = [s for s in signals if s.kind == "memory-weakness"]
    assert len(memory_signals) == 1
    assert "隐性遗忘风险" in memory_signals[0].summary


# ---------------------------------------------------------------------------
# B. Confidence-weighted estimation + dynamic confidence
# ---------------------------------------------------------------------------

def test_estimate_confidence_varies_with_signal_count() -> None:
    one_signal = [
        Signal(kind="concept-confusion", score=0.82, confidence=0.86, summary="s1", based_on=[]),
    ]
    two_signals = [
        Signal(kind="concept-confusion", score=0.82, confidence=0.86, summary="s1", based_on=[]),
        Signal(kind="memory-weakness", score=0.8, confidence=0.78, summary="s2", based_on=[]),
    ]
    state_1 = estimate_learner_state("u1", one_signal)
    state_2 = estimate_learner_state("u1", two_signals)
    assert state_2.confidence > state_1.confidence


def test_estimate_scales_delta_by_signal_confidence() -> None:
    high_conf = [Signal(kind="concept-confusion", score=0.82, confidence=0.95, summary="s", based_on=[])]
    low_conf = [Signal(kind="concept-confusion", score=0.82, confidence=0.55, summary="s", based_on=[])]
    state_high = estimate_learner_state("u1", high_conf)
    state_low = estimate_learner_state("u1", low_conf)
    assert state_high.confusion_level > state_low.confusion_level


# ---------------------------------------------------------------------------
# C. Action scoring replaces if-elif waterfall
# ---------------------------------------------------------------------------

def test_score_actions_clarify_wins_when_confusion_high() -> None:
    ls = LearnerUnitState(
        unit_id="u1", mastery=50, understanding_level=48,
        memory_strength=58, confusion_level=72, transfer_readiness=50,
    )
    review_dec = ReviewDecision(should_review=False, priority=0.0, reason="ok")
    scores = _score_actions(ls, review_dec)
    assert max(scores, key=lambda k: scores[k]) == "clarify"


def test_score_actions_review_wins_when_memory_weak() -> None:
    ls = LearnerUnitState(
        unit_id="u1", mastery=50, understanding_level=62,
        memory_strength=35, confusion_level=20, transfer_readiness=55,
    )
    review_dec = ReviewDecision(should_review=True, priority=0.46, reason="memory weak")
    scores = _score_actions(ls, review_dec)
    assert max(scores, key=lambda k: scores[k]) == "review"


def test_score_actions_teach_wins_when_understanding_low() -> None:
    ls = LearnerUnitState(
        unit_id="u1", mastery=40, understanding_level=35,
        memory_strength=70, confusion_level=25, transfer_readiness=60,
    )
    review_dec = ReviewDecision(should_review=False, priority=0.0, reason="stable")
    scores = _score_actions(ls, review_dec)
    best = max(scores, key=lambda k: scores[k])
    assert best == "teach"


def test_diagnosis_includes_action_scores_in_explanation() -> None:
    result = run_agent_v0(build_request(), llm=build_mock_llm())
    diag = result.graph_state.diagnosis
    assert diag is not None
    assert diag.explanation is not None


def test_diagnosis_resolves_confusion_vs_review_tradeoff() -> None:
    """When both confusion and memory weakness compete, scoring resolves it."""
    request = build_request(
        messages=[{"role": "user", "content": "我搞不清这两个概念，而且上次学的也快忘了"}],
    )
    result = run_agent_v0(request, llm=build_mock_llm())
    diag = result.graph_state.diagnosis
    assert diag is not None
    assert diag.recommended_action in ("clarify", "review", "teach")


# ---------------------------------------------------------------------------
# D. Effect assessment — prior action penalty
# ---------------------------------------------------------------------------

def test_score_actions_penalizes_repeated_ineffective_clarify() -> None:
    ls = LearnerUnitState(
        unit_id="u1", mastery=50, understanding_level=48,
        memory_strength=58, confusion_level=60, transfer_readiness=50,
    )
    prior = LearnerUnitState(
        unit_id="u1", mastery=55, understanding_level=52,
        memory_strength=58, confusion_level=58, transfer_readiness=50,
        recommended_action="clarify",
    )
    review_dec = ReviewDecision(should_review=False, priority=0.0, reason="ok")

    scores_no_prior = _score_actions(ls, review_dec, prior_state=None)
    scores_with_prior = _score_actions(ls, review_dec, prior_state=prior)
    assert scores_with_prior["clarify"] < scores_no_prior["clarify"]


def test_multi_round_escalation(tmp_path: Path) -> None:
    """Two rounds with confusion: second round should still decide but with richer signals."""
    repository = SQLiteRepository(tmp_path / "agent.db")
    first = run_agent_v0(
        build_request(
            messages=[{"role": "user", "content": "我分不清 retrieval 和 reranking"}],
        ),
        llm=build_mock_llm(),
    )
    repository.save_run(build_request(), first)

    second = run_agent_v0(
        build_request(
            entry_mode="coach-followup",
            messages=[{"role": "user", "content": "还是混淆，能再讲讲区别吗"}],
        ),
        repository=repository,
        llm=build_mock_llm(),
    )
    assert second.graph_state.diagnosis is not None
