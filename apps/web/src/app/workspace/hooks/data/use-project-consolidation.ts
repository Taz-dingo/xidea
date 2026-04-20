import { useEffect, useState } from "react";
import type { AgentWorkspaceProjectConsolidation } from "@/domain/agent-workspace";
import {
  getProjectConsolidation,
  refreshProjectConsolidation,
} from "@/lib/agent-client";

export type ProjectConsolidationStatus =
  | "idle"
  | "loading"
  | "refreshing"
  | "ready"
  | "error";

export interface ProjectConsolidationState {
  readonly snapshot: AgentWorkspaceProjectConsolidation | null;
  readonly status: ProjectConsolidationStatus;
  readonly errorMessage: string | null;
}

export function useProjectConsolidation({
  agentConnectionState,
  enabled,
  projectId,
}: {
  agentConnectionState: "checking" | "ready" | "offline";
  enabled: boolean;
  projectId: string;
}): ProjectConsolidationState {
  const [state, setState] = useState<ProjectConsolidationState>({
    snapshot: null,
    status: "idle",
    errorMessage: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({
        snapshot: null,
        status: "idle",
        errorMessage: null,
      });
      return;
    }

    if (agentConnectionState !== "ready") {
      setState((current) => ({
        ...current,
        status: current.snapshot === null ? "idle" : current.status,
      }));
      return;
    }

    const abortController = new AbortController();

    setState({
      snapshot: null,
      status: "loading",
      errorMessage: null,
    });

    void (async () => {
      let cachedSnapshot: AgentWorkspaceProjectConsolidation | null = null;

      try {
        cachedSnapshot = await getProjectConsolidation(projectId, {
          signal: abortController.signal,
        });
        if (abortController.signal.aborted) {
          return;
        }

        if (cachedSnapshot !== null) {
          setState({
            snapshot: cachedSnapshot,
            status: "refreshing",
            errorMessage: null,
          });
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setState({
          snapshot: null,
          status: "loading",
          errorMessage:
            error instanceof Error ? error.message : "读取上一次系统收口结果失败。",
        });
      }

      try {
        const refreshedSnapshot = await refreshProjectConsolidation(projectId, {
          signal: abortController.signal,
        });
        if (abortController.signal.aborted) {
          return;
        }

        setState({
          snapshot: refreshedSnapshot,
          status: "ready",
          errorMessage: null,
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setState({
          snapshot: cachedSnapshot,
          status: "error",
          errorMessage:
            error instanceof Error ? error.message : "刷新最新系统收口结果失败。",
        });
      }
    })();

    return () => abortController.abort();
  }, [agentConnectionState, enabled, projectId]);

  return state;
}
