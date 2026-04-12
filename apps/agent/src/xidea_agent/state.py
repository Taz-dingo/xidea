from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class LearningMode(str, Enum):
    """Agent 可选的训练模式，与前端 LearningMode 一一对应。"""

    SOCRATIC = "socratic"
    GUIDED_QA = "guided-qa"
    CONTRAST_DRILL = "contrast-drill"
    IMAGE_RECALL = "image-recall"
    AUDIO_RECALL = "audio-recall"
    SCENARIO_SIM = "scenario-sim"


class TrainingAction(str, Enum):
    """Agent 可推荐的高层训练动作。

    决策规则参考 scientific-review-integration.md：
    - 没懂 → TEACH
    - 易混淆 → CLARIFY
    - 基本理解但不稳 → PRACTICE
    - 会了但快忘 → REVIEW
    - 需要迁移验证 → APPLY
    """

    TEACH = "teach"
    CLARIFY = "clarify"
    PRACTICE = "practice"
    REVIEW = "review"
    APPLY = "apply"


# ---------------------------------------------------------------------------
# Domain models
# ---------------------------------------------------------------------------


class SourceAsset(BaseModel):
    """用户导入的原始学习材料。"""

    id: str
    title: str
    kind: Literal["pdf", "web", "note", "audio", "video", "image"]
    topic: str


class LearningUnit(BaseModel):
    """从原始材料中提炼出的最小可学习单元。"""

    id: str
    title: str
    summary: str
    weakness_tags: list[str] = Field(default_factory=list)
    candidate_modes: list[LearningMode] = Field(default_factory=list)
    difficulty: Literal[1, 2, 3, 4, 5] = 3


class LearnerState(BaseModel):
    """学习者当前状态，同时包含理解状态和记忆状态（双轨模型）。

    理解状态: understanding_level / confusion / weak_signals
    记忆状态: memory_strength / last_reviewed_at / next_review_at
    """

    mastery: int = Field(ge=0, le=100, description="综合掌握度")
    understanding_level: int = Field(ge=0, le=100, description="理解深度")
    memory_strength: int = Field(ge=0, le=100, description="记忆强度")
    confusion: int = Field(ge=0, le=100, description="混淆风险")
    preferred_modes: list[LearningMode] = Field(default_factory=list)
    weak_signals: list[str] = Field(default_factory=list)
    last_reviewed_at: str | None = None
    next_review_at: str | None = None
    recommended_action: TrainingAction = TrainingAction.TEACH


class StudyPlanStep(BaseModel):
    """学习计划中的单个步骤。"""

    id: str
    title: str
    mode: LearningMode
    reason: str
    outcome: str


class StudyPlan(BaseModel):
    """Agent 生成的动态学习路径。"""

    headline: str
    summary: str
    steps: list[StudyPlanStep] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Graph state — LangGraph 编排过程中的完整状态容器
# ---------------------------------------------------------------------------


class GraphState(BaseModel):
    """LangGraph 状态容器，承载从输入到输出的完整编排流程。

    流程: ingest_input → diagnose_learner → select_training_mode
          → generate_plan → write_back_memory
    """

    # 输入层
    source: SourceAsset | None = None
    unit: LearningUnit | None = None
    entry_mode: Literal["qa", "material-import"] = "qa"
    topic: str = ""

    # 诊断层
    learner_state: LearnerState | None = None

    # 编排输出层
    plan: StudyPlan | None = None

    # 过程追踪
    rationale: list[str] = Field(default_factory=list)
