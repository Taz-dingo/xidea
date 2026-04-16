import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CompactNote,
  getKnowledgePointAccent,
  MonitorSection,
  ReviewHeatmap,
} from "@/components/project-workspace-primitives";
import type {
  AgentAssetSummary,
  AgentReviewInspector,
  RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type { ReviewHeatmapCell } from "@/domain/review-heatmap";
import type {
  KnowledgePointItem,
  ProjectItem,
} from "@/domain/project-workspace";
import type { TutorFixtureScenario } from "@/data/tutor-fixtures";

export function ProjectSessionInspector({
  activeAssetSummary,
  activeReviewInspector,
  activeRuntime,
  activeTutorFixtureId,
  generatedProfileSummary,
  hasPersistedState,
  hasStructuredRuntime,
  isBlankSession,
  isDevEnvironment,
  isUsingDevTutorFixture,
  latestReviewedLabel,
  nextReviewLabel,
  onDisableTutorFixture,
  onOpenKnowledgePoint,
  onSelectTutorFixture,
  relatedKnowledgePoints,
  requestSourceAssetIds,
  reviewHeatmap,
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
  generatedProfileSummary: string;
  hasPersistedState: boolean;
  hasStructuredRuntime: boolean;
  isBlankSession: boolean;
  isDevEnvironment: boolean;
  isUsingDevTutorFixture: boolean;
  latestReviewedLabel: string;
  nextReviewLabel: string;
  onDisableTutorFixture: () => void;
  onOpenKnowledgePoint: (pointId: string) => void;
  onSelectTutorFixture: (fixture: TutorFixtureScenario) => void;
  relatedKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
  requestSourceAssetIds: ReadonlyArray<string>;
  reviewHeatmap: ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>>;
  selectedProject: ProjectItem;
  selectedSessionStatus: string;
  selectedSourceAssetIds: ReadonlyArray<string>;
  selectedUnitTitle: string | null;
  tutorFixtureScenarios: ReadonlyArray<TutorFixtureScenario>;
}): ReactElement {
  return (
    <div className="space-y-4">
      {isDevEnvironment ? (
        <MonitorSection accent="Mock" title="Tutor Fixtures">
          <div className="space-y-2">
            <p className="text-[13px] leading-6 text-[var(--xidea-charcoal)]">
              用前端本地场景直接打磨 activity 插卡、gating 和失败回滚，不用起后端。
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

      <MonitorSection title="当前相关知识点">
        <div className="space-y-3">
          {relatedKnowledgePoints.map((point) => (
            <button
              className="w-full rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-4 py-3 text-left transition-colors hover:border-[var(--xidea-selection-border)]"
              key={point.id}
              onClick={() => onOpenKnowledgePoint(point.id)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--xidea-near-black)]">{point.title}</p>
                <Badge
                  className={`border px-2 py-1 text-[12px] shadow-none ${getKnowledgePointAccent(point.status)}`}
                  variant="outline"
                >
                  {point.stageLabel}
                </Badge>
              </div>
              <p className="mt-2 text-[13px] leading-6 text-[var(--xidea-charcoal)]">{point.description}</p>
              <p className="mt-2 text-[12px] text-[var(--xidea-stone)]">{point.nextReviewLabel ?? "等待下一次调度"}</p>
            </button>
          ))}
        </div>
      </MonitorSection>

      <MonitorSection
        accent={
          activeRuntime.source === "live-agent"
            ? "Live"
            : activeRuntime.source === "hydrated-state"
              ? "Hydrated"
              : "Mock"
        }
        title="Session Summary"
      >
        <CompactNote label="Project" value={selectedProject.name} />
        <CompactNote label="Session" value={selectedSessionStatus} />
        <CompactNote label="Mode" value={hasStructuredRuntime ? activeRuntime.decision.title : "待生成"} />
        <CompactNote
          label="State"
          value={hasPersistedState ? activeRuntime.stateSource : "当前 session 还没有真实 learner state。"}
        />
        {hasPersistedState ? (
          <div className="rounded-[0.95rem] bg-[var(--xidea-selection)] px-3 py-3 text-[13px] leading-6 text-[var(--xidea-charcoal)]">
            {generatedProfileSummary}
          </div>
        ) : null}
      </MonitorSection>

      <MonitorSection title="Review Engine">
        <ReviewHeatmap weeks={reviewHeatmap} />
        <CompactNote label="Last" value={latestReviewedLabel} />
        <CompactNote label="Next" value={nextReviewLabel} />
        <p className="text-[13px] leading-6 text-[var(--xidea-stone)]">
          {activeReviewInspector === null
            ? "当前 session 还没有回读到真实复习轨迹；完成一轮交互后会继续刷新。"
            : "热力图会跟随 Review Engine 的安排与已完成事件一起更新。"}
        </p>
      </MonitorSection>

      <MonitorSection title="Materials">
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
        <CompactNote label="Knowledge" value={selectedUnitTitle ?? "未指定"} />
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
    </div>
  );
}
