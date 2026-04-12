"""Agent 可调用的工具定义。

第一版只提供最小必要的读写工具，全部使用 mock 数据。
后续接入真实存储后，只需替换每个工具的内部实现，接口不变。
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from xidea_agent.state import LearnerState, LearningMode, LearningUnit, TrainingAction


# ---------------------------------------------------------------------------
# Tool 输入 / 输出 schema
# ---------------------------------------------------------------------------


class RetrieveLearnerStateInput(BaseModel):
    learner_id: str
    unit_id: str


class RetrieveLearningUnitInput(BaseModel):
    unit_id: str


class ProjectContext(BaseModel):
    """项目上下文：材料列表 + 最近训练历史。"""

    project_id: str
    source_titles: list[str] = Field(default_factory=list)
    recent_actions: list[str] = Field(default_factory=list)


class RetrieveProjectContextInput(BaseModel):
    project_id: str


class WriteBackStateInput(BaseModel):
    learner_id: str
    unit_id: str
    updated_state: LearnerState


class WriteBackResult(BaseModel):
    success: bool
    message: str


# ---------------------------------------------------------------------------
# Mock 实现
# ---------------------------------------------------------------------------

_MOCK_LEARNER_STATES: dict[str, LearnerState] = {
    "profile-1": LearnerState(
        mastery=38,
        understanding_level=42,
        memory_strength=33,
        confusion=52,
        preferred_modes=[LearningMode.GUIDED_QA, LearningMode.SCENARIO_SIM],
        weak_signals=["不会追问", "容易问成确认式问题"],
        last_reviewed_at="2026-04-05",
        next_review_at="2026-04-09",
        recommended_action=TrainingAction.TEACH,
    ),
    "profile-2": LearnerState(
        mastery=64,
        understanding_level=58,
        memory_strength=61,
        confusion=76,
        preferred_modes=[LearningMode.CONTRAST_DRILL, LearningMode.SOCRATIC],
        weak_signals=["概念混淆", "不能解释为何这样设计"],
        last_reviewed_at="2026-04-07",
        next_review_at="2026-04-10",
        recommended_action=TrainingAction.CLARIFY,
    ),
    "profile-3": LearnerState(
        mastery=55,
        understanding_level=57,
        memory_strength=49,
        confusion=81,
        preferred_modes=[LearningMode.IMAGE_RECALL, LearningMode.CONTRAST_DRILL],
        weak_signals=["视觉记忆不稳", "关键差异抓不住"],
        last_reviewed_at="2026-04-06",
        next_review_at="2026-04-08",
        recommended_action=TrainingAction.REVIEW,
    ),
}

_MOCK_UNITS: dict[str, LearningUnit] = {
    "unit-1": LearningUnit(
        id="unit-1",
        title="RAG 为什么不是简单检索 + 拼接",
        summary="理解召回、重排、上下文构造与回答质量之间的关系。",
        weakness_tags=["概念边界", "系统设计", "容易混淆"],
        candidate_modes=[
            LearningMode.GUIDED_QA,
            LearningMode.CONTRAST_DRILL,
            LearningMode.SCENARIO_SIM,
        ],
        difficulty=4,
    ),
    "unit-2": LearningUnit(
        id="unit-2",
        title="用户访谈中的开放式追问",
        summary="识别封闭式问题，并把问题重写成能挖出真实动机的提问。",
        weakness_tags=["表达迁移", "场景应用"],
        candidate_modes=[
            LearningMode.SOCRATIC,
            LearningMode.SCENARIO_SIM,
            LearningMode.AUDIO_RECALL,
        ],
        difficulty=3,
    ),
    "unit-3": LearningUnit(
        id="unit-3",
        title="心电图里房颤与房扑的区别",
        summary="用节律、波形与临床判断线索建立稳定区分。",
        weakness_tags=["视觉辨识", "高混淆"],
        candidate_modes=[
            LearningMode.CONTRAST_DRILL,
            LearningMode.IMAGE_RECALL,
            LearningMode.GUIDED_QA,
        ],
        difficulty=5,
    ),
}


def retrieve_learner_state(inp: RetrieveLearnerStateInput) -> LearnerState:
    """获取学习者当前状态（mock）。"""
    state = _MOCK_LEARNER_STATES.get(inp.learner_id)
    if state is None:
        return LearnerState(
            mastery=50,
            understanding_level=50,
            memory_strength=50,
            confusion=30,
            recommended_action=TrainingAction.TEACH,
        )
    return state


def retrieve_learning_unit(inp: RetrieveLearningUnitInput) -> LearningUnit:
    """获取学习单元详情（mock）。"""
    unit = _MOCK_UNITS.get(inp.unit_id)
    if unit is None:
        return LearningUnit(
            id=inp.unit_id,
            title="未知学习单元",
            summary="",
        )
    return unit


def retrieve_project_context(inp: RetrieveProjectContextInput) -> ProjectContext:
    """获取项目上下文（mock）。"""
    return ProjectContext(
        project_id=inp.project_id,
        source_titles=[
            "RAG 系统设计速览.pdf",
            "产品经理的用户访谈网页收藏",
            "心电图判读入门笔记",
        ],
        recent_actions=["guided-qa on unit-1", "contrast-drill on unit-3"],
    )


def write_back_state(inp: WriteBackStateInput) -> WriteBackResult:
    """训练结束后回写学习者状态（mock：只返回成功）。"""
    _MOCK_LEARNER_STATES[inp.learner_id] = inp.updated_state
    return WriteBackResult(success=True, message="state updated (mock)")


# ---------------------------------------------------------------------------
# Tool 注册表 — 供 graph 节点查找可用工具
# ---------------------------------------------------------------------------

TOOL_REGISTRY: dict[str, dict[str, object]] = {
    "retrieve_learner_state": {
        "fn": retrieve_learner_state,
        "input_schema": RetrieveLearnerStateInput.model_json_schema(),
        "output_schema": LearnerState.model_json_schema(),
        "description": "获取学习者当前状态",
    },
    "retrieve_learning_unit": {
        "fn": retrieve_learning_unit,
        "input_schema": RetrieveLearningUnitInput.model_json_schema(),
        "output_schema": LearningUnit.model_json_schema(),
        "description": "获取学习单元详情",
    },
    "retrieve_project_context": {
        "fn": retrieve_project_context,
        "input_schema": RetrieveProjectContextInput.model_json_schema(),
        "output_schema": ProjectContext.model_json_schema(),
        "description": "获取项目上下文（材料列表、历史训练记录）",
    },
    "write_back_state": {
        "fn": write_back_state,
        "input_schema": WriteBackStateInput.model_json_schema(),
        "output_schema": WriteBackResult.model_json_schema(),
        "description": "训练结束后回写学习者状态",
    },
}
