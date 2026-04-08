import type { LearnerState, LearningUnit, SourceAsset } from "../domain/types";

export const sourceAssets: ReadonlyArray<SourceAsset> = [
  {
    id: "asset-1",
    title: "RAG 系统设计速览.pdf",
    kind: "pdf",
    topic: "AI 应用开发",
  },
  {
    id: "asset-2",
    title: "产品经理的用户访谈网页收藏",
    kind: "web",
    topic: "用户研究",
  },
  {
    id: "asset-3",
    title: "心电图判读入门笔记",
    kind: "note",
    topic: "医学学习",
  },
];

export const learningUnits: ReadonlyArray<LearningUnit> = [
  {
    id: "unit-1",
    title: "RAG 为什么不是简单检索 + 拼接",
    summary: "理解召回、重排、上下文构造与回答质量之间的关系。",
    weaknessTags: ["概念边界", "系统设计", "容易混淆"],
    candidateModes: ["guided-qa", "contrast-drill", "scenario-sim"],
    difficulty: 4,
  },
  {
    id: "unit-2",
    title: "用户访谈中的开放式追问",
    summary: "识别封闭式问题，并把问题重写成能挖出真实动机的提问。",
    weaknessTags: ["表达迁移", "场景应用"],
    candidateModes: ["socratic", "scenario-sim", "audio-recall"],
    difficulty: 3,
  },
  {
    id: "unit-3",
    title: "心电图里房颤与房扑的区别",
    summary: "用节律、波形与临床判断线索建立稳定区分。",
    weaknessTags: ["视觉辨识", "高混淆"],
    candidateModes: ["contrast-drill", "image-recall", "guided-qa"],
    difficulty: 5,
  },
];

export const learnerProfiles: ReadonlyArray<{
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly state: LearnerState;
}> = [
  {
    id: "profile-1",
    name: "新手 PM",
    role: "能复述概念，但迁移到真实访谈时容易卡住",
    state: {
      mastery: 38,
      understandingLevel: 42,
      memoryStrength: 33,
      confusion: 52,
      preferredModes: ["guided-qa", "scenario-sim"],
      weakSignals: ["不会追问", "容易问成确认式问题"],
      lastReviewedAt: "2026-04-05",
      nextReviewAt: "2026-04-09",
      recommendedAction: "teach",
    },
  },
  {
    id: "profile-2",
    name: "AI 工程师",
    role: "理解过基础知识，但系统设计边界模糊",
    state: {
      mastery: 64,
      understandingLevel: 58,
      memoryStrength: 61,
      confusion: 76,
      preferredModes: ["contrast-drill", "socratic"],
      weakSignals: ["概念混淆", "不能解释为何这样设计"],
      lastReviewedAt: "2026-04-07",
      nextReviewAt: "2026-04-10",
      recommendedAction: "clarify",
    },
  },
  {
    id: "profile-3",
    name: "医学生",
    role: "记住过图形特征，但实战识别不稳定",
    state: {
      mastery: 55,
      understandingLevel: 57,
      memoryStrength: 49,
      confusion: 81,
      preferredModes: ["image-recall", "contrast-drill"],
      weakSignals: ["视觉记忆不稳", "关键差异抓不住"],
      lastReviewedAt: "2026-04-06",
      nextReviewAt: "2026-04-08",
      recommendedAction: "review",
    },
  },
];

