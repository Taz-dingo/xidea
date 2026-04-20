import type { UIMessage } from "ai";
import type { AgentEntryMode } from "@/domain/agent-runtime";
import type {
  AgentWorkspaceKnowledgePoint,
  AgentWorkspaceKnowledgePointRecord,
  AgentWorkspaceKnowledgePointState,
  AgentWorkspaceProjectBootstrap,
  AgentWorkspaceProjectMaterial,
  AgentWorkspaceProjectMaterialInput,
  AgentWorkspaceSession,
  AgentWorkspaceSessionDetail,
} from "@/domain/agent-workspace";
import type {
  KnowledgePointItem,
  KnowledgePointStatus,
  ProjectItem,
  SessionItem,
} from "@/domain/project-workspace";
import type { LearningUnit, SourceAsset } from "@/domain/types";

export interface BackendWorkspaceSnapshot {
  readonly projects: ReadonlyArray<ProjectItem>;
  readonly knowledgePoints: ReadonlyArray<KnowledgePointItem>;
  readonly sessions: ReadonlyArray<SessionItem>;
  readonly sourceAssets: ReadonlyArray<SourceAsset>;
  readonly projectMaterialIdsByProject: Record<string, ReadonlyArray<string>>;
  readonly sessionEntryModes: Record<string, AgentEntryMode>;
  readonly sessionSourceAssetIds: Record<string, ReadonlyArray<string>>;
  readonly sessionMessagesById: Record<string, UIMessage[]>;
}

interface SessionLookup {
  readonly detailById: Map<string, AgentWorkspaceSessionDetail>;
  readonly knowledgePointById: Map<string, AgentWorkspaceKnowledgePoint>;
  readonly knowledgePointStateById: Map<string, AgentWorkspaceKnowledgePointState>;
  readonly materialById: Map<string, AgentWorkspaceProjectMaterial>;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
}

function addDays(value: Date, days: number): Date {
  const nextValue = new Date(value);
  nextValue.setDate(nextValue.getDate() + days);
  return nextValue;
}

function formatRelativeDateLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === "") {
    return "刚刚";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffMs < 1000 * 60 * 30) {
    return "刚刚";
  }

  if (isSameCalendarDay(now, date)) {
    return diffHours <= 6 ? `${diffHours}h` : "今天";
  }

  const yesterday = addDays(now, -1);
  if (isSameCalendarDay(yesterday, date)) {
    return "昨天";
  }

  if (diffDays <= 6) {
    return `${diffDays}d`;
  }

  return date.toISOString().slice(0, 10);
}

function formatNextReviewLabel(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "已到期";
  }
  if (diffDays === 0) {
    return "今日到期";
  }
  if (diffDays === 1) {
    return "明日到期";
  }
  if (diffDays <= 6) {
    return `${diffDays}d 后`;
  }

  return target.toISOString().slice(0, 10);
}

function mapKnowledgePointStatus(
  point: AgentWorkspaceKnowledgePoint,
  state: AgentWorkspaceKnowledgePointState | null,
): KnowledgePointStatus {
  if (point.status === "archived") {
    return "archived";
  }

  if (state?.next_review_at) {
    return "active_review";
  }

  if (state && (state.mastery > 0 || state.learning_status !== "new")) {
    return "active_learning";
  }

  return "active_unlearned";
}

function getStageLabel(status: KnowledgePointStatus): string {
  switch (status) {
    case "active_learning":
      return "学习中";
    case "active_review":
      return "待复习";
    case "archived":
      return "已归档";
    case "active_unlearned":
      return "未学";
  }
}

function mapKnowledgePointItem(
  record: AgentWorkspaceKnowledgePointRecord,
): KnowledgePointItem {
  const { knowledge_point: point, knowledge_point_state: state } = record;
  const status = mapKnowledgePointStatus(point, state);

  return {
    id: point.id,
    projectId: point.project_id,
    title: point.title,
    description: point.description,
    status,
    mastery: state?.mastery ?? 0,
    stageLabel: getStageLabel(status),
    nextReviewLabel:
      status === "archived" ? null : formatNextReviewLabel(state?.next_review_at),
    updatedAt: formatRelativeDateLabel(state?.updated_at ?? point.updated_at),
    sourceAssetIds: [...point.source_material_refs],
    originSessionId: point.origin_session_id,
    linkedSessionIds: [...(record.linked_session_ids ?? [])],
    linkedMessageIdsBySession: Object.fromEntries(
      Object.entries(record.linked_session_message_ids ?? {}).map(([sessionId, messageId]) => [
        sessionId,
        String(messageId),
      ]),
    ),
    archiveSuggestion:
      state?.archive_suggested === true
        ? {
            reason: "系统判断这个知识点已经相对稳定，可先移出活跃池，后续按需要再恢复。",
          }
        : null,
  };
}

function mapProjectItem(project: AgentWorkspaceProjectBootstrap["project"]): ProjectItem {
  return {
    id: project.id,
    name: project.title,
    topic: project.topic,
    description: project.description,
    specialRules: [...project.special_rules],
    updatedAt: formatRelativeDateLabel(project.updated_at ?? project.created_at),
  };
}

function mapProjectMaterial(material: AgentWorkspaceProjectMaterial): SourceAsset {
  return {
    id: material.id,
    title: material.title,
    kind: material.kind,
    topic: material.summary?.trim() || material.source_uri?.trim() || "Project material",
  };
}

function buildSessionSummary(
  session: AgentWorkspaceSession,
  detail: AgentWorkspaceSessionDetail | undefined,
  knowledgePointById: Map<string, AgentWorkspaceKnowledgePoint>,
  materialById: Map<string, AgentWorkspaceProjectMaterial>,
): string {
  const latestVisibleMessage = [...(detail?.recent_messages ?? [])]
    .reverse()
    .find((message) => message.content.trim() !== "");

  if (latestVisibleMessage) {
    return truncateText(latestVisibleMessage.content.trim(), 48);
  }

  const focusTitles = session.focus_knowledge_point_ids
    .map((knowledgePointId) => knowledgePointById.get(knowledgePointId)?.title)
    .filter((title): title is string => title !== undefined);

  if (focusTitles.length > 0) {
    if (session.type === "review") {
      return `围绕「${focusTitles[0]}」安排一轮复习回拉。`;
    }
    if (session.type === "study") {
      return `围绕「${focusTitles[0]}」启动一轮学习。`;
    }
  }

  const attachmentTitles = (detail?.session_attachments ?? [])
    .map((attachment) => materialById.get(attachment.project_material_id)?.title)
    .filter((title): title is string => title !== undefined);

  if (attachmentTitles.length > 0) {
    return `已关联 ${attachmentTitles.length} 份材料，当前从《${attachmentTitles[0]}》继续推进。`;
  }

  if (session.type === "review") {
    return "等待系统基于当前状态安排一轮复习回拉。";
  }
  if (session.type === "study") {
    return "等待系统围绕当前知识点开启一轮学习。";
  }
  return "继续围绕当前 project 推进材料与知识点。";
}

function mapSessionStatusLabel(
  session: AgentWorkspaceSession,
  detail: AgentWorkspaceSessionDetail | undefined,
): string {
  if (session.status === "closed") {
    return "已关闭";
  }

  if ((detail?.recent_messages.length ?? 0) > 0) {
    return "进行中";
  }

  if (session.type === "review") {
    return "待复习";
  }

  if (session.type === "study") {
    return "待开始";
  }

  return "空白";
}

function mapSessionItem(
  session: AgentWorkspaceSession,
  lookup: SessionLookup,
): SessionItem {
  const detail = lookup.detailById.get(session.id);

  return {
    id: session.id,
    projectId: session.project_id,
    type: session.type,
    knowledgePointId: session.focus_knowledge_point_ids[0] ?? null,
    title: session.title,
    summary: buildSessionSummary(
      session,
      detail,
      lookup.knowledgePointById,
      lookup.materialById,
    ),
    updatedAt: formatRelativeDateLabel(session.updated_at ?? session.created_at),
    status: mapSessionStatusLabel(session, detail),
  };
}

function mapUiMessages(
  sessionId: string,
  messages: ReadonlyArray<AgentWorkspaceSessionDetail["recent_messages"][number]>,
): UIMessage[] {
  return messages.map((message, index) => ({
    id: `message-${sessionId}-${index}-${message.role}`,
    role: message.role,
    parts: [{ type: "text", text: message.content }],
    content: message.content,
  }) as UIMessage);
}

function buildLookup(
  bootstraps: ReadonlyArray<AgentWorkspaceProjectBootstrap>,
  sessionDetails: ReadonlyArray<AgentWorkspaceSessionDetail>,
): SessionLookup {
  const detailById = new Map<string, AgentWorkspaceSessionDetail>(
    sessionDetails.map((detail) => [detail.session.id, detail]),
  );
  const knowledgePointById = new Map<string, AgentWorkspaceKnowledgePoint>();
  const knowledgePointStateById = new Map<string, AgentWorkspaceKnowledgePointState>();
  const materialById = new Map<string, AgentWorkspaceProjectMaterial>();

  for (const bootstrap of bootstraps) {
    for (const knowledgePoint of bootstrap.knowledge_points) {
      knowledgePointById.set(knowledgePoint.id, knowledgePoint);
    }
    for (const knowledgePointState of bootstrap.knowledge_point_states) {
      knowledgePointStateById.set(knowledgePointState.knowledge_point_id, knowledgePointState);
    }
    for (const material of bootstrap.project_materials) {
      materialById.set(material.id, material);
    }
  }

  return {
    detailById,
    knowledgePointById,
    knowledgePointStateById,
    materialById,
  };
}

export function buildBackendWorkspaceSnapshot(input: {
  readonly bootstraps: ReadonlyArray<AgentWorkspaceProjectBootstrap>;
  readonly sessionDetails: ReadonlyArray<AgentWorkspaceSessionDetail>;
  readonly seedSourceAssets: ReadonlyArray<SourceAsset>;
}): BackendWorkspaceSnapshot {
  const lookup = buildLookup(input.bootstraps, input.sessionDetails);
  const sourceAssetById = new Map<string, SourceAsset>(
    input.seedSourceAssets.map((asset) => [asset.id, asset]),
  );
  const projects: ProjectItem[] = [];
  const knowledgePoints: KnowledgePointItem[] = [];
  const sessions: SessionItem[] = [];
  const projectMaterialIdsByProject: Record<string, ReadonlyArray<string>> = {};
  const sessionEntryModes: Record<string, AgentEntryMode> = {};
  const sessionSourceAssetIds: Record<string, ReadonlyArray<string>> = {};
  const sessionMessagesById: Record<string, UIMessage[]> = {};

  for (const bootstrap of input.bootstraps) {
    projects.push(mapProjectItem(bootstrap.project));
    projectMaterialIdsByProject[bootstrap.project.id] = bootstrap.project_materials
      .filter((material) => material.status === "active")
      .map((material) => material.id);

    for (const material of bootstrap.project_materials) {
      sourceAssetById.set(material.id, mapProjectMaterial(material));
    }

    for (const knowledgePoint of bootstrap.knowledge_points) {
      knowledgePoints.push(
        mapKnowledgePointItem({
          knowledge_point: knowledgePoint,
          knowledge_point_state:
            lookup.knowledgePointStateById.get(knowledgePoint.id) ?? null,
        }),
      );
    }

    for (const session of bootstrap.sessions) {
      sessions.push(mapSessionItem(session, lookup));
      const detail = lookup.detailById.get(session.id);
      const attachmentIds = (detail?.session_attachments ?? []).map(
        (attachment) => attachment.project_material_id,
      );
      sessionEntryModes[session.id] = detail?.thread_context?.entry_mode ?? "chat-question";
      sessionSourceAssetIds[session.id] =
        detail?.thread_context?.source_asset_ids ?? attachmentIds;
      sessionMessagesById[session.id] = mapUiMessages(
        session.id,
        detail?.recent_messages ?? [],
      );
    }
  }

  return {
    projects,
    knowledgePoints,
    sessions,
    sourceAssets: [...sourceAssetById.values()],
    projectMaterialIdsByProject,
    sessionEntryModes,
    sessionSourceAssetIds,
    sessionMessagesById,
  };
}

export function buildProjectMaterialInputs(
  materialIds: ReadonlyArray<string>,
  sourceAssets: ReadonlyArray<SourceAsset>,
): ReadonlyArray<AgentWorkspaceProjectMaterialInput> {
  const assetById = new Map(sourceAssets.map((asset) => [asset.id, asset]));

  return materialIds
    .map((materialId) => assetById.get(materialId) ?? null)
    .filter((asset): asset is SourceAsset => asset !== null)
    .map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      title: asset.title,
      summary: asset.topic,
    }));
}

export function buildLearningUnitFromKnowledgePoint(
  point: KnowledgePointItem,
): LearningUnit {
  const recommendedModes: LearningUnit["candidateModes"] =
    point.status === "active_review"
      ? ["contrast-drill", "guided-qa", "scenario-sim"]
      : point.status === "active_unlearned"
        ? ["guided-qa", "contrast-drill", "scenario-sim"]
        : ["guided-qa", "scenario-sim", "contrast-drill"];

  const weaknessTags = [
    point.stageLabel,
    point.nextReviewLabel ?? "等待继续推进",
    point.archiveSuggestion ? "可归档" : "活跃中",
  ];

  return {
    id: point.id,
    title: point.title,
    summary: point.description,
    weaknessTags,
    candidateModes: recommendedModes,
    difficulty:
      point.mastery >= 80
        ? 2
        : point.mastery >= 60
          ? 3
          : point.mastery >= 30
            ? 4
            : 5,
  };
}
