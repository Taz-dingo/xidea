import { useEffect } from "react";
import { mergeReviewInspector } from "@/domain/agent-runtime";
import { REVIEW_HEATMAP_LOOKBACK_DAYS } from "@/domain/review-heatmap";
import { getReviewInspector } from "@/lib/agent-client";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useProjectReviewInspectorsSync({
  data,
  projectSessions,
}: {
  data: WorkspaceData;
  projectSessions: WorkspaceData["selectedProjectSessions"];
}): void {
  const {
    agentConnectionState,
    sessionReviewInspectors,
    setSessionReviewInspectors,
  } = data;

  useEffect(() => {
    if (agentConnectionState !== "ready" || projectSessions.length === 0) {
      return;
    }

    const sessionsToHydrate = projectSessions.filter(
      (session) =>
        session.knowledgePointId !== null &&
        sessionReviewInspectors[session.id] === undefined,
    );
    if (sessionsToHydrate.length === 0) {
      return;
    }

    const abortController = new AbortController();
    void Promise.all(
      sessionsToHydrate.map(async (session) => [
        session.id,
        await getReviewInspector(session.id, session.knowledgePointId!, {
          days: REVIEW_HEATMAP_LOOKBACK_DAYS,
          signal: abortController.signal,
        }),
      ] as const),
    )
      .then((inspectors) => {
        if (abortController.signal.aborted) {
          return;
        }

        setSessionReviewInspectors((current) => {
          let changed = false;
          const next = { ...current };

          for (const [sessionId, inspector] of inspectors) {
            const mergedInspector = mergeReviewInspector(next[sessionId], inspector);
            if (next[sessionId] !== mergedInspector) {
              next[sessionId] = mergedInspector;
              changed = true;
            }
          }

          return changed ? next : current;
        });
      })
      .catch(() => undefined);

    return () => abortController.abort();
  }, [
    agentConnectionState,
    projectSessions,
    sessionReviewInspectors,
    setSessionReviewInspectors,
  ]);
}
