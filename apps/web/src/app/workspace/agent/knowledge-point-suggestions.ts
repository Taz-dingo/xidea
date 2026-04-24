import type { AgentKnowledgePointSuggestion } from "@/domain/agent-runtime";
import { toKnowledgePointItem } from "@/domain/knowledge-point-sync";
import type { KnowledgePointItem } from "@/domain/project-workspace";
import {
  confirmKnowledgePointSuggestion,
  listProjectKnowledgePoints,
} from "@/lib/agent-client";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

type SetKnowledgePoints = WorkspaceData["setKnowledgePoints"];

const CONFIRM_RETRY_DELAYS_MS = [0, 250, 750, 1500] as const;

function uniqueValues(values: ReadonlyArray<string>): string[] {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

function linkKnowledgePointToSession({
  assistantMessageId,
  point,
  sessionId,
}: {
  assistantMessageId: string;
  point: KnowledgePointItem;
  sessionId: string;
}): KnowledgePointItem {
  const linkedSessionIds = point.linkedSessionIds.includes(sessionId)
    ? point.linkedSessionIds
    : [...point.linkedSessionIds, sessionId];
  const linkedMessageIdsBySession =
    point.linkedMessageIdsBySession[sessionId] === assistantMessageId
      ? point.linkedMessageIdsBySession
      : {
          ...point.linkedMessageIdsBySession,
          [sessionId]: assistantMessageId,
        };

  if (
    linkedSessionIds === point.linkedSessionIds &&
    linkedMessageIdsBySession === point.linkedMessageIdsBySession
  ) {
    return point;
  }

  return {
    ...point,
    linkedMessageIdsBySession,
    linkedSessionIds,
  };
}

function upsertLinkedKnowledgePoint({
  assistantMessageId,
  current,
  point,
  sessionId,
}: {
  assistantMessageId: string;
  current: ReadonlyArray<KnowledgePointItem>;
  point: KnowledgePointItem;
  sessionId: string;
}): ReadonlyArray<KnowledgePointItem> {
  const previousPoint = current.find((candidate) => candidate.id === point.id);
  const remainingPoints = current.filter((candidate) => candidate.id !== point.id);
  const linkedPoint = linkKnowledgePointToSession({
    assistantMessageId,
    point: {
      ...point,
      linkedMessageIdsBySession: {
        ...(previousPoint?.linkedMessageIdsBySession ?? {}),
        ...point.linkedMessageIdsBySession,
        [sessionId]: assistantMessageId,
      },
      linkedSessionIds: uniqueValues([
        ...(previousPoint?.linkedSessionIds ?? []),
        ...point.linkedSessionIds,
        sessionId,
      ]),
    },
    sessionId,
  });

  return [...remainingPoints, linkedPoint];
}

function buildAcceptedSuggestionPoint(
  suggestion: AgentKnowledgePointSuggestion,
): KnowledgePointItem | null {
  if (suggestion.knowledge_point_id === null) {
    return null;
  }

  return {
    archiveSuggestion: null,
    description: suggestion.description,
    id: suggestion.knowledge_point_id,
    linkedMessageIdsBySession: {},
    linkedSessionIds: [suggestion.session_id],
    mastery: 0,
    nextReviewLabel: null,
    originSessionId: suggestion.session_id,
    projectId: suggestion.project_id,
    sourceAssetIds: suggestion.source_material_refs,
    stageLabel: "未学",
    status: "active_unlearned",
    title: suggestion.title,
    updatedAt: "刚刚",
  };
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

async function confirmSuggestionAfterPersistence(
  projectId: string,
  suggestionId: string,
) {
  let latestError: unknown = null;

  for (const delayMs of CONFIRM_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    try {
      return await confirmKnowledgePointSuggestion(projectId, suggestionId);
    } catch (error) {
      latestError = error;
    }
  }

  throw latestError;
}

export function insertAcceptedKnowledgePointSuggestion({
  assistantMessageId,
  setKnowledgePoints,
  suggestion,
}: {
  assistantMessageId: string;
  setKnowledgePoints: SetKnowledgePoints;
  suggestion: AgentKnowledgePointSuggestion;
}): string | null {
  const point = buildAcceptedSuggestionPoint(suggestion);
  if (point === null) {
    return null;
  }

  setKnowledgePoints((current) =>
    upsertLinkedKnowledgePoint({
      assistantMessageId,
      current,
      point,
      sessionId: suggestion.session_id,
    }),
  );
  return point.id;
}

export async function hydrateAcceptedKnowledgePointSuggestion({
  assistantMessageId,
  projectId,
  setKnowledgePoints,
  suggestion,
}: {
  assistantMessageId: string;
  projectId: string;
  setKnowledgePoints: SetKnowledgePoints;
  suggestion: AgentKnowledgePointSuggestion;
}): Promise<string | null> {
  if (suggestion.knowledge_point_id === null) {
    return null;
  }

  const records = await listProjectKnowledgePoints(projectId);
  const point =
    records
      .map((record) => toKnowledgePointItem(record))
      .find((candidate) => candidate?.id === suggestion.knowledge_point_id) ?? null;
  if (point === null) {
    return null;
  }

  setKnowledgePoints((current) =>
    upsertLinkedKnowledgePoint({
      assistantMessageId,
      current,
      point,
      sessionId: suggestion.session_id,
    }),
  );
  return point.id;
}

export async function confirmAndInsertKnowledgePointSuggestion({
  assistantMessageId,
  projectId,
  setKnowledgePoints,
  suggestion,
}: {
  assistantMessageId: string;
  projectId: string;
  setKnowledgePoints: SetKnowledgePoints;
  suggestion: AgentKnowledgePointSuggestion;
}): Promise<string | null> {
  const resolution = await confirmSuggestionAfterPersistence(projectId, suggestion.id);
  const point = toKnowledgePointItem(resolution);
  if (point === null) {
    return null;
  }

  setKnowledgePoints((current) =>
    upsertLinkedKnowledgePoint({
      assistantMessageId,
      current,
      point,
      sessionId: resolution.suggestion.session_id,
    }),
  );
  return point.id;
}

export function handleKnowledgePointSuggestions({
  assistantMessageId,
  handledSuggestionIds,
  projectId,
  sessionType,
  setKnowledgePoints,
  setSelectedKnowledgePointId,
  suggestions,
}: {
  assistantMessageId: string;
  handledSuggestionIds: Set<string>;
  projectId: string;
  sessionType: "project" | "study" | "review";
  setKnowledgePoints: SetKnowledgePoints;
  setSelectedKnowledgePointId: WorkspaceData["setSelectedKnowledgePointId"];
  suggestions: ReadonlyArray<AgentKnowledgePointSuggestion>;
}): void {
  if (sessionType !== "project") {
    return;
  }

  for (const suggestion of suggestions) {
    if (suggestion.kind !== "create") {
      continue;
    }
    if (suggestion.status === "accepted" && suggestion.knowledge_point_id !== null) {
      const pointId = insertAcceptedKnowledgePointSuggestion({
        assistantMessageId,
        setKnowledgePoints,
        suggestion,
      });
      if (pointId !== null) {
        setSelectedKnowledgePointId(pointId);
      }
      if (handledSuggestionIds.has(suggestion.id)) {
        continue;
      }
      handledSuggestionIds.add(suggestion.id);
      void hydrateAcceptedKnowledgePointSuggestion({
        assistantMessageId,
        projectId,
        setKnowledgePoints,
        suggestion,
      })
        .then((hydratedPointId) => {
          if (hydratedPointId !== null) {
            setSelectedKnowledgePointId(hydratedPointId);
          }
        })
        .catch(() => {
          handledSuggestionIds.delete(suggestion.id);
        });
      continue;
    }
    if (suggestion.status !== "pending" || handledSuggestionIds.has(suggestion.id)) {
      continue;
    }
    handledSuggestionIds.add(suggestion.id);
    void confirmAndInsertKnowledgePointSuggestion({
      assistantMessageId,
      projectId,
      setKnowledgePoints,
      suggestion,
    })
      .then((pointId) => {
        if (pointId !== null) {
          setSelectedKnowledgePointId(pointId);
        }
      })
      .catch(() => {
        handledSuggestionIds.delete(suggestion.id);
      });
  }
}
