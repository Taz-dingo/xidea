import type { ReactElement, ReactNode } from "react";
import type { SourceAsset } from "@/domain/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AssetListItem } from "@/components/workspace/core";

interface AssetPickerProps {
  readonly assets: ReadonlyArray<SourceAsset>;
  readonly selectedAssetIds: ReadonlyArray<string>;
  readonly onToggle: (assetId: string) => void;
}

interface ProjectDraftValue {
  readonly name: string;
  readonly topic: string;
  readonly description: string;
  readonly specialRulesText: string;
  readonly initialMaterialIds: ReadonlyArray<string>;
}

function AssetPicker({
  assets,
  selectedAssetIds,
  onToggle,
}: AssetPickerProps): ReactElement {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {assets.map((asset) => {
        const selected = selectedAssetIds.includes(asset.id);

        return (
          <AssetListItem
            asset={asset}
            key={asset.id}
            onClick={() => onToggle(asset.id)}
            selected={selected}
          />
        );
      })}
    </div>
  );
}

function FormShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-medium text-[var(--xidea-near-black)]">
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
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
}: {
  assets: ReadonlyArray<SourceAsset>;
  draft: ProjectDraftValue;
  onCancel: () => void;
  onChange: (draft: ProjectDraftValue) => void;
  onSave: () => void;
}): ReactElement {
  const isDisabled =
    draft.name.trim() === "" ||
    draft.topic.trim() === "" ||
    draft.description.trim() === "";

  return (
    <FormShell
      description="先把项目主题、答辩目标和规则收紧，再进入知识点池和会话工作态。"
      title="新建项目"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2 text-sm text-[var(--xidea-charcoal)]">
          <span className="font-medium text-[var(--xidea-near-black)]">项目名称</span>
          <input
            className="w-full rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] px-3 py-2 outline-none focus:border-[var(--xidea-selection-border)]"
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="例如：RAG Demo 答辩排练"
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

      <div className="space-y-2 text-sm text-[var(--xidea-charcoal)]">
        <span className="font-medium text-[var(--xidea-near-black)]">初始材料</span>
        <AssetPicker
          assets={assets}
          onToggle={(assetId) =>
            onChange({
              ...draft,
              initialMaterialIds: draft.initialMaterialIds.includes(assetId)
                ? draft.initialMaterialIds.filter((id) => id !== assetId)
                : [...draft.initialMaterialIds, assetId],
            })
          }
          selectedAssetIds={draft.initialMaterialIds}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
          disabled={isDisabled}
          onClick={onSave}
          type="button"
        >
          创建项目
        </Button>
        <Button className="rounded-full" onClick={onCancel} type="button" variant="outline">
          取消
        </Button>
      </div>
    </FormShell>
  );
}
