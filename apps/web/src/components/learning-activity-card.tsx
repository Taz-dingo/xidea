import { useEffect, useState, type ReactElement } from "react";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MODE_LABELS } from "@/domain/planner";
import type {
  LearningActivity,
  LearningActivityAttempt,
  LearningActivitySubmission,
} from "@/domain/types";

function getKindLabel(kind: LearningActivity["kind"]): string {
  switch (kind) {
    case "coach-followup":
      return "导师追问";
    case "quiz":
      return "对比辨析";
    case "recall":
      return "主动回忆";
  }
}

function buildChoiceAttempt(input: {
  readonly activity: LearningActivity;
  readonly choiceId: string;
  readonly attemptNumber: number;
}): LearningActivityAttempt | null {
  if (input.activity.input.type !== "choice") {
    return null;
  }

  const choice =
    input.activity.input.choices.find((item) => item.id === input.choiceId) ?? null;
  if (choice === null) {
    return null;
  }

  const feedbackIndex = choice.isCorrect
    ? 0
    : Math.min(
        Math.max(input.attemptNumber - 1, 0),
        Math.max(choice.feedbackLayers.length - 1, 0),
      );
  const feedback =
    choice.feedbackLayers[feedbackIndex] ?? choice.analysis ?? choice.detail;

  return {
    attemptNumber: input.attemptNumber,
    responseText: choice.label,
    selectedChoiceId: choice.id,
    isCorrect: choice.isCorrect,
    feedback,
    analysis: choice.analysis,
  };
}

function getFeedbackToneClasses(tone: "success" | "retry"): string {
  return tone === "success"
    ? "border-[#bfd6a7] bg-[linear-gradient(180deg,#f7fff1_0%,#eef9e6_100%)] text-[#27481c]"
    : "border-[var(--xidea-selection-border)] bg-[linear-gradient(180deg,#fff8f4_0%,#fceddf_100%)] text-[var(--xidea-selection-text)]";
}

export function LearningActivityCard({
  activity,
  disabled,
  resolution,
  onSkip,
  onSubmit,
}: {
  activity: LearningActivity;
  disabled: boolean;
  resolution: "submitted" | "skipped" | null;
  onSkip?: (attempts?: ReadonlyArray<LearningActivityAttempt>) => void;
  onSubmit: (submission: LearningActivitySubmission) => void;
}): ReactElement {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [attempts, setAttempts] = useState<LearningActivityAttempt[]>([]);
  const [feedbackState, setFeedbackState] = useState<{
    readonly tone: "success" | "retry";
    readonly title: string;
    readonly body: string;
    readonly helper: string;
  } | null>(null);
  const [pendingSubmission, setPendingSubmission] =
    useState<LearningActivitySubmission | null>(null);

  useEffect(() => {
    setSelectedChoiceId(null);
    setDraftText("");
    setAttempts([]);
    setFeedbackState(null);
    setPendingSubmission(null);
  }, [activity.id]);

  useEffect(() => {
    if (pendingSubmission === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      onSubmit(pendingSubmission);
      setPendingSubmission(null);
    }, 720);

    return () => {
      window.clearTimeout(timer);
    };
  }, [onSubmit, pendingSubmission]);

  const isResolved = resolution !== null;
  const isChoiceActivity = activity.input.type === "choice";
  const isLocked = disabled || isResolved || pendingSubmission !== null;
  const latestAttempt = attempts.at(-1) ?? null;
  const wrongAttemptCount = attempts.filter((attempt) => attempt.isCorrect === false).length;
  const canSubmitText = draftText.trim().length >= (activity.input.type === "text" ? activity.input.minLength : 1);

  function handleChoicePick(choiceId: string): void {
    if (activity.input.type !== "choice" || isLocked) {
      return;
    }

    setSelectedChoiceId(choiceId);
    const nextAttempt = buildChoiceAttempt({
      activity,
      choiceId,
      attemptNumber: attempts.length + 1,
    });
    if (nextAttempt === null) {
      return;
    }

    const nextAttempts = [...attempts, nextAttempt];
    setAttempts(nextAttempts);
    if (nextAttempt.isCorrect) {
      setFeedbackState({
        tone: "success",
        title: attempts.length === 0 ? "答对了，继续推进" : "修正到位，进入下一张",
        body: nextAttempt.feedback ?? "这次判断已经对上关键边界了。",
        helper:
          attempts.length === 0
            ? "这一张会自动收进已完成卡组。"
            : `你在第 ${nextAttempt.attemptNumber} 次纠偏成功，这段轨迹会一起记进右侧回看区。`,
      });
      setPendingSubmission({
        activityId: activity.id,
        kind: activity.kind,
        responseText: nextAttempt.responseText,
        selectedChoiceId: nextAttempt.selectedChoiceId,
        isCorrect: true,
        attempts: nextAttempts,
        finalFeedback: nextAttempt.feedback,
        finalAnalysis: nextAttempt.analysis,
      });
      return;
    }

    setFeedbackState({
      tone: "retry",
      title:
        wrongAttemptCount === 0
          ? "还差一点，先别往下走"
          : `再收窄一步，这是第 ${wrongAttemptCount + 1} 次提示`,
      body: nextAttempt.feedback ?? "这条选择还没对上当前卡要验证的边界。",
      helper: nextAttempt.analysis ?? "不用发给 agent，先把这一张做对，系统再带你进下一张。",
    });
  }

  function handleSubmitText(): void {
    if (activity.input.type !== "text" || isLocked || !canSubmitText) {
      return;
    }

    const trimmed = draftText.trim();
    onSubmit({
      activityId: activity.id,
      kind: activity.kind,
      responseText: trimmed,
      selectedChoiceId: null,
      isCorrect: null,
      attempts: [
        {
          attemptNumber: 1,
          responseText: trimmed,
          selectedChoiceId: null,
          isCorrect: null,
          feedback: null,
          analysis: null,
        },
      ],
      finalFeedback: null,
      finalAnalysis: null,
    });
  }

  return (
    <Card className="rounded-[1.15rem] border-[var(--xidea-selection-border)] bg-[linear-gradient(180deg,#fffdf9_0%,#fcf4ee_100%)] shadow-[0_18px_40px_rgba(111,74,53,0.08)]">
      <CardHeader className="space-y-3 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className="border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] text-[var(--xidea-selection-text)] shadow-none"
            variant="outline"
          >
            当前动作
          </Badge>
          <Badge
            className="border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-stone)] shadow-none"
            variant="outline"
          >
            {getKindLabel(activity.kind)}
          </Badge>
          {activity.mode !== null ? (
            <Badge
              className="border-[var(--xidea-border)] bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)] shadow-none"
              variant="outline"
            >
              {MODE_LABELS[activity.mode]}
            </Badge>
          ) : null}
          {isChoiceActivity ? (
            <Badge
              className="border-[#d7d0c5] bg-[#fff9f3] text-[var(--xidea-stone)] shadow-none"
              variant="outline"
            >
              点选后即时判定
            </Badge>
          ) : null}
        </div>

        <div className="space-y-2">
          <CardTitle className="text-base font-medium text-[var(--xidea-near-black)]">
            {activity.title}
          </CardTitle>
          <p className="text-sm leading-7 text-[var(--xidea-charcoal)]">{activity.prompt}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-1">
        {activity.input.type === "choice" ? (
          <div className="space-y-2.5">
            {activity.input.choices.map((choice) => {
              const wasLatestWrong =
                latestAttempt?.selectedChoiceId === choice.id && latestAttempt.isCorrect === false;
              const wasLatestCorrect =
                latestAttempt?.selectedChoiceId === choice.id && latestAttempt.isCorrect === true;

              return (
                <button
                  className={
                    wasLatestCorrect
                      ? "w-full rounded-[1rem] border border-[#9dc67e] bg-[linear-gradient(180deg,#f7fff1_0%,#eef9e6_100%)] px-3.5 py-3 text-left transition-all"
                      : wasLatestWrong
                        ? "w-full rounded-[1rem] border border-[#ebb59c] bg-[linear-gradient(180deg,#fff6f1_0%,#fde8dd_100%)] px-3.5 py-3 text-left transition-all"
                        : selectedChoiceId === choice.id
                          ? "w-full rounded-[1rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-3.5 py-3 text-left transition-colors"
                          : "w-full rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3.5 py-3 text-left transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[#fff8f4]"
                  }
                  disabled={isLocked}
                  key={choice.id}
                  onClick={() => {
                    handleChoicePick(choice.id);
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                        {choice.label}
                      </p>
                      <p className="text-[13px] leading-5 text-[var(--xidea-stone)]">
                        {choice.detail}
                      </p>
                    </div>
                    {wasLatestCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5a8c34]" />
                    ) : wasLatestWrong ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#cc6d48]" />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <Textarea
            className="min-h-[7rem] rounded-[0.95rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] text-sm leading-6 text-[var(--xidea-charcoal)] shadow-none focus-visible:ring-[var(--xidea-selection-border)]"
            disabled={isLocked}
            onChange={(event) => {
              setDraftText(event.target.value);
            }}
            placeholder={activity.input.placeholder}
            value={draftText}
          />
        )}

        {feedbackState !== null ? (
          <div
            className={`rounded-[1rem] border px-4 py-3 shadow-[0_12px_24px_rgba(112,78,55,0.08)] transition-all ${getFeedbackToneClasses(feedbackState.tone)}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={
                  feedbackState.tone === "success"
                    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e3f3d8] text-[#568632]"
                    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fce4d8] text-[#d46d45]"
                }
              >
                {feedbackState.tone === "success" ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold leading-6">{feedbackState.title}</p>
                <p className="text-sm leading-6">{feedbackState.body}</p>
                <p className="text-[13px] leading-6 opacity-80">{feedbackState.helper}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-[var(--xidea-stone)]">
              {resolution === "submitted"
                ? "这轮作答已经发给 agent，接下来会基于你的表现继续决定动作。"
                : resolution === "skipped"
                  ? "这轮动作已跳过，agent 会根据当前状态重新安排下一步。"
                  : isChoiceActivity
                    ? wrongAttemptCount > 0
                      ? `已纠偏 ${wrongAttemptCount} 次，答对后会自动进入下一张。`
                      : "选一个答案就会立刻判定；答对后自动进入下一张。"
                    : "先完成这一轮动作，再继续下一轮对话。"}
            </p>
            {attempts.length > 0 ? (
              <p className="text-[12px] text-[var(--xidea-stone)]/80">
                当前累计尝试 {attempts.length} 次
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onSkip ? (
              <Button
                className="rounded-full border-[var(--xidea-border)] bg-[var(--xidea-white)] px-4 text-[var(--xidea-charcoal)] hover:bg-[var(--xidea-parchment)]"
                disabled={isLocked}
                onClick={() => onSkip(attempts)}
                type="button"
                variant="outline"
              >
                先跳过
              </Button>
            ) : null}
            {activity.input.type === "text" ? (
              <Button
                className="rounded-full bg-[var(--xidea-terracotta)] px-4 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                disabled={isLocked || !canSubmitText}
                onClick={handleSubmitText}
                type="button"
              >
                {activity.submitLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
