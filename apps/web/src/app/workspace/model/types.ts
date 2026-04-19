import type { AgentReviewInspector } from "@/domain/agent-runtime";
import type {
  HomeSection,
  KnowledgePointItem,
  ProjectItem,
  ProjectStats,
  SessionItem,
  SessionType,
} from "@/domain/project-workspace";

export interface ProjectDraft {
  readonly name: string;
  readonly topic: string;
  readonly description: string;
  readonly specialRulesText: string;
  readonly initialMaterialIds: ReadonlyArray<string>;
}

export interface EditableKnowledgePointDraft {
  readonly title: string;
  readonly description: string;
}

export interface ProjectMetaDraft {
  readonly name: string;
  readonly topic: string;
  readonly description: string;
  readonly specialRulesText: string;
  readonly materialIds: ReadonlyArray<string>;
}

export interface PendingSessionIntent {
  readonly projectId: string;
  readonly type: SessionType;
  readonly knowledgePointId: string | null;
  readonly knowledgePointTitle: string | null;
}

export interface PendingInitialPrompt {
  readonly sessionId: string;
  readonly text: string;
  readonly sessionSummary: string;
}

export interface ProjectSummaryItem {
  readonly project: ProjectItem;
  readonly stats: ProjectStats;
}

export interface BrowseProfileSummary {
  readonly title: string;
  readonly evidence: string;
}

export interface HomeSectionCounts {
  readonly recent: number;
  readonly dueReview: number;
  readonly archived: number;
}

export interface HomeSectionSelectionParams {
  readonly homeSection: HomeSection;
  readonly projectSummaries: ReadonlyArray<ProjectSummaryItem>;
  readonly recentProjectSummaries: ReadonlyArray<ProjectSummaryItem>;
}

export interface RelatedKnowledgeParams {
  readonly selectedKnowledgePoint: KnowledgePointItem | null;
  readonly selectedProjectKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
  readonly selectedSession: SessionItem | undefined;
}

export interface KnowledgeReviewSummaryParams {
  readonly knowledgePointReviewInspectors: ReadonlyArray<AgentReviewInspector>;
}
