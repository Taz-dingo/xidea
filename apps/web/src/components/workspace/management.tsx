import { useState, type ReactElement, type ReactNode } from "react";
import { Trash2, X } from "lucide-react";
import type { SourceAsset } from "@/domain/types";
import { MaterialUploadButton } from "@/components/material-upload-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AssetListItem,
  getAssetKindLabel,
} from "@/components/workspace/core";

interface DraftAssetListProps {
  readonly assets: ReadonlyArray<SourceAsset>;
  readonly onDelete: (assetId: string) => Promise<void>;
}

interface ProjectDraftValue {
  readonly id: string;
  readonly name: string;
  readonly topic: string;
  readonly description: string;
  readonly specialRulesText: string;
  readonly initialMaterialIds: ReadonlyArray<string>;
}

function DraftAssetList({
  assets,
  onDelete,
}: DraftAssetListProps): ReactElement {
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete(assetId: string): Promise<void> {
    setDeletingAssetId(assetId);
    setErrorMessage(null);
    try {
      await onDelete(assetId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除材料失败。");
    } finally {
      setDeletingAssetId(null);
    }
  }

  if (assets.length === 0) {
    return (
      <div className="rounded-[1rem] border border-dashed border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-4 py-5 text-sm leading-6 text-[var(--xidea-stone)]">
        还没有初始材料。先上传你这次项目真正要用的材料，系统会把它们作为新项目的起始上下文。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset) => (
          <div className="relative" key={asset.id}>
            <AssetListItem asset={asset} />
            <Button
              aria-label={`删除材料 ${asset.title}`}
              className="absolute right-3 top-3 h-8 w-8 rounded-full border-[var(--xidea-border)] bg-[var(--xidea-white)] p-0 text-[var(--xidea-charcoal)] shadow-none hover:bg-[var(--xidea-parchment)]"
              disabled={deletingAssetId === asset.id}
              onClick={() => {
                void handleDelete(asset.id);
              }}
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <span className="text-[12px] text-[var(--xidea-stone)]">
                {getAssetKindLabel(asset.kind)}
              </span>
              <span className="text-[12px] text-[var(--xidea-selection-text)]">
                默认加入项目材料
              </span>
            </div>
          </div>
        ))}
      </div>
      {errorMessage ? (
        <p className="text-[12px] leading-5 text-[#b95e39]">{errorMessage}</p>
      ) : null}
    </div>
  );
}

function FormShell({
  action,
  title,
  description,
  children,
}: {
  action?: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base font-medium text-[var(--xidea-near-black)]">
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function CreateProjectPanel({
  assets,
  draft,
  onCancel,
  onChange,
  onSave,
  onDeleteMaterial,
  onUploadMaterial,
}: {
  assets: ReadonlyArray<SourceAsset>;
  draft: ProjectDraftValue;
  onCancel: () => void;
  onChange: (draft: ProjectDraftValue) => void;
  onSave: () => void;
  onDeleteMaterial: (assetId: string) => Promise<void>;
  onUploadMaterial: (file: File) => Promise<void>;
}): ReactElement {
  const isDisabled =
    draft.name.trim() === "" ||
    draft.topic.trim() === "" ||
    draft.description.trim() === "";

  return (
    <FormShell
      action={
        <Button
          aria-label="关闭新建项目弹窗"
          className="h-10 w-10 rounded-full p-0"
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          <X className="h-4 w-4" />
        </Button>
      }
      description="先把项目主题、答辩目标和规则收紧，再进入知识点池和会话工作态。"
      title="新建项目"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2 text-sm text-[var(--xidea-charcoal)]">
          <span className="font-medium text-[var(--xidea-near-black)]">项目名称</span>
          <input
            className="w-full rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] px-3 py-2 outline-none focus:border-[var(--xidea-selection-border)]"
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="例如：比赛答辩排练 / 新人入职学习 / 项目知识梳理"
            value={draft.name}
          />
        </label>
        <label className="space-y-2 text-sm text-[var(--xidea-charcoal)]">
          <span className="font-medium text-[var(--xidea-near-black)]">学习主题</span>
          <input
            className="w-full rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] px-3 py-2 outline-none focus:border-[var(--xidea-selection-border)]"
            onChange={(event) => onChange({ ...draft, topic: event.target.value })}
            placeholder="围绕什么问题组织项目型学习"
            value={draft.topic}
          />
        </label>
      </div>

      <label className="block space-y-2 text-sm text-[var(--xidea-charcoal)]">
        <span className="font-medium text-[var(--xidea-near-black)]">项目说明</span>
        <Textarea
          className="min-h-24 rounded-[0.95rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] text-sm leading-7 text-[var(--xidea-charcoal)] focus-visible:ring-[var(--xidea-selection-border)]"
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          placeholder="这轮 demo 想证明什么，系统需要帮你把什么讲清楚。"
          value={draft.description}
        />
      </label>

      <label className="block space-y-2 text-sm text-[var(--xidea-charcoal)]">
        <span className="font-medium text-[var(--xidea-near-black)]">特殊约束</span>
        <Textarea
          className="min-h-24 rounded-[0.95rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] text-sm leading-7 text-[var(--xidea-charcoal)] focus-visible:ring-[var(--xidea-selection-border)]"
          onChange={(event) =>
            onChange({ ...draft, specialRulesText: event.target.value })
          }
          placeholder={"每行一条规则，例如：\n优先围绕比赛答辩表达\n不要扩散到泛泛 AI 问答"}
          value={draft.specialRulesText}
        />
      </label>

      <div className="space-y-3 text-sm text-[var(--xidea-charcoal)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="font-medium text-[var(--xidea-near-black)]">初始材料</span>
            <p className="text-xs leading-5 text-[var(--xidea-stone)]">
              默认从空开始。这里只展示你刚刚为这个项目真实上传的材料，并支持继续添加或删除。
            </p>
          </div>
          <MaterialUploadButton label="上传本地材料" onUpload={onUploadMaterial} />
        </div>
        <DraftAssetList
          assets={assets}
          onDelete={onDeleteMaterial}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          className="min-w-[8.5rem] rounded-full bg-[var(--xidea-terracotta)] px-6 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
          disabled={isDisabled}
          onClick={onSave}
          type="button"
        >
          创建项目
        </Button>
        <Button
          className="min-w-[8.5rem] rounded-full px-6"
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          取消
        </Button>
      </div>
    </FormShell>
  );
}
