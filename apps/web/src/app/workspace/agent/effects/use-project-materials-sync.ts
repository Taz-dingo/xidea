import { useEffect } from "react";
import { listProjectMaterials } from "@/lib/agent-client";
import type { SourceAsset } from "@/domain/types";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

function hasSameAssetIds(
  left: ReadonlyArray<SourceAsset>,
  right: ReadonlyArray<SourceAsset>,
): boolean {
  return left.length === right.length && left.every((asset, index) => asset.id === right[index]?.id);
}

function hasSameIds(
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>,
): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function useProjectMaterialsSync({
  data,
  projectId,
}: {
  data: WorkspaceData;
  projectId: string;
}): void {
  const {
    agentConnectionState,
    setProjectAssetsByProject,
    setProjectMaterialIdsByProject,
  } = data;

  useEffect(() => {
    if (agentConnectionState !== "ready") {
      return;
    }

    const abortController = new AbortController();
    void listProjectMaterials(projectId, { signal: abortController.signal })
      .then((materials) => {
        if (abortController.signal.aborted) {
          return;
        }

        setProjectAssetsByProject((current) => {
          const currentAssets = current[projectId] ?? [];
          const remainingAssets = currentAssets.filter(
            (asset) => !materials.some((material) => material.id === asset.id),
          );
          const nextAssets = [...materials, ...remainingAssets];
          if (hasSameAssetIds(currentAssets, nextAssets)) {
            return current;
          }
          return {
            ...current,
            [projectId]: nextAssets,
          };
        });

        setProjectMaterialIdsByProject((current) => {
          const currentIds = current[projectId] ?? [];
          const nextIds = Array.from(
            new Set([...materials.map((material) => material.id), ...currentIds]),
          );
          if (hasSameIds(currentIds, nextIds)) {
            return current;
          }
          return {
            ...current,
            [projectId]: nextIds,
          };
        });
      })
      .catch(() => undefined);

    return () => abortController.abort();
  }, [
    agentConnectionState,
    projectId,
    setProjectAssetsByProject,
    setProjectMaterialIdsByProject,
  ]);
}
