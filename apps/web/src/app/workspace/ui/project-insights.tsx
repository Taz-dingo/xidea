import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import {
  Brain,
  CalendarRange,
  FileText,
  Layers3,
  Trash2,
  X,
} from "lucide-react";
import type { ProjectStats } from "@/domain/project-workspace";
import type { ReviewHeatmapCell } from "@/domain/review-heatmap";
import type { SourceAsset } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AssetCompactList, MetricTile, SessionTypeBadge } from "@/components/workspace/core";
import { MaterialUploadButton } from "@/components/material-upload-button";
import { ReviewHeatmap } from "@/components/workspace/monitor";

const portraitDots: ReadonlyArray<{
  className: string;
  color: string;
  sizeClassName: string;
  style: CSSProperties;
}> = [
  {
    className: "right-2 top-2",
    color: "#c96442",
    sizeClassName: "h-2.5 w-2.5",
    style: {
      ["--xidea-orb-x-1" as string]: "-4px",
      ["--xidea-orb-y-1" as string]: "6px",
      ["--xidea-orb-x-2" as string]: "-10px",
      ["--xidea-orb-y-2" as string]: "2px",
      ["--xidea-orb-parallax-x" as string]: "1.1",
      ["--xidea-orb-parallax-y" as string]: "-0.5",
      ["--xidea-orb-inertia-x" as string]: "0.7",
      ["--xidea-orb-inertia-y" as string]: "-0.8",
      ["--xidea-orb-duration" as string]: "6.8s",
      ["--xidea-orb-delay" as string]: "-1.1s",
    },
  },
  {
    className: "bottom-3 left-3",
    color: "#7f9eb7",
    sizeClassName: "h-2.5 w-2.5",
    style: {
      ["--xidea-orb-x-1" as string]: "5px",
      ["--xidea-orb-y-1" as string]: "-7px",
      ["--xidea-orb-x-2" as string]: "11px",
      ["--xidea-orb-y-2" as string]: "-1px",
      ["--xidea-orb-parallax-x" as string]: "-0.9",
      ["--xidea-orb-parallax-y" as string]: "0.8",
      ["--xidea-orb-inertia-x" as string]: "-0.45",
      ["--xidea-orb-inertia-y" as string]: "0.75",
      ["--xidea-orb-duration" as string]: "7.4s",
      ["--xidea-orb-delay" as string]: "-3.2s",
    },
  },
  {
    className: "bottom-4 right-4",
    color: "#b98a4a",
    sizeClassName: "h-2 w-2",
    style: {
      ["--xidea-orb-x-1" as string]: "-6px",
      ["--xidea-orb-y-1" as string]: "-4px",
      ["--xidea-orb-x-2" as string]: "3px",
      ["--xidea-orb-y-2" as string]: "-10px",
      ["--xidea-orb-parallax-x" as string]: "0.55",
      ["--xidea-orb-parallax-y" as string]: "0.45",
      ["--xidea-orb-inertia-x" as string]: "0.3",
      ["--xidea-orb-inertia-y" as string]: "0.5",
      ["--xidea-orb-duration" as string]: "5.9s",
      ["--xidea-orb-delay" as string]: "-2.4s",
    },
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function usePortraitMotion(portraitRef: React.RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const portraitElement = portraitRef.current;

    if (portraitElement === null || typeof window === "undefined") {
      return;
    }

    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (motionMedia.matches) {
      portraitElement.style.removeProperty("--xidea-portrait-tilt");
      portraitElement.style.removeProperty("--xidea-portrait-lift");
      portraitElement.style.removeProperty("--xidea-orb-scroll-x");
      portraitElement.style.removeProperty("--xidea-orb-scroll-y");
      portraitElement.style.removeProperty("--xidea-orb-inertia");
      return;
    }

    let animationFrame = 0;
    let idleFrames = 0;
    let inertia = 0;
    let lastScrollY = window.scrollY;

    const render = (): void => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      const targetInertia = clamp(delta * 0.72, -9, 9);
      inertia = inertia * 0.84 + targetInertia * 0.16;

      const rect = portraitElement.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const portraitCenter = rect.top + rect.height / 2;
      const relative = clamp((viewportCenter - portraitCenter) / viewportCenter, -1, 1);

      portraitElement.style.setProperty("--xidea-portrait-tilt", `${relative * 4.8 + inertia * 0.32}deg`);
      portraitElement.style.setProperty("--xidea-portrait-lift", `${relative * -4.5 - Math.abs(inertia) * 0.35}px`);
      portraitElement.style.setProperty("--xidea-orb-scroll-x", `${relative * 7}px`);
      portraitElement.style.setProperty("--xidea-orb-scroll-y", `${relative * -5}px`);
      portraitElement.style.setProperty("--xidea-orb-inertia", `${inertia}px`);

      if (Math.abs(inertia) < 0.08 && Math.abs(delta) < 0.08) {
        idleFrames += 1;
      } else {
        idleFrames = 0;
      }

      if (idleFrames >= 6) {
        animationFrame = 0;
        return;
      }

      animationFrame = window.requestAnimationFrame(render);
    };

    const schedule = (): void => {
      if (animationFrame !== 0) {
        return;
      }

      idleFrames = 0;
      animationFrame = window.requestAnimationFrame(render);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [portraitRef]);
}

function MasteryPortraitGlyph({
  iconClassName,
  stablePercent,
  wrapperClassName,
  coreClassName,
}: {
  iconClassName: string;
  stablePercent: number;
  wrapperClassName: string;
  coreClassName: string;
}): ReactElement {
  const portraitRef = useRef<HTMLDivElement | null>(null);
  usePortraitMotion(portraitRef);

  return (
    <div
      className={`xidea-portrait-field relative flex items-center justify-center rounded-[1.6rem] border border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffaf5_0%,#f6efe9_100%)] ${wrapperClassName}`}
      ref={portraitRef}
    >
      <div
        className="absolute inset-[18%] rounded-[1.2rem] bg-[radial-gradient(circle_at_50%_35%,rgba(201,100,66,0.22),transparent_55%),radial-gradient(circle_at_50%_78%,rgba(127,158,183,0.2),transparent_52%)]"
        style={{ opacity: stablePercent / 100 }}
      />
      <div className={`relative flex items-center justify-center rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] text-[var(--xidea-selection-text)] ${coreClassName}`}>
        <Brain className={iconClassName} />
      </div>
      {portraitDots.map((dot) => (
        <span
          className={`xidea-orb-drift absolute ${dot.className} ${dot.sizeClassName} rounded-full`}
          key={`${wrapperClassName}-${dot.className}-${dot.color}`}
          style={{ ...dot.style, backgroundColor: dot.color }}
        />
      ))}
    </div>
  );
}

function ProjectMasteryPortrait({
  projectStats,
}: {
  projectStats: ProjectStats;
}): ReactElement {
  const totalPoints = Math.max(projectStats.total, 1);
  const masteredRatio = (projectStats.total - projectStats.unlearned - projectStats.dueReview) / totalPoints;
  const stablePercent = Math.max(12, Math.round(masteredRatio * 100));

  return (
    <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
      <MasteryPortraitGlyph
        coreClassName="h-12 w-12"
        iconClassName="h-6 w-6"
        stablePercent={stablePercent}
        wrapperClassName="h-24 w-24"
      />
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium text-[var(--xidea-near-black)]">学习画像</p>
        <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
          当前稳定掌握约 {stablePercent}% ，其余内容仍在学习或等待复习。
        </p>
        <div className="flex flex-wrap gap-2">
          <SessionTypeBadge type="project" />
          <span className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-1 text-[12px] text-[var(--xidea-stone)]">
            未学 {projectStats.unlearned}
          </span>
          <span className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-1 text-[12px] text-[var(--xidea-stone)]">
            待复习 {projectStats.dueReview}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProjectInsightPreview({
  title,
  summary,
  icon,
  children,
  onClick,
}: {
  title: string;
  summary: string;
  icon: ReactElement;
  children: ReactElement;
  onClick: () => void;
}): ReactElement {
  return (
    <div
      className="group flex h-full min-h-[196px] w-full flex-col rounded-[1.15rem] border border-[var(--xidea-border)] bg-[linear-gradient(180deg,#fffdf9_0%,#f7f2eb_100%)] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--xidea-selection-border)] hover:shadow-[0_18px_36px_rgba(177,112,82,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-white)]"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="xidea-kicker text-[var(--xidea-selection-text)]">{title}</p>
          <p className="line-clamp-2 text-sm leading-6 text-[var(--xidea-charcoal)]">{summary}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-selection-text)] transition-colors group-hover:border-[var(--xidea-selection-border)]">
          {icon}
        </span>
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function ProjectInsightModal({
  children,
  maxWidthClassName = "max-w-[1040px]",
  onClose,
  title,
}: {
  children: ReactElement;
  maxWidthClassName?: string;
  onClose: () => void;
  title: string;
}): ReactElement {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,20,19,0.28)] px-4 py-6 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className={`xidea-modal-pop w-full ${maxWidthClassName} overflow-hidden rounded-[1.5rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-[0_32px_64px_rgba(54,44,36,0.18)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--xidea-border)] px-5 py-4">
          <div className="space-y-1">
            <p className="xidea-kicker text-[var(--xidea-selection-text)]">项目洞察</p>
            <p className="text-base font-medium text-[var(--xidea-near-black)]">{title}</p>
          </div>
          <Button
            aria-label="关闭弹窗"
            className="h-9 w-9 rounded-full p-0 text-[var(--xidea-charcoal)]"
            onClick={onClose}
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function MaterialDeleteButton({
  armed = false,
  disabled = false,
  onDelete,
  title,
}: {
  armed?: boolean;
  disabled?: boolean;
  onDelete: () => void;
  title: string;
}): ReactElement {
  return (
    <Button
      aria-label={armed ? `确认删除材料 ${title}` : `删除材料 ${title}`}
      className="h-8 w-8 shrink-0 rounded-full border-[var(--xidea-border)] bg-[var(--xidea-white)] p-0 text-[var(--xidea-charcoal)] shadow-none hover:bg-[var(--xidea-parchment)]"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      title={armed ? `再点一次删除 ${title}` : `删除材料 ${title}`}
      type="button"
      variant="ghost"
    >
      <Trash2 className={armed ? "h-4 w-4 text-red-600" : "h-4 w-4"} />
    </Button>
  );
}

type ProjectInsightModalKey = "heatmap" | "materials" | "portrait" | null;

export function ProjectInsightsStrip({
  onDeleteProjectMaterial,
  isEditingProjectMeta,
  onToggleProjectMaterial,
  onUploadProjectMaterial,
  profileSummary,
  projectAssets,
  projectMaterialIds,
  projectMaterials,
  projectReviewHeatmap,
  projectReviewHeatmapExpanded,
  projectStats,
}: {
  onDeleteProjectMaterial: (assetId: string) => Promise<void>;
  isEditingProjectMeta: boolean;
  onToggleProjectMaterial: (assetId: string) => void;
  onUploadProjectMaterial: (file: File) => Promise<void>;
  profileSummary: {
    readonly title: string;
    readonly evidence: string;
  };
  projectAssets: ReadonlyArray<SourceAsset>;
  projectMaterialIds: ReadonlyArray<string>;
  projectMaterials: ReadonlyArray<SourceAsset>;
  projectReviewHeatmap: ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>>;
  projectReviewHeatmapExpanded: ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>>;
  projectStats: ProjectStats;
}): ReactElement {
  const [activeModal, setActiveModal] = useState<ProjectInsightModalKey>(null);
  const [armedMaterialId, setArmedMaterialId] = useState<string | null>(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [materialErrorMessage, setMaterialErrorMessage] = useState<string | null>(null);
  const visibleProjectMaterials = isEditingProjectMeta ? projectAssets : projectMaterials;
  const totalPoints = Math.max(projectStats.total, 1);
  const masteredRatio = (projectStats.total - projectStats.unlearned - projectStats.dueReview) / totalPoints;
  const stablePercent = Math.max(12, Math.round(masteredRatio * 100));

  useEffect(() => {
    if (activeModal !== "materials") {
      setArmedMaterialId(null);
      setMaterialErrorMessage(null);
    }
  }, [activeModal]);

  useEffect(() => {
    if (
      armedMaterialId !== null &&
      !visibleProjectMaterials.some((asset) => asset.id === armedMaterialId)
    ) {
      setArmedMaterialId(null);
    }
  }, [armedMaterialId, visibleProjectMaterials]);

  async function handleDeleteMaterial(assetId: string): Promise<void> {
    setDeletingMaterialId(assetId);
    setMaterialErrorMessage(null);

    try {
      await onDeleteProjectMaterial(assetId);
      setArmedMaterialId((current) => (current === assetId ? null : current));
    } catch (error) {
      setMaterialErrorMessage(error instanceof Error ? error.message : "删除材料失败。");
    } finally {
      setDeletingMaterialId(null);
    }
  }

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-[minmax(300px,1fr)_minmax(0,0.84fr)] xl:grid-rows-[auto_auto]">
        <div className="xl:row-span-2">
          <ProjectInsightPreview
            icon={<Layers3 className="h-4 w-4" />}
            onClick={() => setActiveModal("materials")}
            summary={
              isEditingProjectMeta ? "点开管理材料池和挂接状态。" : "项目当前挂接的材料来源。"
            }
            title="项目材料"
          >
            <div className="space-y-2">
              <div className="max-h-[31rem] space-y-2 overflow-y-auto pr-1">
                {visibleProjectMaterials.length > 0 ? (
                  visibleProjectMaterials.map((asset) => (
                    <div
                      className="grid grid-cols-[36px_minmax(0,1fr)_auto] gap-3 rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-2.5"
                      key={asset.id}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-selection-text)]">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="line-clamp-1 text-sm font-medium leading-5 text-[var(--xidea-near-black)]">
                          {asset.title}
                        </p>
                        <p className="line-clamp-1 text-sm leading-5 text-[var(--xidea-charcoal)]">
                          {asset.topic}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[0.95rem] border border-dashed border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-4 text-sm text-[var(--xidea-stone)]">
                    当前还没有项目材料。
                  </div>
                )}
              </div>
              {materialErrorMessage ? (
                <p className="text-[12px] leading-5 text-[#b95e39]">{materialErrorMessage}</p>
              ) : null}
            </div>
          </ProjectInsightPreview>
        </div>

        <ProjectInsightPreview
          icon={<CalendarRange className="h-4 w-4" />}
          onClick={() => setActiveModal("heatmap")}
          summary="最近 5 周的学习与复习轨迹。"
          title="复习热力图"
        >
          <div className="space-y-3">
            <ReviewHeatmap compact showTooltip={false} weeks={projectReviewHeatmap} />
          </div>
        </ProjectInsightPreview>

        <ProjectInsightPreview
          icon={<Brain className="h-4 w-4" />}
          onClick={() => setActiveModal("portrait")}
          summary={profileSummary.evidence}
          title="学习画像"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <MasteryPortraitGlyph
                coreClassName="h-8 w-8"
                iconClassName="h-4 w-4"
                stablePercent={stablePercent}
                wrapperClassName="h-16 w-16 shrink-0 rounded-[1.2rem]"
              />
              <div className="min-w-0 space-y-1">
                <p className="line-clamp-1 text-sm font-medium text-[var(--xidea-near-black)]">
                  {profileSummary.title}
                </p>
                <p className="line-clamp-2 text-sm leading-6 text-[var(--xidea-charcoal)]">
                  {profileSummary.evidence}
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricTile label="未学" tone="amber" value={`${projectStats.unlearned}`} />
              <MetricTile label="待复习" tone="sky" value={`${projectStats.dueReview}`} />
              <MetricTile label="已归档" tone="rose" value={`${projectStats.archived}`} />
            </div>
          </div>
        </ProjectInsightPreview>
      </div>

      {activeModal === "portrait" ? (
        <ProjectInsightModal onClose={() => setActiveModal(null)} title="学习画像">
          <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
            <CardContent className="space-y-5 p-5">
              <div className="space-y-2">
                <p className="xidea-kicker text-[var(--xidea-selection-text)]">学习画像</p>
                <p className="text-sm font-medium text-[var(--xidea-near-black)]">{profileSummary.title}</p>
                <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">{profileSummary.evidence}</p>
              </div>
              <ProjectMasteryPortrait projectStats={projectStats} />
              <div className="grid gap-2 sm:grid-cols-3">
                <MetricTile label="未学" tone="amber" value={`${projectStats.unlearned}`} />
                <MetricTile label="待复习" tone="sky" value={`${projectStats.dueReview}`} />
                <MetricTile label="已归档" tone="rose" value={`${projectStats.archived}`} />
              </div>
            </CardContent>
          </Card>
        </ProjectInsightModal>
      ) : null}

      {activeModal === "heatmap" ? (
        <ProjectInsightModal
          maxWidthClassName="max-w-[1320px]"
          onClose={() => setActiveModal(null)}
          title="复习热力图"
        >
          <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1">
                <p className="xidea-kicker text-[var(--xidea-stone)]">复习热力图</p>
                <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                  展示近 1 年的学习与复习轨迹。
                </p>
              </div>
              <ReviewHeatmap rangeLabel="近 1 年轨迹" weeks={projectReviewHeatmapExpanded} />
            </CardContent>
          </Card>
        </ProjectInsightModal>
      ) : null}

      {activeModal === "materials" ? (
        <ProjectInsightModal onClose={() => setActiveModal(null)} title="项目材料">
          <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="xidea-kicker text-[var(--xidea-stone)]">项目材料</p>
                  <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                    {isEditingProjectMeta
                      ? "在这里调整材料池，并决定哪些材料参与研讨。"
                      : "当前项目挂接的材料来源。"}
                  </p>
                </div>
                {isEditingProjectMeta ? (
                  <MaterialUploadButton label="上传材料" onUpload={onUploadProjectMaterial} />
                ) : null}
              </div>
              <AssetCompactList
                assets={visibleProjectMaterials}
                emptyText={
                  isEditingProjectMeta ? "当前材料池还是空的，先上传材料。" : "当前还没有项目材料。"
                }
                maxHeightClassName="max-h-[30rem]"
                onAssetClick={isEditingProjectMeta ? onToggleProjectMaterial : undefined}
                renderAssetAction={(asset) => (
                  <MaterialDeleteButton
                    armed={armedMaterialId === asset.id}
                    disabled={deletingMaterialId === asset.id}
                    onDelete={() => {
                      if (armedMaterialId === asset.id) {
                        void handleDeleteMaterial(asset.id);
                        return;
                      }
                      setArmedMaterialId(asset.id);
                      setMaterialErrorMessage(null);
                    }}
                    title={asset.title}
                  />
                )}
                selectedAssetIds={isEditingProjectMeta ? projectMaterialIds : []}
              />
              {materialErrorMessage ? (
                <p className="text-[12px] leading-5 text-[#b95e39]">{materialErrorMessage}</p>
              ) : null}
            </CardContent>
          </Card>
        </ProjectInsightModal>
      ) : null}
    </>
  );
}
