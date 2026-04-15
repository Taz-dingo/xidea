"""Shared fixtures for xidea-agent tests."""

from __future__ import annotations

import pytest

from xidea_agent.llm import _ensure_env, get_llm, reset_llm


@pytest.fixture(autouse=True)
def _disable_llm_for_heuristic_tests(request, monkeypatch):
    """Disable LLM for all tests except those marked with @pytest.mark.llm."""
    if "llm" in (m.name for m in request.node.iter_markers()):
        _ensure_env()
        yield
    else:
        reset_llm()
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        yield
        reset_llm()


def pytest_configure(config):
    config.addinivalue_line("markers", "llm: mark test as requiring real LLM API calls")


@pytest.fixture
def llm_client():
    """Provide a configured LLM client for tests that need it."""
    _ensure_env()
    client = get_llm()
    if client is None:
        pytest.skip("LLM not configured (OPENAI_API_KEY missing in .env)")
    return client
