import { useEffect } from "react";
import { getTutorFixtureScenario } from "@/data/tutor-fixtures";
import { selectFixture } from "@/app/workspace/agent/session-fixture";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useFixtureSync({
  data,
  fixtureIdFromUrl,
}: {
  data: WorkspaceData;
  fixtureIdFromUrl: string | null;
}): void {
  useEffect(() => {
    if (!data.isDevEnvironment) {
      return;
    }
    const fixtureFromUrl = getTutorFixtureScenario(fixtureIdFromUrl);
    if (fixtureFromUrl !== null && data.devTutorFixtureState?.fixtureId !== fixtureFromUrl.id) {
      data.setDevTutorFixtureState(selectFixture(fixtureFromUrl));
    }
  }, [data, fixtureIdFromUrl]);
}
