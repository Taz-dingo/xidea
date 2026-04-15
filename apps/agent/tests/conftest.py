"""Shared test fixtures for the xidea-agent test suite."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from xidea_agent.llm import LLMClient


def _mock_openai_response(content: str):
    message = SimpleNamespace(content=content)
    choice = SimpleNamespace(message=message)
    return SimpleNamespace(choices=[choice])


def _default_side_effect():
    """Return a side_effect list that satisfies the full LLM-first pipeline."""
    bundled = json.dumps({
        "signals": [
            {"kind": "concept-confusion", "score": 0.85, "confidence": 0.88,
             "summary": "用户对 retrieval 和 reranking 概念边界混淆"},
        ],
        "diagnosis": {
            "recommended_action": "clarify",
            "reason": "用户明确表达概念边界混淆",
            "confidence": 0.88,
            "primary_issue": "concept-confusion",
            "needs_tool": False,
        },
    })
    plan = json.dumps({
        "headline": "围绕概念辨析的学习路径",
        "summary": "先辨析边界再追问",
        "selected_mode": "contrast-drill",
        "expected_outcome": "能清晰说出两者的职责差异",
        "steps": [
            {"id": "contrast-boundary", "title": "对比辨析训练",
             "mode": "contrast-drill",
             "reason": "先比较相近概念的边界", "outcome": "能说清各自解决什么问题"},
            {"id": "guided-check", "title": "1v1 导师问答",
             "mode": "guided-qa",
             "reason": "追问确认理解稳定", "outcome": "确认不是表面上听懂"},
        ],
    })
    reply = "这两个概念的关键区别在于：retrieval 负责从大量文档中召回候选集，reranking 则在候选集上做精排。"

    return [
        _mock_openai_response(bundled),
        _mock_openai_response(reply),
        _mock_openai_response(plan),
    ]


def build_mock_llm(side_effect=None) -> LLMClient:
    """Build a mock LLMClient for tests that call the full agent pipeline."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = side_effect or _default_side_effect()
    return LLMClient(client=mock_client, model="gpt-4o-mini")


def build_mock_llm_for_review() -> LLMClient:
    """Build a mock LLMClient that recommends 'review' action."""
    bundled = json.dumps({
        "signals": [
            {"kind": "memory-weakness", "score": 0.85, "confidence": 0.88,
             "summary": "用户记忆强度偏低，需要复习巩固"},
        ],
        "diagnosis": {
            "recommended_action": "review",
            "reason": "记忆强度不足，需要复习",
            "confidence": 0.85,
            "primary_issue": "weak-recall",
            "needs_tool": False,
        },
    })
    plan = json.dumps({
        "headline": "围绕复习巩固的学习路径",
        "summary": "先回忆再辨析",
        "selected_mode": "guided-qa",
        "expected_outcome": "确认记忆断点",
        "steps": [
            {"id": "recall-core", "title": "1v1 导师问答",
             "mode": "guided-qa",
             "reason": "先做主动回忆", "outcome": "确认记忆断点"},
        ],
    })
    reply = "来做一次主动回忆吧，看看哪些概念已经掉出工作记忆了。"

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(bundled),
        _mock_openai_response(reply),
        _mock_openai_response(plan),
    ]
    return LLMClient(client=mock_client, model="gpt-4o-mini")


def build_mock_llm_for_teach() -> LLMClient:
    """Build a mock LLMClient that recommends 'teach' action."""
    bundled = json.dumps({
        "signals": [
            {"kind": "concept-gap", "score": 0.82, "confidence": 0.85,
             "summary": "用户理解框架不稳"},
        ],
        "diagnosis": {
            "recommended_action": "teach",
            "reason": "用户理解框架不稳，先补建模",
            "confidence": 0.85,
            "primary_issue": "insufficient-understanding",
            "needs_tool": False,
        },
    })
    plan = json.dumps({
        "headline": "围绕理解框架的教学路径",
        "summary": "先建模再验证",
        "selected_mode": "guided-qa",
        "expected_outcome": "能用自己的话复述核心逻辑",
        "steps": [
            {"id": "guided-model", "title": "1v1 导师问答",
             "mode": "guided-qa",
             "reason": "先补关键设计框架", "outcome": "能复述核心判断逻辑"},
        ],
    })
    reply = "我们先来建立一个理解框架。"

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(bundled),
        _mock_openai_response(reply),
        _mock_openai_response(plan),
    ]
    return LLMClient(client=mock_client, model="gpt-4o-mini")


def build_mock_llm_for_material_import() -> LLMClient:
    """Build a mock LLMClient for material-import entry mode."""
    bundled = json.dumps({
        "signals": [
            {"kind": "project-relevance", "score": 0.9, "confidence": 0.9,
             "summary": "材料导入场景"},
        ],
        "diagnosis": {
            "recommended_action": "teach",
            "reason": "材料导入，先补上下文",
            "confidence": 0.85,
            "primary_issue": "missing-context",
            "needs_tool": True,
        },
    })
    plan = json.dumps({
        "headline": "材料导入学习路径",
        "summary": "先处理材料再教学",
        "selected_mode": "guided-qa",
        "expected_outcome": "理解材料核心",
        "steps": [
            {"id": "guided-material", "title": "1v1 导师问答",
             "mode": "guided-qa",
             "reason": "基于材料教学", "outcome": "理解材料核心"},
        ],
    })
    reply = "我先看看你导入的材料，然后基于材料内容安排学习。"

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(bundled),
        _mock_openai_response(reply),
        _mock_openai_response(plan),
    ]
    return LLMClient(client=mock_client, model="gpt-4o-mini")


@pytest.fixture
def mock_llm() -> LLMClient:
    return build_mock_llm()
