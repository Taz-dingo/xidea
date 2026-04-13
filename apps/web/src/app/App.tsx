import { startTransition, useEffect, useState, type ReactElement } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  FileInput,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Route,
  Target,
} from "lucide-react";
import { learnerProfiles, learningUnits, projectContext, sourceAssets } from "@/data/demo";
import {
  buildAgentRequest,
  buildDefaultAgentPrompt,
  buildMockRuntimeSnapshot,
  normalizeAgentRunResult,
  type AgentEntryMode,
} from "@/domain/agent-runtime";
import { MODE_LABELS } from "@/domain/planner";
import type { LearningMode } from "@/domain/types";
import { getAgentBaseUrl, runAgentV0 } from "@/lib/agent-client";

const entryModes = [
  {
    id: "chat-question" as const,
    icon: MessageSquareText,
    title: "问答进入",
  },
  {
    id: "material-import" as const,
    icon: FileInput,
    title: "材料进入",
  },
];

const sessionMetaByUnitId: Record<string, { updatedAt: string; status: string }> = {
  "unit-1": { updatedAt: "1h", status: "诊断中" },
  "unit-2": { updatedAt: "昨天", status: "待澄清" },
  "unit-3": { updatedAt: "2d", status: "待答辩" },
};

const demoProjects = [
  {
    id: "project-rag-demo",
    name: projectContext.name,
    description: "围绕同一个比赛案例组织 session。",
  },
] as const;

type DemoProject = (typeof demoProjects)[number];

interface SessionItem {
  readonly id: string;
  readonly projectId: DemoProject["id"];
  readonly unitId: string;
  readonly title: string;
  readonly summary: string;
  readonly updatedAt: string;
  readonly status: string;
}

const initialSessions: ReadonlyArray<SessionItem> = learningUnits.map((unit) => {
  const meta = sessionMetaByUnitId[unit.id] ?? { updatedAt: "刚刚", status: "进行中" };

  return {
    id: `session-${unit.id}`,
    projectId: "project-rag-demo",
    unitId: unit.id,
    title: unit.title,
    summary: unit.summary,
    updatedAt: meta.updatedAt,
    status: meta.status,
  };
});

const metricCopy = [
  { key: "understandingLevel", label: "理解", tone: "emerald" },
  { key: "memoryStrength", label: "记忆", tone: "amber" },
  { key: "confusion", label: "混淆", tone: "rose" },
  { key: "transferReadiness", label: "迁移", tone: "sky" },
] as const;

function getModeAccent(mode: LearningMode): string {
  switch (mode) {
    case "guided-qa":
      return "bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)] ring-1 ring-inset ring-[var(--xidea-sand)]";
    case "contrast-drill":
      return "bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)] ring-1 ring-inset ring-[var(--xidea-sand)]";
    case "scenario-sim":
      return "bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)] ring-1 ring-inset ring-[var(--xidea-sand)]";
    case "socratic":
      return "bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)] ring-1 ring-inset ring-[var(--xidea-sand)]";
    case "image-recall":
      return "bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)] ring-1 ring-inset ring-[var(--xidea-sand)]";
    case "audio-recall":
      return "bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)] ring-1 ring-inset ring-[var(--xidea-sand)]";
  }
}

function getModeNarrative(mode: LearningMode): string {
  switch (mode) {
    case "guided-qa":
      return "先补理解框架。";
    case "contrast-drill":
      return "先把概念边界拉开。";
    case "scenario-sim":
      return "先验证能不能迁移到项目。";
    case "socratic":
      return "通过追问逼近理解空洞。";
    case "image-recall":
      return "用图像线索唤起记忆。";
    case "audio-recall":
      return "用听觉输入模拟现场反应。";
  }
}

function MetricPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: "emerald" | "amber" | "rose" | "sky";
}): ReactElement {
  const dotClass =
    tone === "emerald"
      ? "bg-[#7a9d83]"
      : tone === "amber"
        ? "bg-[#b98a4a]"
        : tone === "sky"
          ? "bg-[#7f9eb7]"
          : "bg-[#b37a7f]";

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-2 text-sm font-medium text-[var(--xidea-charcoal)]">
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <span>
        {label} {value === null ? "--" : `${value}%`}
      </span>
    </div>
  );
}

function SidebarSession({
  active,
  summary,
  title,
  status,
  updatedAt,
  onClick,
}: {
  active: boolean;
  summary: string;
  title: string;
  status: string;
  updatedAt: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className={
        active
          ? "w-full rounded-[1rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-4 py-3 text-left text-[var(--xidea-near-black)]"
          : "w-full rounded-[1rem] border border-transparent bg-transparent px-4 py-3 text-left text-[var(--xidea-charcoal)] hover:bg-[var(--xidea-white)]"
      }
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-[var(--xidea-near-black)]">
          {title}
        </p>
        <span className={active ? "shrink-0 text-xs text-[var(--xidea-selection-text)]" : "shrink-0 text-xs text-[var(--xidea-stone)]"}>
          {updatedAt}
        </span>
      </div>
      <p className={active ? "mt-2 truncate text-sm leading-6 text-[var(--xidea-charcoal)]" : "mt-2 truncate text-sm leading-6 text-[var(--xidea-stone)]"}>
        {summary}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className={active ? "rounded-full bg-[var(--xidea-white)] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--xidea-selection-text)]" : "rounded-full bg-[var(--xidea-parchment)] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--xidea-stone)]"}>
          {status}
        </span>
      </div>
    </button>
  );
}

function ProjectNode({
  expanded,
  name,
  description,
  sessionCount,
  onClick,
}: {
  expanded: boolean;
  name: string;
  description: string;
  sessionCount: number;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className="flex w-full items-start gap-3 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-4 py-4 text-left"
      onClick={onClick}
      type="button"
    >
      <div className="mt-0.5 text-[var(--xidea-stone)]">
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-[var(--xidea-near-black)]">{name}</p>
          <span className="shrink-0 text-xs text-[var(--xidea-stone)]">{sessionCount}</span>
        </div>
        <p className="mt-2 truncate text-sm leading-6 text-[var(--xidea-stone)]">{description}</p>
      </div>
    </button>
  );
}

function ThreadBubble({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: string;
  tone?: "neutral" | "accent" | "dark";
}): ReactElement {
  const toneClass =
    tone === "accent"
      ? "border-[#ebd5cc] bg-[#f5ede9]"
      : tone === "dark"
        ? "border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)]"
        : "border-[var(--xidea-border)] bg-[var(--xidea-white)]";

  const noteClass = tone === "dark" ? "text-[var(--xidea-selection-text)]" : "text-[var(--xidea-stone)]";
  const bodyClass = "text-[var(--xidea-charcoal)]";

  return (
    <div className={`rounded-[1.2rem] border p-5 ${toneClass}`}>
      <p className={`xidea-kicker ${noteClass}`}>{title}</p>
      <p className={`mt-3 text-sm leading-7 ${bodyClass}`}>{body}</p>
    </div>
  );
}

function InspectorCard({
  title,
  children,
}: {
  title: string;
  children: ReactElement | ReactElement[];
}): ReactElement {
  return (
    <section className="rounded-[1.25rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-5">
      <p className="xidea-kicker">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function App(): ReactElement {
  const initialProfile = learnerProfiles[1] ?? learnerProfiles[0];
  const initialUnit = learningUnits[0];

  if (initialProfile === undefined || initialUnit === undefined) {
    throw new Error("Demo data must contain at least one learner profile and one learning unit.");
  }

  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile.id);
  const [sessions, setSessions] = useState<ReadonlyArray<SessionItem>>(initialSessions);
  const [expandedProjectIds, setExpandedProjectIds] = useState<ReadonlyArray<string>>([
    demoProjects[0].id,
  ]);
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessions[0]?.id ?? "");
  const [selectedEntryMode, setSelectedEntryMode] = useState<AgentEntryMode>("chat-question");
  const [draftPrompt, setDraftPrompt] = useState(() =>
    buildDefaultAgentPrompt(initialProfile, initialUnit, projectContext),
  );
  const [agentState, setAgentState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    snapshot: ReturnType<typeof buildMockRuntimeSnapshot> | null;
    error: string | null;
    lastRunKey: string | null;
  }>({
    status: "idle",
    snapshot: null,
    error: null,
    lastRunKey: null,
  });

  const selectedProfile =
    learnerProfiles.find((profile) => profile.id === selectedProfileId) ?? initialProfile;
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? sessions[0];
  const selectedUnit =
    learningUnits.find((unit) => unit.id === selectedSession?.unitId) ?? initialUnit;
  const selectedProject =
    demoProjects.find((project) => project.id === selectedSession?.projectId) ?? demoProjects[0];
  const agentBaseUrl = getAgentBaseUrl();
  const mockRuntime = buildMockRuntimeSnapshot(selectedProfile, selectedUnit);
  const activeRuntime = agentState.snapshot ?? mockRuntime;
  const currentRunKey = `${selectedProfileId}|${selectedSession?.id ?? "none"}|${selectedEntryMode}|${draftPrompt.trim()}`;
  const isAgentResultStale = agentState.snapshot !== null && agentState.lastRunKey !== currentRunKey;

  useEffect(() => {
    setDraftPrompt(buildDefaultAgentPrompt(selectedProfile, selectedUnit, projectContext));
    setAgentState({
      status: "idle",
      snapshot: null,
      error: null,
      lastRunKey: null,
    });
  }, [selectedProfile.id, selectedSession?.id, selectedUnit.id]);

  function toggleProject(projectId: string): void {
    setExpandedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
  }

  function handleCreateSession(): void {
    const nextIndex = sessions.filter((session) => session.projectId === selectedProject.id).length + 1;
    const createdSession: SessionItem = {
      id: `session-${Date.now()}`,
      projectId: selectedProject.id,
      unitId: selectedUnit.id,
      title: `${selectedUnit.title} / 新对话 ${nextIndex}`,
      summary: "新建 session，等待本轮输入与状态判断。",
      updatedAt: "刚刚",
      status: "草稿",
    };

    setSessions((current) => [createdSession, ...current]);
    setSelectedSessionId(createdSession.id);
    setExpandedProjectIds((current) =>
      current.includes(selectedProject.id) ? current : [...current, selectedProject.id],
    );
  }

  async function handleRunAgent(): Promise<void> {
    setAgentState((current) => ({
      ...current,
      status: "loading",
      error: null,
    }));

    try {
      const result = await runAgentV0(
        buildAgentRequest({
          entryMode: selectedEntryMode,
          profile: selectedProfile,
          project: projectContext,
          prompt: draftPrompt,
          sourceAssets,
          unit: selectedUnit,
        }),
      );

      setAgentState({
        status: "success",
        snapshot: normalizeAgentRunResult(result),
        error: null,
        lastRunKey: currentRunKey,
      });
    } catch (error) {
      setAgentState((current) => ({
        ...current,
        status: "error",
        error: error instanceof Error ? error.message : "Agent 请求失败。",
      }));
    }
  }

  return (
    <main className="xidea-shell min-h-screen bg-[var(--xidea-parchment)] text-[var(--xidea-near-black)]">
      <div className="relative mx-auto min-h-screen max-w-[1560px] px-3 py-3 md:px-4 md:py-4">
        <div className="grid min-h-[calc(100vh-1.5rem)] gap-3 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <aside className="rounded-[1.6rem] border border-[var(--xidea-border)] bg-[#f1f0ea] p-4">
            <button
              className="w-full rounded-[1rem] border border-[var(--xidea-sand)] bg-[var(--xidea-white)] px-4 py-3 text-left text-sm font-medium text-[var(--xidea-near-black)]"
              onClick={handleCreateSession}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                新建 session
              </span>
            </button>

            <div className="mt-6">
              <p className="xidea-kicker">Projects</p>
              <div className="mt-3 space-y-3">
                {demoProjects.map((project) => {
                  const projectSessions = sessions.filter((session) => session.projectId === project.id);
                  const expanded = expandedProjectIds.includes(project.id);

                  return (
                    <div key={project.id}>
                      <ProjectNode
                        description={project.description}
                        expanded={expanded}
                        name={project.name}
                        onClick={() => {
                          toggleProject(project.id);
                        }}
                        sessionCount={projectSessions.length}
                      />

                      {expanded ? (
                        <div className="mt-2 ml-3 border-l border-[var(--xidea-sand)] pl-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="xidea-kicker">Sessions</p>
                            <span className="text-xs text-[var(--xidea-stone)]">{projectSessions.length}</span>
                          </div>
                          <div className="space-y-1">
                            {projectSessions.map((session) => (
                              <SidebarSession
                                active={session.id === selectedSession?.id}
                                key={session.id}
                                onClick={() => {
                                  startTransition(() => {
                                    setSelectedSessionId(session.id);
                                  });
                                }}
                                status={session.status}
                                summary={session.summary}
                                title={session.title}
                                updatedAt={session.updatedAt}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="rounded-[1.6rem] border border-[var(--xidea-border)] bg-[var(--xidea-ivory)]">
            <div className="border-b border-[var(--xidea-border)] px-5 py-4 md:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="truncate text-sm font-medium text-[var(--xidea-near-black)]">
                    {selectedSession?.title ?? selectedUnit.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--xidea-stone)]">
                    {selectedProject.name} / {selectedSession?.status ?? "进行中"}
                  </p>
                </div>
                <div className="rounded-full bg-[var(--xidea-white)] px-3 py-1 text-xs font-medium text-[var(--xidea-stone)]">
                  {activeRuntime.source === "live-agent" ? "Live Agent" : agentBaseUrl ? "Mock Fallback" : "Mock Demo"}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 px-5 py-5 md:px-6">
              <ThreadBubble body={draftPrompt.trim() || "输入为空。"} title="当前输入" />
              <ThreadBubble body={activeRuntime.decision.reason} title="系统判断" tone="accent" />
              <ThreadBubble body={activeRuntime.assistantMessage} title="当前动作" tone="dark" />

              <div className="rounded-[1.2rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5ede9] text-[var(--xidea-terracotta)]">
                    <Route className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="xidea-kicker">下一步路径</p>
                    <p className="mt-1 text-sm text-[var(--xidea-stone)]">只保留当前最关键的三步。</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {activeRuntime.plan.steps.slice(0, 3).map((step, index) => (
                    <div
                      className="flex items-start gap-4 rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4"
                      key={step.id}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eadfd7] text-sm font-medium text-[var(--xidea-selection-text)]">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-[var(--xidea-near-black)]">{step.title}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getModeAccent(step.mode)}`}>
                            {MODE_LABELS[step.mode]}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">{step.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--xidea-border)] px-5 py-4 md:px-6">
              <div className="rounded-[1.2rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {entryModes.map((entry) => {
                    const Icon = entry.icon;
                    const active = entry.id === selectedEntryMode;

                    return (
                      <button
                        className={
                          active
                            ? "xidea-button-dark inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                            : "xidea-button-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                        }
                        key={entry.id}
                        onClick={() => {
                          setSelectedEntryMode(entry.id);
                        }}
                        type="button"
                      >
                        <Icon className="h-4 w-4" />
                        {entry.title}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  className="xidea-field mt-4 min-h-28 w-full rounded-[1rem] px-4 py-4 text-sm leading-7 transition"
                  onChange={(event) => {
                    setDraftPrompt(event.target.value);
                  }}
                  value={draftPrompt}
                />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-[var(--xidea-stone)]">
                    {agentState.error
                      ? agentState.error
                      : isAgentResultStale
                        ? "当前结果来自上一轮运行。"
                        : projectContext.currentThread}
                  </div>
                  <button
                    className="xidea-button-primary rounded-full px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={agentState.status === "loading" || agentBaseUrl === null}
                    onClick={() => {
                      void handleRunAgent();
                    }}
                    type="button"
                  >
                    {agentState.status === "loading" ? "运行中..." : "运行 agent"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-3 rounded-[1.6rem] border border-[var(--xidea-border)] bg-[#f7f6f0] p-4">
            <InspectorCard title="学习画像">
              <div className="space-y-2">
                {learnerProfiles.map((profile) => (
                  <button
                    className={
                      profile.id === selectedProfile.id
                        ? "w-full rounded-[1rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-4 py-3 text-left text-[var(--xidea-near-black)]"
                        : "w-full rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-4 py-3 text-left text-[var(--xidea-near-black)]"
                    }
                    key={profile.id}
                    onClick={() => {
                      startTransition(() => {
                        setSelectedProfileId(profile.id);
                      });
                    }}
                    type="button"
                  >
                    <p className="truncate text-sm font-medium">{profile.name}</p>
                    <p className={profile.id === selectedProfile.id ? "mt-2 truncate text-sm leading-6 text-[var(--xidea-charcoal)]" : "mt-2 truncate text-sm leading-6 text-[var(--xidea-stone)]"}>
                      {profile.role}
                    </p>
                  </button>
                ))}
              </div>
            </InspectorCard>

            <InspectorCard title="学习状态">
              <div className="flex flex-wrap gap-2">
                {metricCopy.map((metric) => (
                  <MetricPill
                    key={metric.key}
                    label={metric.label}
                    tone={metric.tone}
                    value={activeRuntime.state[metric.key]}
                  />
                ))}
              </div>
              <div className="mt-4 rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4 text-sm leading-7 text-[var(--xidea-charcoal)]">
                {activeRuntime.stateSource}
              </div>
            </InspectorCard>

            <InspectorCard title="复习系统">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4">
                  <p className="text-sm text-[var(--xidea-stone)]">最近复盘</p>
                  <p className="mt-2 text-sm font-medium text-[var(--xidea-near-black)]">
                    {activeRuntime.state.lastReviewedAt ?? "未记录"}
                  </p>
                </div>
                <div className="rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4">
                  <p className="text-sm text-[var(--xidea-stone)]">下一次提醒</p>
                  <p className="mt-2 text-sm font-medium text-[var(--xidea-near-black)]">
                    {activeRuntime.state.nextReviewAt ?? "待本轮决定"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {activeRuntime.state.weakSignals.map((signal) => (
                  <span
                    className="rounded-full bg-[var(--xidea-ivory)] px-3 py-2 text-sm text-[var(--xidea-charcoal)] ring-1 ring-inset ring-[var(--xidea-sand)]"
                    key={signal}
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </InspectorCard>

            <InspectorCard title="项目面板">
              <div className="space-y-3">
                <div className="rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4">
                  <p className="text-sm font-medium text-[var(--xidea-near-black)]">{selectedProject.name}</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">
                    当前 project 下共有 {sessions.filter((session) => session.projectId === selectedProject.id).length} 个 session。
                  </p>
                </div>

                <div className="rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-[var(--xidea-terracotta)]" />
                    <p className="text-sm font-medium text-[var(--xidea-near-black)]">{activeRuntime.decision.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">{activeRuntime.decision.objective}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedUnit.candidateModes.map((mode) => (
                    <span className={`rounded-full px-3 py-2 text-sm font-medium ${getModeAccent(mode)}`} key={mode}>
                      {MODE_LABELS[mode]}
                    </span>
                  ))}
                </div>

                <div className="rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-[var(--xidea-terracotta)]" />
                    <p className="text-sm font-medium text-[var(--xidea-near-black)]">当前材料</p>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">
                    {sourceAssets.length} 份材料已接入当前项目线程，默认不展开详情。
                  </p>
                </div>

                <div className="rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4">
                  <div className="flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4 text-[var(--xidea-terracotta)]" />
                    <p className="text-sm font-medium text-[var(--xidea-near-black)]">状态回写</p>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">
                    {activeRuntime.writeback[0]?.change ?? "本轮结果会写回 learner state 和 review engine。"}
                  </p>
                </div>
              </div>
            </InspectorCard>
          </aside>
        </div>
      </div>
    </main>
  );
}
