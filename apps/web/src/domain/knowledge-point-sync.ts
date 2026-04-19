import type {
  AgentKnowledgePointRecord,
  AgentKnowledgePointSuggestionResolution,
} from "@/domain/agent-runtime";
import type { KnowledgePointItem } from "@/domain/project-workspace";

function getKnowledgePointStatus(
  resolution: AgentKnowledgePointSuggestionResolution | AgentKnowledgePointRecord,
): KnowledgePointItem["status"] {
  const point = resolution.knowledge_point;
  const pointState = resolution.knowledge_point_state;

  if (point?.status === "archived" || pointState?.learning_status === "archived") {
    return "archived";
  }
  if (pointState?.review_status === "scheduled" || pointState?.review_status === "due") {
    return "active_review";
  }
  if (pointState?.learning_status === "learning") {
    return "active_learning";
  }
  return "active_unlearned";
}

function getStageLabel(status: KnowledgePointItem["status"]): string {
  switch (status) {
    case "active_learning":
      return "学习中";
    case "active_review":
      return "待复习";
    case "archived":
      return "已归档";
    case "active_unlearned":
      return "未学";
  }
}

function toLinkedMessageIdsBySession(
  resolution: AgentKnowledgePointSuggestionResolution | AgentKnowledgePointRecord,
): KnowledgePointItem["linkedMessageIdsBySession"] {
  const linkedIds =
    "linked_session_message_ids" in resolution
      ? resolution.linked_session_message_ids
      : {};

  return Object.fromEntries(
    Object.entries(linkedIds).map(([sessionId, messageId]) => [
      sessionId,
      `${sessionId}-message-${messageId}`,
    ]),
  );
}

export function toKnowledgePointItem(
  resolution: AgentKnowledgePointSuggestionResolution | AgentKnowledgePointRecord,
): KnowledgePointItem | null {
  const point = resolution.knowledge_point;
  if (point === null) {
    return null;
  }

  const status = getKnowledgePointStatus(resolution);
  return {
    id: point.id,
    projectId: point.project_id,
    originSessionId: point.origin_session_id,
    linkedSessionIds:
      "linked_session_ids" in resolution
        ? resolution.linked_session_ids
        : point.origin_session_id
          ? [point.origin_session_id]
          : [],
    linkedMessageIdsBySession: toLinkedMessageIdsBySession(resolution),
    title: point.title,
    description: point.description,
    status,
    mastery: resolution.knowledge_point_state?.mastery ?? 0,
    stageLabel: getStageLabel(status),
    nextReviewLabel: resolution.knowledge_point_state?.next_review_at ?? null,
    updatedAt: "刚刚",
    sourceAssetIds: point.source_material_refs,
    archiveSuggestion: null,
  };
}
