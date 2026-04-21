export type SessionType = "project" | "study" | "review";

export type AppScreen = "home" | "workspace";

export type HomeSection =
  | "all-projects"
  | "recent"
  | "due-review"
  | "archived";

export type WorkspaceSection = "overview" | "due-review" | "archived";

export type KnowledgePointStatus =
  | "active_unlearned"
  | "active_learning"
  | "active_review"
  | "archived";

export interface KnowledgePointArchiveSuggestion {
  readonly reason: string;
}

export interface ProjectItem {
  readonly id: string;
  readonly name: string;
  readonly topic: string;
  readonly description: string;
  readonly specialRules: ReadonlyArray<string>;
  readonly updatedAt: string;
}

export interface SessionItem {
  readonly id: string;
  readonly projectId: string;
  readonly type: SessionType;
  readonly knowledgePointId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly updatedAt: string;
  readonly status: string;
}

export interface KnowledgePointItem {
  readonly id: string;
  readonly projectId: string;
  readonly originSessionId: string | null;
  readonly linkedSessionIds: ReadonlyArray<string>;
  readonly linkedMessageIdsBySession: Readonly<Record<string, string>>;
  readonly title: string;
  readonly description: string;
  readonly status: KnowledgePointStatus;
  readonly mastery: number;
  readonly stageLabel: string;
  readonly nextReviewLabel: string | null;
  readonly updatedAt: string;
  readonly sourceAssetIds: ReadonlyArray<string>;
  readonly archiveSuggestion: KnowledgePointArchiveSuggestion | null;
}

export interface ProjectStats {
  readonly total: number;
  readonly dueReview: number;
  readonly unlearned: number;
  readonly archived: number;
}

export function buildPendingSessionId(input: {
  readonly projectId: string;
  readonly type: SessionType;
  readonly knowledgePointId: string | null;
}): string {
  return `pending-session:${input.projectId}:${input.type}:${input.knowledgePointId ?? "project"}`;
}

export function getSessionTypeLabel(type: SessionType): string {
  switch (type) {
    case "project":
      return "研讨";
    case "review":
      return "复习";
    case "study":
      return "学习";
  }
}

export function getSessionTypeDescription(type: SessionType): string {
  switch (type) {
    case "project":
      return "研讨用于围绕项目目标、材料判断和知识点沉淀持续推进，先把方向讲清楚。";
    case "review":
      return "复习用于回忆校准和稳定判断，检查是不是真的记住了、会用了。";
    case "study":
      return "学习用于推进一个知识点，系统会安排讲解、追问和题卡来带你往前走。";
  }
}

export function getWorkspaceSectionLabel(section: WorkspaceSection): string {
  switch (section) {
    case "overview":
      return "总览";
    case "due-review":
      return "待复习";
    case "archived":
      return "已归档";
  }
}

export function getProjectStats(
  points: ReadonlyArray<KnowledgePointItem>,
): ProjectStats {
  return {
    total: points.length,
    dueReview: points.filter((point) => point.status === "active_review").length,
    unlearned: points.filter((point) => point.status === "active_unlearned").length,
    archived: points.filter((point) => point.status === "archived").length,
  };
}

export function getNextSuggestedAction(
  points: ReadonlyArray<KnowledgePointItem>,
): string {
  const dueReviewCount = points.filter(
    (point) => point.status === "active_review",
  ).length;
  if (dueReviewCount > 0) {
    return `复习 ${dueReviewCount} 个知识点`;
  }

  const unlearnedCount = points.filter(
    (point) => point.status === "active_unlearned",
  ).length;
  if (unlearnedCount > 0) {
    return `开始学习 ${unlearnedCount} 个未学知识点`;
  }

  return "继续当前研讨";
}
