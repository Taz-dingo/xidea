import { useEffect, useState, type ReactElement } from "react";
import { Archive, ArrowLeft, FilePenLine, Trash2, X } from "lucide-react";
import type { KnowledgePointItem, SessionItem } from "@/domain/project-workspace";
import type { ReviewHeatmapCell } from "@/domain/review-heatmap";
import type { SourceAsset } from "@/domain/types";
import {
  AssetListGrid,
  getSessionDisplayTitle,
  getKnowledgePointAccent,
  MetricTile,
  SessionCard,
} from "@/components/workspace/core";
import {
  InspectorCard,
  ReviewHeatmap,
} from "@/components/workspace/monitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface EditableKnowledgePointDraftValue {
  readonly title: string;
  readonly description: string;
}

export function KnowledgePointDetailScreen({
  draft,
  isEditing,
  knowledgePoint,
  knowledgePointAssets,
  isArchiveConfirmationOpen,
  onCancelArchiveConfirmation,
  onBack,
  onCancelEditing,
  onChangeDraft,
  onConfirmArchive,
  onDelete,
  onOpenSession,
  onSave,
  onStartArchiveConfirmation,
  onStartEditing,
  onStartReview,
  onStartStudy,
  reviewHeatmap,
  reviewHistorySummary,
  relatedSessions,
  selectedSessionId,
  showBackButton = true,
}: {
  draft: EditableKnowledgePointDraftValue;
  isEditing: boolean;
  knowledgePoint: KnowledgePointItem;
  knowledgePointAssets: ReadonlyArray<SourceAsset>;
  isArchiveConfirmationOpen: boolean;
  onCancelArchiveConfirmation: () => void;
  onBack: () => void;
  onCancelEditing: () => void;
  onChangeDraft: (draft: EditableKnowledgePointDraftValue) => void;
  onConfirmArchive: () => void;
  onDelete: () => void;
  onOpenSession: (sessionId: string) => void;
  onSave: () => void;
  onStartArchiveConfirmation: () => void;
  onStartEditing: () => void;
  onStartReview: () => void;
  onStartStudy: () => void;
  reviewHeatmap: ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>>;
  reviewHistorySummary: string;
  relatedSessions: ReadonlyArray<SessionItem>;
  selectedSessionId: string;
  showBackButton?: boolean;
}): ReactElement {
  const [deleteArmed, setDeleteArmed] = useState(false);
  const showStudyAction =
    knowledgePoint.status === "active_unlearned" ||
    knowledgePoint.status === "active_learning";
  const showReviewAction = knowledgePoint.status === "active_review";

  useEffect(() => {
    if (!deleteArmed) {
      return;
    }

    const timeoutId = window.setTimeout(() => setDeleteArmed(false), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [deleteArmed]);

  useEffect(() => {
    setDeleteArmed(false);
  }, [knowledgePoint.id]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Card className="xidea-card-motion rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
          <CardContent className="space-y-5 p-6">
            {showBackButton ? (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-1.5 text-sm text-[var(--xidea-charcoal)] transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[var(--xidea-white)]"
                onClick={onBack}
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
                返回主题工作台
              </button>
            ) : null}

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-3">
                {isEditing ? (
                  <>
                    <input
                      className="w-full rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] px-3 py-2 text-lg font-medium text-[var(--xidea-near-black)] outline-none focus:border-[var(--xidea-selection-border)]"
                      onChange={(event) =>
                        onChangeDraft({ ...draft, title: event.target.value })
                      }
                      value={draft.title}
                    />
                    <Textarea
                      className="min-h-28 rounded-[0.95rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] text-sm leading-7 text-[var(--xidea-charcoal)] focus-visible:ring-[var(--xidea-selection-border)]"
                      onChange={(event) =>
                        onChangeDraft({ ...draft, description: event.target.value })
                      }
                      value={draft.description}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-xl font-medium text-[var(--xidea-near-black)]">
                        {knowledgePoint.title}
                      </p>
                      <Button
                        aria-label="编辑知识点"
                        className="h-9 w-9 shrink-0 rounded-full border-[var(--xidea-border)] p-0 text-[var(--xidea-charcoal)] hover:bg-[var(--xidea-parchment)]"
                        onClick={onStartEditing}
                        type="button"
                        variant="ghost"
                      >
                        <FilePenLine className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="max-w-3xl text-sm leading-7 text-[var(--xidea-charcoal)]">
                      {knowledgePoint.description}
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-start gap-2">
                <Button
                  aria-label={deleteArmed ? "确认删除知识卡" : "删除知识卡"}
                  className="h-9 w-9 shrink-0 rounded-full border-[var(--xidea-border)] p-0 text-[var(--xidea-charcoal)] hover:bg-[var(--xidea-parchment)]"
                  onClick={() => {
                    if (deleteArmed) {
                      onDelete();
                      return;
                    }
                    setDeleteArmed(true);
                  }}
                  title={deleteArmed ? "再点一次删除" : "删除知识卡"}
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className={deleteArmed ? "h-4 w-4 text-red-600" : "h-4 w-4"} />
                </Button>
                <Badge
                  className={`border px-3 py-1.5 text-[12px] shadow-none ${getKnowledgePointAccent(knowledgePoint.status)}`}
                  variant="outline"
                >
                  {knowledgePoint.stageLabel}
                </Badge>
                {!showBackButton ? (
                  <Button
                    aria-label="关闭知识卡弹窗"
                    className="h-10 w-10 rounded-full p-0"
                    onClick={onBack}
                    type="button"
                    variant="outline"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile label="掌握度" tone="emerald" value={`${knowledgePoint.mastery}%`} />
              <MetricTile
                label="下次复习"
                tone="sky"
                value={knowledgePoint.nextReviewLabel ?? "待安排"}
              />
              <MetricTile label="最近更新" tone="amber" value={knowledgePoint.updatedAt} />
            </div>

            <div className="flex flex-wrap gap-3">
              {isEditing ? (
                <>
                  <Button
                    className="h-11 min-w-[110px] rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                    disabled={draft.title.trim() === "" || draft.description.trim() === ""}
                    onClick={onSave}
                    type="button"
                  >
                    保存
                  </Button>
                  <Button className="h-11 min-w-[110px] rounded-full" onClick={onCancelEditing} type="button" variant="outline">
                    取消
                  </Button>
                </>
              ) : (
                <>
                  {showStudyAction ? (
                    <Button
                      className="h-11 min-w-[110px] rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                      onClick={onStartStudy}
                      type="button"
                    >
                      加入学习
                    </Button>
                  ) : null}
                  {showReviewAction ? (
                    <Button
                      className="h-11 min-w-[110px] rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                      onClick={onStartReview}
                      type="button"
                    >
                      加入复习
                    </Button>
                  ) : null}
                  {knowledgePoint.status === "archived" ? (
                    <Button
                      className="h-11 min-w-[110px] rounded-full"
                      onClick={onStartArchiveConfirmation}
                      type="button"
                      variant="outline"
                    >
                      恢复
                    </Button>
                  ) : knowledgePoint.archiveSuggestion !== null ? (
                    <Button
                      className="h-11 min-w-[148px] rounded-full border-[#d7c0ad] bg-[#fbf3eb] text-[var(--xidea-selection-text)] hover:bg-[#f5e9df]"
                      onClick={onStartArchiveConfirmation}
                      type="button"
                      variant="outline"
                    >
                      <Archive className="h-4 w-4" />
                      接受归档建议
                    </Button>
                  ) : null}
                </>
              )}
            </div>

            {!isEditing && knowledgePoint.status !== "archived" ? (
              knowledgePoint.archiveSuggestion !== null ? (
                <Card className="rounded-[1rem] border-[#e3d3c6] bg-[#faf3ee] shadow-none">
                  <CardContent className="space-y-2 px-4 py-4">
                    <div className="flex items-center gap-2 text-[var(--xidea-selection-text)]">
                      <Archive className="h-4 w-4" />
                      <p className="xidea-kicker text-[var(--xidea-selection-text)]">
                        归档建议
                      </p>
                    </div>
                    <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                      {knowledgePoint.archiveSuggestion.reason}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <p className="text-sm leading-6 text-[var(--xidea-stone)]">
                  当前还没有归档建议。系统会在知识点经过多轮学习与复习、状态足够稳定后再提醒。
                </p>
              )
            ) : null}

            {isArchiveConfirmationOpen ? (
              <Card className="rounded-[1rem] border-[#ebd5cc] bg-[#f9efea] shadow-none">
                <CardContent className="space-y-3 px-4 py-4">
                  <p className="text-sm leading-6 text-[var(--xidea-selection-text)]">
                    {knowledgePoint.status === "archived"
                      ? "确认把这个知识点重新放回复习池吗？恢复后它会重新出现在活跃工作区里。"
                      : knowledgePoint.archiveSuggestion?.reason ??
                        "确认把这个知识点移出活跃池吗？"}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      className="h-11 min-w-[120px] rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                      onClick={onConfirmArchive}
                      type="button"
                    >
                      {knowledgePoint.status === "archived" ? "确认恢复" : "确认接受建议"}
                    </Button>
                    <Button
                      className="h-11 min-w-[110px] rounded-full"
                      onClick={onCancelArchiveConfirmation}
                      type="button"
                      variant="outline"
                    >
                      取消
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium text-[var(--xidea-near-black)]">
              来源材料
            </CardTitle>
            <CardDescription>当前知识卡关联的主题材料。</CardDescription>
          </CardHeader>
          <CardContent>
            <AssetListGrid
              assets={knowledgePointAssets}
              className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
              emptyText="当前还没有挂接材料。"
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <InspectorCard
          description={reviewHistorySummary}
          title="复习热力图"
        >
          <ReviewHeatmap compact weeks={reviewHeatmap} />
        </InspectorCard>

        <InspectorCard description="这个知识卡在当前学习主题里是如何被继续推进的。" title="相关会话">
          {relatedSessions.length > 0 ? (
            relatedSessions.map((session) => (
              <SessionCard
                active={session.id === selectedSessionId}
                key={session.id}
                onClick={() => onOpenSession(session.id)}
                title={getSessionDisplayTitle(session.title, session.type)}
                type={session.type}
                updatedAt={session.updatedAt}
              />
            ))
          ) : (
            <p className="text-sm text-[var(--xidea-stone)]">
              还没有围绕这个知识点展开过独立 session。
            </p>
          )}
        </InspectorCard>
      </div>
    </div>
  );
}
