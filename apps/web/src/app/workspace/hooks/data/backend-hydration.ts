import { startTransition, type SetStateAction } from "react";
import type { UIMessage } from "ai";
import { sourceAssets as demoSourceAssets } from "@/data/demo";
import { getAgentBaseUrl } from "@/lib/agent-client";
import {
  getWorkspaceProjectBootstrap,
  getWorkspaceSessionDetail,
  listWorkspaceProjects,
} from "@/lib/agent-workspace-client";
import type { AgentEntryMode } from "@/domain/agent-runtime";
import type {
  KnowledgePointItem,
  ProjectItem,
  SessionItem,
} from "@/domain/project-workspace";
import type { SourceAsset } from "@/domain/types";
import {
  buildBackendWorkspaceSnapshot,
  type BackendWorkspaceSnapshot,
} from "@/app/workspace/model/backend-adapter";

interface SelectionOptions {
  readonly preferredKnowledgePointId?: string;
  readonly preferredProjectId?: string;
  readonly preferredSessionId?: string;
}

export interface WorkspaceBackendHydrationTarget {
  readonly selectedProjectId: string;
  readonly selectedKnowledgePointId: string;
  readonly selectedSessionId: string;
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
  readonly sessionEntryModesSetter: (
    nextState: SetStateAction<Record<string, AgentEntryMode>>,
  ) => void;
  readonly setSessionSourceAssetIds: (
    nextState: SetStateAction<Record<string, ReadonlyArray<string>>>,
  ) => void;
  readonly setSessionMessagesById: (
    nextState: SetStateAction<Record<string, UIMessage[]>>,
  ) => void;
  readonly setSelectedProjectId: (nextState: SetStateAction<string>) => void;
  readonly setSelectedKnowledgePointId: (nextState: SetStateAction<string>) => void;
  readonly setSelectedSessionId: (nextState: SetStateAction<string>) => void;
}

function resolveProjectId(
  projects: ReadonlyArray<ProjectItem>,
  preferredProjectId: string | undefined,
): string {
  if (preferredProjectId && projects.some((project) => project.id === preferredProjectId)) {
    return preferredProjectId;
  }

  return projects[0]?.id ?? "";
}

function resolveKnowledgePointId(
  knowledgePoints: ReadonlyArray<KnowledgePointItem>,
  projectId: string,
  preferredKnowledgePointId: string | undefined,
): string {
  const projectPoints = knowledgePoints.filter((point) => point.projectId === projectId);
  if (
    preferredKnowledgePointId
    && projectPoints.some((point) => point.id === preferredKnowledgePointId)
  ) {
    return preferredKnowledgePointId;
  }

  return projectPoints[0]?.id ?? "";
}

function resolveSessionId(
  sessions: ReadonlyArray<SessionItem>,
  projectId: string,
  preferredSessionId: string | undefined,
): string {
  const projectSessions = sessions.filter((session) => session.projectId === projectId);
  if (
    preferredSessionId
    && projectSessions.some((session) => session.id === preferredSessionId)
  ) {
    return preferredSessionId;
  }

  return "";
}

export async function fetchBackendWorkspaceSnapshot(
  options?: { signal?: AbortSignal },
): Promise<BackendWorkspaceSnapshot | null> {
  if (getAgentBaseUrl() === null) {
    return null;
  }

  const projects = await listWorkspaceProjects({ signal: options?.signal });
  if (projects.length === 0) {
    return null;
  }

  const bootstraps = await Promise.all(
    projects.map((project) =>
      getWorkspaceProjectBootstrap(project.id, { signal: options?.signal })),
  );
  const sessionDetails = await Promise.all(
    bootstraps.flatMap((bootstrap) =>
      bootstrap.sessions.map((session) =>
        getWorkspaceSessionDetail(bootstrap.project.id, session.id, {
          signal: options?.signal,
        }))),
  );

  return buildBackendWorkspaceSnapshot({
    bootstraps,
    sessionDetails,
    seedSourceAssets: demoSourceAssets,
  });
}

export function applyBackendWorkspaceSnapshot(
  target: WorkspaceBackendHydrationTarget,
  snapshot: BackendWorkspaceSnapshot,
  options?: SelectionOptions,
): void {
  const nextProjectId = resolveProjectId(
    snapshot.projects,
    options?.preferredProjectId ?? target.selectedProjectId,
  );
  const nextKnowledgePointId = resolveKnowledgePointId(
    snapshot.knowledgePoints,
    nextProjectId,
    options?.preferredKnowledgePointId ?? target.selectedKnowledgePointId,
  );
  const nextSessionId = resolveSessionId(
    snapshot.sessions,
    nextProjectId,
    options?.preferredSessionId ?? target.selectedSessionId,
  );

  startTransition(() => {
    target.setProjects(snapshot.projects);
    target.setKnowledgePoints(snapshot.knowledgePoints);
    target.setSessions(snapshot.sessions);
    target.setSourceAssets(snapshot.sourceAssets);
    target.setProjectMaterialIdsByProject(snapshot.projectMaterialIdsByProject);
    target.sessionEntryModesSetter(snapshot.sessionEntryModes);
    target.setSessionSourceAssetIds(snapshot.sessionSourceAssetIds);
    target.setSessionMessagesById(snapshot.sessionMessagesById);
    target.setSelectedProjectId(nextProjectId);
    target.setSelectedKnowledgePointId(nextKnowledgePointId);
    target.setSelectedSessionId(nextSessionId);
  });
}

export async function hydrateWorkspaceFromBackend(
  target: WorkspaceBackendHydrationTarget,
  options?: SelectionOptions & { signal?: AbortSignal },
): Promise<boolean> {
  const snapshot = await fetchBackendWorkspaceSnapshot({
    signal: options?.signal,
  });

  if (snapshot === null) {
    return false;
  }

  applyBackendWorkspaceSnapshot(target, snapshot, options);
  return true;
}
