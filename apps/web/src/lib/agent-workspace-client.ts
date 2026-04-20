import { getAgentBaseUrl } from "@/lib/agent-client";
import type {
  AgentWorkspaceCreateProjectRequest,
  AgentWorkspaceCreateSessionRequest,
  AgentWorkspaceKnowledgePointRecord,
  AgentWorkspaceProject,
  AgentWorkspaceProjectBootstrap,
  AgentWorkspaceSessionDetail,
  AgentWorkspaceUpdateKnowledgePointRequest,
  AgentWorkspaceUpdateProjectRequest,
} from "@/domain/agent-workspace";

function requireAgentBaseUrl(): string {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }
  return baseUrl;
}

async function readErrorMessage(response: Response): Promise<string> {
  const errorText = (await response.text()).trim();

  if (errorText === "") {
    return `Agent 请求失败（${response.status}）。`;
  }

  try {
    const parsed = JSON.parse(errorText) as { detail?: string };
    return parsed.detail?.trim() || errorText;
  } catch {
    return errorText;
  }
}

async function fetchAgentJson<T>(
  path: string,
  options?: {
    readonly body?: unknown;
    readonly method?: "GET" | "POST" | "PATCH";
    readonly signal?: AbortSignal;
  },
): Promise<T> {
  const baseUrl = requireAgentBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    headers:
      options?.body === undefined
        ? undefined
        : {
            "Content-Type": "application/json",
          },
    method: options?.method ?? "GET",
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function listWorkspaceProjects(
  options?: { signal?: AbortSignal },
): Promise<ReadonlyArray<AgentWorkspaceProject>> {
  return fetchAgentJson<AgentWorkspaceProject[]>("/projects", {
    signal: options?.signal,
  });
}

export async function getWorkspaceProjectBootstrap(
  projectId: string,
  options?: { signal?: AbortSignal },
): Promise<AgentWorkspaceProjectBootstrap> {
  return fetchAgentJson<AgentWorkspaceProjectBootstrap>(`/projects/${projectId}`, {
    signal: options?.signal,
  });
}

export async function createWorkspaceProject(
  request: AgentWorkspaceCreateProjectRequest,
  options?: { signal?: AbortSignal },
): Promise<AgentWorkspaceProjectBootstrap> {
  return fetchAgentJson<AgentWorkspaceProjectBootstrap>("/projects", {
    body: request,
    method: "POST",
    signal: options?.signal,
  });
}

export async function updateWorkspaceProject(
  projectId: string,
  request: AgentWorkspaceUpdateProjectRequest,
  options?: { signal?: AbortSignal },
): Promise<AgentWorkspaceProjectBootstrap> {
  return fetchAgentJson<AgentWorkspaceProjectBootstrap>(`/projects/${projectId}`, {
    body: request,
    method: "PATCH",
    signal: options?.signal,
  });
}

export async function getWorkspaceSessionDetail(
  projectId: string,
  sessionId: string,
  options?: { signal?: AbortSignal },
): Promise<AgentWorkspaceSessionDetail> {
  return fetchAgentJson<AgentWorkspaceSessionDetail>(
    `/projects/${projectId}/sessions/${sessionId}`,
    {
      signal: options?.signal,
    },
  );
}

export async function createWorkspaceSession(
  projectId: string,
  request: AgentWorkspaceCreateSessionRequest,
  options?: { signal?: AbortSignal },
): Promise<AgentWorkspaceSessionDetail> {
  return fetchAgentJson<AgentWorkspaceSessionDetail>(
    `/projects/${projectId}/sessions`,
    {
      body: request,
      method: "POST",
      signal: options?.signal,
    },
  );
}

export async function updateWorkspaceKnowledgePoint(
  projectId: string,
  knowledgePointId: string,
  request: AgentWorkspaceUpdateKnowledgePointRequest,
  options?: { signal?: AbortSignal },
): Promise<AgentWorkspaceKnowledgePointRecord> {
  return fetchAgentJson<AgentWorkspaceKnowledgePointRecord>(
    `/projects/${projectId}/knowledge-points/${knowledgePointId}`,
    {
      body: request,
      method: "PATCH",
      signal: options?.signal,
    },
  );
}
