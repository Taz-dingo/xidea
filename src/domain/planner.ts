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

export function buildStudyPlan(
  unit: LearningUnit,
  learner: LearnerState,
): StudyPlan {
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

  if (learner.mastery <= 40) {
    steps.push(
      createStep(
        "guided",
        "guided-qa",
        "当前理解深度不够，先由导师引导建模，不直接上强测试。",
        "补足核心框架，形成可被提取的解释能力。",
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
        "使用对当前用户更有效的练习形式，提高完成率和记忆保持。",
        "把内容转成更贴近个人习惯的训练体验。",
      ),
    );
  }

  if (steps.length < 3) {
    steps.push(
      createStep(
        "scenario",
        "scenario-sim",
        "用真实场景做迁移测试，确认是否能在应用层面使用知识。",
        "从会背升级到会用，形成闭环。",
      ),
    );
  }

  return {
    headline: `围绕「${unit.title}」生成的动态学习路径`,
    summary: `系统根据掌握度 ${learner.mastery}% 和混淆风险 ${learner.confusion}%，优先安排更适合当前状态的训练顺序。`,
    steps,
  };
}

