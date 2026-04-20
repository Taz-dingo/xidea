import type { SetStateAction } from "react";
import { create } from "zustand";
import { sourceAssets } from "@/data/demo";
import {
  initialKnowledgePoints,
  initialProjects,
  initialSessions,
} from "@/data/project-workspace-demo";
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
}

const initialProjectMaterials = Object.fromEntries(
  initialProjects.map((project) => [
    project.id,
    Array.from(
      new Set(
        initialKnowledgePoints
          .filter((point) => point.projectId === project.id)
          .flatMap((point) => point.sourceAssetIds),
      ),
    ),
  ]),
);

export const useWorkspaceEntitiesStore = create<WorkspaceEntitiesState>()((set) => ({
  projects: initialProjects,
  knowledgePoints: initialKnowledgePoints,
  sessions: initialSessions,
  sourceAssets,
  projectMaterialIdsByProject: initialProjectMaterials,
  setProjects: (nextState) =>
    set((state) => ({ projects: resolveState(nextState, state.projects) })),
  setKnowledgePoints: (nextState) =>
    set((state) => ({
      knowledgePoints: resolveState(nextState, state.knowledgePoints),
    })),
  setSessions: (nextState) =>
    set((state) => ({ sessions: resolveState(nextState, state.sessions) })),
  setSourceAssets: (nextState) =>
    set((state) => ({
      sourceAssets: resolveState(nextState, state.sourceAssets),
    })),
  setProjectMaterialIdsByProject: (nextState) =>
    set((state) => ({
      projectMaterialIdsByProject: resolveState(
        nextState,
        state.projectMaterialIdsByProject,
      ),
    })),
}));
