import { startTransition, useState, type ComponentType, type ReactElement } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  Brain,
  FileInput,
  GitBranchPlus,
  MessageSquareText,
  RefreshCcw,
  Route,
  Target,
} from "lucide-react";
import { learnerProfiles, learningUnits, projectContext, sourceAssets } from "@/data/demo";
import { MODE_LABELS, buildStudyPlan } from "@/domain/planner";
import type { LearnerProfile, LearnerState, LearningMode, LearningUnit } from "@/domain/types";

const entryModes = [
  {
    icon: FileInput,
    title: "材料导入",
    description: "用户直接提供 PDF、网页或复盘笔记，让系统从项目材料进入学习。",
  },
  {
    icon: MessageSquareText,
    title: "普通问答",
    description: "用户先从问题切入，系统在问答中逐步补齐状态判断。",
  },
];

const orchestrationMoments = [
  {
    title: "输入进入同一项目线程",
    detail: "不管是问问题还是丢材料，系统都先回到真实项目上下文。",
  },
  {
    title: "先诊断，再决定教学动作",
    detail: "不是统一给答案，而是根据理解状态和混淆风险安排下一步。",
  },
  {
    title: "学习路径会显式展开",
    detail: "页面直接展示为什么是这个动作，以及后面准备怎么练。",
  },
  {
    title: "结果会回写状态与记忆",
    detail: "这轮不是一次性聊天，而是项目型持续学习的一部分。",
  },
];

const actionCopy: Record<
  LearnerState["recommendedAction"],
  { label: string; title: string; description: string }
> = {
  teach: {
    label: "先补理解框架",
    title: "系统判断当前更像“知道名词，但还没真正懂”",
    description: "这一轮优先由导师式引导建立结构，再决定是否进入辨析或迁移应用。",
  },
  clarify: {
    label: "先做边界澄清",
    title: "系统先拆开混淆点，而不是继续泛泛追问",
    description: "当前最危险的不是记不住，而是带着错误的概念模型继续推进项目方案。",
  },
  practice: {
    label: "先做针对练习",
    title: "系统判断可以通过短练习把能力拉稳",
    description: "理解已经有基础，下一步更适合通过练习把判断路径固定下来。",
  },
  review: {
    label: "先安排复习",
    title: "系统判断这轮重点是记忆调度",
    description: "知识点本身不一定陌生，但回忆窗口正在走弱，需要先把关键概念拉回可用状态。",
  },
  apply: {
    label: "先做项目迁移",
    title: "系统判断现在最值得验证的是能不能把理解用出来",
    description: "这一轮更像答辩和方案推演，目标是把抽象概念稳定映射到真实项目决策。",
  },
};

const metricCopy = [
  {
    key: "understandingLevel",
    label: "理解水平",
    hint: "系统判断是否已经建立正确的设计框架。",
    tone: "emerald",
  },
  {
    key: "memoryStrength",
    label: "记忆强度",
    hint: "决定是继续推进，还是需要重新唤起关键概念。",
    tone: "amber",
  },
  {
    key: "confusion",
    label: "混淆风险",
    hint: "风险越高，越需要先做边界澄清而不是继续堆信息。",
    tone: "rose",
  },
] as const;

function getModeNarrative(mode: LearningMode): string {
  switch (mode) {
    case "guided-qa":
      return "用导师引导把零散理解整理成可讲清楚的框架。";
    case "contrast-drill":
      return "通过对比问题先拆开容易混在一起的判断边界。";
    case "scenario-sim":
      return "把概念放进项目情境里验证是否真的会用。";
    case "socratic":
      return "通过追问逼近真正的理解空洞。";
    case "image-recall":
      return "借助图像线索唤起结构化记忆。";
    case "audio-recall":
      return "用听觉输入模拟现场问答和即时反应。";
  }
}

function getModeAccent(mode: LearningMode): string {
  switch (mode) {
    case "guided-qa":
      return "bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200";
    case "contrast-drill":
      return "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200";
    case "scenario-sim":
      return "bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-200";
    case "socratic":
      return "bg-violet-100 text-violet-900 ring-1 ring-inset ring-violet-200";
    case "image-recall":
      return "bg-fuchsia-100 text-fuchsia-900 ring-1 ring-inset ring-fuchsia-200";
    case "audio-recall":
      return "bg-orange-100 text-orange-900 ring-1 ring-inset ring-orange-200";
  }
}

function SectionIntro({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        <Icon className="h-4 w-4" />
        {eyebrow}
      </div>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function SelectorCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className={
        active
          ? "w-full rounded-[1.4rem] border border-slate-950/10 bg-slate-950 px-4 py-4 text-left text-white shadow-lg shadow-slate-950/10 transition"
          : "w-full rounded-[1.4rem] border border-slate-200/80 bg-white/85 px-4 py-4 text-left text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
      }
      onClick={onClick}
      type="button"
    >
      <div className="font-semibold">{title}</div>
      <div className={active ? "mt-1 text-sm text-slate-300" : "mt-1 text-sm text-slate-600"}>
        {description}
      </div>
    </button>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "emerald" | "amber" | "rose";
}): ReactElement {
  const accentClass =
    tone === "emerald"
      ? "from-emerald-500 to-emerald-300"
      : tone === "amber"
        ? "from-amber-500 to-amber-300"
        : "from-rose-500 to-rose-300";

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}%</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          实时估计
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full bg-linear-to-r ${accentClass}`} style={{ width: `${value}%` }} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{hint}</p>
    </div>
  );
}

export function App(): ReactElement {
  const initialProfile = learnerProfiles[1] ?? learnerProfiles[0];
  const initialUnit = learningUnits[0];

  if (initialProfile === undefined || initialUnit === undefined) {
    throw new Error("Demo data must contain at least one learner profile and one learning unit.");
  }

  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile.id);
  const [selectedUnitId, setSelectedUnitId] = useState(initialUnit.id);

  const selectedProfile =
    learnerProfiles.find((profile) => profile.id === selectedProfileId) ?? initialProfile;
  const selectedUnit = learningUnits.find((unit) => unit.id === selectedUnitId) ?? initialUnit;
  const studyPlan = buildStudyPlan(selectedUnit, selectedProfile.state);
  const primaryMode = studyPlan.steps[0]?.mode;
  const selectedAction = actionCopy[selectedProfile.state.recommendedAction];
  const highlightedModes = new Set(studyPlan.steps.map((step) => step.mode));

  return (
    <main className="xidea-shell min-h-screen text-slate-900">
      <div className="grid-fade pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        <header className="glass-panel overflow-hidden rounded-[2rem] p-6 md:p-8">
          <div className="grid gap-8 xl:grid-cols-[1.18fr_0.82fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                <Brain className="h-4 w-4" />
                Xidea / Frontend V0
              </div>

              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-balance text-slate-950 md:text-6xl">
                系统不是回答你一个问题，
                <span className="block text-slate-500">而是在项目里决定你下一步该怎么学。</span>
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
                当前比赛版只围绕一个 RAG 主案例展开，但首页必须一眼讲清楚同一条证据链：
                输入如何进入项目线程，系统如何诊断学习状态，为什么切到当前教学动作，以及这轮结果会怎么回写。
              </p>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.5rem] border border-white/70 bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">主案例</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">RAG 项目学习</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">聚焦“召回、重排、上下文构造”的真实设计理解。</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">核心差异点</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">AI 学习编排</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">系统显式展示 why this action now，而不是只给一段回答。</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">演示目标</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">可讲、可演示、可继续接 API</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">先把前端故事线立住，再继续对接真实 agent runtime。</p>
                </div>
              </div>

              <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {orchestrationMoments.map((moment, index) => (
                  <div
                    className="rounded-[1.5rem] border border-white/80 bg-white/75 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
                    key={moment.title}
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      0{index + 1}
                    </div>
                    <div className="mt-3 text-base font-semibold text-slate-950">{moment.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{moment.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-[1.8rem] bg-slate-950 p-5 text-white shadow-[0_35px_90px_rgba(15,23,42,0.28)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">本轮编排快照</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{selectedAction.label}</p>
                </div>
                <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                  Live Demo
                </div>
              </div>

              <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">当前学习者</p>
                <p className="mt-1 text-xl font-semibold">{selectedProfile.name}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{selectedProfile.role}</p>
              </div>

              <div className="mt-3 rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">当前学习主题</p>
                <p className="mt-1 text-xl font-semibold">{selectedUnit.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{selectedUnit.summary}</p>
              </div>

              <div className="mt-6 flex items-center gap-3 rounded-[1.4rem] bg-white px-4 py-4 text-slate-950">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">系统决定</p>
                  <p className="mt-1 text-base font-semibold">{studyPlan.decision.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{studyPlan.decision.objective}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">最近复盘</p>
                  <p className="mt-2 text-lg font-semibold">{selectedProfile.state.lastReviewedAt ?? "未记录"}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">下一次提醒</p>
                  <p className="mt-2 text-lg font-semibold">{selectedProfile.state.nextReviewAt ?? "待本轮决定"}</p>
                </div>
              </div>
            </aside>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="glass-panel rounded-[1.8rem] p-6">
            <SectionIntro
              icon={Target}
              eyebrow="Project Thread"
              title="输入不是散落的素材，而是进入同一个项目线程"
              description="v0 前端先把项目语境立住，让评委能看到系统不是在回答一个抽象问题，而是在接住同一条项目主线上的材料、问题和 bad case。"
            />

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-4">
                <p className="text-sm text-slate-500">项目名</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{projectContext.name}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-4">
                <p className="text-sm text-slate-500">成功信号</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{projectContext.successSignal}</p>
              </div>
            </div>

            <div className="mt-3 rounded-[1.5rem] border border-white/70 bg-white/85 p-5">
              <div className="grid gap-4 md:grid-cols-[0.92fr_1.08fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">项目目标</p>
                  <p className="mt-3 text-base leading-7 text-slate-800">{projectContext.goal}</p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-950 px-4 py-4 text-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">当前线程</p>
                  <p className="mt-3 text-base leading-7">{projectContext.currentThread}</p>
                </div>
              </div>
              <div className="mt-4 rounded-[1.25rem] bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-950 ring-1 ring-inset ring-amber-200">
                为什么这里一定要编排：{projectContext.orchestrationWhy}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">进入方式与材料来源</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-[0.88fr_1.12fr]">
                <div className="space-y-3">
                  {entryModes.map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <div className="rounded-[1.4rem] border border-white/70 bg-white/85 p-4" key={entry.title}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-950">{entry.title}</div>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{entry.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <ul className="grid gap-3">
                  {sourceAssets.map((asset) => (
                    <li
                      className="rounded-[1.4rem] border border-white/70 bg-white/85 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
                      key={asset.id}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {asset.kind}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {asset.topic}
                        </span>
                      </div>
                      <div className="mt-3 text-base font-semibold text-slate-950">{asset.title}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-[1.8rem] p-6">
            <SectionIntro
              icon={GitBranchPlus}
              eyebrow="Demo State"
              title="切换学习者与主题，系统会即时换一套教学判断"
              description="这块是比赛演示时最直接的控台。不同画像和学习主题切换后，诊断信号、主动作与回写建议都会同步变化。"
            />

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">学习者画像</p>
              <div className="mt-3 space-y-3">
                {learnerProfiles.map((profile) => (
                  <SelectorCard
                    active={profile.id === selectedProfile.id}
                    description={profile.role}
                    key={profile.id}
                    onClick={() => {
                      startTransition(() => {
                        setSelectedProfileId(profile.id);
                      });
                    }}
                    title={profile.name}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">学习主题</p>
              <div className="mt-3 space-y-3">
                {learningUnits.map((unit) => (
                  <SelectorCard
                    active={unit.id === selectedUnit.id}
                    description={unit.summary}
                    key={unit.id}
                    onClick={() => {
                      startTransition(() => {
                        setSelectedUnitId(unit.id);
                      });
                    }}
                    title={unit.title}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">当前候选训练形态</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedUnit.candidateModes.map((mode) => (
                  <span
                    className={`rounded-full px-3 py-2 text-sm font-medium ${highlightedModes.has(mode) ? getModeAccent(mode) : "bg-white text-slate-500 ring-1 ring-inset ring-slate-200"}`}
                    key={mode}
                  >
                    {MODE_LABELS[mode]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.94fr_1.06fr]">
          <div className="glass-panel rounded-[1.8rem] p-6">
            <SectionIntro
              icon={Brain}
              eyebrow="Diagnosis"
              title="系统先看到了什么，再决定该用哪种教学方式"
              description="前端 v0 需要把状态估计做成显式可讲的界面，而不是藏在一句‘我觉得你不太懂’里。"
            />

            <div className="mt-6 grid gap-3">
              {metricCopy.map((metric) => (
                <MetricCard
                  hint={metric.hint}
                  key={metric.key}
                  label={metric.label}
                  tone={metric.tone}
                  value={selectedProfile.state[metric.key]}
                />
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/70 bg-white/85 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">状态来源</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">{selectedProfile.stateSource}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedProfile.state.weakSignals.map((signal) => (
                  <span
                    className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
                    key={signal}
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-panel rounded-[1.8rem] p-6">
              <SectionIntro
                icon={ArrowRightLeft}
                eyebrow="Why This Action"
                title="为什么是这个动作，而不是另一种"
                description="系统要公开自己的判断依据：本轮到底更像是理解缺口、概念混淆，还是需要迁移到真实项目情境。"
              />

              <div className="mt-6 grid gap-4 lg:grid-cols-[1.03fr_0.97fr]">
                <div className="rounded-[1.6rem] bg-slate-950 p-5 text-white">
                  <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                    Recommended Action
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">{selectedAction.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{selectedAction.description}</p>

                  <div className="mt-5 rounded-[1.2rem] bg-white px-4 py-4 text-slate-950">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">主动作目标</div>
                    <div className="mt-2 text-lg font-semibold">{studyPlan.decision.objective}</div>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-white/70 bg-white/85 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">候选模式排序</div>
                  <div className="mt-4 space-y-3">
                    {selectedUnit.candidateModes.map((mode) => (
                      <div
                        className="flex items-start gap-3 rounded-[1.2rem] border border-slate-200/80 px-4 py-4"
                        key={mode}
                      >
                        <div
                          className={`mt-0.5 rounded-full px-3 py-1 text-xs font-semibold ${highlightedModes.has(mode) ? getModeAccent(mode) : "bg-slate-100 text-slate-500"}`}
                        >
                          {highlightedModes.has(mode) ? "已入选" : "候选"}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-950">{MODE_LABELS[mode]}</div>
                          <div className="mt-1 text-sm leading-6 text-slate-600">{getModeNarrative(mode)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {selectedProfile.diagnosisSignals.map((signal) => (
                  <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-5" key={signal.id}>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      {signal.label}
                    </div>
                    <div className="mt-3 text-base font-semibold text-slate-950">{signal.observation}</div>
                    <div className="mt-3 text-sm leading-7 text-slate-600">因此：{signal.implication}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-[1.8rem] p-6">
              <SectionIntro
                icon={Route}
                eyebrow="Study Path"
                title="动态学习路径必须像一条会推进的教学流程"
                description="不是罗列几张卡片，而是把‘现在做什么、接着做什么、最后验证什么’串成一条可以讲述的演示路径。"
              />

              <div className="mt-6 rounded-[1.6rem] bg-linear-to-br from-sky-50 via-white to-amber-50 p-5 ring-1 ring-inset ring-white/80">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Path Summary</div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{studyPlan.headline}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{studyPlan.summary}</p>
              </div>

              <ol className="mt-5 space-y-3">
                {studyPlan.steps.map((step, index) => (
                  <li
                    className="relative overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
                    key={step.id}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                          0{index + 1}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getModeAccent(step.mode)}`}>
                              {MODE_LABELS[step.mode]}
                            </span>
                            {index === 0 ? (
                              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                                当前主动作
                              </span>
                            ) : null}
                          </div>
                          <h4 className="mt-3 text-lg font-semibold text-slate-950">{step.title}</h4>
                          <p className="mt-2 text-sm leading-7 text-slate-600">{step.reason}</p>
                        </div>
                      </div>
                      <div className="md:max-w-xs">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">预期结果</div>
                        <div className="mt-2 text-sm leading-7 text-slate-700">{step.outcome}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.06fr_0.94fr]">
          <div className="glass-panel rounded-[1.8rem] p-6">
            <SectionIntro
              icon={RefreshCcw}
              eyebrow="Writeback"
              title="这轮结束后，系统会把什么写回去"
              description="前端要把‘学习闭环’讲清楚。每次动作不只是生成答案，而是更新线程记忆、状态估计和后续复盘依据。"
            />

            <div className="mt-6 grid gap-3">
              {studyPlan.writeback.map((item) => (
                <div
                  className="flex flex-col gap-3 rounded-[1.5rem] border border-white/70 bg-white/85 p-5 md:flex-row md:items-start md:justify-between"
                  key={item.id}
                >
                  <div className="md:max-w-xs">
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{item.target}</div>
                    <div className="mt-2 text-base font-semibold text-slate-950">{item.change}</div>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    state patch
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[1.8rem] p-6">
            <SectionIntro
              icon={MessageSquareText}
              eyebrow="Next Turn"
              title="v0 页面里也要看得见“下一轮会怎么继续”"
              description="这会直接帮助答辩讲解：Xidea 不是一次性 tutor，而是围绕项目线程不断评估、教学和回写的系统。"
            />

            <div className="mt-6 rounded-[1.6rem] bg-slate-950 p-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">记忆调度参考</div>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.2rem] bg-white/5 px-4 py-4">
                <div>
                  <div className="text-sm text-slate-400">上次复盘</div>
                  <div className="mt-1 text-lg font-semibold">{selectedProfile.state.lastReviewedAt ?? "未记录"}</div>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-500" />
                <div className="text-right">
                  <div className="text-sm text-slate-400">下次安排</div>
                  <div className="mt-1 text-lg font-semibold">{selectedProfile.state.nextReviewAt ?? "待决定"}</div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.2rem] bg-white/5 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">主线说明</div>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  本轮主动作是
                  <span className="font-semibold text-white"> {primaryMode ? MODE_LABELS[primaryMode] : "待决定"} </span>
                  ，下一轮会结合回答质量、混淆是否降低，以及是否能把判断迁移到项目场景，继续调整学习路径。
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">v0 页面判断准则</div>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                <li>评委在 10 秒内能看懂：系统为什么不是静态卡片工具。</li>
                <li>切换画像或主题时，当前动作、路径和回写建议都会显著变化。</li>
                <li>页面默认展示完整证据链，讲解时不需要额外脑补系统判断过程。</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
