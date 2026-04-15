from __future__ import annotations

from typing import Any

from xidea_agent.repository import SQLiteRepository
from xidea_agent.state import (
    AgentRequest,
    LearningUnit,
    SourceAsset,
    ToolIntent,
    ToolResult,
)


_ASSET_CATALOG: dict[str, SourceAsset] = {
    "asset-1": SourceAsset(
        id="asset-1",
        title="RAG 系统设计评审记录.pdf",
        kind="pdf",
        topic="当前项目方案",
    ),
    "asset-2": SourceAsset(
        id="asset-2",
        title="检索召回与重排对比笔记",
        kind="note",
        topic="概念边界",
    ),
    "asset-3": SourceAsset(
        id="asset-3",
        title="线上 bad case 复盘网页",
        kind="web",
        topic="真实项目反馈",
    ),
}

_ASSET_ENRICHMENT: dict[str, dict[str, Any]] = {
    "asset-1": {
        "contentExcerpt": (
            "当前 RAG 方案采用向量召回 + cross-encoder 重排两阶段架构。"
            "评审中暴露的核心问题：召回阶段命中率达到 82%，但端到端回答准确率只有 61%，"
            "说明召回命中不等于回答质量。重排层的 recall@5 提升了 18pp，"
            "但上下文窗口超过 4k token 后回答质量反而下降。"
        ),
        "keyConcepts": [
            "两阶段检索架构",
            "召回命中率 vs 回答准确率",
            "cross-encoder 重排",
            "上下文窗口饱和效应",
        ],
        "relevanceHint": "直接对应当前项目的核心设计取舍，适合用来验证学习者对 RAG 架构的理解深度。",
    },
    "asset-2": {
        "contentExcerpt": (
            "向量召回的优势在于语义泛化能力，但容易把语义相似但逻辑不同的段落混在一起。"
            "重排的核心价值不是「提高召回率」，而是「重新排列召回结果的业务相关性」。"
            "常见误区：把重排当成召回的简单补丁，忽略了重排本身需要任务级信号。"
        ),
        "keyConcepts": [
            "语义召回 vs 精确匹配",
            "重排 ≠ 召回补丁",
            "任务级信号的必要性",
            "语义相似 ≠ 逻辑等价",
        ],
        "relevanceHint": "聚焦概念边界辨析，适合在学习者出现「召回 vs 重排」混淆时作为澄清材料。",
    },
    "asset-3": {
        "contentExcerpt": (
            "线上 bad case 分析：用户问「如何优化检索效果」时，系统召回了 3 篇语义相关文档，"
            "但其中 2 篇讨论的是倒排索引优化而非向量检索优化。"
            "根因：召回阶段没有区分「检索」的不同技术含义，重排模型也没有足够的领域判别能力。"
        ),
        "keyConcepts": [
            "语义歧义导致的召回污染",
            "领域判别能力不足",
            "bad case 根因分析方法",
            "召回质量的评估维度",
        ],
        "relevanceHint": "真实项目反馈，适合用来验证学习者能否把概念知识迁移到实际问题诊断。",
    },
}

_UNIT_CATALOG: dict[str, LearningUnit] = {
    "unit-rag-retrieval": LearningUnit(
        id="unit-rag-retrieval",
        title="什么时候需要重排，而不是只做向量召回",
        summary="理解召回命中和回答质量之间的断层，以及重排的作用。",
        weakness_tags=["概念边界", "方案取舍", "容易误配"],
        candidate_modes=["contrast-drill", "guided-qa", "scenario-sim"],
        difficulty=3,
    ),
    "unit-rag-core": LearningUnit(
        id="unit-rag-core",
        title="RAG 为什么不是简单检索 + 拼接",
        summary="理解召回、重排、上下文构造与回答质量之间的关系。",
        weakness_tags=["概念边界", "系统设计", "容易混淆"],
        candidate_modes=["guided-qa", "contrast-drill", "scenario-sim"],
        difficulty=4,
    ),
    "unit-rag-explain": LearningUnit(
        id="unit-rag-explain",
        title="如何把 RAG 方案解释给产品和评审",
        summary="把技术设计转换成业务可理解的取舍说明和实施路径。",
        weakness_tags=["表达迁移", "真实应用", "答辩压力"],
        candidate_modes=["scenario-sim", "guided-qa", "contrast-drill"],
        difficulty=4,
    ),
}

_UNIT_ENRICHMENT: dict[str, dict[str, Any]] = {
    "unit-rag-retrieval": {
        "prerequisites": [
            "向量相似度检索的基本原理",
            "embedding 模型的输入输出",
            "信息检索中 precision / recall 的含义",
        ],
        "commonMisconceptions": [
            "「召回率高 = 回答质量高」：召回命中的文档可能语义相关但逻辑不对口",
            "「重排只是对召回结果重新排序」：重排需要引入任务级信号，不只是换个排序函数",
            "「向量召回够好就不需要重排」：即使 recall@10 很高，top-k 的排列顺序仍显著影响生成质量",
        ],
        "coreQuestions": [
            "在什么条件下，只做向量召回就够了？给出一个具体场景。",
            "重排层引入了什么额外信号，是向量召回本身无法提供的？",
            "如果召回 recall@10=95% 但回答准确率只有 60%，最可能的瓶颈在哪里？",
        ],
        "relatedUnits": ["unit-rag-core", "unit-rag-explain"],
    },
    "unit-rag-core": {
        "prerequisites": [
            "大语言模型的上下文窗口机制",
            "prompt 构造对生成质量的影响",
            "检索增强生成的基本流程",
        ],
        "commonMisconceptions": [
            "「RAG = 检索 + 拼接到 prompt」：上下文构造本身是一个需要设计的环节，不是简单拼接",
            "「检索到的内容越多越好」：上下文窗口存在饱和效应，过多内容反而降低生成质量",
            "「RAG 只解决知识更新问题」：RAG 同时解决知识覆盖、幻觉控制和可溯源性",
        ],
        "coreQuestions": [
            "RAG 系统中「上下文构造」阶段的核心决策是什么？",
            "为什么说「检索到 ≠ 用好」？用一个项目例子说明。",
            "如果去掉 RAG 的重排环节，对最终回答质量的影响路径是什么？",
        ],
        "relatedUnits": ["unit-rag-retrieval", "unit-rag-explain"],
    },
    "unit-rag-explain": {
        "prerequisites": [
            "RAG 系统的基本技术架构",
            "产品需求和技术方案之间的映射关系",
            "技术评审中的常见关注点",
        ],
        "commonMisconceptions": [
            "「技术方案只需要讲实现细节」：评审关注的是取舍逻辑，不是实现步骤",
            "「用技术术语更专业」：对非技术受众，业务指标比技术概念更有说服力",
            "「方案好就不需要准备质疑回答」：评审的核心是压力测试取舍判断，不是验证正确性",
        ],
        "coreQuestions": [
            "如何用一句话向产品经理解释为什么需要重排层？",
            "评审中被问「为什么不用更简单的关键词检索」，你会怎么回答？",
            "如何量化 RAG 方案的 ROI，让非技术决策者理解投入产出？",
        ],
        "relatedUnits": ["unit-rag-core", "unit-rag-retrieval"],
    },
}


def retrieve_source_assets(asset_ids: list[str]) -> list[SourceAsset]:
    assets: list[SourceAsset] = []

    for asset_id in asset_ids:
        asset = _ASSET_CATALOG.get(asset_id)
        if asset is None:
            assets.append(
                SourceAsset(
                    id=asset_id,
                    title=f"Imported asset {asset_id}",
                    kind="note",
                    topic="未分类材料",
                )
            )
        else:
            assets.append(asset)

    return assets


def retrieve_learning_unit(unit_id: str | None, topic: str) -> LearningUnit:
    if unit_id and unit_id in _UNIT_CATALOG:
        return _UNIT_CATALOG[unit_id]

    lowered = topic.lower()
    if "重排" in topic or "rerank" in lowered:
        return _UNIT_CATALOG["unit-rag-retrieval"]
    if "答辩" in topic or "评审" in topic:
        return _UNIT_CATALOG["unit-rag-explain"]

    return _UNIT_CATALOG["unit-rag-core"]


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
            payload=_build_asset_summary_payload(request.source_asset_ids),
        )

    if tool_intent == "thread-memory":
        return ToolResult(
            kind=tool_intent,
            payload=_build_thread_memory_payload(request.thread_id, request.target_unit_id, repository),
        )

    if tool_intent == "review-context":
        return ToolResult(
            kind=tool_intent,
            payload=_build_review_context_payload(
                request.thread_id,
                request.target_unit_id or "rag-core-unit",
                repository,
            ),
        )

    unit = retrieve_learning_unit(request.target_unit_id, request.topic)
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


def _build_asset_summary_payload(asset_ids: list[str]) -> dict[str, Any]:
    assets = retrieve_source_assets(asset_ids)
    asset_details: list[dict[str, Any]] = []
    all_concepts: list[str] = []

    for asset in assets:
        enrichment = _ASSET_ENRICHMENT.get(asset.id, {})
        concepts = enrichment.get("keyConcepts", [])
        all_concepts.extend(concepts)
        asset_details.append({
            "id": asset.id,
            "title": asset.title,
            "kind": asset.kind,
            "topic": asset.topic,
            "contentExcerpt": enrichment.get(
                "contentExcerpt",
                f"材料「{asset.title}」的内容摘要暂未提取，后续接入解析后自动补充。",
            ),
            "keyConcepts": concepts,
            "relevanceHint": enrichment.get(
                "relevanceHint",
                "该材料与当前学习主题的关联度待评估。",
            ),
        })

    unique_concepts = list(dict.fromkeys(all_concepts))
    return {
        "assetIds": [asset.id for asset in assets],
        "assets": asset_details,
        "keyConcepts": unique_concepts,
        "summary": (
            f"已读取 {len(assets)} 份材料，"
            f"提取到 {len(unique_concepts)} 个核心概念。"
            "建议围绕这些概念验证学习者的理解深度和迁移能力。"
        ),
    }


def build_asset_summary_payload(asset_ids: list[str]) -> dict[str, Any]:
    return _build_asset_summary_payload(asset_ids)


def _build_unit_detail_payload(unit: LearningUnit) -> dict[str, Any]:
    enrichment = _UNIT_ENRICHMENT.get(unit.id, {})
    return {
        "focusUnitId": unit.id,
        "title": unit.title,
        "summary": unit.summary,
        "candidateModes": unit.candidate_modes,
        "weaknessTags": unit.weakness_tags,
        "difficulty": unit.difficulty,
        "prerequisites": enrichment.get("prerequisites", []),
        "commonMisconceptions": enrichment.get("commonMisconceptions", []),
        "coreQuestions": enrichment.get("coreQuestions", []),
        "relatedUnits": enrichment.get("relatedUnits", []),
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
