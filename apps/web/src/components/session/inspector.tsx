import type { ReactElement } from "react";
import { PenSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getKnowledgePointAccent } from "@/components/workspace/core";
import {
  CompactNote,
  MonitorSection,
} from "@/components/workspace/monitor";
import type {
  AgentAssetSummary,
  AgentReviewInspector,
  RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type {
  KnowledgePointItem,
  ProjectItem,
} from "@/domain/project-workspace";
import type { TutorFixtureScenario } from "@/data/tutor-fixtures";

export function SessionInspector({
  activeAssetSummary,
  activeReviewInspector,
  activeRuntime,
  activeTutorFixtureId,
  hasPersistedState,
  hasStructuredRuntime,
  isBlankSession,
  isDevEnvironment,
  isUsingDevTutorFixture,
  latestReviewedLabel,
  nextReviewLabel,
  onDisableTutorFixture,
  onEditKnowledgePoint,
  onOpenKnowledgePoint,
  onSelectTutorFixture,
  relatedKnowledgePoints,
  requestSourceAssetIds,
  selectedProject,
  selectedSessionStatus,
  selectedSourceAssetIds,
  selectedUnitTitle,
  tutorFixtureScenarios,
}: {
  activeAssetSummary: AgentAssetSummary | null;
  activeReviewInspector: AgentReviewInspector | null;
  activeRuntime: RuntimeSnapshot;
  activeTutorFixtureId: string | null;
  hasPersistedState: boolean;
  hasStructuredRuntime: boolean;
  isBlankSession: boolean;
  isDevEnvironment: boolean;
  isUsingDevTutorFixture: boolean;
  latestReviewedLabel: string;
  nextReviewLabel: string;
  onDisableTutorFixture: () => void;
  onEditKnowledgePoint: (pointId: string) => void;
  onOpenKnowledgePoint: (pointId: string) => void;
  onSelectTutorFixture: (fixture: TutorFixtureScenario) => void;
  relatedKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
  requestSourceAssetIds: ReadonlyArray<string>;
  selectedProject: ProjectItem;
  selectedSessionStatus: string;
  selectedSourceAssetIds: ReadonlyArray<string>;
  selectedUnitTitle: string | null;
  tutorFixtureScenarios: ReadonlyArray<TutorFixtureScenario>;
}): ReactElement {
  return (
    <div className="space-y-4">
      <MonitorSection title="当前相关知识点">
        <div className="space-y-3">
          {relatedKnowledgePoints.map((point) => (
            <Card
              className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none"
              key={point.id}
            >
              <CardContent className="space-y-3 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                    {point.title}
                  </p>
                  <Badge
                    className={`border px-2 py-1 text-[12px] shadow-none ${getKnowledgePointAccent(point.status)}`}
                    variant="outline"
                  >
                    {point.stageLabel}
                  </Badge>
                </div>
                <p className="text-[13px] leading-6 text-[var(--xidea-charcoal)]">
                  {point.description}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] text-[var(--xidea-stone)]">
                    {point.nextReviewLabel ?? "等待下一次调度"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="h-8 rounded-full px-3"
                      onClick={() => onOpenKnowledgePoint(point.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      查看
                    </Button>
                    <Button
                      className="h-8 rounded-full px-3"
                      onClick={() => onEditKnowledgePoint(point.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <PenSquare className="h-3.5 w-3.5" />
                      编辑
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </MonitorSection>

      <MonitorSection title="本轮上下文">
        <CompactNote label="Project" value={selectedProject.name} />
        <CompactNote label="Session" value={selectedSessionStatus} />
        <CompactNote label="Mode" value={hasStructuredRuntime ? activeRuntime.decision.title : "待生成"} />
        <CompactNote label="Knowledge" value={selectedUnitTitle ?? "未指定"} />
        <p className="text-[13px] leading-6 text-[var(--xidea-stone)]">
          {hasPersistedState
            ? activeRuntime.stateSource
            : "当前还没有回读到真实 learner state，这一栏会在 session 有真实交互后变得更具体。"}
        </p>
      </MonitorSection>

      <MonitorSection title="复习提示">
        <CompactNote label="Last" value={latestReviewedLabel} />
        <CompactNote label="Next" value={nextReviewLabel} />
        <p className="text-[13px] leading-6 text-[var(--xidea-stone)]">
          {activeReviewInspector === null
            ? "当前 session 还没有回读到真实复习轨迹；完成一轮交互后会继续刷新。"
            : activeReviewInspector.summary}
        </p>
      </MonitorSection>

      <MonitorSection title="材料上下文">
        <CompactNote
          label="Selected"
          value={
            isBlankSession
              ? "0 assets"
              : selectedSourceAssetIds.length > 0
                ? `${requestSourceAssetIds.length} attached`
                : `${requestSourceAssetIds.length} linked`
          }
        />
        <CompactNote label="Context" value={activeAssetSummary?.summary ?? "等待读取真实材料上下文"} />
        {activeAssetSummary?.keyConcepts.length ? (
          <div className="flex flex-wrap gap-2">
            {activeAssetSummary.keyConcepts.slice(0, 4).map((concept) => (
              <Badge
                className="border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] px-2 py-1 text-[12px] text-[var(--xidea-charcoal)] shadow-none"
                key={concept}
                variant="outline"
              >
                {concept}
              </Badge>
            ))}
          </div>
        ) : null}
      </MonitorSection>

      {isDevEnvironment ? (
        <MonitorSection accent="Dev Only" title="Tutor Fixtures">
          <div className="space-y-2">
            <p className="text-[13px] leading-6 text-[var(--xidea-charcoal)]">
              这块只服务前端交互打磨，不属于正式 demo 叙事。
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-8 rounded-full px-3"
                onClick={onDisableTutorFixture}
                size="sm"
                type="button"
                variant={isUsingDevTutorFixture ? "outline" : "default"}
              >
                关闭
              </Button>
              {tutorFixtureScenarios.map((fixture) => (
                <Button
                  className="h-8 rounded-full px-3"
                  key={fixture.id}
                  onClick={() => onSelectTutorFixture(fixture)}
                  size="sm"
                  type="button"
                  variant={activeTutorFixtureId === fixture.id ? "default" : "outline"}
                >
                  {fixture.label}
                </Button>
              ))}
            </div>
          </div>
        </MonitorSection>
      ) : null}
    </div>
  );
}
