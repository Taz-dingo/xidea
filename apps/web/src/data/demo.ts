import type {
  LearnerProfile,
  LearningUnit,
  ProjectContext,
  SourceAsset,
} from "../domain/types";

export const projectContext: ProjectContext = {
  name: "企业知识库问答助手",
  goal: "在现有 AI 应用里补齐 RAG 方案，并能解释为什么这样设计。",
  currentThread: "当前线程聚焦：为什么不能把检索结果直接拼给模型，以及何时需要重排。",
  successSignal: "用户能把召回、重排、上下文构造和回答质量的关系讲清楚，并映射到项目设计。",
  orchestrationWhy: "这不是一次性问答问题，而是围绕真实项目持续学习的问题，需要系统根据状态切换澄清、讲解和应用动作。",
};

export const sourceAssets: ReadonlyArray<SourceAsset> = [
  {
    id: "asset-1",
    title: "RAG 系统设计评审记录.pdf",
    kind: "pdf",
    topic: "当前项目方案",
  },
  {
    id: "asset-2",
    title: "检索召回与重排对比笔记",
    kind: "note",
    topic: "概念边界",
  },
  {
    id: "asset-3",
    title: "线上 bad case 复盘网页",
    kind: "web",
    topic: "真实项目反馈",
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
    title: "什么时候需要重排，而不是只做向量召回",
    summary: "理解召回命中和最终回答质量之间的断层，以及重排的作用。",
    weaknessTags: ["判断标准", "方案取舍", "容易误配"],
    candidateModes: ["contrast-drill", "guided-qa", "scenario-sim"],
    difficulty: 3,
  },
  {
    id: "unit-3",
    title: "如何把 RAG 方案解释给产品和评审",
    summary: "把技术设计转换成业务可理解的取舍说明和实施路径。",
    weaknessTags: ["表达迁移", "真实应用", "答辩压力"],
    candidateModes: ["scenario-sim", "guided-qa", "contrast-drill"],
    difficulty: 4,
  },
];

export const learnerProfiles: ReadonlyArray<LearnerProfile> = [
  {
    id: "profile-1",
    name: "刚接手项目的工程师",
    role: "看过材料，但还没形成稳定的 RAG 设计框架",
    stateSource: "来源：读过方案草稿、问过几轮概念问题，但还不能解释为什么这样设计。",
    diagnosisSignals: [
      {
        id: "p1-s1",
        label: "材料理解",
        observation: "能复述“检索 + 生成”的基本流程。",
        implication: "说明接触过概念，但理解仍停留在口号层。",
      },
      {
        id: "p1-s2",
        label: "项目迁移",
        observation: "无法把 bad case 和方案设计调整对应起来。",
        implication: "当前更需要导师式引导，而不是直接做复习。",
      },
    ],
    state: {
      mastery: 38,
      understandingLevel: 42,
      memoryStrength: 33,
      confusion: 58,
      preferredModes: ["guided-qa", "scenario-sim"],
      weakSignals: ["知道名词但不会拆设计", "碰到 bad case 时只会继续堆上下文"],
      lastReviewedAt: "2026-04-05",
      nextReviewAt: "2026-04-09",
      recommendedAction: "teach",
    },
  },
  {
    id: "profile-2",
    name: "正在改方案的工程师",
    role: "理解过基础知识，但召回、重排和上下文构造边界模糊",
    stateSource: "来源：最近几轮问答能说出流程，但在评审里解释不清为何需要重排。",
    diagnosisSignals: [
      {
        id: "p2-s1",
        label: "混淆风险",
        observation: "把“召回质量差”和“上下文构造差”混成一个问题。",
        implication: "系统应先安排边界澄清，避免继续带着错模型推进项目。",
      },
      {
        id: "p2-s2",
        label: "项目反馈",
        observation: "看到线上 bad case 后，仍倾向于只增加 chunk 数量。",
        implication: "需要对比辨析训练，而不是继续泛泛聊天。",
      },
    ],
    state: {
      mastery: 64,
      understandingLevel: 58,
      memoryStrength: 61,
      confusion: 76,
      preferredModes: ["contrast-drill", "scenario-sim"],
      weakSignals: ["概念混淆", "不能解释为何这样设计"],
      lastReviewedAt: "2026-04-07",
      nextReviewAt: "2026-04-10",
      recommendedAction: "clarify",
    },
  },
  {
    id: "profile-3",
    name: "准备答辩的技术负责人",
    role: "基本理解方案，但需要把设计取舍讲清楚并迁移到答辩场景",
    stateSource: "来源：能解释核心链路，但在模拟答辩时还不够稳定，项目表达需要打磨。",
    diagnosisSignals: [
      {
        id: "p3-s1",
        label: "应用能力",
        observation: "能说出 RAG 模块，但对“为什么不是直接拼接”解释不够有层次。",
        implication: "当前更适合做项目情境模拟，验证能否稳定输出。",
      },
      {
        id: "p3-s2",
        label: "记忆稳定性",
        observation: "关键概念能回忆，但在高压场景下会漏掉设计取舍。",
        implication: "需要把表达迁移写回线程，并视表现安排后续复盘。",
      },
    ],
    state: {
      mastery: 72,
      understandingLevel: 74,
      memoryStrength: 56,
      confusion: 34,
      preferredModes: ["scenario-sim", "guided-qa"],
      weakSignals: ["项目表达不够稳", "评审追问时容易回到泛泛描述"],
      lastReviewedAt: "2026-04-09",
      nextReviewAt: "2026-04-14",
      recommendedAction: "apply",
    },
  },
];
