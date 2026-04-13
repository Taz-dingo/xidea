import type {
  AgentLearnerUnitState,
  AgentRequest,
  AgentRunResult,
  AgentStreamEvent,
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
