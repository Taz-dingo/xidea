import { useEffect } from "react";
import { toKnowledgePointItem } from "@/domain/knowledge-point-sync";
import { listProjectKnowledgePoints } from "@/lib/agent-client";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

function hasSameIds(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasSameMessageIdMap(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value]) => right[key] === value)
  );
}

export function useProjectKnowledgeSync({
  data,
  projectId,
}: {
  data: WorkspaceData;
  projectId: string;
}): void {
  const { agentConnectionState, setKnowledgePoints } = data;

  useEffect(() => {
    if (agentConnectionState !== "ready") {
      return;
    }

    const abortController = new AbortController();
    void listProjectKnowledgePoints(projectId, { signal: abortController.signal })
      .then((records) => {
        if (abortController.signal.aborted) {
          return;
        }

        const syncedPoints = records
          .map((record) => toKnowledgePointItem(record))
          .filter((point) => point !== null);

        if (syncedPoints.length === 0) {
          return;
        }

        setKnowledgePoints((current) => {
          const currentProjectPoints = current.filter((point) => point.projectId === projectId);
          const otherProjectPoints = current.filter((point) => point.projectId !== projectId);
          const nextById = new Map(currentProjectPoints.map((point) => [point.id, point]));

          for (const point of syncedPoints) {
            nextById.set(point.id, point);
          }

          const nextProjectPoints = Array.from(nextById.values());
          if (
            currentProjectPoints.length === nextProjectPoints.length &&
            currentProjectPoints.every((point, index) => {
              const nextPoint = nextProjectPoints[index];
              return (
                nextPoint !== undefined &&
                point.id === nextPoint.id &&
                point.originSessionId === nextPoint.originSessionId &&
                hasSameIds(point.linkedSessionIds, nextPoint.linkedSessionIds) &&
                hasSameMessageIdMap(
                  point.linkedMessageIdsBySession,
                  nextPoint.linkedMessageIdsBySession,
                ) &&
                point.status === nextPoint.status &&
                point.stageLabel === nextPoint.stageLabel &&
                point.mastery === nextPoint.mastery &&
                point.nextReviewLabel === nextPoint.nextReviewLabel &&
                point.updatedAt === nextPoint.updatedAt &&
                hasSameIds(point.sourceAssetIds, nextPoint.sourceAssetIds)
              );
            })
          ) {
            return current;
          }

          return [...otherProjectPoints, ...nextProjectPoints];
        });
      })
      .catch(() => undefined);

    return () => abortController.abort();
  }, [agentConnectionState, projectId, setKnowledgePoints]);
}
