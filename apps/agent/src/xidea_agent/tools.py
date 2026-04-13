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
            payload=_build_thread_memory_payload(request.thread_id, repository),
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
        payload={
            "focusUnitId": unit.id,
            "title": unit.title,
            "summary": unit.summary,
            "candidateModes": unit.candidate_modes,
            "weaknessTags": unit.weakness_tags,
        },
    )


def describe_tool_registry() -> dict[str, dict[str, Any]]:
    return {
        "asset-summary": {
            "description": "Summarize imported source assets for the current turn.",
            "returns": ["assetIds", "assetTitles", "summary"],
        },
        "unit-detail": {
            "description": "Return structured detail for the current learning unit.",
            "returns": ["focusUnitId", "title", "summary", "candidateModes"],
        },
        "thread-memory": {
            "description": "Return recent thread messages to preserve multi-turn continuity.",
            "returns": ["threadId", "recentMessages", "summary"],
        },
        "review-context": {
            "description": "Return latest review scheduling context for the current unit.",
            "returns": ["focusUnitId", "dueUnitIds", "scheduledAt", "summary"],
        },
    }


def _build_asset_summary_payload(asset_ids: list[str]) -> dict[str, Any]:
    assets = retrieve_source_assets(asset_ids)
    return {
        "assetIds": [asset.id for asset in assets],
        "assetTitles": [asset.title for asset in assets],
        "summary": "需要先读取导入材料，提取与当前问题最相关的项目背景和概念片段。",
    }


def _build_thread_memory_payload(
    thread_id: str, repository: SQLiteRepository | None
) -> dict[str, Any]:
    if repository is None:
        return {
            "threadId": thread_id,
            "recentMessages": [],
            "summary": "当前没有持久化 thread memory，先按本轮消息继续诊断。",
        }

    messages = repository.list_recent_messages(thread_id, limit=5)
    return {
        "threadId": thread_id,
        "recentMessages": [message.model_dump() for message in messages],
        "summary": "已补充最近几轮 thread message，供当前轮保持连续教学。",
    }


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
            "summary": "当前没有持久化 review state，先按本轮记忆风险安排复盘。",
        }

    review_state = repository.get_review_state(thread_id, unit_id)
    if review_state is None:
        return {
            "focusUnitId": unit_id,
            "dueUnitIds": [unit_id],
            "scheduledAt": None,
            "summary": "当前 unit 暂无既有 review 记录，本轮将作为新的复盘依据。",
        }

    return {
        "focusUnitId": unit_id,
        "dueUnitIds": review_state.due_unit_ids,
        "scheduledAt": review_state.scheduled_at,
        "summary": review_state.review_reason or "已读取最近一次 review 调度信息。",
    }
