import type {
  LearnerState,
  LearningMode,
  LearningUnit,
  StudyPlan,
  StudyPlanDecision,
  StudyPlanStep,
  WritebackPreview,
} from "./types";

export const MODE_LABELS: Record<LearningMode, string> = {
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

function pushUniqueStep(steps: StudyPlanStep[], step: StudyPlanStep): void {
  if (steps.some((item) => item.mode === step.mode)) {
    return;
  }

  steps.push(step);
}

function buildDecision(steps: ReadonlyArray<StudyPlanStep>): StudyPlanDecision {
  const primaryStep = steps[0];

  if (primaryStep === undefined) {
    return {
      title: "等待主动作",
      reason: "当前还没有可解释的训练动作。",
      objective: "先补全状态后再决定下一步。",
    };
  }

  return {
    title: primaryStep.title,
    reason: primaryStep.reason,
    objective: primaryStep.outcome,
  };
}

function buildWriteback(unit: LearningUnit, learner: LearnerState): ReadonlyArray<WritebackPreview> {
  const previews: WritebackPreview[] = [
    {
      id: "thread-memory",
      target: "Theme Thread",
      change: `记录这次围绕「${unit.title}」的学习动作和后续待验证问题。`,
    },
  ];

  if (learner.confusion >= 70) {
    previews.push({
      id: "confusion-patch",
      target: "LearnerState.confusion",
      change: "把容易混淆的关键概念边界写回线程，作为下一轮辨析依据。",
    });
  }

  if (learner.understandingLevel <= 55 || learner.recommendedAction === "teach") {
    previews.push({
      id: "understanding-patch",
      target: "LearnerState.understandingLevel",
      change: "根据导师引导后的回答质量，更新用户是否真正建立了设计框架。",
    });
  } else {
    previews.push({
      id: "application-patch",
      target: "LearnerState.mastery",
      change: "根据情境模拟里的方案解释质量，更新是否具备主题场景落地能力。",
    });
  }

  previews.push({
    id: "review-patch",
    target: "Review Engine",
    change: "根据本轮表现决定是否安排下一次关键概念复盘。",
  });

  return previews;
}

export function buildStudyPlan(unit: LearningUnit, learner: LearnerState): StudyPlan {
  const steps: StudyPlanStep[] = [];

  if (learner.confusion >= 70) {
    pushUniqueStep(
      steps,
      createStep(
        "contrast",
        "contrast-drill",
        "用户容易混淆相关概念，先用对比把边界拉清楚。",
        "建立清晰区分标准，避免学会一个又混掉一个。",
      ),
    );
  }

  if (learner.understandingLevel <= 45 || learner.recommendedAction === "teach") {
    pushUniqueStep(
      steps,
      createStep(
        "guided",
        "guided-qa",
        "系统判断当前主要问题是没真正理解，先由导师引导建模。",
        "先补理解框架，再决定是否进入练习或复习。",
      ),
    );
  } else {
    pushUniqueStep(
      steps,
      createStep(
        "scenario",
        "scenario-sim",
        "当前更值得验证的是能否把当前判断迁移到真实任务场景。",
        "从概念理解升级到能解释具体设计取舍。",
      ),
    );
  }

  const preferredCandidate = learner.preferredModes.find((mode) =>
    unit.candidateModes.includes(mode),
  );

  if (preferredCandidate !== undefined) {
    pushUniqueStep(
      steps,
      createStep(
        "preferred",
        preferredCandidate,
        "使用对当前用户更有效的训练形式，提高完成率和保持率。",
        "把训练动作和个人状态对齐，而不是统一安排。",
      ),
    );
  }

  if (steps.length < 3) {
    pushUniqueStep(
      steps,
      createStep(
        "fallback-scenario",
        "scenario-sim",
        "最后用真实场景做迁移测试，确认知识能否被应用。",
        "从会答题升级到会用。",
      ),
    );
  }

  return {
    headline: `围绕「${unit.title}」生成的动态学习路径`,
    summary: `系统综合理解水平 ${learner.understandingLevel}%、记忆强度 ${learner.memoryStrength}% 和混淆风险 ${learner.confusion}%，决定当前先澄清边界、补理解，还是进入主题情境验证。`,
    decision: buildDecision(steps),
    steps,
    writeback: buildWriteback(unit, learner),
  };
}
