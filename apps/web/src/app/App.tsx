import { startTransition, useMemo, useState, type ReactElement } from "react";
import {
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
import { buildStudyPlan } from "@/domain/planner";

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

export function App(): ReactElement {
  const initialProfile = learnerProfiles[1] ?? learnerProfiles[0];
  const initialUnit = learningUnits[0];

  if (initialProfile === undefined || initialUnit === undefined) {
    throw new Error("Demo data must contain at least one learner profile and one learning unit.");
  }

  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile.id);
  const [selectedUnitId, setSelectedUnitId] = useState(initialUnit.id);

  const selectedProfile = useMemo(
    () => learnerProfiles.find((profile) => profile.id === selectedProfileId) ?? initialProfile,
    [initialProfile, selectedProfileId],
  );
  const selectedUnit = useMemo(
    () => learningUnits.find((unit) => unit.id === selectedUnitId) ?? initialUnit,
    [initialUnit, selectedUnitId],
  );
  const studyPlan = useMemo(
    () => buildStudyPlan(selectedUnit, selectedProfile.state),
    [selectedProfile.state, selectedUnit],
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-500">Xidea / AI Learning Orchestration</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            比赛版先证明一件事：系统能决定你在项目里下一步该怎么学。
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            长期上，Xidea 仍然是一个可扩展的 AI 学习编排系统；当前 demo 只是先用 RAG 项目学习这个主案例，
            证明“项目上下文 + 学习状态 + 动作选择”这条主线能成立。
          </p>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Target className="h-4 w-4" />
              当前项目上下文
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">项目名</div>
                <div className="mt-1 font-medium">{projectContext.name}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">成功信号</div>
                <div className="mt-1 text-sm text-slate-700">{projectContext.successSignal}</div>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">项目目标</div>
              <div className="mt-1">{projectContext.goal}</div>
              <div className="mt-3 font-medium text-slate-900">当前线程</div>
              <div className="mt-1">{projectContext.currentThread}</div>
              <div className="mt-3 font-medium text-slate-900">为什么需要编排</div>
              <div className="mt-1">{projectContext.orchestrationWhy}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <GitBranchPlus className="h-4 w-4" />
              进入方式与材料
            </div>
            <div className="mt-4 space-y-3">
              {entryModes.map((entry) => {
                const Icon = entry.icon;
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={entry.title}>
                    <div className="flex items-center gap-2 font-medium">
                      <Icon className="h-4 w-4 text-slate-500" />
                      {entry.title}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{entry.description}</p>
                  </div>
                );
              })}
            </div>

            <ul className="mt-4 space-y-3">
              {sourceAssets.map((asset) => (
                <li className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm" key={asset.id}>
                  <div className="font-medium">{asset.title}</div>
                  <div className="mt-1 text-slate-600">
                    {asset.kind} / {asset.topic}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">学习者画像</p>
            <div className="mt-4 space-y-3">
              {learnerProfiles.map((profile) => (
                <button
                  className={
                    profile.id === selectedProfile.id
                      ? "w-full rounded-xl border border-slate-400 bg-slate-100 p-4 text-left"
                      : "w-full rounded-xl border border-slate-200 bg-white p-4 text-left"
                  }
                  key={profile.id}
                  onClick={() => {
                    startTransition(() => {
                      setSelectedProfileId(profile.id);
                    });
                  }}
                  type="button"
                >
                  <div className="font-medium">{profile.name}</div>
                  <div className="mt-1 text-sm text-slate-600">{profile.role}</div>
                </button>
              ))}
            </div>

            <p className="mt-6 text-sm font-medium text-slate-500">学习主题</p>
            <div className="mt-4 space-y-3">
              {learningUnits.map((unit) => (
                <button
                  className={
                    unit.id === selectedUnit.id
                      ? "w-full rounded-xl border border-slate-400 bg-slate-100 p-4 text-left"
                      : "w-full rounded-xl border border-slate-200 bg-white p-4 text-left"
                  }
                  key={unit.id}
                  onClick={() => {
                    startTransition(() => {
                      setSelectedUnitId(unit.id);
                    });
                  }}
                  type="button"
                >
                  <div className="font-medium">{unit.title}</div>
                  <div className="mt-1 text-sm text-slate-600">{unit.summary}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">编排证据链</p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Brain className="h-4 w-4" />
                1. 当前学习状态
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm text-slate-500">理解水平</div>
                  <div className="mt-1 text-xl font-semibold">{selectedProfile.state.understandingLevel}%</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm text-slate-500">记忆强度</div>
                  <div className="mt-1 text-xl font-semibold">{selectedProfile.state.memoryStrength}%</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm text-slate-500">混淆风险</div>
                  <div className="mt-1 text-xl font-semibold">{selectedProfile.state.confusion}%</div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <div className="font-medium text-slate-900">状态来源</div>
                <div className="mt-1">{selectedProfile.stateSource}</div>
                <div className="mt-3">弱信号：{selectedProfile.state.weakSignals.join(" / ")}</div>
                <div className="mt-1">推荐动作：{selectedProfile.state.recommendedAction}</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <ArrowRightLeft className="h-4 w-4" />
                2. 为什么是这个动作
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-medium text-slate-900">{studyPlan.decision.title}</div>
                <div className="mt-1 text-sm text-slate-600">{studyPlan.decision.reason}</div>
                <div className="mt-2 text-sm text-slate-800">目标：{studyPlan.decision.objective}</div>
              </div>

              <div className="mt-3 space-y-3">
                {selectedProfile.diagnosisSignals.map((signal) => (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm" key={signal.id}>
                    <div className="font-medium text-slate-900">{signal.label}</div>
                    <div className="mt-1 text-slate-600">{signal.observation}</div>
                    <div className="mt-2 text-slate-800">因此：{signal.implication}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Route className="h-4 w-4" />
                3. 动态学习路径
              </div>
              <h2 className="mt-3 text-xl font-semibold">{studyPlan.headline}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{studyPlan.summary}</p>

              <ol className="mt-4 space-y-3">
                {studyPlan.steps.map((step) => (
                  <li className="rounded-xl border border-slate-200 bg-white p-4" key={step.id}>
                    <div className="font-medium">{step.title}</div>
                    <div className="mt-1 text-sm text-slate-600">{step.reason}</div>
                    <div className="mt-1 text-sm text-slate-800">目标：{step.outcome}</div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <RefreshCcw className="h-4 w-4" />
                4. 计划如何回写
              </div>
              <div className="mt-3 space-y-3">
                {studyPlan.writeback.map((item) => (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm" key={item.id}>
                    <div className="font-medium text-slate-900">{item.target}</div>
                    <div className="mt-1 text-slate-700">{item.change}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm text-slate-600">
                记忆调度参考：{selectedProfile.state.lastReviewedAt ?? "未记录"} →{" "}
                {selectedProfile.state.nextReviewAt ?? "未安排"}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
