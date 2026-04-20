import type { SetStateAction } from "react";
import type { UIMessage } from "ai";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { resetLegacyWorkspaceStorage } from "@/app/workspace/store/persistence";
import type {
  AgentAssetSummary,
  AgentEntryMode,
  AgentReviewInspector,
  RuntimeSnapshot,
} from "@/domain/agent-runtime";
import {
  type ActivityResolution,
  type CompletedActivityDeck,
  type SessionActivityBatchState,
} from "@/domain/project-session-runtime";

function resolveState<T>(
  nextState: SetStateAction<T>,
  currentState: T,
): T {
  return typeof nextState === "function"
    ? (nextState as (value: T) => T)(currentState)
    : nextState;
}

interface WorkspaceRuntimeState {
  readonly sessionEntryModes: Record<string, AgentEntryMode>;
  readonly sessionSourceAssetIds: Record<string, ReadonlyArray<string>>;
  readonly sessionMaterialTrayOpen: Record<string, boolean>;
  readonly sessionSnapshots: Record<string, RuntimeSnapshot>;
  readonly sessionReviewInspectors: Record<string, AgentReviewInspector | null>;
  readonly assetSummaryByKey: Record<string, AgentAssetSummary>;
  readonly agentConnectionState: "checking" | "ready" | "offline";
  readonly sessionMessagesById: Record<string, UIMessage[]>;
  readonly activityResolutionsBySession: Record<string, Record<string, ActivityResolution>>;
  readonly runningSessionIds: Record<string, boolean>;
  readonly bootstrapLoadedKeys: Record<string, boolean>;
  readonly activityBatchStateBySession: Record<string, SessionActivityBatchState>;
  readonly completedActivityDecksBySession: Record<string, ReadonlyArray<CompletedActivityDeck>>;
  readonly setSessionEntryModes: (
    nextState: SetStateAction<Record<string, AgentEntryMode>>,
  ) => void;
  readonly setSessionSourceAssetIds: (
    nextState: SetStateAction<Record<string, ReadonlyArray<string>>>,
  ) => void;
  readonly setSessionMaterialTrayOpen: (
    nextState: SetStateAction<Record<string, boolean>>,
  ) => void;
  readonly setSessionSnapshots: (
    nextState: SetStateAction<Record<string, RuntimeSnapshot>>,
  ) => void;
  readonly setSessionReviewInspectors: (
    nextState: SetStateAction<Record<string, AgentReviewInspector | null>>,
  ) => void;
  readonly setAssetSummaryByKey: (
    nextState: SetStateAction<Record<string, AgentAssetSummary>>,
  ) => void;
  readonly setAgentConnectionState: (
    nextState: SetStateAction<"checking" | "ready" | "offline">,
  ) => void;
  readonly setSessionMessagesById: (
    nextState: SetStateAction<Record<string, UIMessage[]>>,
  ) => void;
  readonly setActivityResolutionsBySession: (
    nextState: SetStateAction<Record<string, Record<string, ActivityResolution>>>,
  ) => void;
  readonly setRunningSessionIds: (
    nextState: SetStateAction<Record<string, boolean>>,
  ) => void;
  readonly setActivityBatchStateBySession: (
    nextState: SetStateAction<Record<string, SessionActivityBatchState>>,
  ) => void;
  readonly setCompletedActivityDecksBySession: (
    nextState: SetStateAction<Record<string, ReadonlyArray<CompletedActivityDeck>>>,
  ) => void;
  readonly markBootstrapLoaded: (key: string) => void;
  readonly clearBootstrapLoaded: (key: string) => void;
}

resetLegacyWorkspaceStorage();

export const useWorkspaceRuntimeStore = create<WorkspaceRuntimeState>()(
  persist(
    (set) => ({
      sessionEntryModes: {},
      sessionSourceAssetIds: {},
      sessionMaterialTrayOpen: {},
      sessionSnapshots: {},
      sessionReviewInspectors: {},
      assetSummaryByKey: {},
      agentConnectionState: "checking",
      sessionMessagesById: {},
      activityResolutionsBySession: {},
      runningSessionIds: {},
      bootstrapLoadedKeys: {},
      activityBatchStateBySession: {},
      completedActivityDecksBySession: {},
      setSessionEntryModes: (nextState) =>
        set((state) => ({
          sessionEntryModes: resolveState(nextState, state.sessionEntryModes),
        })),
      setSessionSourceAssetIds: (nextState) =>
        set((state) => ({
          sessionSourceAssetIds: resolveState(nextState, state.sessionSourceAssetIds),
        })),
      setSessionMaterialTrayOpen: (nextState) =>
        set((state) => ({
          sessionMaterialTrayOpen: resolveState(nextState, state.sessionMaterialTrayOpen),
        })),
      setSessionSnapshots: (nextState) =>
        set((state) => ({
          sessionSnapshots: resolveState(nextState, state.sessionSnapshots),
        })),
      setSessionReviewInspectors: (nextState) =>
        set((state) => ({
          sessionReviewInspectors: resolveState(nextState, state.sessionReviewInspectors),
        })),
      setAssetSummaryByKey: (nextState) =>
        set((state) => ({
          assetSummaryByKey: resolveState(nextState, state.assetSummaryByKey),
        })),
      setAgentConnectionState: (nextState) =>
        set((state) => ({
          agentConnectionState: resolveState(nextState, state.agentConnectionState),
        })),
      setSessionMessagesById: (nextState) =>
        set((state) => ({
          sessionMessagesById: resolveState(nextState, state.sessionMessagesById),
        })),
      setActivityResolutionsBySession: (nextState) =>
        set((state) => ({
          activityResolutionsBySession: resolveState(
            nextState,
            state.activityResolutionsBySession,
          ),
        })),
      setRunningSessionIds: (nextState) =>
        set((state) => ({
          runningSessionIds: resolveState(nextState, state.runningSessionIds),
        })),
      setActivityBatchStateBySession: (nextState) =>
        set((state) => ({
          activityBatchStateBySession: resolveState(
            nextState,
            state.activityBatchStateBySession,
          ),
        })),
      setCompletedActivityDecksBySession: (nextState) =>
        set((state) => ({
          completedActivityDecksBySession: resolveState(
            nextState,
            state.completedActivityDecksBySession,
          ),
        })),
      markBootstrapLoaded: (key) =>
        set((state) => ({
          bootstrapLoadedKeys:
            state.bootstrapLoadedKeys[key] === true
              ? state.bootstrapLoadedKeys
              : { ...state.bootstrapLoadedKeys, [key]: true },
        })),
      clearBootstrapLoaded: (key) =>
        set((state) => {
          if (state.bootstrapLoadedKeys[key] === undefined) {
            return state;
          }
          const nextKeys = { ...state.bootstrapLoadedKeys };
          delete nextKeys[key];
          return { bootstrapLoadedKeys: nextKeys };
        }),
    }),
    {
      name: "xidea-workspace-runtime-v1",
      partialize: (state) => ({
        completedActivityDecksBySession: state.completedActivityDecksBySession,
      }),
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
