import type { SetStateAction } from "react";
import type { UIMessage } from "ai";
import { create } from "zustand";
import { initialSessions } from "@/data/project-workspace-demo";
import { getTutorFixtureScenario } from "@/data/tutor-fixtures";
import type {
  AgentAssetSummary,
  AgentEntryMode,
  AgentReviewInspector,
  RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type { KnowledgePointSuggestion } from "@/domain/project-workspace";
import {
  getDefaultSourceAssetIds,
  type ActivityResolution,
  type DevTutorFixtureState,
  buildDevTutorFixtureState,
} from "@/domain/project-session-runtime";

function resolveState<T>(
  nextState: SetStateAction<T>,
  currentState: T,
): T {
  return typeof nextState === "function"
    ? (nextState as (value: T) => T)(currentState)
    : nextState;
}

function getInitialDevTutorFixtureState(): DevTutorFixtureState | null {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }

  const fixtureId = new URLSearchParams(window.location.search).get("mockTutor");
  const fixture = getTutorFixtureScenario(fixtureId);
  return fixture ? buildDevTutorFixtureState(fixture) : null;
}

interface WorkspaceRuntimeState {
  readonly sessionEntryModes: Record<string, AgentEntryMode>;
  readonly sessionSourceAssetIds: Record<string, ReadonlyArray<string>>;
  readonly sessionMaterialTrayOpen: Record<string, boolean>;
  readonly devTutorFixtureState: DevTutorFixtureState | null;
  readonly sessionSnapshots: Record<string, RuntimeSnapshot>;
  readonly sessionReviewInspectors: Record<string, AgentReviewInspector | null>;
  readonly assetSummaryByKey: Record<string, AgentAssetSummary>;
  readonly agentConnectionState: "checking" | "ready" | "offline";
  readonly sessionMessagesById: Record<string, UIMessage[]>;
  readonly sessionKnowledgePointSuggestions: Record<string, KnowledgePointSuggestion | null>;
  readonly activityResolutionsBySession: Record<string, Record<string, ActivityResolution>>;
  readonly runningSessionIds: Record<string, boolean>;
  readonly bootstrapLoadedKeys: Record<string, boolean>;
  readonly setSessionEntryModes: (
    nextState: SetStateAction<Record<string, AgentEntryMode>>,
  ) => void;
  readonly setSessionSourceAssetIds: (
    nextState: SetStateAction<Record<string, ReadonlyArray<string>>>,
  ) => void;
  readonly setSessionMaterialTrayOpen: (
    nextState: SetStateAction<Record<string, boolean>>,
  ) => void;
  readonly setDevTutorFixtureState: (
    nextState: SetStateAction<DevTutorFixtureState | null>,
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
  readonly setSessionKnowledgePointSuggestions: (
    nextState: SetStateAction<Record<string, KnowledgePointSuggestion | null>>,
  ) => void;
  readonly setActivityResolutionsBySession: (
    nextState: SetStateAction<Record<string, Record<string, ActivityResolution>>>,
  ) => void;
  readonly setRunningSessionIds: (
    nextState: SetStateAction<Record<string, boolean>>,
  ) => void;
  readonly markBootstrapLoaded: (key: string) => void;
  readonly clearBootstrapLoaded: (key: string) => void;
}

export const useWorkspaceRuntimeStore = create<WorkspaceRuntimeState>()((set) => ({
  sessionEntryModes: Object.fromEntries(
    initialSessions.map((session) => [session.id, "chat-question"]),
  ),
  sessionSourceAssetIds: Object.fromEntries(
    initialSessions.map((session) => [session.id, getDefaultSourceAssetIds()]),
  ),
  sessionMaterialTrayOpen: {},
  devTutorFixtureState: getInitialDevTutorFixtureState(),
  sessionSnapshots: {},
  sessionReviewInspectors: {},
  assetSummaryByKey: {},
  agentConnectionState: "checking",
  sessionMessagesById: Object.fromEntries(
    initialSessions.map((session) => [session.id, []]),
  ),
  sessionKnowledgePointSuggestions: {},
  activityResolutionsBySession: {},
  runningSessionIds: {},
  bootstrapLoadedKeys: {},
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
  setDevTutorFixtureState: (nextState) =>
    set((state) => ({
      devTutorFixtureState: resolveState(nextState, state.devTutorFixtureState),
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
  setSessionKnowledgePointSuggestions: (nextState) =>
    set((state) => ({
      sessionKnowledgePointSuggestions: resolveState(
        nextState,
        state.sessionKnowledgePointSuggestions,
      ),
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
}));
