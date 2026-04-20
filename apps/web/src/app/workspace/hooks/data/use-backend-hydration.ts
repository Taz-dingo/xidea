import { useEffect, useEffectEvent, useRef } from "react";
import {
  hydrateWorkspaceFromBackend,
  type WorkspaceBackendHydrationTarget,
} from "@/app/workspace/hooks/data/backend-hydration";

export function useWorkspaceBackendHydration(
  target: WorkspaceBackendHydrationTarget,
): void {
  const hasAttemptedHydration = useRef(false);
  const runHydration = useEffectEvent(() => {
    if (hasAttemptedHydration.current) {
      return;
    }

    hasAttemptedHydration.current = true;
    void hydrateWorkspaceFromBackend(target).catch(() => {
      hasAttemptedHydration.current = false;
    });
  });

  useEffect(() => {
    runHydration();
  }, [runHydration]);
}
