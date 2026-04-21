import type { SetStateAction } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { resetLegacyWorkspaceStorage } from "@/app/workspace/store/persistence";
import type {
  KnowledgePointItem,
  ProjectItem,
  SessionItem,
} from "@/domain/project-workspace";
import type { SourceAsset } from "@/domain/types";

function resolveState<T>(
  nextState: SetStateAction<T>,
  currentState: T,
): T {
  return typeof nextState === "function"
    ? (nextState as (value: T) => T)(currentState)
    : nextState;
}

interface WorkspaceEntitiesState {
  readonly projects: ReadonlyArray<ProjectItem>;
  readonly knowledgePoints: ReadonlyArray<KnowledgePointItem>;
  readonly sessions: ReadonlyArray<SessionItem>;
  readonly sourceAssets: ReadonlyArray<SourceAsset>;
  readonly projectMaterialIdsByProject: Record<string, ReadonlyArray<string>>;
  readonly projectAssetsByProject: Record<string, ReadonlyArray<SourceAsset>>;
  readonly setProjects: (
    nextState: SetStateAction<ReadonlyArray<ProjectItem>>,
  ) => void;
  readonly setKnowledgePoints: (
    nextState: SetStateAction<ReadonlyArray<KnowledgePointItem>>,
  ) => void;
  readonly setSessions: (
    nextState: SetStateAction<ReadonlyArray<SessionItem>>,
  ) => void;
  readonly setSourceAssets: (
    nextState: SetStateAction<ReadonlyArray<SourceAsset>>,
  ) => void;
  readonly setProjectMaterialIdsByProject: (
    nextState: SetStateAction<Record<string, ReadonlyArray<string>>>,
  ) => void;
  readonly setProjectAssetsByProject: (
    nextState: SetStateAction<Record<string, ReadonlyArray<SourceAsset>>>,
  ) => void;
}

resetLegacyWorkspaceStorage();

export const useWorkspaceEntitiesStore = create<WorkspaceEntitiesState>()(
  persist(
    (set) => ({
      projects: [],
      knowledgePoints: [],
      sessions: [],
      sourceAssets: [],
      projectMaterialIdsByProject: {},
      projectAssetsByProject: {},
      setProjects: (nextState) =>
        set((state) => ({ projects: resolveState(nextState, state.projects) })),
      setKnowledgePoints: (nextState) =>
        set((state) => ({
          knowledgePoints: resolveState(nextState, state.knowledgePoints),
        })),
      setSessions: (nextState) =>
        set((state) => ({ sessions: resolveState(nextState, state.sessions) })),
      setSourceAssets: (nextState) =>
        set((state) => ({ sourceAssets: resolveState(nextState, state.sourceAssets) })),
      setProjectMaterialIdsByProject: (nextState) =>
        set((state) => ({
          projectMaterialIdsByProject: resolveState(
            nextState,
            state.projectMaterialIdsByProject,
          ),
        })),
      setProjectAssetsByProject: (nextState) =>
        set((state) => ({
          projectAssetsByProject: resolveState(nextState, state.projectAssetsByProject),
        })),
    }),
    {
      name: "xidea-workspace-entities-v5",
      partialize: (state) => ({
        knowledgePoints: state.knowledgePoints,
        projectAssetsByProject: state.projectAssetsByProject,
        projectMaterialIdsByProject: state.projectMaterialIdsByProject,
        projects: state.projects,
        sourceAssets: state.sourceAssets,
      }),
      storage: createJSONStorage(() => localStorage),
      version: 6,
    },
  ),
);
