import type { SetStateAction } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { resetLegacyWorkspaceStorage } from "@/app/workspace/store/persistence";
import type {
  AppScreen,
  HomeSection,
  WorkspaceSection,
} from "@/domain/project-workspace";
import type {
  PendingInitialPrompt,
  PendingSessionIntent,
} from "@/app/workspace/model/types";

function resolveState<T>(nextState: SetStateAction<T>, currentState: T): T {
  return typeof nextState === "function"
    ? (nextState as (value: T) => T)(currentState)
    : nextState;
}

interface WorkspaceUiState {
  readonly screen: AppScreen;
  readonly homeSection: HomeSection;
  readonly workspaceSection: WorkspaceSection;
  readonly isProjectMetaOpen: boolean;
  readonly searchQuery: string;
  readonly isCreatingProject: boolean;
  readonly isEditingProjectMeta: boolean;
  readonly isEditingKnowledgePoint: boolean;
  readonly isKnowledgePointDialogOpen: boolean;
  readonly archiveConfirmationPointId: string | null;
  readonly pendingSessionIntent: PendingSessionIntent | null;
  readonly pendingInitialPrompt: PendingInitialPrompt | null;
  readonly selectedProjectId: string;
  readonly selectedSessionId: string;
  readonly selectedKnowledgePointId: string;
  readonly draftPrompt: string;
  readonly setScreen: (nextState: SetStateAction<AppScreen>) => void;
  readonly setHomeSection: (nextState: SetStateAction<HomeSection>) => void;
  readonly setWorkspaceSection: (nextState: SetStateAction<WorkspaceSection>) => void;
  readonly setIsProjectMetaOpen: (nextState: SetStateAction<boolean>) => void;
  readonly setSearchQuery: (nextState: SetStateAction<string>) => void;
  readonly setIsCreatingProject: (nextState: SetStateAction<boolean>) => void;
  readonly setIsEditingProjectMeta: (nextState: SetStateAction<boolean>) => void;
  readonly setIsEditingKnowledgePoint: (nextState: SetStateAction<boolean>) => void;
  readonly setIsKnowledgePointDialogOpen: (nextState: SetStateAction<boolean>) => void;
  readonly setArchiveConfirmationPointId: (
    nextState: SetStateAction<string | null>,
  ) => void;
  readonly setPendingSessionIntent: (
    nextState: SetStateAction<PendingSessionIntent | null>,
  ) => void;
  readonly setPendingInitialPrompt: (
    nextState: SetStateAction<PendingInitialPrompt | null>,
  ) => void;
  readonly setSelectedProjectId: (nextState: SetStateAction<string>) => void;
  readonly setSelectedSessionId: (nextState: SetStateAction<string>) => void;
  readonly setSelectedKnowledgePointId: (nextState: SetStateAction<string>) => void;
  readonly setDraftPrompt: (nextState: SetStateAction<string>) => void;
}

resetLegacyWorkspaceStorage();

export const useWorkspaceUiStore = create<WorkspaceUiState>()(
  persist(
    (set) => ({
      screen: "home",
      homeSection: "all-projects",
      workspaceSection: "overview",
      isProjectMetaOpen: false,
      searchQuery: "",
      isCreatingProject: false,
      isEditingProjectMeta: false,
      isEditingKnowledgePoint: false,
      isKnowledgePointDialogOpen: false,
      archiveConfirmationPointId: null,
      pendingSessionIntent: null,
      pendingInitialPrompt: null,
      selectedProjectId: "",
      selectedSessionId: "",
      selectedKnowledgePointId: "",
      draftPrompt: "",
      setScreen: (nextState) =>
        set((state) => ({ screen: resolveState(nextState, state.screen) })),
      setHomeSection: (nextState) =>
        set((state) => ({ homeSection: resolveState(nextState, state.homeSection) })),
      setWorkspaceSection: (nextState) =>
        set((state) => ({
          workspaceSection: resolveState(nextState, state.workspaceSection),
        })),
      setIsProjectMetaOpen: (nextState) =>
        set((state) => ({
          isProjectMetaOpen: resolveState(nextState, state.isProjectMetaOpen),
        })),
      setSearchQuery: (nextState) =>
        set((state) => ({ searchQuery: resolveState(nextState, state.searchQuery) })),
      setIsCreatingProject: (nextState) =>
        set((state) => ({
          isCreatingProject: resolveState(nextState, state.isCreatingProject),
        })),
      setIsEditingProjectMeta: (nextState) =>
        set((state) => ({
          isEditingProjectMeta: resolveState(nextState, state.isEditingProjectMeta),
        })),
      setIsEditingKnowledgePoint: (nextState) =>
        set((state) => ({
          isEditingKnowledgePoint: resolveState(nextState, state.isEditingKnowledgePoint),
        })),
      setIsKnowledgePointDialogOpen: (nextState) =>
        set((state) => ({
          isKnowledgePointDialogOpen: resolveState(nextState, state.isKnowledgePointDialogOpen),
        })),
      setArchiveConfirmationPointId: (nextState) =>
        set((state) => ({
          archiveConfirmationPointId: resolveState(
            nextState,
            state.archiveConfirmationPointId,
          ),
        })),
      setPendingSessionIntent: (nextState) =>
        set((state) => ({
          pendingSessionIntent: resolveState(nextState, state.pendingSessionIntent),
        })),
      setPendingInitialPrompt: (nextState) =>
        set((state) => ({
          pendingInitialPrompt: resolveState(nextState, state.pendingInitialPrompt),
        })),
      setSelectedProjectId: (nextState) =>
        set((state) => ({
          selectedProjectId: resolveState(nextState, state.selectedProjectId),
        })),
      setSelectedSessionId: (nextState) =>
        set((state) => ({
          selectedSessionId: resolveState(nextState, state.selectedSessionId),
        })),
      setSelectedKnowledgePointId: (nextState) =>
        set((state) => ({
          selectedKnowledgePointId: resolveState(
            nextState,
            state.selectedKnowledgePointId,
          ),
        })),
      setDraftPrompt: (nextState) =>
        set((state) => ({ draftPrompt: resolveState(nextState, state.draftPrompt) })),
    }),
    {
      name: "xidea-workspace-ui-v3",
      partialize: (state) => ({
        homeSection: state.homeSection,
        screen: state.screen,
        searchQuery: state.searchQuery,
        selectedKnowledgePointId: state.selectedKnowledgePointId,
        selectedProjectId: state.selectedProjectId,
        selectedSessionId: state.selectedSessionId,
        workspaceSection: state.workspaceSection,
      }),
      storage: createJSONStorage(() => localStorage),
      version: 3,
    },
  ),
);
