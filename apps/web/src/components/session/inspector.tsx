import { useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { ArrowRight, Compass, Flag, Route, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DeckHistoryDialog,
  formatDeckCompletionLabel,
  SessionDeckBadge,
} from "@/components/session/deck-history-dialog";
import { CompactNote, MonitorSection } from "@/components/workspace/monitor";
import type {
  AgentReviewInspector,
  AgentSessionOrchestration,
  RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type {
  CompletedActivityDeck,
} from "@/domain/project-session-runtime";
import { type ProjectItem } from "@/domain/project-workspace";

function DeckStackPreview({
  deck,
  onOpen,
}: {
  deck: CompletedActivityDeck;
  onOpen: () => void;
}): ReactElement {
  const latestCard = deck.cards.at(-1) ?? deck.cards[0];
  const correctCount = deck.cards.filter((card) => card.isCorrect === true).length;
  const totalAttempts = deck.cards.reduce((total, card) => total + card.attempts.length, 0);

  return (
    <button
      className="group relative block w-full text-left"
      onClick={onOpen}
      type="button"
    >
      {[2, 1].map((layer) => (
        <div
          className="pointer-events-none absolute inset-x-4 rounded-[1.05rem] border border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffdf9_0%,#f3ece6_100%)] opacity-80 transition-transform group-hover:translate-y-[-2px]"
          key={`${deck.deckKey}-layer-${layer}`}
          style={{
            top: `${layer * 10}px`,
            transform: `rotate(${layer % 2 === 0 ? 1.1 : -1}deg)`,
            zIndex: layer,
          }}
        />
      ))}
      <Card className="relative z-10 rounded-[1.15rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] shadow-none transition-transform group-hover:-translate-y-1">
        <CardContent className="space-y-3 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <SessionDeckBadge sessionType={deck.sessionType} />
                <span className="text-[12px] text-[var(--xidea-stone)]">
                  {formatDeckCompletionLabel(deck.completedAt)}
                </span>
              </div>
              <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                {latestCard?.activityTitle ?? "本轮卡组"}
              </p>
            </div>
            <Badge className="border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-stone)] shadow-none" variant="outline">
              回看
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <CompactInlineNote label="卡片" value={`${deck.cards.length} 张`} />
            <CompactInlineNote label="答对" value={`${correctCount} 张`} />
            <CompactInlineNote label="尝试" value={`${totalAttempts} 次`} />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function CompactInlineNote({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-[0.9rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-2">
      <p className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--xidea-near-black)]">{value}</p>
    </div>
  );
}

function getPlanAccent(status: AgentSessionOrchestration["status"]): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "adjusted":
      return "已调整";
    case "planned":
      return "进行中";
  }
}

function getPlanStatusTone(status: AgentSessionOrchestration["status"]): string {
  switch (status) {
    case "completed":
      return "border-[#bfd6a7] bg-[#f2f8ea] text-[#5c7f39]";
    case "adjusted":
      return "border-[#e0c5b9] bg-[#fbefe7] text-[#9d5b43]";
    case "planned":
      return "border-[#e6d8b2] bg-[#fbf5df] text-[#99741f]";
  }
}

function clampTwoLines(value: string): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
}

function PlanInfoTile({
  icon,
  label,
  value,
}: {
  icon: ReactElement;
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)]/85 px-3 py-3">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">
        <span className="text-[var(--xidea-selection-text)]">{icon}</span>
        <span>{label}</span>
      </div>
      <p
        className="mt-2 text-[13px] font-medium leading-5 text-[var(--xidea-near-black)]"
        style={clampTwoLines(value)}
      >
        {value}
      </p>
    </div>
  );
}

function LearningPlanBoard({
  activePlan,
  onOpenDetail,
}: {
  activePlan: AgentSessionOrchestration;
  onOpenDetail: () => void;
}): ReactElement {
  const completedCount = activePlan.steps.filter((step) => step.status === "completed").length;
  const totalSteps = Math.max(activePlan.steps.length, 1);
  const activeStep =
    activePlan.steps.find((step) => step.status === "active") ??
    activePlan.steps.at(completedCount) ??
    activePlan.steps[0] ??
    null;
  const routeSteps = activePlan.steps.slice(0, 4);

  return (
    <MonitorSection accent={getPlanAccent(activePlan.status)} title="当前学习计划">
      <div className="overflow-hidden rounded-[1.15rem] border border-[#e4d7ca] bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe7_100%)]">
        <div className="space-y-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[#e2d2c3] bg-[var(--xidea-white)]">
              <div className="absolute inset-[7px] rounded-full border border-dashed border-[#dcc7b4]" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--xidea-stone)]">进度</p>
                <p className="mt-1 text-xl font-semibold text-[var(--xidea-near-black)]">
                  {completedCount}/{totalSteps}
                </p>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getPlanStatusTone(activePlan.status)}`}
                >
                  {getPlanAccent(activePlan.status)}
                </span>
              </div>
              {activeStep ? (
                <div className="rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-2">
                  <p className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">当前聚焦</p>
                  <p className="mt-1 text-[13px] font-medium leading-5 text-[var(--xidea-near-black)]">
                    {activeStep.title}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <PlanInfoTile icon={<Flag className="h-3.5 w-3.5" />} label="目标" value={activePlan.objective} />
            <PlanInfoTile
              icon={<Compass className="h-3.5 w-3.5" />}
              label="焦点"
              value={activeStep?.title ?? "等待首次编排"}
            />
            <PlanInfoTile
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="状态"
              value={activePlan.last_change_reason ?? "按当前编排继续推进"}
            />
          </div>
        </div>

        {routeSteps.length > 0 ? (
          <div className="border-t border-[#eadfd3] bg-[var(--xidea-white)]/70 px-4 py-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">
              <Route className="h-3.5 w-3.5 text-[var(--xidea-selection-text)]" />
              <span>步骤轨道</span>
            </div>
            <div className="space-y-2">
              {routeSteps.map((step, index) => (
                <div className="space-y-2" key={step.knowledge_point_id}>
                  <div
                    className={
                      step.status === "completed"
                        ? "rounded-[0.95rem] border border-[#bfd6a7] bg-[#f3f8ea] px-3 py-2"
                        : step.status === "active"
                          ? "rounded-[0.95rem] border border-[var(--xidea-selection-border)] bg-[#fcf2ea] px-3 py-2"
                          : "rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-2"
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          step.status === "completed"
                            ? "h-2.5 w-2.5 rounded-full bg-[#7da25b]"
                            : step.status === "active"
                              ? "h-2.5 w-2.5 rounded-full bg-[var(--xidea-terracotta)]"
                              : "h-2.5 w-2.5 rounded-full bg-[#d8cdc2]"
                        }
                      />
                      <span className="text-[11px] text-[var(--xidea-stone)]">
                        {step.status === "completed" ? "完成" : step.status === "active" ? "当前" : "待推进"}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] font-medium leading-5 text-[var(--xidea-near-black)]">
                      {step.title}
                    </p>
                  </div>
                  {index < routeSteps.length - 1 ? (
                    <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 shrink-0 rotate-90 text-[var(--xidea-stone)]/60" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <Button
        className="w-full rounded-[0.95rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] hover:bg-[var(--xidea-selection)]"
        onClick={onOpenDetail}
        type="button"
        variant="outline"
      >
        查看详情
      </Button>
    </MonitorSection>
  );
}


export function SessionInspector({
  activeReviewInspector,
  activeRuntime,
  completedActivityDecks,
  hasPersistedState,
  hasStructuredRuntime,
  isReplayDisabled = false,
  latestReviewedLabel,
  nextReviewLabel,
  onReplayDeck,
  selectedProject,
  selectedSessionStatus,
  selectedSessionType,
}: {
  activeReviewInspector: AgentReviewInspector | null;
  activeRuntime: RuntimeSnapshot;
  completedActivityDecks: ReadonlyArray<CompletedActivityDeck>;
  hasPersistedState: boolean;
  hasStructuredRuntime: boolean;
  isReplayDisabled?: boolean;
  latestReviewedLabel: string;
  nextReviewLabel: string;
  onReplayDeck: (deck: CompletedActivityDeck) => void;
  selectedProject: ProjectItem;
  selectedSessionStatus: string;
  selectedSessionType: "project" | "study" | "review";
}): ReactElement {
  const [openDeckKey, setOpenDeckKey] = useState<string | null>(null);
  const [isPlanDetailOpen, setIsPlanDetailOpen] = useState(false);
  const previewDecks = useMemo(
    () => completedActivityDecks.slice(0, 3),
    [completedActivityDecks],
  );
  const openDeck =
    completedActivityDecks.find((deck) => deck.deckKey === openDeckKey) ?? null;
  const activePlan = activeRuntime.orchestration.current;
  const timeline = activeRuntime.orchestration.timeline;

  return (
    <>
      <div className="space-y-4">
        {selectedSessionType === "project" ? (
          <MonitorSection title="本轮上下文">
            <CompactNote label="主题" value={selectedProject.name} />
            <CompactNote label="会话" value={selectedSessionStatus} />
            <CompactNote
              label="模式"
              value={
                hasStructuredRuntime ? activeRuntime.decision.title : "研讨对话"
              }
            />
            <p className="text-[13px] leading-6 text-[var(--xidea-stone)]">
              {hasPersistedState
                ? activeRuntime.stateSource
                : "当前还没有回读到真实 learner state，这一栏会在会话有真实交互后变得更具体。"}
            </p>
          </MonitorSection>
        ) : activePlan !== null ? (
          <LearningPlanBoard
            activePlan={activePlan}
            onOpenDetail={() => setIsPlanDetailOpen(true)}
          />
        ) : (
          <MonitorSection title="当前学习计划">
            <CompactNote label="主题" value={selectedProject.name} />
            <CompactNote label="会话" value={selectedSessionStatus} />
            <p className="text-[13px] leading-6 text-[var(--xidea-stone)]">
              等待首次编排返回当前小学习计划。
            </p>
          </MonitorSection>
        )}

        {selectedSessionType === "review" ? (
          <MonitorSection title="复习提示">
            <CompactNote label="上次复习" value={latestReviewedLabel} />
            <CompactNote label="下次安排" value={nextReviewLabel} />
            <p className="text-[13px] leading-6 text-[var(--xidea-stone)]">
              {activeReviewInspector === null
                ? "当前会话还没有回读到真实复习轨迹；完成一轮交互后会继续刷新。"
                : activeReviewInspector.summary}
            </p>
          </MonitorSection>
        ) : null}

        {selectedSessionType !== "project" && previewDecks.length > 0 ? (
          <MonitorSection title="已完成卡组" accent={`${completedActivityDecks.length} 组`}>
            <div className="space-y-4">
              {previewDecks.map((deck) => (
                <DeckStackPreview
                  deck={deck}
                  key={deck.deckKey}
                  onOpen={() => setOpenDeckKey(deck.deckKey)}
                />
              ))}
            </div>
          </MonitorSection>
        ) : null}

      </div>

      <DeckHistoryDialog
        deck={openDeck}
        onClose={() => setOpenDeckKey(null)}
        onReplay={(deck) => {
          onReplayDeck(deck);
          setOpenDeckKey(null);
        }}
        replayDisabled={isReplayDisabled}
      />
      {isPlanDetailOpen && activePlan !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-8 backdrop-blur-[2px]">
          <Card className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-[0_24px_80px_rgba(20,20,19,0.18)]">
            <CardContent className="flex max-h-[85vh] flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-base font-medium text-[var(--xidea-near-black)]">完整编排记录</p>
                  <p className="text-sm text-[var(--xidea-stone)]">{activePlan.objective}</p>
                </div>
                <Button className="rounded-full" onClick={() => setIsPlanDetailOpen(false)} type="button" variant="outline">
                  <X className="h-4 w-4" />
                  关闭
                </Button>
              </div>
              <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
                {timeline.map((event, index) => (
                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[#fffaf5] shadow-none" key={`${event.kind}-${event.created_at ?? index}`}>
                    <CardContent className="space-y-2 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-[var(--xidea-near-black)]">{event.title}</p>
                        <span className="text-[12px] text-[var(--xidea-stone)]">{event.kind}</span>
                      </div>
                      <p className="text-[13px] leading-6 text-[var(--xidea-charcoal)]">{event.summary}</p>
                      {event.reason ? (
                        <p className="text-[12px] leading-5 text-[var(--xidea-stone)]">原因：{event.reason}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
