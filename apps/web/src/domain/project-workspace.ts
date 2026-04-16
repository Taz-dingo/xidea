export type SessionType = "project" | "study" | "review";

export type AppScreen = "home" | "workspace" | "detail";

export type WorkspaceSection = "overview" | "due-review" | "archived";

export type KnowledgePointStatus =
  | "active_unlearned"
  | "active_learning"
  | "active_review"
  | "archived";

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
  readonly title: string;
  readonly description: string;
  readonly status: KnowledgePointStatus;
  readonly mastery: number;
  readonly stageLabel: string;
  readonly nextReviewLabel: string | null;
  readonly updatedAt: string;
  readonly sourceAssetIds: ReadonlyArray<string>;
}

export interface ProjectStats {
  readonly total: number;
  readonly dueReview: number;
  readonly unlearned: number;
  readonly archived: number;
}

export function getSessionTypeLabel(type: SessionType): string {
  switch (type) {
    case "project":
      return "project";
    case "review":
      return "review";
    case "study":
      return "study";
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

  return "继续当前 project session";
}
