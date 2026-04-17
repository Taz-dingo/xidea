import { useEffect } from "react";
import { getAgentBaseUrl, getAgentHealth } from "@/lib/agent-client";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useAgentHealth(data: WorkspaceData): void {
  const { setAgentConnectionState } = data;

  useEffect(() => {
    const agentBaseUrl = getAgentBaseUrl();
    if (agentBaseUrl === null) {
      setAgentConnectionState("offline");
      return;
    }
    const abortController = new AbortController();
    setAgentConnectionState("checking");
    void getAgentHealth({ signal: abortController.signal })
      .then((healthy) => {
        if (!abortController.signal.aborted) {
          setAgentConnectionState(healthy ? "ready" : "offline");
        }
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setAgentConnectionState("offline");
        }
      });
    return () => abortController.abort();
  }, [setAgentConnectionState]);
}
