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
      return "围绕学习方向、材料线索和知识点演化持续推进。";
    case "review":
      return "针对已学知识点做回忆校准和复盘。";
    case "study":
      return "围绕当前知识点继续学习编排和练习。";
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
