import type {
  AgentAssetSummary,
  AgentInspectorBootstrap,
  AgentLearnerUnitState,
  AgentRequest,
  AgentReviewInspector,
  AgentRunResult,
  AgentStreamEvent,
  AgentThreadContext,
} from "@/domain/agent-runtime";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
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
  options?: { signal?: AbortSignal },
): Promise<AgentAssetSummary> {
  const baseUrl = getAgentBaseUrl();
  if (baseUrl === null) {
    throw new Error("未配置 agent API 地址。开发环境可直接启动本地代理，或设置 VITE_AGENT_API_BASE_URL。");
  }

  const summaryUrl = new URL(`${baseUrl}/assets/summary`, window.location.origin);
  summaryUrl.searchParams.set("asset_ids", assetIds.join(","));

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
