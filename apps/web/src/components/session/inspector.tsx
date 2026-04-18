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
import type { CompletedActivityDeck } from "@/domain/project-session-runtime";
import type {
  KnowledgePointItem,
  ProjectItem,
} from "@/domain/project-workspace";
import type { TutorFixtureScenario } from "@/data/tutor-fixtures";

function formatDeckCompletionLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) {
    return "刚刚完成";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function SessionInspector({
  activeAssetSummary,
  activeReviewInspector,
  activeRuntime,
  activeTutorFixtureId,
  completedActivityDecks,
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
  selectedSessionType,
  selectedSourceAssetIds,
  selectedUnitTitle,
  tutorFixtureScenarios,
}: {
  activeAssetSummary: AgentAssetSummary | null;
  activeReviewInspector: AgentReviewInspector | null;
  activeRuntime: RuntimeSnapshot;
  activeTutorFixtureId: string | null;
  completedActivityDecks: ReadonlyArray<CompletedActivityDeck>;
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
  selectedSessionType: "project" | "study" | "review";
  selectedSourceAssetIds: ReadonlyArray<string>;
  selectedUnitTitle: string | null;
  tutorFixtureScenarios: ReadonlyArray<TutorFixtureScenario>;
}): ReactElement {
  return (
    <div className="space-y-4">
      {selectedSessionType !== "project" ? (
        <MonitorSection title="当前知识点">
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
      ) : null}

      <MonitorSection title="本轮上下文">
        <CompactNote label="Project" value={selectedProject.name} />
        <CompactNote label="Session" value={selectedSessionStatus} />
        <CompactNote label="Mode" value={hasStructuredRuntime ? activeRuntime.decision.title : "待生成"} />
        {selectedSessionType !== "project" ? (
          <CompactNote label="Knowledge" value={selectedUnitTitle ?? "未指定"} />
        ) : null}
        <p className="text-[13px] leading-6 text-[var(--xidea-stone)]">
          {hasPersistedState
            ? activeRuntime.stateSource
            : "当前还没有回读到真实 learner state，这一栏会在 session 有真实交互后变得更具体。"}
        </p>
      </MonitorSection>

      {selectedSessionType === "review" ? (
        <MonitorSection title="复习提示">
          <CompactNote label="Last" value={latestReviewedLabel} />
          <CompactNote label="Next" value={nextReviewLabel} />
          <p className="text-[13px] leading-6 text-[var(--xidea-stone)]">
            {activeReviewInspector === null
              ? "当前 session 还没有回读到真实复习轨迹；完成一轮交互后会继续刷新。"
              : activeReviewInspector.summary}
          </p>
        </MonitorSection>
      ) : null}

      {selectedSessionType !== "project" && completedActivityDecks.length > 0 ? (
        <MonitorSection title="已完成卡组">
          <div className="space-y-3">
            {completedActivityDecks.map((deck) => (
              <Card
                className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none"
                key={deck.deckKey}
              >
                <CardContent className="space-y-3 px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                        {deck.sessionType === "review" ? "复习卡组" : "学习卡组"}
                      </p>
                      <p className="text-[12px] text-[var(--xidea-stone)]">
                        {deck.cards.length} 张卡 · {formatDeckCompletionLabel(deck.completedAt)}
                      </p>
                    </div>
                    <Badge
                      className="border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-stone)] shadow-none"
                      variant="outline"
                    >
                      回看
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {deck.cards.map((card) => (
                      <div
                        className="rounded-[0.95rem] border border-[var(--xidea-border)] bg-[#fffaf5] px-3 py-3"
                        key={card.activityId}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                              {card.activityTitle}
                            </p>
                            <p className="text-[13px] leading-6 text-[var(--xidea-charcoal)]">
                              {card.activityPrompt}
                            </p>
                          </div>
                          <Badge
                            className={
                              card.action === "skip"
                                ? "border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-stone)] shadow-none"
                                : card.isCorrect === true
                                  ? "border-[#bfd6a7] bg-[#f3fbe9] text-[#4f7c2f] shadow-none"
                                  : "border-[var(--xidea-selection-border)] bg-[#fff3eb] text-[var(--xidea-selection-text)] shadow-none"
                            }
                            variant="outline"
                          >
                            {card.action === "skip"
                              ? "已跳过"
                              : card.isCorrect === true
                                ? `已完成 · ${card.attempts.length} 次`
                                : "未完成"}
                          </Badge>
                        </div>

                        {card.attempts.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {card.attempts.map((attempt) => (
                              <div
                                className="rounded-[0.9rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-2.5"
                                key={`${card.activityId}-${attempt.attemptNumber}`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[13px] font-medium text-[var(--xidea-near-black)]">
                                    第 {attempt.attemptNumber} 次：
                                    {attempt.responseText || "未作答"}
                                  </p>
                                  <span
                                    className={
                                      attempt.isCorrect === true
                                        ? "text-[12px] text-[#5a8c34]"
                                        : attempt.isCorrect === false
                                          ? "text-[12px] text-[#cc6d48]"
                                          : "text-[12px] text-[var(--xidea-stone)]"
                                    }
                                  >
                                    {attempt.isCorrect === true
                                      ? "答对"
                                      : attempt.isCorrect === false
                                        ? "纠偏中"
                                        : "已提交"}
                                  </span>
                                </div>
                                {attempt.feedback ? (
                                  <p className="mt-1.5 text-[12px] leading-5 text-[var(--xidea-charcoal)]">
                                    {attempt.feedback}
                                  </p>
                                ) : null}
                                {attempt.isCorrect === false && attempt.analysis ? (
                                  <p className="mt-1 text-[12px] leading-5 text-[var(--xidea-stone)]">
                                    分析：{attempt.analysis}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-[12px] leading-5 text-[var(--xidea-stone)]">
                            这一张没有留下作答记录。
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </MonitorSection>
      ) : null}

      {selectedSessionType === "project" ? (
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
          <CompactNote
            label="Context"
            value={activeAssetSummary?.summary ?? "等待读取真实材料上下文"}
          />
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
      ) : null}

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
