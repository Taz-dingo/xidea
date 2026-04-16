import type { WorkspaceData } from "@/app/workspace/hooks/use-data";
import { useKnowledgePointActions } from "@/app/workspace/hooks/actions/knowledge-point";
import { useNavigationActions } from "@/app/workspace/hooks/actions/navigation";
import { useProjectActions } from "@/app/workspace/hooks/actions/project";
import { useSessionActions } from "@/app/workspace/hooks/actions/session";

export function useWorkspaceActions(data: WorkspaceData) {
  return {
    ...useNavigationActions(data),
    ...useProjectActions(data),
    ...useSessionActions(data),
    ...useKnowledgePointActions(data),
  };
}
