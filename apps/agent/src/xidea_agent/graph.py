"""LangGraph 最小编排图。

5 个节点对应文档中的核心链路：
  ingest_input → diagnose_learner → select_training_mode → generate_plan → write_back_memory

第一版所有节点使用规则逻辑 mock 实现，不接真实模型。
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from xidea_agent.guardrails import get_violations, run_all_guardrails
from xidea_agent.state import (
    GraphState,
    LearnerState,
    LearningMode,
    LearningUnit,
    SourceAsset,
    StudyPlan,
    StudyPlanStep,
    TrainingAction,
)
from xidea_agent.tools import (
    RetrieveLearnerStateInput,
    RetrieveLearningUnitInput,
    retrieve_learner_state,
    retrieve_learning_unit,
)

MODE_LABELS: dict[LearningMode, str] = {
    LearningMode.SOCRATIC: "苏格拉底追问",
    LearningMode.GUIDED_QA: "1v1 导师问答",
    LearningMode.CONTRAST_DRILL: "对比辨析训练",
    LearningMode.IMAGE_RECALL: "看图回忆",
    LearningMode.AUDIO_RECALL: "听音作答",
    LearningMode.SCENARIO_SIM: "情境模拟",
}


# ---------------------------------------------------------------------------
# Node 1: ingest_input — 接收输入并准备学习单元
# ---------------------------------------------------------------------------


def ingest_input(state: GraphState) -> dict:
    rationale = list(state.rationale)

    if state.unit is not None:
        rationale.append(f"输入已包含学习单元「{state.unit.title}」，跳过提炼步骤")
        return {"rationale": rationale}

    if state.source is not None:
        unit = LearningUnit(
            id=f"unit-from-{state.source.id}",
            title=f"从「{state.source.title}」提炼的学习单元",
            summary=f"基于 {state.source.kind} 材料自动生成（mock）",
            weakness_tags=["待分析"],
            candidate_modes=[
                LearningMode.GUIDED_QA,
                LearningMode.CONTRAST_DRILL,
                LearningMode.SCENARIO_SIM,
            ],
            difficulty=3,
        )
        rationale.append(f"从材料「{state.source.title}」提炼出学习单元（mock）")
        return {"unit": unit, "rationale": rationale}

    unit = retrieve_learning_unit(RetrieveLearningUnitInput(unit_id="unit-1"))
    rationale.append("未提供输入，使用默认学习单元（mock fallback）")
    return {"unit": unit, "rationale": rationale}


# ---------------------------------------------------------------------------
# Node 2: diagnose_learner — 诊断学习者状态
# ---------------------------------------------------------------------------


def diagnose_learner(state: GraphState) -> dict:
    rationale = list(state.rationale)

    if state.learner_state is not None:
        rationale.append("学习者状态已存在，跳过诊断")
        return {"rationale": rationale}

    learner = retrieve_learner_state(
        RetrieveLearnerStateInput(learner_id="profile-1", unit_id=state.unit.id if state.unit else "")
    )
    rationale.append(
        f"诊断完成 — 理解:{learner.understanding_level}% "
        f"记忆:{learner.memory_strength}% 混淆:{learner.confusion}%"
    )
    return {"learner_state": learner, "rationale": rationale}


# ---------------------------------------------------------------------------
# Node 3: select_training_mode — 根据状态选择训练动作
# ---------------------------------------------------------------------------


def select_training_mode(state: GraphState) -> dict:
    rationale = list(state.rationale)
    ls = state.learner_state
    if ls is None:
        rationale.append("警告：未完成诊断就进入训练选择")
        return {"rationale": rationale}

    if ls.confusion >= 70:
        action = TrainingAction.CLARIFY
        rationale.append(f"confusion={ls.confusion} >= 70 → 优先澄清")
    elif ls.understanding_level <= 45:
        action = TrainingAction.TEACH
        rationale.append(f"understanding={ls.understanding_level} <= 45 → 先教学")
    elif ls.memory_strength <= 50:
        action = TrainingAction.REVIEW
        rationale.append(f"memory_strength={ls.memory_strength} <= 50 → 安排复习")
    elif ls.mastery >= 70:
        action = TrainingAction.APPLY
        rationale.append(f"mastery={ls.mastery} >= 70 → 迁移验证")
    else:
        action = TrainingAction.PRACTICE
        rationale.append("综合指标中等 → 安排练习")

    updated_learner = ls.model_copy(update={"recommended_action": action})
    return {"learner_state": updated_learner, "rationale": rationale}


# ---------------------------------------------------------------------------
# Node 4: generate_plan — 生成学习计划
# ---------------------------------------------------------------------------


def _create_step(step_id: str, mode: LearningMode, reason: str, outcome: str) -> StudyPlanStep:
    return StudyPlanStep(
        id=step_id,
        title=MODE_LABELS[mode],
        mode=mode,
        reason=reason,
        outcome=outcome,
    )


def generate_plan(state: GraphState) -> dict:
    rationale = list(state.rationale)
    ls = state.learner_state
    unit = state.unit

    if ls is None or unit is None:
        rationale.append("缺少诊断结果或学习单元，无法生成计划")
        return {"rationale": rationale}

    steps: list[StudyPlanStep] = []
    candidates = set(unit.candidate_modes)

    if ls.confusion >= 70 and LearningMode.CONTRAST_DRILL in candidates:
        steps.append(_create_step(
            "contrast", LearningMode.CONTRAST_DRILL,
            "用户容易混淆相关概念，先用对比把边界拉清楚。",
            "建立清晰区分标准，避免学会一个又混掉一个。",
        ))

    if ls.understanding_level <= 45 or ls.recommended_action == TrainingAction.TEACH:
        if LearningMode.GUIDED_QA in candidates:
            steps.append(_create_step(
                "guided", LearningMode.GUIDED_QA,
                "系统判断当前主要问题是没真正理解，先由导师引导建模。",
                "先补理解框架，再决定是否进入练习或复习。",
            ))
    elif ls.memory_strength <= 50 or ls.recommended_action == TrainingAction.REVIEW:
        recall_mode = (
            LearningMode.AUDIO_RECALL if LearningMode.AUDIO_RECALL in candidates
            else LearningMode.IMAGE_RECALL if LearningMode.IMAGE_RECALL in candidates
            else None
        )
        if recall_mode:
            steps.append(_create_step(
                "review", recall_mode,
                "用户已经基本理解，但记忆强度偏弱，适合进入回忆型训练。",
                "把短时掌握转成更稳定的长期记忆。",
            ))
    else:
        if LearningMode.SOCRATIC in candidates:
            steps.append(_create_step(
                "socratic", LearningMode.SOCRATIC,
                "已有一定掌握度，适合通过追问暴露真实理解缺口。",
                "把「好像懂了」转成可以稳定表达和迁移的理解。",
            ))

    preferred = next(
        (m for m in ls.preferred_modes if m in candidates and not any(s.mode == m for s in steps)),
        None,
    )
    if preferred:
        steps.append(_create_step(
            "preferred", preferred,
            "使用对当前用户更有效的训练形式，提高完成率和保持率。",
            "把训练动作和个人状态对齐，而不是统一安排。",
        ))

    used_modes = {s.mode for s in steps}
    if len(steps) < 3 and LearningMode.SCENARIO_SIM in candidates and LearningMode.SCENARIO_SIM not in used_modes:
        steps.append(_create_step(
            "scenario", LearningMode.SCENARIO_SIM,
            "最后用真实场景做迁移测试，确认知识能否被应用。",
            "从会答题升级到会用。",
        ))

    plan = StudyPlan(
        headline=f"围绕「{unit.title}」生成的动态学习路径",
        summary=(
            f"系统综合理解水平 {ls.understanding_level}% 、"
            f"记忆强度 {ls.memory_strength}% 和混淆风险 {ls.confusion}% "
            f"来安排当前学习动作。"
        ),
        steps=steps,
    )
    rationale.append(f"生成学习计划：{len(steps)} 个步骤")
    return {"plan": plan, "rationale": rationale}


# ---------------------------------------------------------------------------
# Node 5: write_back_memory — 回写状态（mock）
# ---------------------------------------------------------------------------


def write_back_memory(state: GraphState) -> dict:
    rationale = list(state.rationale)

    violations = get_violations(state)
    if violations:
        names = ", ".join(f"{v.rule_id}({v.rule_name})" for v in violations)
        rationale.append(f"Guardrail 检查未通过: {names}")
        for v in violations:
            rationale.append(f"  {v.rule_id}: {v.violation} → {v.suggestion}")
    else:
        rationale.append("Guardrail 检查全部通过")

    rationale.append("状态回写完成（mock）")
    return {"rationale": rationale}


# ---------------------------------------------------------------------------
# Graph 组装
# ---------------------------------------------------------------------------


def build_graph() -> StateGraph:
    """构建 LangGraph 编排图。"""
    graph = StateGraph(GraphState)

    graph.add_node("ingest_input", ingest_input)
    graph.add_node("diagnose_learner", diagnose_learner)
    graph.add_node("select_training_mode", select_training_mode)
    graph.add_node("generate_plan", generate_plan)
    graph.add_node("write_back_memory", write_back_memory)

    graph.add_edge(START, "ingest_input")
    graph.add_edge("ingest_input", "diagnose_learner")
    graph.add_edge("diagnose_learner", "select_training_mode")
    graph.add_edge("select_training_mode", "generate_plan")
    graph.add_edge("generate_plan", "write_back_memory")
    graph.add_edge("write_back_memory", END)

    return graph


def compile_graph():
    """构建并编译 LangGraph 编排图，返回可调用的 app。"""
    return build_graph().compile()


# ---------------------------------------------------------------------------
# 描述接口（保留向后兼容）
# ---------------------------------------------------------------------------

GRAPH_NODES = [
    "ingest_input",
    "diagnose_learner",
    "select_training_mode",
    "generate_plan",
    "write_back_memory",
]


def describe_graph() -> dict[str, object]:
    return {
        "nodes": GRAPH_NODES,
        "edges": [
            "START → ingest_input",
            "ingest_input → diagnose_learner",
            "diagnose_learner → select_training_mode",
            "select_training_mode → generate_plan",
            "generate_plan → write_back_memory",
            "write_back_memory → END",
        ],
        "state_model": GraphState.model_json_schema(),
        "note": "Minimal LangGraph with rule-based mock nodes. Ready for real model integration.",
    }
