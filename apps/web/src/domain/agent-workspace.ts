import type {
  AgentActivity,
  AgentEntryMode,
  AgentPlan,
  AgentSessionOrchestration,
  AgentSessionOrchestrationEventRecord,
} from "@/domain/agent-runtime";

export type AgentWorkspaceProjectStatus = "active" | "archived";
export type AgentWorkspaceSessionType = "project" | "study" | "review";
export type AgentWorkspaceSessionStatus = "active" | "closed";
export type AgentWorkspaceProjectMaterialKind =
  | "pdf"
  | "web"
  | "note"
  | "audio"
  | "video"
  | "image";
export type AgentWorkspaceProjectMaterialStatus = "active" | "archived";
export type AgentWorkspaceKnowledgePointStatus = "active" | "archived";

export interface AgentWorkspaceProject {
  readonly id: string;
  readonly title: string;
  readonly topic: string;
  readonly description: string;
  readonly special_rules: ReadonlyArray<string>;
  readonly status: AgentWorkspaceProjectStatus;
  readonly created_at: string | null;
  readonly updated_at: string | null;
}

export interface AgentWorkspaceSession {
  readonly id: string;
  readonly project_id: string;
  readonly type: AgentWorkspaceSessionType;
  readonly title: string;
  readonly status: AgentWorkspaceSessionStatus;
  readonly focus_knowledge_point_ids: ReadonlyArray<string>;
  readonly current_activity_id: string | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
}

export interface AgentWorkspaceProjectMaterial {
  readonly id: string;
  readonly project_id: string;
  readonly kind: AgentWorkspaceProjectMaterialKind;
  readonly title: string;
  readonly source_uri: string | null;
  readonly content_ref: string | null;
  readonly summary: string | null;
  readonly status: AgentWorkspaceProjectMaterialStatus;
  readonly created_at: string | null;
  readonly updated_at: string | null;
}

export interface AgentWorkspaceSessionAttachment {
  readonly id: string;
  readonly session_id: string;
  readonly project_material_id: string;
  readonly role: string;
  readonly attached_at: string | null;
}

export interface AgentWorkspaceThreadContext {
  readonly thread_id: string;
  readonly entry_mode: AgentEntryMode;
  readonly source_asset_ids: ReadonlyArray<string>;
  readonly session_orchestration: AgentSessionOrchestration | null;
  readonly orchestration_events: ReadonlyArray<AgentSessionOrchestrationEventRecord>;
  readonly plan: AgentPlan | null;
  readonly activities: ReadonlyArray<AgentActivity>;
  readonly updated_at: string | null;
}

export interface AgentWorkspaceMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface AgentWorkspaceKnowledgePoint {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly description: string;
  readonly status: AgentWorkspaceKnowledgePointStatus;
  readonly origin_type: string;
  readonly origin_session_id: string | null;
  readonly source_material_refs: ReadonlyArray<string>;
  readonly created_at: string | null;
  readonly updated_at: string | null;
}

export interface AgentWorkspaceKnowledgePointState {
  readonly knowledge_point_id: string;
  readonly mastery: number;
  readonly learning_status: string;
  readonly review_status: string;
  readonly next_review_at: string | null;
  readonly archive_suggested: boolean;
  readonly updated_at: string | null;
}

export interface AgentWorkspaceKnowledgePointRecord {
  readonly knowledge_point: AgentWorkspaceKnowledgePoint;
  readonly knowledge_point_state: AgentWorkspaceKnowledgePointState | null;
  readonly linked_session_ids?: ReadonlyArray<string>;
  readonly linked_session_message_ids?: Readonly<Record<string, number>>;
}

export interface AgentWorkspaceProjectMemory {
  readonly id: string | null;
  readonly project_id: string;
  readonly summary: string;
  readonly key_facts: ReadonlyArray<string>;
  readonly open_threads: ReadonlyArray<string>;
  readonly updated_at: string | null;
}

export interface AgentWorkspaceProjectLearningProfile {
  readonly id: string | null;
  readonly project_id: string;
  readonly current_stage: string;
  readonly primary_weaknesses: ReadonlyArray<string>;
  readonly learning_preferences: ReadonlyArray<string>;
  readonly freshness: string;
  readonly updated_at: string | null;
}

export interface AgentWorkspaceConsolidationKnowledgePointSummary {
  readonly knowledge_point_id: string;
  readonly title: string;
  readonly status: string;
  readonly mastery: number;
  readonly learning_status: string;
  readonly review_status: string;
  readonly next_review_at: string | null;
  readonly updated_at: string | null;
  readonly archive_suggested: boolean;
  readonly review_due: boolean;
}

export interface AgentWorkspaceConsolidationStats {
  readonly total: number;
  readonly active: number;
  readonly archived: number;
  readonly due_for_review: number;
  readonly archive_suggested: number;
  readonly pending_create_suggestions: number;
  readonly pending_archive_suggestions: number;
}

export interface AgentWorkspaceConsolidationSuggestion {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly knowledge_point_id: string | null;
  readonly reason: string;
  readonly status: string;
  readonly created_at: string | null;
}

export interface AgentWorkspaceProjectConsolidation {
  readonly project_id: string;
  readonly project_topic: string | null;
  readonly generated_at: string;
  readonly project_memory: AgentWorkspaceProjectMemory | null;
  readonly project_learning_profile: AgentWorkspaceProjectLearningProfile | null;
  readonly knowledge_point_stats: AgentWorkspaceConsolidationStats;
  readonly due_for_review: ReadonlyArray<AgentWorkspaceConsolidationKnowledgePointSummary>;
  readonly unstable_knowledge_points: ReadonlyArray<AgentWorkspaceConsolidationKnowledgePointSummary>;
  readonly stable_knowledge_points: ReadonlyArray<AgentWorkspaceConsolidationKnowledgePointSummary>;
  readonly pending_suggestions: ReadonlyArray<AgentWorkspaceConsolidationSuggestion>;
  readonly recommended_actions: ReadonlyArray<string>;
}

export interface AgentWorkspaceProjectBootstrap {
  readonly project: AgentWorkspaceProject;
  readonly sessions: ReadonlyArray<AgentWorkspaceSession>;
  readonly project_materials: ReadonlyArray<AgentWorkspaceProjectMaterial>;
  readonly session_attachments: ReadonlyArray<AgentWorkspaceSessionAttachment>;
  readonly knowledge_points: ReadonlyArray<AgentWorkspaceKnowledgePoint>;
  readonly knowledge_point_states: ReadonlyArray<AgentWorkspaceKnowledgePointState>;
  readonly project_memory: AgentWorkspaceProjectMemory | null;
  readonly project_learning_profile: AgentWorkspaceProjectLearningProfile | null;
}

export interface AgentWorkspaceSessionDetail {
  readonly session: AgentWorkspaceSession;
  readonly thread_context: AgentWorkspaceThreadContext | null;
  readonly session_attachments: ReadonlyArray<AgentWorkspaceSessionAttachment>;
  readonly recent_messages: ReadonlyArray<AgentWorkspaceMessage>;
}

export interface AgentWorkspaceProjectMaterialInput {
  readonly id?: string | null;
  readonly kind: AgentWorkspaceProjectMaterialKind;
  readonly title: string;
  readonly source_uri?: string | null;
  readonly content_ref?: string | null;
  readonly summary?: string | null;
}

export interface AgentWorkspaceCreateProjectRequest {
  readonly project_id?: string | null;
  readonly title: string;
  readonly topic: string;
  readonly description: string;
  readonly special_rules: ReadonlyArray<string>;
  readonly initial_materials: ReadonlyArray<AgentWorkspaceProjectMaterialInput>;
}

export interface AgentWorkspaceUpdateProjectRequest {
  readonly title?: string | null;
  readonly topic?: string | null;
  readonly description?: string | null;
  readonly special_rules?: ReadonlyArray<string> | null;
  readonly initial_materials?: ReadonlyArray<AgentWorkspaceProjectMaterialInput> | null;
}

export interface AgentWorkspaceCreateSessionRequest {
  readonly session_id?: string | null;
  readonly type: AgentWorkspaceSessionType;
  readonly title?: string | null;
  readonly entry_mode?: AgentEntryMode;
  readonly focus_knowledge_point_ids: ReadonlyArray<string>;
  readonly project_material_ids: ReadonlyArray<string>;
}

export interface AgentWorkspaceUpdateKnowledgePointRequest {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly source_material_refs?: ReadonlyArray<string> | null;
}
