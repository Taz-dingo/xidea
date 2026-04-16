import type { ReactElement } from "react";
import type { KnowledgePointItem, SessionItem } from "@/domain/project-workspace";
import type { SourceAsset } from "@/domain/types";
import {
  getAssetKindLabel,
  getKnowledgePointAccent,
  InspectorCard,
  MetricTile,
  SessionCard,
} from "@/components/project-workspace-primitives";
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
  onArchive,
  onCancelEditing,
  onChangeDraft,
  onOpenSession,
  onSave,
  onStartEditing,
  onStartReview,
  onStartStudy,
  relatedSessions,
  selectedSessionId,
}: {
  draft: EditableKnowledgePointDraftValue;
  isEditing: boolean;
  knowledgePoint: KnowledgePointItem;
  knowledgePointAssets: ReadonlyArray<SourceAsset>;
  onArchive: () => void;
  onCancelEditing: () => void;
  onChangeDraft: (draft: EditableKnowledgePointDraftValue) => void;
  onOpenSession: (sessionId: string) => void;
  onSave: () => void;
  onStartEditing: () => void;
  onStartReview: () => void;
  onStartStudy: () => void;
  relatedSessions: ReadonlyArray<SessionItem>;
  selectedSessionId: string;
}): ReactElement {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
          <CardContent className="space-y-5 p-6">
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
                    <p className="text-xl font-medium text-[var(--xidea-near-black)]">
                      {knowledgePoint.title}
                    </p>
                    <p className="max-w-3xl text-sm leading-7 text-[var(--xidea-charcoal)]">
                      {knowledgePoint.description}
                    </p>
                  </>
                )}
              </div>
              <Badge
                className={`border px-3 py-1.5 text-[12px] shadow-none ${getKnowledgePointAccent(knowledgePoint.status)}`}
                variant="outline"
              >
                {knowledgePoint.stageLabel}
              </Badge>
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
                    className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                    disabled={draft.title.trim() === "" || draft.description.trim() === ""}
                    onClick={onSave}
                    type="button"
                  >
                    保存
                  </Button>
                  <Button className="rounded-full" onClick={onCancelEditing} type="button" variant="outline">
                    取消
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                    onClick={onStartStudy}
                    type="button"
                  >
                    加入学习
                  </Button>
                  <Button className="rounded-full" onClick={onStartReview} type="button" variant="outline">
                    加入复习
                  </Button>
                  <Button className="rounded-full" onClick={onStartEditing} type="button" variant="outline">
                    编辑
                  </Button>
                  <Button className="rounded-full" onClick={onArchive} type="button" variant="outline">
                    {knowledgePoint.status === "archived" ? "恢复" : "Archive"}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium text-[var(--xidea-near-black)]">
              来源材料
            </CardTitle>
            <CardDescription>当前知识点关联的 project materials。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {knowledgePointAssets.length > 0 ? (
              knowledgePointAssets.map((asset) => (
                <div
                  className="rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-4 py-3"
                  key={asset.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                      {asset.title}
                    </p>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--xidea-stone)]">
                      {getAssetKindLabel(asset.kind)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--xidea-charcoal)]">
                    {asset.topic}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--xidea-stone)]">当前还没有挂接材料。</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <InspectorCard description="这个知识点在项目内如何被继续组织。" title="相关 Sessions">
          {relatedSessions.length > 0 ? (
            relatedSessions.map((session) => (
              <SessionCard
                active={session.id === selectedSessionId}
                key={session.id}
                onClick={() => onOpenSession(session.id)}
                title={session.title}
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
