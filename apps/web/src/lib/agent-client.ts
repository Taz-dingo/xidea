import type { AgentRequest, AgentRunResult } from "@/domain/agent-runtime";

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
