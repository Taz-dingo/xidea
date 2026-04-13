import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { startTransition, useEffect, useMemo, useState, type ReactElement } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { learnerProfiles, learningUnits, projectContext, sourceAssets } from "@/data/demo";
import { buildDefaultAgentPrompt, buildMockRuntimeSnapshot, type AgentEntryMode, type RuntimeSnapshot } from "@/domain/agent-runtime";
import { MODE_LABELS } from "@/domain/planner";
import type { LearningMode } from "@/domain/types";
import { createAgentChatTransport } from "@/lib/agent-chat-transport";
import { getAgentBaseUrl } from "@/lib/agent-client";

const entryModes = [
  { id: "chat-question" as const, icon: MessageSquareText, title: "问答进入" },
  { id: "material-import" as const, icon: FileInput, title: "材料进入" },
];

const sessionMetaByUnitId: Record<string, { updatedAt: string; status: string }> = {
  "unit-1": { updatedAt: "1h", status: "诊断中" },
  "unit-2": { updatedAt: "昨天", status: "待澄清" },
  "unit-3": { updatedAt: "2d", status: "待答辩" },
};

interface ProjectItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

const initialProjects: ReadonlyArray<ProjectItem> = [
  {
    id: "project-rag-demo",
    name: projectContext.name,
    description: "围绕同一个比赛案例组织 session。",
  },
] as const;

interface SessionItem {
  readonly id: string;
  readonly projectId: string;
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

function getModeBadgeClass(_mode: LearningMode): string {
  return "border-[var(--xidea-sand)] bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)]";
}

function getMetricDotClass(tone: "emerald" | "amber" | "rose" | "sky"): string {
  switch (tone) {
    case "emerald":
      return "bg-[#7a9d83]";
    case "amber":
      return "bg-[#b98a4a]";
    case "sky":
      return "bg-[#7f9eb7]";
    case "rose":
      return "bg-[#b37a7f]";
  }
}

function getMessageText(message: UIMessage): string {
  const text = message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();

  return text === "" ? "当前消息没有文本内容。" : text;
}

function SessionCard({
  active,
  title,
  summary,
  status,
  updatedAt,
  onClick,
}: {
  active: boolean;
  title: string;
  summary: string;
  status: string;
  updatedAt: string;
  onClick: () => void;
}): ReactElement {
  return (
    <Card
      className={
        active
          ? "rounded-[1rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] shadow-none transition-colors"
          : "rounded-[1rem] border-transparent bg-transparent shadow-none transition-colors hover:border-[var(--xidea-border)] hover:bg-[var(--xidea-white)]"
      }
    >
      <CardContent className="p-0">
        <button
          className="block w-full rounded-[1rem] px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-parchment)]"
          onClick={onClick}
          type="button"
        >
          <div className="min-w-0 w-full">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
              <span className={active ? "shrink-0 text-xs text-[var(--xidea-selection-text)]" : "shrink-0 text-xs text-[var(--xidea-stone)]"}>
                {updatedAt}
              </span>
            </div>
            <p
              className={
                active
                  ? "mt-2 line-clamp-2 text-sm leading-6 text-[var(--xidea-charcoal)]"
                  : "mt-2 line-clamp-2 text-sm leading-6 text-[var(--xidea-stone)]"
              }
            >
              {summary}
            </p>
            <div className="mt-3">
              <Badge
                className={
                  active
                    ? "border-transparent bg-[var(--xidea-white)] text-[var(--xidea-selection-text)] shadow-none"
                    : "border-[var(--xidea-sand)] bg-[var(--xidea-parchment)] text-[var(--xidea-stone)] shadow-none"
                }
                variant="outline"
              >
                {status}
              </Badge>
            </div>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

function ProjectCard({
  active,
  expanded,
  name,
  description,
  sessionCount,
  onClick,
}: {
  active: boolean;
  expanded: boolean;
  name: string;
  description: string;
  sessionCount: number;
  onClick: () => void;
}): ReactElement {
  return (
    <Card
      className={
        active
          ? "rounded-[1rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] shadow-none transition-colors"
          : "rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[#fcfbf7]"
      }
    >
      <CardContent className="p-0">
        <button
          className="block w-full rounded-[1rem] px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-parchment)]"
          onClick={onClick}
          type="button"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-[var(--xidea-stone)]">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{name}</p>
                <span className="shrink-0 text-xs text-[var(--xidea-stone)]">{sessionCount}</span>
              </div>
              <p className="mt-2 line-clamp-1 text-sm leading-6 text-[var(--xidea-stone)]">{description}</p>
            </div>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

function ProfileCard({
  active,
  name,
  role,
  onClick,
}: {
  active: boolean;
  name: string;
  role: string;
  onClick: () => void;
}): ReactElement {
  return (
    <Card
      className={
        active
          ? "rounded-[1rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] shadow-none transition-colors"
          : "rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[#fcfbf7]"
      }
    >
      <CardContent className="p-0">
        <button
          className="block w-full rounded-[1rem] px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-white)]"
          onClick={onClick}
          type="button"
        >
          <p className="text-sm font-medium leading-6">{name}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--xidea-stone)]">{role}</p>
        </button>
      </CardContent>
    </Card>
  );
}

function InspectorCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactElement | ReactElement[];
}): ReactElement {
  return (
    <Card className="rounded-[1.25rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardHeader className="pb-4">
        <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">{title}</CardTitle>
        {description ? <CardDescription className="text-sm text-[var(--xidea-stone)]">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function getErrorMessage(error: Error | undefined): string | null {
  if (error === undefined) {
    return null;
  }

  const message = error.message.trim();
  if (message === "") {
    return "Agent 当前不可用，请稍后重试。";
  }

  if (message.startsWith("{")) {
    return "Agent 当前不可用，请检查本地服务或代理配置。";
  }

  return message;
}

export function App(): ReactElement {
  const initialProfile = learnerProfiles[1] ?? learnerProfiles[0];
  const initialUnit = learningUnits[0];
  const initialProject = initialProjects[0];

  if (initialProfile === undefined || initialUnit === undefined || initialProject === undefined) {
    throw new Error("Demo data must contain at least one learner profile, learning unit, and project.");
  }

  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile.id);
  const [projects, setProjects] = useState<ReadonlyArray<ProjectItem>>(initialProjects);
  const [sessions, setSessions] = useState<ReadonlyArray<SessionItem>>(initialSessions);
  const [expandedProjectIds, setExpandedProjectIds] = useState<ReadonlyArray<string>>([
    initialProject.id,
  ]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialSessions[0]?.projectId ?? initialProject.id);
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessions[0]?.id ?? "");
  const [selectedEntryMode, setSelectedEntryMode] = useState<AgentEntryMode>("chat-question");
  const [draftPrompt, setDraftPrompt] = useState(() =>
    buildDefaultAgentPrompt(initialProfile, initialUnit, projectContext),
  );
  const [sessionSnapshots, setSessionSnapshots] = useState<Record<string, RuntimeSnapshot>>({});
  const [sessionMessagesById, setSessionMessagesById] = useState<Record<string, UIMessage[]>>(
    () => Object.fromEntries(initialSessions.map((session) => [session.id, []])),
  );

  const selectedProfile =
    learnerProfiles.find((profile) => profile.id === selectedProfileId) ?? initialProfile;
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const selectedUnit =
    learningUnits.find((unit) => unit.id === selectedSession?.unitId) ?? initialUnit;
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? initialProject;
  const agentBaseUrl = getAgentBaseUrl();
  const mockRuntime = buildMockRuntimeSnapshot(selectedProfile, selectedUnit);
  const activeRuntime =
    selectedSession === undefined ? mockRuntime : sessionSnapshots[selectedSession.id] ?? mockRuntime;

  const transport = useMemo(
    () =>
      createAgentChatTransport({
        entryMode: selectedEntryMode,
        profile: selectedProfile,
        project: projectContext,
        sourceAssets,
        unit: selectedUnit,
        onSnapshot: (snapshot) => {
          if (selectedSession === undefined) {
            return;
          }

          setSessionSnapshots((current) => ({
            ...current,
            [selectedSession.id]: snapshot,
          }));
          setSessions((current) =>
            current.map((session) =>
              session.id === selectedSession.id
                ? {
                    ...session,
                    status: "已更新",
                    updatedAt: "刚刚",
                  }
                : session,
            ),
          );
        },
      }),
    [selectedEntryMode, selectedProfile, selectedSession, selectedUnit],
  );

  const { clearError, messages, sendMessage, status, error } = useChat({
    id: selectedSession?.id ?? selectedProject?.id ?? "project",
    messages: selectedSession ? sessionMessagesById[selectedSession.id] ?? [] : [],
    transport,
  });

  const errorMessage = getErrorMessage(error);

  useEffect(() => {
    setDraftPrompt(buildDefaultAgentPrompt(selectedProfile, selectedUnit, projectContext));
  }, [selectedProfile.id, selectedSession?.id, selectedUnit.id]);

  useEffect(() => {
    if (selectedSession === undefined) {
      return;
    }

    setSessionMessagesById((current) =>
      current[selectedSession.id] === messages
        ? current
        : {
            ...current,
            [selectedSession.id]: messages,
          },
    );
  }, [messages, selectedSession]);

  useEffect(() => {
    if (selectedSession === undefined || error === undefined) {
      return;
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === selectedSession.id
          ? session.status === "错误"
            ? session
            : {
                ...session,
                status: "错误",
                updatedAt: "刚刚",
              }
          : session,
      ),
    );
  }, [error, selectedSession?.id]);

  function toggleProject(projectId: string): void {
    setExpandedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
  }

  function handleSelectProject(projectId: string): void {
    setSelectedProjectId(projectId);

    const firstProjectSession = sessions.find((session) => session.projectId === projectId);
    setSelectedSessionId(firstProjectSession?.id ?? "");
  }

  function handleCreateProject(): void {
    const nextIndex = projects.length + 1;
    const createdProject: ProjectItem = {
      id: `project-${Date.now()}`,
      name: `新项目 ${nextIndex}`,
      description: "围绕一个新的答辩主题组织 session。",
    };

    setProjects((current) => [createdProject, ...current]);
    setSelectedProjectId(createdProject.id);
    setSelectedSessionId("");
    setExpandedProjectIds((current) => [createdProject.id, ...current]);
  }

  function handleCreateSession(projectId: string): void {
    const targetProject =
      projects.find((project) => project.id === projectId) ?? selectedProject ?? projects[0];

    if (targetProject === undefined) {
      return;
    }

    const nextIndex = sessions.filter((session) => session.projectId === targetProject.id).length + 1;
    const createdSession: SessionItem = {
      id: `session-${Date.now()}`,
      projectId: targetProject.id,
      unitId: selectedUnit.id,
      title: `${selectedUnit.title} / 新对话 ${nextIndex}`,
      summary: "等待本轮输入",
      updatedAt: "刚刚",
      status: "草稿",
    };

    setSessions((current) => [createdSession, ...current]);
    setSessionMessagesById((current) => ({ ...current, [createdSession.id]: [] }));
    setSelectedProjectId(targetProject.id);
    setSelectedSessionId(createdSession.id);
    setExpandedProjectIds((current) =>
      current.includes(targetProject.id) ? current : [...current, targetProject.id],
    );
  }

  function handleSubmitPrompt(): void {
    if (selectedSession === undefined) {
      return;
    }

    const text = draftPrompt.trim();
    if (text === "") {
      return;
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === selectedSession.id
          ? {
              ...session,
              summary: text,
              updatedAt: "刚刚",
              status: "运行中",
            }
          : session,
      ),
    );

    setDraftPrompt("");
    void sendMessage({ text });
  }

  return (
    <main className="xidea-shell min-h-screen bg-[var(--xidea-parchment)] text-[var(--xidea-near-black)]">
      <div className="relative mx-auto min-h-screen max-w-[1600px] px-4 py-4 md:px-5 md:py-5 xl:h-screen xl:min-h-0">
        <div className="grid items-start gap-4 xl:h-full xl:grid-cols-[340px_minmax(0,1fr)] xl:items-stretch 2xl:grid-cols-[340px_minmax(0,1fr)_320px]">
          <Card className="overflow-hidden rounded-[1.6rem] border-[var(--xidea-border)] bg-[#f1f0ea] shadow-none xl:h-full">
            <CardContent className="flex h-full flex-col p-4">
              <Button
                className="justify-start rounded-[1rem] border-[var(--xidea-charcoal)] bg-[var(--xidea-white)] text-[var(--xidea-near-black)] shadow-none transition-colors hover:bg-[#f8f6f1]"
                onClick={handleCreateProject}
                type="button"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                新建 project
              </Button>

              <Separator className="my-5 bg-[var(--xidea-border)]" />

              <div className="flex min-h-0 flex-1 flex-col space-y-3">
                <p className="xidea-kicker">Projects</p>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-3 pr-2">
                    {projects.map((project) => {
                      const projectSessions = sessions.filter((session) => session.projectId === project.id);
                      const expanded = expandedProjectIds.includes(project.id);
                      const activeProject = project.id === selectedProject?.id;

                      return (
                        <div key={project.id}>
                          <ProjectCard
                            active={activeProject}
                            description={project.description}
                            expanded={expanded}
                            name={project.name}
                            onClick={() => {
                              handleSelectProject(project.id);
                              toggleProject(project.id);
                            }}
                            sessionCount={projectSessions.length}
                          />

                          {expanded ? (
                            <div className="mt-2 ml-3 box-border w-[calc(100%-0.75rem)] border-l border-[var(--xidea-sand)] pl-3">
                              <div className="mb-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="xidea-kicker">Sessions</p>
                                  <span className="shrink-0 text-xs text-[var(--xidea-stone)]">
                                    {projectSessions.length}
                                  </span>
                                </div>
                                <Button
                                  className="w-full justify-start rounded-full px-3 text-xs shadow-none transition-colors hover:bg-[var(--xidea-white)]"
                                  onClick={() => {
                                    handleCreateSession(project.id);
                                  }}
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  新建 session
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {projectSessions.length === 0 ? (
                                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                                    <CardContent className="px-4 py-3 text-sm text-[var(--xidea-stone)]">
                                      这个 project 还没有 session。
                                    </CardContent>
                                  </Card>
                                ) : null}
                                {projectSessions.map((session) => (
                                  <SessionCard
                                    active={session.id === selectedSession?.id}
                                    key={session.id}
                                    onClick={() => {
                                      startTransition(() => {
                                        setSelectedProjectId(project.id);
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
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] shadow-none xl:h-full">
            <CardHeader className="gap-3 border-b border-[var(--xidea-border)] pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-sm font-medium text-[var(--xidea-near-black)]">
                    {selectedSession?.title ?? `${selectedProject.name} / 暂无 session`}
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm text-[var(--xidea-stone)]">
                    {selectedProject.name} / {selectedSession?.status ?? "等待创建 session"}
                  </CardDescription>
                </div>
                <Badge
                  className="border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-stone)] shadow-none"
                  variant="outline"
                >
                  {status === "streaming" || status === "submitted"
                    ? "Streaming"
                    : activeRuntime.source === "live-agent"
                      ? "Live Agent"
                      : agentBaseUrl
                        ? "Mock Fallback"
                        : "Mock Demo"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-0">
              <div className="px-5 pt-5 md:px-6">
                <div className="flex flex-wrap gap-2">
                  {entryModes.map((entry) => {
                    const Icon = entry.icon;
                    const active = entry.id === selectedEntryMode;

                    return (
                      <Button
                        className={
                          active
                            ? "rounded-full border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] hover:bg-[#f2e6df]"
                            : "rounded-full border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-charcoal)] hover:border-[var(--xidea-selection-border)] hover:bg-[#f8f6f1]"
                        }
                        key={entry.id}
                        onClick={() => {
                          setSelectedEntryMode(entry.id);
                        }}
                        type="button"
                        variant="outline"
                      >
                        <Icon className="h-4 w-4" />
                        {entry.title}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Separator className="bg-[var(--xidea-border)]" />

              <div className="min-h-0 flex-1 px-5 md:px-6">
                <ScrollArea className="h-full pr-3">
                  <div className="space-y-3 pb-4">
                    {selectedSession === undefined ? (
                      <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                        <CardHeader className="pb-3">
                          <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">当前 project</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm leading-7 text-[var(--xidea-charcoal)]">
                          <p>这个 project 还没有 session。</p>
                          <p>先在左侧当前 project 下新建 session，再开始这一轮 agent 运行。</p>
                        </CardContent>
                      </Card>
                    ) : messages.length === 0 ? (
                      <>
                        <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                          <CardHeader className="pb-3">
                            <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">当前输入</CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                            {draftPrompt.trim() || "输入为空。"}
                          </CardContent>
                        </Card>
                        <Card className="rounded-[1.2rem] border-[#ebd5cc] bg-[#f5ede9] shadow-none">
                          <CardHeader className="pb-3">
                            <CardTitle className="xidea-kicker text-[var(--xidea-selection-text)]">系统判断</CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                            {activeRuntime.decision.reason}
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      messages.map((message) => (
                        <Card
                          className={
                            message.role === "assistant"
                              ? "rounded-[1.2rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] shadow-none"
                              : "rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none"
                          }
                          key={message.id}
                        >
                          <CardHeader className="pb-3">
                            <CardTitle
                              className={
                                message.role === "assistant"
                                  ? "xidea-kicker text-[var(--xidea-selection-text)]"
                                  : "xidea-kicker text-[var(--xidea-stone)]"
                              }
                            >
                              {message.role === "assistant" ? "当前动作" : "当前输入"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                            {getMessageText(message)}
                          </CardContent>
                        </Card>
                      ))
                    )}

                    <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5ede9] text-[var(--xidea-terracotta)]">
                            <Route className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">下一步路径</CardTitle>
                            <CardDescription className="text-sm text-[var(--xidea-stone)]">
                              由当前 runtime 决定的前三步。
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
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
                                <Badge
                                  className={`border shadow-none ${getModeBadgeClass(step.mode)}`}
                                  variant="outline"
                                >
                                  {MODE_LABELS[step.mode]}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">{step.reason}</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </div>

              <div className="shrink-0 border-t border-[var(--xidea-border)] px-5 py-4 md:px-6">
                <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                  <CardContent className="p-4">
                    <Textarea
                      className="min-h-28 rounded-[1rem] border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] text-sm leading-7 text-[var(--xidea-charcoal)] shadow-none focus-visible:ring-[var(--xidea-selection-border)]"
                      onChange={(event) => {
                        if (error !== undefined) {
                          clearError();
                        }
                        setDraftPrompt(event.target.value);
                      }}
                      placeholder="输入这一轮你想推进的问题或材料。"
                      value={draftPrompt}
                    />

                    {errorMessage ? (
                      <Card className="mt-4 rounded-[1rem] border-[#ebd5cc] bg-[#f9efea] shadow-none">
                        <CardContent className="px-4 py-3 text-sm leading-6 text-[var(--xidea-selection-text)]">
                          {errorMessage}
                        </CardContent>
                      </Card>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-[var(--xidea-stone)]">
                        {errorMessage ?? projectContext.currentThread}
                      </div>
                      <Button
                        className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                        disabled={
                          selectedSession === undefined ||
                          status === "submitted" ||
                          status === "streaming" ||
                          agentBaseUrl === null
                        }
                        onClick={handleSubmitPrompt}
                        type="button"
                      >
                        {status === "submitted" || status === "streaming" ? "运行中..." : "运行 agent"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="min-h-0 xl:col-span-2 2xl:col-span-1 2xl:h-full">
            <ScrollArea className="h-full pr-1">
              <div className="flex flex-col gap-3 pb-1">
                <InspectorCard description="当前 session 绑定哪个学习者阶段。" title="学习画像">
                  <div className="space-y-2">
                    {learnerProfiles.map((profile) => (
                      <ProfileCard
                        active={profile.id === selectedProfile.id}
                        key={profile.id}
                        name={profile.name}
                        onClick={() => {
                          startTransition(() => {
                            setSelectedProfileId(profile.id);
                          });
                        }}
                        role={profile.role}
                      />
                    ))}
                  </div>
                </InspectorCard>

                <InspectorCard description="由当前 runtime 回写出来的学习状态。" title="学习状态">
                  <div className="flex flex-wrap gap-2">
                    {metricCopy.map((metric) => (
                      <Badge
                        className="rounded-full border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-2 text-sm font-medium text-[var(--xidea-charcoal)] shadow-none"
                        key={metric.key}
                        variant="outline"
                      >
                        <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${getMetricDotClass(metric.tone)}`} />
                        {metric.label} {activeRuntime.state[metric.key] === null ? "--" : `${activeRuntime.state[metric.key]}%`}
                      </Badge>
                    ))}
                  </div>
                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                    <CardContent className="p-4 text-sm leading-7 text-[var(--xidea-charcoal)]">
                      {activeRuntime.stateSource}
                    </CardContent>
                  </Card>
                </InspectorCard>

                <InspectorCard description="当前复习节点和弱信号。" title="复习系统">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                      <CardContent className="p-4">
                        <p className="text-sm text-[var(--xidea-stone)]">最近复盘</p>
                        <p className="mt-2 text-sm font-medium text-[var(--xidea-near-black)]">
                          {activeRuntime.state.lastReviewedAt ?? "未记录"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                      <CardContent className="p-4">
                        <p className="text-sm text-[var(--xidea-stone)]">下一次提醒</p>
                        <p className="mt-2 text-sm font-medium text-[var(--xidea-near-black)]">
                          {activeRuntime.state.nextReviewAt ?? "待本轮决定"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeRuntime.state.weakSignals.map((signal) => (
                      <Badge
                        className="border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] px-3 py-2 text-sm text-[var(--xidea-charcoal)] shadow-none"
                        key={signal}
                        variant="outline"
                      >
                        {signal}
                      </Badge>
                    ))}
                  </div>
                </InspectorCard>

                <InspectorCard description="项目上下文和当前主训练动作。" title="项目面板">
                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-[var(--xidea-near-black)]">{selectedProject.name}</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">
                        当前 project 下共有 {sessions.filter((session) => session.projectId === selectedProject.id).length} 个 session。
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-[var(--xidea-terracotta)]" />
                        <p className="text-sm font-medium text-[var(--xidea-near-black)]">{activeRuntime.decision.title}</p>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">{activeRuntime.decision.objective}</p>
                    </CardContent>
                  </Card>

                  <div className="flex flex-wrap gap-2">
                    {selectedUnit.candidateModes.map((mode) => (
                      <Badge className={`border shadow-none ${getModeBadgeClass(mode)}`} key={mode} variant="outline">
                        {MODE_LABELS[mode]}
                      </Badge>
                    ))}
                  </div>

                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-[var(--xidea-terracotta)]" />
                        <p className="text-sm font-medium text-[var(--xidea-near-black)]">当前材料</p>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">
                        {sourceAssets.length} 份材料已接入当前项目线程，默认不展开详情。
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4 text-[var(--xidea-terracotta)]" />
                        <p className="text-sm font-medium text-[var(--xidea-near-black)]">状态回写</p>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">
                        {activeRuntime.writeback[0]?.change ?? "本轮结果会写回 learner state 和 review engine。"}
                      </p>
                    </CardContent>
                  </Card>
                </InspectorCard>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </main>
  );
}
