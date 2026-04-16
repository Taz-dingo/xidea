import { learningUnits, projectContext } from "@/data/demo";
import type { KnowledgePointItem, ProjectItem, SessionItem } from "@/domain/project-workspace";

const projectId = "project-rag-demo";

type KnowledgePointSeed = Omit<
  KnowledgePointItem,
  "id" | "projectId" | "title" | "description"
>;

const knowledgePointMetaByUnitId: Record<string, KnowledgePointSeed> = {
  "unit-1": {
    status: "active_review",
    mastery: 68,
    stageLabel: "待复习",
    nextReviewLabel: "今日到期",
    updatedAt: "昨天",
    sourceAssetIds: ["asset-1", "asset-3"],
  },
  "unit-2": {
    status: "active_unlearned",
    mastery: 24,
    stageLabel: "未学",
    nextReviewLabel: null,
    updatedAt: "今天",
    sourceAssetIds: ["asset-1", "asset-2"],
  },
  "unit-3": {
    status: "active_learning",
    mastery: 52,
    stageLabel: "学习中",
    nextReviewLabel: "明天复习",
    updatedAt: "2 天前",
    sourceAssetIds: ["asset-2", "asset-3"],
  },
};

export const initialProjects: ReadonlyArray<ProjectItem> = [
  {
    id: projectId,
    name: projectContext.name,
    topic: "围绕 RAG 系统设计进行项目型学习",
    description: projectContext.goal,
    specialRules: [
      "所有学习动作都要能回到比赛 demo 的讲述场景。",
      "优先解释设计取舍，不扩散到泛泛 AI 问答。",
    ],
    updatedAt: "昨天",
  },
] as const;

export const initialKnowledgePoints: ReadonlyArray<KnowledgePointItem> =
  learningUnits.map((unit) => {
    const meta = knowledgePointMetaByUnitId[unit.id];

    return {
      id: unit.id,
      projectId,
      title: unit.title,
      description: unit.summary,
      status: meta?.status ?? "active_unlearned",
      mastery: meta?.mastery ?? 0,
      stageLabel: meta?.stageLabel ?? "未学",
      nextReviewLabel: meta?.nextReviewLabel ?? null,
      updatedAt: meta?.updatedAt ?? "刚刚",
      sourceAssetIds: meta?.sourceAssetIds ?? [],
    };
  });

export const initialSessions: ReadonlyArray<SessionItem> = [
  {
    id: "session-project-current",
    projectId,
    type: "project",
    unitId: null,
    title: "当前 project session",
    summary: "围绕材料导入、知识点演化和项目答辩叙事继续推进。",
    updatedAt: "1h",
    status: "活跃",
  },
  {
    id: "session-review-rerank",
    projectId,
    type: "review",
    unitId: "unit-2",
    title: "复习：重排判断",
    summary: "回拉“什么时候需要重排”的判断边界。",
    updatedAt: "昨天",
    status: "待复习",
  },
  {
    id: "session-study-defense",
    projectId,
    type: "study",
    unitId: "unit-3",
    title: "学习：答辩表达迁移",
    summary: "把设计取舍转成比赛答辩可讲的表达结构。",
    updatedAt: "2d",
    status: "进行中",
  },
];
