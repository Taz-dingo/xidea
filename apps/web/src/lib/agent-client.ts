import type {
  AgentAssetSummary,
  AgentInspectorBootstrap,
  AgentKnowledgePointRecord,
  AgentKnowledgePointSuggestion,
  AgentKnowledgePointSuggestionResolution,
  AgentMessage,
  AgentProjectThreadRecord,
  AgentLearnerUnitState,
  AgentRequest,
  AgentReviewInspector,
  AgentRunResult,
  AgentStreamEvent,
  AgentThreadContext,
} from "@/domain/agent-runtime";
import type { CompletedActivityDeck } from "@/domain/project-session-runtime";
import type { SourceAsset } from "@/domain/types";

type RawSourceAsset = SourceAsset & {
  readonly source_uri?: string | null;
  readonly content_ref?: string | null;
  readonly created_at?: string | null;
  readonly updated_at?: string | null;
};

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeSourceAsset(asset: RawSourceAsset): SourceAsset {
  return {
    id: asset.id,
    title: asset.title,
    kind: asset.kind,
    topic: asset.topic,
    summary: asset.summary ?? null,
    sourceUri: asset.sourceUri ?? asset.source_uri ?? null,
    contentRef: asset.contentRef ?? asset.content_ref ?? null,
    status: asset.status ?? null,
    createdAt: asset.createdAt ?? asset.created_at ?? null,
    updatedAt: asset.updatedAt ?? asset.updated_at ?? null,
  };
}

export function getAgentBaseUrl(): string | null {
  const configuredUrl = import.meta.env.VITE_AGENT_API_BASE_URL?.trim();
  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  if (import.meta.env.DEV) {
    return "/agent-api";
  }

  return null;
}

export async function getAgentHealth(
  options?: { signal?: AbortSignal },
): Promise<boolean> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    return false;
  }

  const response = await fetch(`${baseUrl}/health`, {
    method: "GET",
    signal: options?.signal,
  });

  return response.ok;
}

export async function runAgentV0(
  request: AgentRequest,
  options?: { signal?: AbortSignal },
): Promise<AgentRunResult> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const response = await fetch(`${baseUrl}/runs/v0`, {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Agent 请求失败（${response.status}）。`);
  }

  return (await response.json()) as AgentRunResult;
}

function parseSseEventBlock(block: string): AgentStreamEvent | null {
  const lines = block.split("\n");
  let eventName = "";
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (eventName === "" || dataLines.length === 0) {
    return null;
  }

  const payload = JSON.parse(dataLines.join("\n")) as AgentStreamEvent;
  return payload;
}

export async function runAgentV0Stream(
  request: AgentRequest,
  options?: {
    signal?: AbortSignal;
    onEvent?: (event: AgentStreamEvent) => void;
  },
): Promise<ReadonlyArray<AgentStreamEvent>> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const response = await fetch(`${baseUrl}/runs/v0/stream`, {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: options?.signal,
  });

  if (!response.ok || response.body === null) {
    const errorText = await response.text();
    throw new Error(errorText || `Agent 请求失败（${response.status}）。`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: AgentStreamEvent[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const parsedEvent = parseSseEventBlock(block);
      if (parsedEvent === null) {
        continue;
      }

      events.push(parsedEvent);
      options?.onEvent?.(parsedEvent);
    }

    if (done) {
      break;
    }
  }

  const trailingEvent = parseSseEventBlock(buffer);
  if (trailingEvent !== null) {
    events.push(trailingEvent);
    options?.onEvent?.(trailingEvent);
  }

  return events;
}

export async function getLearnerUnitState(
  threadId: string,
  unitId: string,
  options?: { signal?: AbortSignal },
): Promise<AgentLearnerUnitState | null> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const response = await fetch(`${baseUrl}/threads/${threadId}/units/${unitId}`, {
    method: "GET",
    signal: options?.signal,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Learner state 请求失败（${response.status}）。`);
  }

  return (await response.json()) as AgentLearnerUnitState;
}

export async function getThreadContext(
  threadId: string,
  options?: { signal?: AbortSignal },
): Promise<AgentThreadContext | null> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const response = await fetch(`${baseUrl}/threads/${threadId}/context`, {
    method: "GET",
    signal: options?.signal,
  });

  if (response.status === 204 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Thread context 请求失败（${response.status}）。`);
  }

  return (await response.json()) as AgentThreadContext;
}

export async function listProjectThreads(
  projectId: string,
  options?: { signal?: AbortSignal },
): Promise<ReadonlyArray<AgentProjectThreadRecord>> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const response = await fetch(`${baseUrl}/projects/${projectId}/threads`, {
    method: "GET",
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Project threads 请求失败（${response.status}）。`);
  }

  return (await response.json()) as ReadonlyArray<AgentProjectThreadRecord>;
}

export async function listProjectKnowledgePoints(
  projectId: string,
  options?: { signal?: AbortSignal },
): Promise<ReadonlyArray<AgentKnowledgePointRecord>> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const response = await fetch(`${baseUrl}/projects/${projectId}/knowledge-points`, {
    method: "GET",
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Project knowledge points 请求失败（${response.status}）。`);
  }

  return (await response.json()) as ReadonlyArray<AgentKnowledgePointRecord>;
}

export async function getThreadMessages(
  threadId: string,
  options?: { signal?: AbortSignal; limit?: number },
): Promise<ReadonlyArray<AgentMessage>> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const messagesUrl = new URL(`${baseUrl}/threads/${threadId}/messages`, window.location.origin);
  if (options?.limit !== undefined) {
    messagesUrl.searchParams.set("limit", String(options.limit));
  }

  const response = await fetch(messagesUrl.toString(), {
    method: "GET",
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Thread messages 请求失败（${response.status}）。`);
  }

  return (await response.json()) as ReadonlyArray<AgentMessage>;
}

export async function getThreadActivityDecks(
  threadId: string,
  options?: { signal?: AbortSignal },
): Promise<ReadonlyArray<CompletedActivityDeck>> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const response = await fetch(`${baseUrl}/threads/${threadId}/activity-decks`, {
    method: "GET",
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Thread activity decks 请求失败（${response.status}）。`);
  }

  const records = (await response.json()) as ReadonlyArray<{
    readonly deck_id: string;
    readonly session_id: string;
    readonly session_type: CompletedActivityDeck["sessionType"];
    readonly knowledge_point_id: string | null;
    readonly completed_at: string;
    readonly cards: CompletedActivityDeck["cards"];
  }>;

  return records.map((record) => ({
    deckKey: record.deck_id,
    sessionId: record.session_id,
    sessionType: record.session_type,
    knowledgePointId: record.knowledge_point_id,
    completedAt: record.completed_at,
    cards: record.cards,
  }));
}

export async function confirmKnowledgePointSuggestion(
  projectId: string,
  suggestionId: string,
  options?: { signal?: AbortSignal },
): Promise<AgentKnowledgePointSuggestionResolution> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const response = await fetch(
    `${baseUrl}/projects/${projectId}/knowledge-point-suggestions/${suggestionId}/confirm`,
    {
      method: "POST",
      signal: options?.signal,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `知识点确认失败（${response.status}）。`);
  }

  return (await response.json()) as AgentKnowledgePointSuggestionResolution;
}

export async function deleteThread(
  threadId: string,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const response = await fetch(`${baseUrl}/threads/${threadId}`, {
    method: "DELETE",
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `删除会话失败（${response.status}）。`);
  }
}

export async function deleteKnowledgePoint(
  projectId: string,
  knowledgePointId: string,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const response = await fetch(
    `${baseUrl}/projects/${projectId}/knowledge-points/${knowledgePointId}`,
    {
      method: "DELETE",
      signal: options?.signal,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `删除知识卡失败（${response.status}）。`);
  }
}

export async function getInspectorBootstrap(
  threadId: string,
  unitId: string,
  options?: { signal?: AbortSignal },
): Promise<AgentInspectorBootstrap> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const bootstrapUrl = new URL(`${baseUrl}/threads/${threadId}/inspector-bootstrap`, window.location.origin);
  bootstrapUrl.searchParams.set("unit_id", unitId);

  const response = await fetch(bootstrapUrl.toString(), {
    method: "GET",
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Inspector bootstrap 请求失败（${response.status}）。`);
  }

  return (await response.json()) as AgentInspectorBootstrap;
}

export async function getReviewInspector(
  threadId: string,
  unitId: string,
  options?: { signal?: AbortSignal; days?: number },
): Promise<AgentReviewInspector | null> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const reviewUrl = new URL(`${baseUrl}/threads/${threadId}/units/${unitId}/review-inspector`, window.location.origin);
  reviewUrl.searchParams.set("days", String(options?.days ?? 35));

  const response = await fetch(reviewUrl.toString(), {
    method: "GET",
    signal: options?.signal,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Review inspector 请求失败（${response.status}）。`);
  }

  return (await response.json()) as AgentReviewInspector;
}

export async function getAssetSummary(
  assetIds: ReadonlyArray<string>,
  options?: { signal?: AbortSignal; projectId?: string },
): Promise<AgentAssetSummary> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const summaryUrl = new URL(`${baseUrl}/assets/summary`, window.location.origin);
  summaryUrl.searchParams.set("asset_ids", assetIds.join(","));
  if (options?.projectId) {
    summaryUrl.searchParams.set("project_id", options.projectId);
  }

  const response = await fetch(summaryUrl.toString(), {
    method: "GET",
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Asset summary 请求失败（${response.status}）。`);
  }

  return (await response.json()) as AgentAssetSummary;
}

export async function listProjectMaterials(
  projectId: string,
  options?: { signal?: AbortSignal },
): Promise<ReadonlyArray<SourceAsset>> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const response = await fetch(`${baseUrl}/projects/${projectId}/materials`, {
    method: "GET",
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Project materials 请求失败（${response.status}）。`);
  }

  const payload = (await response.json()) as ReadonlyArray<RawSourceAsset>;
  return payload.map(normalizeSourceAsset);
}

async function encodeFileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

export async function uploadProjectMaterial(input: {
  readonly projectId: string;
  readonly file: File;
  readonly topic?: string | null;
  readonly signal?: AbortSignal;
}): Promise<SourceAsset> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  if (input.file.size > 4 * 1024 * 1024) {
    throw new Error("单份材料暂时限制在 4MB 以内。");
  }

  const response = await fetch(`${baseUrl}/projects/${input.projectId}/materials/upload`, {
    body: JSON.stringify({
      filename: input.file.name,
      content_base64: await encodeFileToBase64(input.file),
      topic: input.topic ?? null,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: input.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `材料上传失败（${response.status}）。`);
  }

  const payload = (await response.json()) as RawSourceAsset;
  return normalizeSourceAsset(payload);
}
