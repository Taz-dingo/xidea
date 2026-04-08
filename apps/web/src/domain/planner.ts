import type {
  LearnerState,
  LearningMode,
  LearningUnit,
  StudyPlan,
  StudyPlanStep,
} from "./types";

const MODE_LABELS: Record<LearningMode, string> = {
  socratic: "苏格拉底追问",
  "guided-qa": "1v1 导师问答",
  "contrast-drill": "对比辨析训练",
  "image-recall": "看图回忆",
  "audio-recall": "听音作答",
  "scenario-sim": "情境模拟",
};

function createStep(
  id: string,
  mode: LearningMode,
  reason: string,
  outcome: string,
): StudyPlanStep {
  return {
    id,
    mode,
    reason,
    outcome,
    title: MODE_LABELS[mode],
  };
}

export function buildStudyPlan(unit: LearningUnit, learner: LearnerState): StudyPlan {
  const steps: StudyPlanStep[] = [];

  if (learner.confusion >= 70) {
    steps.push(
      createStep(
        "contrast",
        "contrast-drill",
        "用户容易混淆相关概念，先用对比把边界拉清楚。",
        "建立清晰区分标准，避免学会一个又混掉一个。",
      ),
    );
  }

  if (learner.understandingLevel <= 45 || learner.recommendedAction === "teach") {
    steps.push(
      createStep(
        "guided",
        "guided-qa",
        "系统判断当前主要问题是没真正理解，先由导师引导建模。",
        "先补理解框架，再决定是否进入练习或复习。",
      ),
    );
  } else if (learner.memoryStrength <= 50 || learner.recommendedAction === "review") {
    steps.push(
      createStep(
        "review",
        "audio-recall",
        "用户已经基本理解，但记忆强度偏弱，适合进入回忆型训练。",
        "把短时掌握转成更稳定的长期记忆。",
      ),
    );
  } else {
    steps.push(
      createStep(
        "socratic",
        "socratic",
        "已有一定掌握度，适合通过追问暴露真实理解缺口。",
        "把“好像懂了”转成可以稳定表达和迁移的理解。",
      ),
    );
  }

  const preferredCandidate = learner.preferredModes.find((mode) =>
    unit.candidateModes.includes(mode),
  );

  if (preferredCandidate !== undefined) {
    steps.push(
      createStep(
        "preferred",
        preferredCandidate,
        "使用对当前用户更有效的训练形式，提高完成率和保持率。",
        "把训练动作和个人状态对齐，而不是统一安排。",
      ),
    );
  }

  if (steps.length < 3) {
    steps.push(
      createStep(
        "scenario",
        "scenario-sim",
        "最后用真实场景做迁移测试，确认知识能否被应用。",
        "从会答题升级到会用。",
      ),
    );
  }

  return {
    headline: `围绕「${unit.title}」生成的动态学习路径`,
    summary: `系统综合理解水平 ${learner.understandingLevel}% 、记忆强度 ${learner.memoryStrength}% 和混淆风险 ${learner.confusion}% 来安排当前学习动作。`,
    steps,
  };
}

