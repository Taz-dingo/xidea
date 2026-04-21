import type { KnowledgePointItem, ProjectItem } from "@/domain/project-workspace";
import type { LearningUnit } from "@/domain/types";

export const EMPTY_PROJECT_ITEM: ProjectItem = {
  id: "",
  name: "",
  topic: "",
  description: "",
  specialRules: [],
  updatedAt: "",
};

export const EMPTY_KNOWLEDGE_POINT_ITEM: KnowledgePointItem = {
  id: "",
  projectId: "",
  originSessionId: null,
  linkedSessionIds: [],
  linkedMessageIdsBySession: {},
  title: "",
  description: "",
  status: "active_unlearned",
  mastery: 0,
  stageLabel: "未学",
  nextReviewLabel: null,
  updatedAt: "",
  sourceAssetIds: [],
  archiveSuggestion: null,
};

export const EMPTY_LEARNING_UNIT: LearningUnit = {
  id: "",
  title: "当前知识点",
  summary: "等待系统回读当前知识点。",
  weaknessTags: [],
  candidateModes: ["guided-qa"],
  difficulty: 3,
};
