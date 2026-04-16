import { useEffect } from "react";
import { getAgentBaseUrl, getAgentHealth } from "@/lib/agent-client";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useAgentHealth(data: WorkspaceData): void {
  useEffect(() => {
    const agentBaseUrl = getAgentBaseUrl();
    if (agentBaseUrl === null) {
      data.setAgentConnectionState("offline");
      return;
    }
    const abortController = new AbortController();
    data.setAgentConnectionState("checking");
    void getAgentHealth({ signal: abortController.signal })
      .then((healthy) => {
        if (!abortController.signal.aborted) {
          data.setAgentConnectionState(healthy ? "ready" : "offline");
        }
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          data.setAgentConnectionState("offline");
        }
      });
    return () => abortController.abort();
  }, [data]);
}
