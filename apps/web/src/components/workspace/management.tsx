import type { ReactElement, ReactNode } from "react";
import { MaterialUploadButton } from "@/components/material-upload-button";
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
import { getAssetKindLabel } from "@/components/workspace/core";

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

interface ProjectMetaDraftValue {
  readonly topic: string;
  readonly description: string;
  readonly specialRulesText: string;
  readonly materialIds: ReadonlyArray<string>;
}

interface ProjectMetaEditorProps {
  readonly assets: ReadonlyArray<SourceAsset>;
  readonly draft: ProjectMetaDraftValue;
  readonly onCancel: () => void;
  readonly onChange: (draft: ProjectMetaDraftValue) => void;
  readonly onUploadMaterial: (file: File) => Promise<void>;
  readonly onSave: () => void;
}

function AssetPicker({
  assets,
  selectedAssetIds,
  onToggle,
}: AssetPickerProps): ReactElement {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {assets.map((asset) => {
        const selected = selectedAssetIds.includes(asset.id);

        return (
          <button
            className={
              selected
                ? "rounded-[1rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-4 py-4 text-left"
                : "rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] px-4 py-4 text-left hover:border-[var(--xidea-selection-border)]"
            }
            key={asset.id}
            onClick={() => onToggle(asset.id)}
            type="button"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                {asset.title}
              </p>
              <span className="text-[11px] tracking-[0.08em] text-[var(--xidea-stone)]">
                {getAssetKindLabel(asset.kind)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--xidea-charcoal)]">
              {asset.topic}
            </p>
          </button>
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

export function EditMetaPanel({
  assets,
  draft,
  onCancel,
  onChange,
  onUploadMaterial,
  onSave,
}: ProjectMetaEditorProps): ReactElement {
  return (
    <FormShell
      description="这里改的是当前项目的主题叙事、特殊约束和材料池。"
      title="编辑项目信息"
    >
      <ProjectMetaEditorFields
        assets={assets}
        draft={draft}
        onCancel={onCancel}
        onChange={onChange}
        onSave={onSave}
        onUploadMaterial={onUploadMaterial}
      />
    </FormShell>
  );
}

function ProjectMetaEditorFields({
  assets,
  draft,
  onCancel,
  onChange,
  onUploadMaterial,
  onSave,
}: ProjectMetaEditorProps): ReactElement {
  const isDisabled =
    draft.topic.trim() === "" || draft.description.trim() === "";

  return (
    <>
      <label className="block space-y-2 text-sm text-[var(--xidea-charcoal)]">
        <span className="font-medium text-[var(--xidea-near-black)]">主题</span>
        <input
          className="w-full rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] px-3 py-2 outline-none focus:border-[var(--xidea-selection-border)]"
          onChange={(event) => onChange({ ...draft, topic: event.target.value })}
          value={draft.topic}
        />
      </label>
      <label className="block space-y-2 text-sm text-[var(--xidea-charcoal)]">
        <span className="font-medium text-[var(--xidea-near-black)]">说明</span>
        <Textarea
          className="min-h-24 rounded-[0.95rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] text-sm leading-7 text-[var(--xidea-charcoal)] focus-visible:ring-[var(--xidea-selection-border)]"
          onChange={(event) =>
            onChange({ ...draft, description: event.target.value })
          }
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
          value={draft.specialRulesText}
        />
      </label>
      <div className="space-y-2 text-sm text-[var(--xidea-charcoal)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-medium text-[var(--xidea-near-black)]">材料池</span>
          <MaterialUploadButton label="上传到材料池" onUpload={onUploadMaterial} />
        </div>
        <AssetPicker
          assets={assets}
          onToggle={(assetId) =>
            onChange({
              ...draft,
              materialIds: draft.materialIds.includes(assetId)
                ? draft.materialIds.filter((id) => id !== assetId)
                : [...draft.materialIds, assetId],
            })
          }
          selectedAssetIds={draft.materialIds}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
          disabled={isDisabled}
          onClick={onSave}
          type="button"
        >
          保存项目信息
        </Button>
        <Button className="rounded-full" onClick={onCancel} type="button" variant="outline">
          取消
        </Button>
      </div>
    </>
  );
}

export function InlineProjectMetaEditor({
  assets,
  draft,
  onCancel,
  onChange,
  onUploadMaterial,
  onSave,
}: ProjectMetaEditorProps): ReactElement {
  return (
    <div className="space-y-4 rounded-[1.2rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)] p-4">
      <div className="space-y-1">
        <p className="xidea-kicker text-[var(--xidea-selection-text)]">编辑项目</p>
        <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
          在这里直接调整主题、说明、约束和材料池。
        </p>
      </div>
      <ProjectMetaEditorFields
        assets={assets}
        draft={draft}
        onCancel={onCancel}
        onChange={onChange}
        onSave={onSave}
        onUploadMaterial={onUploadMaterial}
      />
    </div>
  );
}
