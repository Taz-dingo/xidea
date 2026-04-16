import type { ReactElement } from "react";
import { ProjectWorkspaceShell } from "@/app/project-workspace-shell";
import { useProjectWorkspaceController } from "@/app/use-project-workspace-controller";

export function App(): ReactElement {
  const controller = useProjectWorkspaceController();

  return <ProjectWorkspaceShell controller={controller} />;
}
