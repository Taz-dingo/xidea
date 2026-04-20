import type { AgentEntryMode } from "@/domain/agent-runtime";

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
