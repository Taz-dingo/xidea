"""End-to-end tests using a real LLM API.

Requires a configured LLM API key and network access.
Skipped automatically when no API key is configured.

Run with:
    uv run pytest tests/test_real_llm.py -v -m real_llm
"""

from __future__ import annotations

import os

import pytest

from xidea_agent.llm import build_llm_client, LLMClient
from xidea_agent.runtime import run_agent_v0, iter_agent_v0_events
from xidea_agent.state import AgentRequest, Message

pytestmark = pytest.mark.real_llm


def _load_env_once() -> None:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def _has_api_key() -> bool:
    _load_env_once()
    for key in ("XIDEA_LLM_API_KEY", "ZHIPU_API_KEY", "ZAI_API_KEY", "OPENAI_API_KEY"):
        if os.getenv(key, "").strip():
            return True
    return False


@pytest.fixture(scope="module")
def llm() -> LLMClient:
    if not _has_api_key():
        pytest.skip("No LLM API key configured")
    return build_llm_client()


class TestRealLLMDiagnoseAndCompose:
    """Test the full agent pipeline with a real LLM."""

    def test_basic_chat_question(self, llm: LLMClient):
        """Basic chat question should produce diagnosis, plan, and response."""
        request = AgentRequest(
            project_id="test-real",
            thread_id="test-thread-1",
            entry_mode="chat-question",
            topic="RAG 系统设计",
            messages=[
                Message(role="user", content="retrieval 和 reranking 有什么区别？"),
            ],
        )
        result = run_agent_v0(request, llm=llm)

        assert result.graph_state.diagnosis is not None
        assert result.graph_state.plan is not None
        assert result.graph_state.assistant_message is not None
        assert result.graph_state.state_patch is not None
        assert len(result.graph_state.assistant_message) > 20

        diag = result.graph_state.diagnosis
        assert diag.recommended_action in ("teach", "clarify", "practice", "review", "apply")
        assert diag.confidence > 0
        assert diag.primary_issue is not None

        plan = result.graph_state.plan
        assert len(plan.steps) >= 1
        assert plan.selected_mode

    def test_confusion_scenario(self, llm: LLMClient):
        """Scenario with obvious confusion should produce a relevant diagnosis."""
        request = AgentRequest(
            project_id="test-real",
            thread_id="test-thread-2",
            entry_mode="chat-question",
            topic="RAG 系统设计",
            messages=[
                Message(
                    role="user",
                    content="我搞不清楚 embedding 和 reranking 是不是同一回事，"
                    "它们的目的好像差不多？还有 vector search 和 keyword search 我也分不清。",
                ),
            ],
        )
        result = run_agent_v0(request, llm=llm)

        assert result.graph_state.diagnosis is not None
        diag = result.graph_state.diagnosis
        assert diag.recommended_action in ("clarify", "teach")
        assert result.graph_state.assistant_message
        assert len(result.graph_state.assistant_message) > 50

    def test_material_import(self, llm: LLMClient):
        """material-import entry mode should produce tool_result."""
        request = AgentRequest(
            project_id="test-real",
            thread_id="test-thread-3",
            entry_mode="material-import",
            topic="RAG 系统设计",
            messages=[
                Message(role="user", content="帮我分析一下这份材料"),
            ],
            source_asset_ids=["asset-1"],
        )
        result = run_agent_v0(request, llm=llm)

        assert result.graph_state.diagnosis is not None
        assert result.graph_state.assistant_message is not None
        assert result.graph_state.tool_result is not None


class TestRealLLMStreaming:
    """Test SSE streaming with a real LLM."""

    def test_streaming_yields_all_event_types(self, llm: LLMClient):
        """Streaming should yield diagnosis, text-delta, plan, state-patch, and done."""
        request = AgentRequest(
            project_id="test-real",
            thread_id="test-thread-stream-1",
            entry_mode="chat-question",
            topic="RAG 系统设计",
            messages=[
                Message(role="user", content="什么是向量检索？"),
            ],
        )
        events = list(iter_agent_v0_events(request, llm=llm))

        event_types = [e.event for e in events]
        assert "diagnosis" in event_types
        assert "text-delta" in event_types
        assert "plan" in event_types
        assert "state-patch" in event_types
        assert "done" in event_types

        text_deltas = [e for e in events if e.event == "text-delta"]
        assert len(text_deltas) >= 1

        done_events = [e for e in events if e.event == "done"]
        assert len(done_events) == 1
        assert len(done_events[0].final_message) > 20
