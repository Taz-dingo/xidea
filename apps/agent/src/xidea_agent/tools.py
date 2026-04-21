from __future__ import annotations

import re
from typing import Any

from xidea_agent.material_reader import (
    MaterialReadMode,
    build_material_chunks,
    read_material_text,
    select_material_chunks,
)
from xidea_agent.material_content import (
    MAX_MATERIAL_KNOWLEDGE_POINT_SUGGESTIONS,
    extract_material_knowledge_point_candidates,
    normalize_material_text,
)
from xidea_agent.repository import SQLiteRepository
from xidea_agent.state import (
    AgentRequest,
    KnowledgePoint,
    LearningUnit,
    Message,
    ProjectContext,
    SourceAsset,
    ToolIntent,
    ToolResult,
)


def retrieve_source_assets(
    asset_ids: list[str],
    repository: SQLiteRepository | None = None,
    project_id: str | None = None,
) -> list[SourceAsset]:
    if repository is None or project_id is None:
        return []

    materials = repository.get_project_materials_by_ids(project_id, asset_ids)
    materials_by_id = {material.id: material for material in materials}
    return [materials_by_id[asset_id] for asset_id in asset_ids if asset_id in materials_by_id]


def _build_learning_unit_from_knowledge_point(point: KnowledgePoint) -> LearningUnit:
    summary = point.description.strip() or f"围绕知识点「{point.title}」建立稳定理解与可迁移判断。"
    weakness_tags = ["知识点沉淀", "概念边界"]
    if point.source_material_refs:
        weakness_tags.append("材料迁移")
    return LearningUnit(
        id=point.id,
        title=point.title,
        summary=summary,
        weakness_tags=list(dict.fromkeys(weakness_tags)),
        candidate_modes=["guided-qa", "contrast-drill", "scenario-sim"],
        difficulty=3 if point.source_material_refs else 2,
    )


def _build_learning_unit_from_topic(
    unit_id: str | None,
    topic: str,
) -> LearningUnit:
    normalized_topic = " ".join(topic.strip().split())
    title = normalized_topic or "当前学习主题"
    summary = (
        f"围绕「{title}」建立稳定理解、判断边界和可迁移表达。"
        if normalized_topic
        else "先围绕当前主题建立稳定理解、判断边界和可迁移表达。"
    )
    return LearningUnit(
        id=unit_id or "current-topic",
        title=title,
        summary=summary,
        weakness_tags=["知识点沉淀", "概念边界", "项目迁移"],
        candidate_modes=["guided-qa", "contrast-drill", "scenario-sim"],
        difficulty=3,
    )


def retrieve_learning_unit(
    unit_id: str | None,
    topic: str,
    *,
    repository: SQLiteRepository | None = None,
    project_id: str | None = None,
) -> LearningUnit:
    if unit_id and repository is not None and project_id is not None:
        point = repository.get_knowledge_point(project_id, unit_id)
        if point is not None:
            return _build_learning_unit_from_knowledge_point(point)

    return _build_learning_unit_from_topic(unit_id, topic)


def resolve_tool_result(
    tool_intent: ToolIntent,
    request: AgentRequest,
    repository: SQLiteRepository | None = None,
) -> ToolResult | None:
    if tool_intent == "none":
        return None

    if tool_intent == "asset-summary":
        return ToolResult(
            kind=tool_intent,
            payload=_build_asset_summary_payload(
                request.source_asset_ids,
                repository=repository,
                project_id=request.project_id,
            ),
        )

    if tool_intent == "material-read":
        return ToolResult(
            kind=tool_intent,
            payload=_build_material_read_payload(
                request.source_asset_ids,
                repository=repository,
                project_id=request.project_id,
                query=request.messages[-1].content if request.messages else None,
                mode="overview" if request.entry_mode == "material-import" else "targeted",
            ),
        )

    if tool_intent == "thread-memory":
        return ToolResult(
            kind=tool_intent,
            payload=_build_thread_memory_payload(request.thread_id, request.target_unit_id, repository),
        )

    if tool_intent == "review-context":
        if request.target_unit_id is None:
            return None
        return ToolResult(
            kind=tool_intent,
            payload=_build_review_context_payload(
                request.thread_id,
                request.target_unit_id,
                repository,
            ),
        )

    unit = retrieve_learning_unit(
        request.target_unit_id,
        request.topic,
        repository=repository,
        project_id=request.project_id,
    )
    return ToolResult(
        kind=tool_intent,
        payload=_build_unit_detail_payload(unit),
    )


def describe_tool_registry() -> dict[str, dict[str, Any]]:
    return {
        "asset-summary": {
            "description": "Summarize imported source assets with content excerpts and key concepts.",
            "returns": [
                "assetIds",
                "assets",
                "keyConcepts",
                "summary",
            ],
        },
        "material-read": {
            "description": "Read source materials as retrievable chunks with citations for overview or targeted lookup.",
            "returns": [
                "materialIds",
                "materials",
                "keyConcepts",
                "chunks",
                "citations",
                "summary",
            ],
        },
        "unit-detail": {
            "description": "Return structured detail including prerequisites, misconceptions and core questions.",
            "returns": [
                "focusUnitId",
                "title",
                "summary",
                "candidateModes",
                "weaknessTags",
                "prerequisites",
                "commonMisconceptions",
                "coreQuestions",
                "relatedUnits",
            ],
        },
        "thread-memory": {
            "description": "Return recent thread messages with learning progress and last diagnosis.",
            "returns": [
                "threadId",
                "recentMessages",
                "learningProgress",
                "lastDiagnosis",
                "summary",
            ],
        },
        "review-context": {
            "description": "Return review scheduling context with performance trend and decay risk.",
            "returns": [
                "focusUnitId",
                "dueUnitIds",
                "scheduledAt",
                "reviewCount",
                "lapseCount",
                "performanceTrend",
                "decayRisk",
                "lastReviewOutcome",
                "summary",
            ],
        },
    }


def _build_asset_summary_payload(
    asset_ids: list[str],
    *,
    repository: SQLiteRepository | None = None,
    project_id: str | None = None,
) -> dict[str, Any]:
    assets = retrieve_source_assets(asset_ids, repository=repository, project_id=project_id)
    asset_details: list[dict[str, Any]] = []
    all_concepts: list[str] = []

    for asset in assets:
        extracted_text = read_material_text(asset)
        normalized_excerpt = _normalize_asset_text(extracted_text)
        uploaded_summary = asset.summary.strip() if isinstance(asset.summary, str) else ""
        concept_source = normalized_excerpt or uploaded_summary
        extracted_concepts = _extract_key_concepts(concept_source)
        knowledge_point_candidates = extract_material_knowledge_point_candidates(
            concept_source,
            limit=MAX_MATERIAL_KNOWLEDGE_POINT_SUGGESTIONS,
        )
        concepts = list(dict.fromkeys(extracted_concepts))[:4]
        all_concepts.extend(concepts)
        asset_details.append({
            "id": asset.id,
            "title": asset.title,
            "kind": asset.kind,
            "topic": asset.topic,
            "contentExcerpt": (normalized_excerpt or uploaded_summary)
            or f"材料「{asset.title}」的内容摘要暂未提取，后续接入解析后自动补充。",
            "keyConcepts": concepts,
            "knowledgePointCandidates": knowledge_point_candidates,
            "relevanceHint": "该材料已进入当前 project 材料池，可作为这轮 project 判断与知识点建议的上下文。",
        })

    unique_concepts = list(dict.fromkeys(all_concepts))
    visible_titles = "、".join(asset["title"] for asset in asset_details[:3])
    visible_concepts = "、".join(unique_concepts[:6])
    return {
        "assetIds": [asset.id for asset in assets],
        "assets": asset_details,
        "keyConcepts": unique_concepts,
        "summary": (
            f"已读取 {len(assets)} 份材料：{visible_titles or '暂无标题'}。"
            f"核心概念包括：{visible_concepts or '待补充解析'}。"
            "建议直接围绕这些材料判断学习主题、概念边界和可沉淀的知识点。"
        ),
    }


def build_asset_summary_payload(
    asset_ids: list[str],
    *,
    repository: SQLiteRepository | None = None,
    project_id: str | None = None,
) -> dict[str, Any]:
    return _build_asset_summary_payload(
        asset_ids,
        repository=repository,
        project_id=project_id,
    )


def build_material_read_payload(
    asset_ids: list[str],
    *,
    repository: SQLiteRepository | None = None,
    project_id: str | None = None,
    query: str | None = None,
    mode: MaterialReadMode = "overview",
    max_chunks: int = 6,
) -> dict[str, Any]:
    return _build_material_read_payload(
        asset_ids,
        repository=repository,
        project_id=project_id,
        query=query,
        mode=mode,
        max_chunks=max_chunks,
    )


def build_project_context(
    request: AgentRequest,
    repository: SQLiteRepository | None = None,
) -> ProjectContext:
    repository_context = (
        repository.get_project_context(request.project_id, request.thread_id)
        if repository is not None
        else None
    )
    thread_context = (
        repository_context.get("thread_context")
        if repository_context is not None
        else None
    )
    stored_asset_ids = (
        thread_context.get("source_asset_ids", [])
        if isinstance(thread_context, dict)
        else []
    )
    source_asset_ids = (
        request.source_asset_ids or stored_asset_ids
        if request.session_type == "project"
        else []
    )
    focus_unit = retrieve_learning_unit(
        request.target_unit_id,
        request.topic,
        repository=repository,
        project_id=request.project_id,
    )
    recent_messages = (
        repository_context.get("recent_messages", [])
        if repository_context is not None
        else request.messages[-5:]
        if repository is None
        else []
    )
    project_memory = (
        repository_context.get("project_memory")
        if repository_context is not None
        else None
    )
    project_learning_profile = (
        repository_context.get("project_learning_profile")
        if repository_context is not None
        else None
    )
    if not isinstance(recent_messages, list):
        recent_messages = request.messages[-5:]

    asset_summary = (
        _build_asset_summary_payload(
            source_asset_ids,
            repository=repository,
            project_id=request.project_id,
        )
        if source_asset_ids
        else None
    )
    thread_memory = _build_thread_memory_payload(
        request.thread_id,
        request.target_unit_id,
        repository,
    )
    review_summary = (
        _build_review_context_payload(
            request.thread_id,
            request.target_unit_id,
            repository,
        )
        if request.target_unit_id is not None
        else None
    )

    topic = (
        str(repository_context.get("project_topic")).strip()
        if repository_context is not None and repository_context.get("project_topic")
        else request.topic
    )
    source = (
        "repository"
        if repository_context is not None and repository_context.get("project_topic")
        else "request"
    )

    summary_parts = [
        f"当前 project 主题：{topic}",
        f"当前聚焦知识点：{focus_unit.title}",
        asset_summary["summary"] if asset_summary is not None else None,
        thread_memory["summary"],
        review_summary["summary"] if review_summary is not None else None,
        _summarize_project_memory(project_memory),
        _summarize_project_learning_profile(project_learning_profile),
    ]
    recent_message_summary = _summarize_recent_messages(recent_messages)
    if recent_message_summary is not None:
        summary_parts.append(f"最近会话摘要：{recent_message_summary}")
    if request.context_hint:
        summary_parts.append(f"请求上下文提示：{request.context_hint}")

    return ProjectContext(
        project_id=request.project_id,
        topic=topic,
        focus_unit_id=focus_unit.id,
        focus_unit_title=focus_unit.title,
        source_asset_ids=list(source_asset_ids),
        source_asset_summary=asset_summary["summary"] if asset_summary is not None else None,
        thread_memory_summary=thread_memory["summary"],
        review_summary=review_summary["summary"] if review_summary is not None else None,
        project_memory_summary=_summarize_project_memory(project_memory),
        project_learning_profile_summary=_summarize_project_learning_profile(
            project_learning_profile
        ),
        recent_messages=[message for message in recent_messages if isinstance(message, Message)],
        source=source,
        summary="；".join(item for item in summary_parts if item) + "。",
    )


def _extract_key_concepts(summary: str) -> list[str]:
    if summary.strip() == "":
        return []

    knowledge_points = extract_material_knowledge_point_candidates(summary, limit=4)
    if knowledge_points:
        return knowledge_points

    fragments = re.split(r"[。；;，,\n]+", summary)
    concepts: list[str] = []
    for fragment in fragments:
        cleaned = fragment.strip(" ：:-")
        if len(cleaned) < 4:
            continue
        lowered = cleaned.lower()
        if lowered.startswith(("created:", "modified:", "updated:", "date:", "tags:")):
            continue
        if re.fullmatch(r"[\d\s:,-]+", cleaned):
            continue
        concepts.append(cleaned[:28])
        if len(concepts) >= 4:
            break
    return concepts


def _normalize_asset_text(text: str, limit: int = 900) -> str:
    return normalize_material_text(text, limit=limit)


def _build_material_read_payload(
    asset_ids: list[str],
    *,
    repository: SQLiteRepository | None = None,
    project_id: str | None = None,
    query: str | None = None,
    mode: MaterialReadMode = "overview",
    max_chunks: int = 6,
) -> dict[str, Any]:
    assets = retrieve_source_assets(asset_ids, repository=repository, project_id=project_id)
    material_details: list[dict[str, Any]] = []
    all_chunks = []
    all_concepts: list[str] = []

    for asset in assets:
        raw_material_text = read_material_text(asset)
        asset_chunks = build_material_chunks(asset)
        excerpt_source = " ".join(chunk.text for chunk in asset_chunks[:2]) if asset_chunks else (asset.summary or "")
        candidate_source = (
            raw_material_text
            if raw_material_text.strip()
            else "\n".join(chunk.text for chunk in asset_chunks[:MAX_MATERIAL_KNOWLEDGE_POINT_SUGGESTIONS])
            if asset_chunks
            else (asset.summary or "")
        )
        normalized_excerpt = _normalize_asset_text(excerpt_source)
        key_concepts = _extract_key_concepts(normalized_excerpt)
        knowledge_point_candidates = extract_material_knowledge_point_candidates(
            candidate_source,
            limit=MAX_MATERIAL_KNOWLEDGE_POINT_SUGGESTIONS,
        )
        all_concepts.extend(key_concepts)
        material_details.append({
            "id": asset.id,
            "title": asset.title,
            "kind": asset.kind,
            "topic": asset.topic,
            "contentExcerpt": normalized_excerpt
            or f"材料「{asset.title}」的正文暂未成功提取，当前先回退到元信息。",
            "keyConcepts": key_concepts,
            "knowledgePointCandidates": knowledge_point_candidates,
            "relevanceHint": "该材料已切成可检索片段，可用于主题判断、知识点建议和后续引用。",
            "chunkIds": [chunk.chunk_id for chunk in asset_chunks],
        })
        all_chunks.extend(asset_chunks)

    selected_chunks = select_material_chunks(
        all_chunks,
        query=query,
        mode=mode,
        max_chunks=max_chunks,
    )
    visible_titles = "、".join(material["title"] for material in material_details[:3])
    visible_concepts = "、".join(list(dict.fromkeys(all_concepts))[:6])
    chunk_payload = [
        {
            "chunkId": chunk.chunk_id,
            "materialId": chunk.material_id,
            "title": chunk.title,
            "text": chunk.text,
            "locator": chunk.locator,
            "score": chunk.score,
        }
        for chunk in selected_chunks
    ]
    citations = [
        {
            "chunkId": chunk.chunk_id,
            "materialId": chunk.material_id,
            "title": chunk.title,
            "locator": chunk.locator,
            "label": (
                f"{chunk.title} / {chunk.locator}"
                if chunk.locator
                else chunk.title
            ),
        }
        for chunk in selected_chunks
    ]

    return {
        "mode": mode,
        "query": query,
        "materialIds": [asset.id for asset in assets],
        "materials": material_details,
        "keyConcepts": list(dict.fromkeys(all_concepts)),
        "chunks": chunk_payload,
        "citations": citations,
        "summary": (
            f"已阅读 {len(material_details)} 份材料：{visible_titles or '暂无标题'}。"
            f"当前返回 {len(chunk_payload)} 个可引用片段。"
            f"{'核心概念包括：' + visible_concepts + '。' if visible_concepts else ''}"
        ),
    }


def _summarize_project_memory(project_memory: object | None) -> str | None:
    summary = getattr(project_memory, "summary", None)
    if not isinstance(summary, str) or not summary.strip():
        return None
    return f"project memory：{summary.strip()}"


def _summarize_project_learning_profile(project_learning_profile: object | None) -> str | None:
    if project_learning_profile is None:
        return None

    stage = getattr(project_learning_profile, "current_stage", None)
    freshness = getattr(project_learning_profile, "freshness", None)
    weaknesses = getattr(project_learning_profile, "primary_weaknesses", [])
    if not isinstance(weaknesses, list):
        weaknesses = []

    parts = []
    if isinstance(stage, str) and stage.strip():
        parts.append(f"阶段={stage.strip()}")
    if weaknesses:
        parts.append(f"薄弱点={', '.join(str(item) for item in weaknesses[:3])}")
    if isinstance(freshness, str) and freshness.strip():
        parts.append(f"freshness={freshness.strip()}")
    if not parts:
        return None
    return "project learning profile：" + "，".join(parts)


def _build_unit_detail_payload(unit: LearningUnit) -> dict[str, Any]:
    generic_title = unit.title.strip()
    generic_summary = unit.summary.strip()
    prerequisites = [
        f"先明确「{generic_title}」在当前项目里要解决什么判断问题。",
        "先把来源材料中的关键概念、术语和例子对齐，再进入学习动作。",
    ]
    common_misconceptions = [
        f"把「{generic_title}」当成泛泛主题，而不是一个需要建立边界的知识点。",
        "只记住表面结论，没有回到材料证据和适用条件。",
    ]
    core_questions = [
        f"「{generic_title}」最关键的判断边界是什么？",
        f"如果要把「{generic_title}」讲给别人听，最先应该举哪个例子或证据？",
    ]
    related_units: list[str] = []

    return {
        "focusUnitId": unit.id,
        "title": unit.title,
        "summary": unit.summary,
        "candidateModes": unit.candidate_modes,
        "weaknessTags": unit.weakness_tags,
        "difficulty": unit.difficulty,
        "prerequisites": prerequisites,
        "commonMisconceptions": common_misconceptions,
        "coreQuestions": core_questions,
        "relatedUnits": related_units,
        "teachingNote": generic_summary,
    }


def _build_thread_memory_payload(
    thread_id: str,
    target_unit_id: str | None,
    repository: SQLiteRepository | None,
) -> dict[str, Any]:
    if repository is None:
        return {
            "threadId": thread_id,
            "recentMessages": [],
            "learningProgress": None,
            "lastDiagnosis": None,
            "summary": "当前没有持久化 thread memory，先按本轮消息继续诊断。",
        }

    messages = repository.list_recent_messages(thread_id, limit=5)

    learning_progress: dict[str, Any] | None = None
    last_diagnosis: dict[str, Any] | None = None

    if target_unit_id:
        learner_state = repository.get_learner_unit_state(thread_id, target_unit_id)
        if learner_state is not None:
            learning_progress = {
                "unitId": learner_state.unit_id,
                "mastery": learner_state.mastery,
                "understandingLevel": learner_state.understanding_level,
                "memoryStrength": learner_state.memory_strength,
                "confusionLevel": learner_state.confusion_level,
                "transferReadiness": learner_state.transfer_readiness,
                "weakSignals": learner_state.weak_signals,
                "updatedAt": learner_state.updated_at.isoformat() if learner_state.updated_at else None,
            }
            if learner_state.recommended_action:
                last_diagnosis = {
                    "action": learner_state.recommended_action,
                    "basedOn": learner_state.based_on[:3],
                }

    summary_parts = [f"已补充最近 {len(messages)} 条 thread message"]
    if learning_progress:
        summary_parts.append(
            f"学习进度：mastery={learning_progress['mastery']}，"
            f"理解={learning_progress['understandingLevel']}，"
            f"记忆={learning_progress['memoryStrength']}"
        )
    if last_diagnosis:
        summary_parts.append(f"上轮建议动作：{last_diagnosis['action']}")

    return {
        "threadId": thread_id,
        "recentMessages": [message.model_dump() for message in messages],
        "learningProgress": learning_progress,
        "lastDiagnosis": last_diagnosis,
        "summary": "；".join(summary_parts) + "。",
    }


def build_thread_memory_payload(
    thread_id: str,
    target_unit_id: str | None,
    repository: SQLiteRepository | None,
) -> dict[str, Any]:
    return _build_thread_memory_payload(thread_id, target_unit_id, repository)


def _build_review_context_payload(
    thread_id: str,
    unit_id: str,
    repository: SQLiteRepository | None,
) -> dict[str, Any]:
    if repository is None:
        return {
            "focusUnitId": unit_id,
            "dueUnitIds": [unit_id],
            "scheduledAt": None,
            "performanceTrend": None,
            "decayRisk": "unknown",
            "lastReviewOutcome": None,
            "summary": "当前没有持久化 review state，先按本轮记忆风险安排复盘。",
        }

    review_state = repository.get_review_state(thread_id, unit_id)
    learner_state = repository.get_learner_unit_state(thread_id, unit_id)

    performance_trend: dict[str, Any] | None = None
    decay_risk = "low"
    last_review_outcome: dict[str, Any] | None = None

    if learner_state is not None:
        memory = learner_state.memory_strength
        if memory <= 30:
            decay_risk = "critical"
        elif memory <= 50:
            decay_risk = "high"
        elif memory <= 70:
            decay_risk = "medium"

        performance_trend = {
            "memoryStrength": memory,
            "understandingLevel": learner_state.understanding_level,
            "confusionLevel": learner_state.confusion_level,
            "weakSignals": learner_state.weak_signals,
            "trendHint": _infer_trend_hint(memory, learner_state.confusion_level),
        }

    if review_state is not None:
        last_review_outcome = {
            "scheduledAt": review_state.scheduled_at.isoformat() if review_state.scheduled_at else None,
            "reviewReason": review_state.review_reason,
            "dueUnitIds": review_state.due_unit_ids,
            "reviewCount": review_state.review_count,
            "lapseCount": review_state.lapse_count,
        }

    summary_parts = [f"记忆衰减风险：{decay_risk}"]
    if review_state is not None:
        summary_parts.append(
            review_state.review_reason or "已读取最近一次 review 调度信息"
        )
    else:
        summary_parts.append("当前 unit 暂无既有 review 记录，本轮将作为新的复盘依据")

    return {
        "focusUnitId": unit_id,
        "dueUnitIds": review_state.due_unit_ids if review_state else [unit_id],
        "scheduledAt": (
            review_state.scheduled_at.isoformat()
            if review_state and review_state.scheduled_at
            else None
        ),
        "reviewCount": review_state.review_count if review_state else 0,
        "lapseCount": review_state.lapse_count if review_state else 0,
        "performanceTrend": performance_trend,
        "decayRisk": decay_risk,
        "lastReviewOutcome": last_review_outcome,
        "summary": "；".join(summary_parts) + "。",
    }


def build_review_context_payload(
    thread_id: str,
    unit_id: str,
    repository: SQLiteRepository | None,
) -> dict[str, Any]:
    return _build_review_context_payload(thread_id, unit_id, repository)


def _infer_trend_hint(memory_strength: int, confusion_level: int) -> str:
    if memory_strength <= 30:
        return "记忆严重衰减，需要立即安排针对性复盘，否则之前的学习投入可能归零。"
    if memory_strength <= 50 and confusion_level >= 60:
        return "记忆不稳且混淆度高，复习前建议先做一轮概念澄清，避免强化错误记忆。"
    if memory_strength <= 50:
        return "记忆强度偏低，适合安排一次主动回忆训练来巩固。"
    if confusion_level >= 60:
        return "记忆尚可但混淆风险偏高，建议在复习中加入对比辨析环节。"
    return "当前记忆状态相对稳定，可按常规节奏复习。"


def _summarize_recent_messages(messages: list[Message]) -> str | None:
    if not messages:
        return None

    items: list[str] = []
    for message in messages[-3:]:
        prefix = "用户" if message.role == "user" else "系统"
        items.append(f"{prefix}：{message.content[:40]}")

    return " / ".join(items)
