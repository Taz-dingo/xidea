from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Literal

from xidea_agent.knowledge_points import build_knowledge_point_id
from xidea_agent.project_bootstrap import (
    build_bootstrap_knowledge_points,
    build_project_id,
    build_project_learning_profile_id,
    build_project_material_id,
    build_project_memory_id,
    build_project_memory_key_facts,
    build_project_memory_summary,
    build_session_attachment_id,
    build_session_id,
    build_session_title,
    default_session_title,
    infer_session_type,
)
from xidea_agent.state import (
    AgentRequest,
    AgentRunResult,
    CreateProjectRequest,
    CreateSessionRequest,
    KnowledgePoint,
    KnowledgePointRecord,
    KnowledgePointState,
    KnowledgePointSuggestion,
    KnowledgePointSuggestionResolution,
    LearnerUnitState,
    Message,
    Project,
    ProjectBootstrap,
    ProjectMaterial,
    ProjectMaterialInput,
    ProjectLearningProfile,
    ProjectMemory,
    ReviewPatch,
    Session,
    SessionDetail,
    SessionAttachment,
    StatePatch,
    ThreadContextRecord,
    UpdateKnowledgePointRequest,
    UpdateProjectRequest,
    UpdateSessionRequest,
)


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT NOT NULL,
  special_rules TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  thread_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'project',
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  entry_mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  focus_knowledge_point_ids TEXT NOT NULL DEFAULT '[]',
  current_activity_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS thread_messages (
  message_id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(thread_id) REFERENCES threads(thread_id)
);

CREATE TABLE IF NOT EXISTS thread_context (
  thread_id TEXT PRIMARY KEY,
  entry_mode TEXT NOT NULL,
  source_asset_ids TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(thread_id) REFERENCES threads(thread_id)
);

CREATE TABLE IF NOT EXISTS learner_unit_state (
  thread_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  mastery INTEGER NOT NULL,
  understanding_level INTEGER NOT NULL,
  memory_strength INTEGER NOT NULL,
  confusion_level INTEGER NOT NULL,
  transfer_readiness INTEGER NOT NULL,
  weak_signals TEXT NOT NULL,
  recommended_action TEXT,
  confidence REAL NOT NULL,
  based_on TEXT NOT NULL,
  updated_at TEXT,
  PRIMARY KEY(thread_id, unit_id),
  FOREIGN KEY(thread_id) REFERENCES threads(thread_id)
);

CREATE TABLE IF NOT EXISTS review_state (
  thread_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  due_unit_ids TEXT,
  scheduled_at TEXT,
  review_reason TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  lapse_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(thread_id, unit_id),
  FOREIGN KEY(thread_id) REFERENCES threads(thread_id)
);

CREATE TABLE IF NOT EXISTS review_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  event_at TEXT NOT NULL,
  review_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(thread_id) REFERENCES threads(thread_id)
);

CREATE TABLE IF NOT EXISTS knowledge_points (
  knowledge_point_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  origin_type TEXT NOT NULL,
  origin_session_id TEXT,
  source_material_refs TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS knowledge_point_state (
  knowledge_point_id TEXT PRIMARY KEY,
  mastery INTEGER NOT NULL DEFAULT 0,
  learning_status TEXT NOT NULL,
  review_status TEXT NOT NULL,
  next_review_at TEXT,
  archive_suggested INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(knowledge_point_id) REFERENCES knowledge_points(knowledge_point_id)
);

CREATE TABLE IF NOT EXISTS knowledge_point_suggestions (
  suggestion_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  knowledge_point_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  source_material_refs TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS project_memories (
  project_id TEXT PRIMARY KEY,
  memory_id TEXT,
  summary TEXT NOT NULL,
  key_facts TEXT NOT NULL DEFAULT '[]',
  open_threads TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS project_learning_profiles (
  project_id TEXT PRIMARY KEY,
  profile_id TEXT,
  current_stage TEXT NOT NULL,
  primary_weaknesses TEXT NOT NULL,
  learning_preferences TEXT NOT NULL,
  freshness TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS project_materials (
  project_material_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  source_uri TEXT,
  content_ref TEXT,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS session_attachments (
  attachment_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_material_id TEXT NOT NULL,
  role TEXT NOT NULL,
  attached_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES threads(thread_id),
  FOREIGN KEY(project_material_id) REFERENCES project_materials(project_material_id)
);
"""


class SQLiteRepository:
    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)

    def initialize(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(SCHEMA_SQL)
            self._migrate_schema(connection)

    def save_run(self, request: AgentRequest, run_result: AgentRunResult) -> None:
        self.initialize()
        state = run_result.graph_state
        now = state.learner_unit_state.updated_at if state.learner_unit_state else None
        now_value = now.isoformat() if now else _utc_now()
        focus_knowledge_point_ids = [request.target_unit_id] if request.target_unit_id else []
        current_activity_id = state.activity.id if state.activity is not None else None
        existing_project_memory = (
            self.get_project_memory(request.project_id)
            if state.project_memory_writeback is not None
            else None
        )

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO projects(
                  project_id, title, topic, description, special_rules, status, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id) DO UPDATE SET
                  topic = excluded.topic,
                  title = CASE
                    WHEN projects.title IS NULL OR projects.title = '' THEN excluded.title
                    ELSE projects.title
                  END,
                  updated_at = excluded.updated_at
                """,
                (
                    request.project_id,
                    request.topic,
                    request.topic,
                    request.topic,
                    "[]",
                    "active",
                    now_value,
                    now_value,
                ),
            )
            connection.execute(
                """
                INSERT INTO threads(
                  thread_id, project_id, session_type, title, topic, entry_mode, status,
                  focus_knowledge_point_ids, current_activity_id, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(thread_id) DO UPDATE SET
                  session_type = excluded.session_type,
                  title = excluded.title,
                  topic = excluded.topic,
                  entry_mode = excluded.entry_mode,
                  focus_knowledge_point_ids = excluded.focus_knowledge_point_ids,
                  current_activity_id = excluded.current_activity_id,
                  updated_at = excluded.updated_at
                """,
                (
                    request.thread_id,
                    request.project_id,
                    infer_session_type(request),
                    default_session_title(request),
                    request.topic,
                    request.entry_mode,
                    "active",
                    json.dumps(focus_knowledge_point_ids, ensure_ascii=False),
                    current_activity_id,
                    now_value,
                    now_value,
                ),
            )

            self._append_messages(connection, request.thread_id, request.messages, now_value)
            self._upsert_thread_context(
                connection,
                request.thread_id,
                request.entry_mode,
                request.source_asset_ids,
                now_value,
            )
            if state.assistant_message:
                self._append_messages(
                    connection,
                    request.thread_id,
                    [Message(role="assistant", content=state.assistant_message)],
                    now_value,
                )

            if state.is_off_topic:
                return

            if state.learner_unit_state:
                self._upsert_learner_unit_state(connection, request.thread_id, state.learner_unit_state)

            if state.state_patch and state.state_patch.review_patch:
                self._upsert_review_state(
                    connection,
                    request.thread_id,
                    state.learner_unit_state.unit_id if state.learner_unit_state else request.target_unit_id,
                    state.state_patch.review_patch,
                    now_value,
                )
                self._append_review_events(
                    connection,
                    request.thread_id,
                    state.learner_unit_state.unit_id if state.learner_unit_state else request.target_unit_id,
                    state.state_patch,
                    now_value,
                )

            if state.knowledge_point_suggestions:
                self._upsert_knowledge_point_suggestions(
                    connection,
                    state.knowledge_point_suggestions,
                    now_value,
                )
                self._mark_archive_suggestion_states(
                    connection,
                    state.knowledge_point_suggestions,
                    now_value,
                )

            if state.knowledge_point_state_writebacks:
                for knowledge_point_state in state.knowledge_point_state_writebacks:
                    self._upsert_knowledge_point_state(connection, knowledge_point_state, now_value)

            if state.project_memory_writeback is not None:
                self._upsert_project_memory(
                    connection,
                    self._merge_project_memory(
                        existing_project_memory,
                        state.project_memory_writeback,
                    ),
                    now_value,
                )

            if state.project_learning_profile_writeback is not None:
                self._upsert_project_learning_profile(
                    connection,
                    state.project_learning_profile_writeback,
                    now_value,
                )

    def list_recent_messages(self, thread_id: str, limit: int = 8) -> list[Message]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT role, content
                FROM thread_messages
                WHERE thread_id = ?
                ORDER BY message_id DESC
                LIMIT ?
                """,
                (thread_id, limit),
            ).fetchall()

        return [Message(role=row["role"], content=row["content"]) for row in reversed(rows)]

    def get_learner_unit_state(self, thread_id: str, unit_id: str) -> LearnerUnitState | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM learner_unit_state
                WHERE thread_id = ? AND unit_id = ?
                """,
                (thread_id, unit_id),
            ).fetchone()

        if row is None:
            return None

        return LearnerUnitState(
            unit_id=row["unit_id"],
            mastery=row["mastery"],
            understanding_level=row["understanding_level"],
            memory_strength=row["memory_strength"],
            confusion_level=row["confusion_level"],
            transfer_readiness=row["transfer_readiness"],
            weak_signals=json.loads(row["weak_signals"]),
            recommended_action=row["recommended_action"],
            confidence=row["confidence"],
            based_on=json.loads(row["based_on"]),
            updated_at=row["updated_at"],
        )

    def create_project(self, request: CreateProjectRequest) -> ProjectBootstrap:
        self.initialize()
        now_value = _utc_now()
        project_id = request.project_id or build_project_id(request.title)
        existing_project = self.get_project(project_id)
        if existing_project is not None:
            raise ValueError(f"Project already exists: {project_id}")

        project = Project(
            id=project_id,
            title=request.title,
            topic=request.topic,
            description=request.description,
            special_rules=request.special_rules,
            status="active",
            created_at=now_value,
            updated_at=now_value,
        )
        project_session = Session(
            id=build_session_id(project_id, "project"),
            project_id=project_id,
            type="project",
            title="初始 project session",
            status="active",
            created_at=now_value,
            updated_at=now_value,
        )
        project_materials = [
            self._build_project_material(project_id, material, now_value)
            for material in request.initial_materials
        ]
        session_attachments = [
            SessionAttachment(
                id=build_session_attachment_id(project_session.id, material.id, "selected"),
                session_id=project_session.id,
                project_material_id=material.id,
                role="selected",
                attached_at=now_value,
            )
            for material in project_materials
        ]
        knowledge_points = build_bootstrap_knowledge_points(
            project,
            project_materials,
            project_session.id,
            now_value,
        )
        knowledge_point_states = [
            KnowledgePointState(
                knowledge_point_id=knowledge_point.id,
                mastery=0,
                learning_status="new",
                review_status="idle",
                archive_suggested=False,
                updated_at=now_value,
            )
            for knowledge_point in knowledge_points
        ]
        project_memory = ProjectMemory(
            id=build_project_memory_id(project_id),
            project_id=project_id,
            summary=build_project_memory_summary(project, project_materials),
            key_facts=build_project_memory_key_facts(project, project_materials),
            open_threads=[project_session.id],
            updated_at=now_value,
        )
        project_learning_profile = ProjectLearningProfile(
            id=build_project_learning_profile_id(project_id),
            project_id=project_id,
            current_stage="bootstrapping",
            primary_weaknesses=[],
            learning_preferences=["project-centric"],
            freshness="fresh",
            updated_at=now_value,
        )

        with self._connect() as connection:
            self._upsert_project(connection, project, now_value)
            self._upsert_session(connection, project_session, "chat-question", now_value)
            self._upsert_thread_context(
                connection,
                project_session.id,
                "chat-question",
                [material.id for material in project_materials],
                now_value,
            )
            for material in project_materials:
                self._upsert_project_material(connection, material, now_value)
            self._replace_session_attachments(connection, project_session.id, session_attachments)
            for knowledge_point in knowledge_points:
                self._upsert_knowledge_point(connection, knowledge_point, now_value)
            for knowledge_point_state in knowledge_point_states:
                self._upsert_knowledge_point_state(connection, knowledge_point_state, now_value)
            self._upsert_project_memory(connection, project_memory, now_value)
            self._upsert_project_learning_profile(connection, project_learning_profile, now_value)

        bootstrap = self.get_project_bootstrap(project_id)
        if bootstrap is None:
            raise RuntimeError(f"Project bootstrap not found after create: {project_id}")
        return bootstrap

    def update_project(
        self,
        project_id: str,
        request: UpdateProjectRequest,
    ) -> ProjectBootstrap | None:
        self.initialize()
        existing_project = self.get_project(project_id)
        if existing_project is None:
            return None

        now_value = _utc_now()
        next_project = Project(
            id=existing_project.id,
            title=request.title or existing_project.title,
            topic=request.topic or existing_project.topic,
            description=request.description or existing_project.description,
            special_rules=(
                request.special_rules
                if request.special_rules is not None
                else existing_project.special_rules
            ),
            status=existing_project.status,
            created_at=existing_project.created_at,
            updated_at=now_value,
        )

        sessions = self.list_project_sessions(project_id)
        project_session = next((session for session in sessions if session.type == "project"), None)
        if project_session is None:
            project_session = Session(
                id=build_session_id(project_id, "project"),
                project_id=project_id,
                type="project",
                title="初始 project session",
                status="active",
                created_at=now_value,
                updated_at=now_value,
            )

        existing_materials = {material.id: material for material in self.list_project_materials(project_id)}
        next_materials = list(existing_materials.values())
        next_attachments = self.list_session_attachments(project_session.id)

        if request.initial_materials is not None:
            requested_materials = [
                self._build_project_material(project_id, material, now_value)
                for material in request.initial_materials
            ]
            requested_ids = {material.id for material in requested_materials}
            next_materials = []
            for material in existing_materials.values():
                if material.id in requested_ids:
                    continue
                archived_payload = material.model_dump(mode="python")
                archived_payload["status"] = "archived"
                archived_payload["updated_at"] = now_value
                next_materials.append(
                    ProjectMaterial(**archived_payload)
                )
            next_materials.extend(requested_materials)
            next_attachments = [
                SessionAttachment(
                    id=build_session_attachment_id(project_session.id, material.id, "selected"),
                    session_id=project_session.id,
                    project_material_id=material.id,
                    role="selected",
                    attached_at=now_value,
                )
                for material in requested_materials
            ]

        with self._connect() as connection:
            self._upsert_project(connection, next_project, now_value)
            self._upsert_session(connection, project_session, "chat-question", now_value)
            for material in next_materials:
                self._upsert_project_material(connection, material, now_value)
            self._replace_session_attachments(connection, project_session.id, next_attachments)
            self._upsert_thread_context(
                connection,
                project_session.id,
                "chat-question",
                [attachment.project_material_id for attachment in next_attachments],
                now_value,
            )

        return self.get_project_bootstrap(project_id)

    def get_project(self, project_id: str) -> Project | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM projects
                WHERE project_id = ?
                """,
                (project_id,),
            ).fetchone()

        return self._row_to_project(row) if row is not None else None

    def list_projects(self) -> list[Project]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM projects
                ORDER BY updated_at DESC, project_id ASC
                """
            ).fetchall()

        return [self._row_to_project(row) for row in rows]

    def get_project_bootstrap(self, project_id: str) -> ProjectBootstrap | None:
        project = self.get_project(project_id)
        if project is None:
            return None

        sessions = self.list_project_sessions(project_id)
        project_materials = self.list_project_materials(project_id)
        session_attachments: list[SessionAttachment] = []
        for session in sessions:
            session_attachments.extend(self.list_session_attachments(session.id))

        knowledge_points = self.list_project_knowledge_points(project_id)
        knowledge_point_states = [
            state
            for state in (
                self.get_knowledge_point_state(knowledge_point.id)
                for knowledge_point in knowledge_points
            )
            if state is not None
        ]

        return ProjectBootstrap(
            project=project,
            sessions=sessions,
            project_materials=project_materials,
            session_attachments=session_attachments,
            knowledge_points=knowledge_points,
            knowledge_point_states=knowledge_point_states,
            project_memory=self.get_project_memory(project_id),
            project_learning_profile=self.get_project_learning_profile(project_id),
        )

    def create_session(
        self,
        project_id: str,
        request: CreateSessionRequest,
    ) -> SessionDetail | None:
        self.initialize()
        project = self.get_project(project_id)
        if project is None:
            return None

        now_value = _utc_now()
        existing_sessions = self.list_project_sessions(project_id)
        existing_session_ids = {session.id for session in existing_sessions}
        project_materials = self.list_project_materials(project_id)
        active_project_material_ids = {
            material.id for material in project_materials if material.status == "active"
        }
        requested_project_material_ids = _dedupe_preserving_order(request.project_material_ids)
        invalid_project_material_ids = sorted(
            set(requested_project_material_ids) - active_project_material_ids
        )
        if invalid_project_material_ids:
            raise ValueError(
                "Unknown active project material ids: "
                + ", ".join(invalid_project_material_ids)
            )

        knowledge_points = self.list_project_knowledge_points(project_id)
        knowledge_point_by_id = {knowledge_point.id: knowledge_point for knowledge_point in knowledge_points}
        requested_focus_ids = _dedupe_preserving_order(request.focus_knowledge_point_ids)
        invalid_focus_ids = sorted(set(requested_focus_ids) - set(knowledge_point_by_id))
        if invalid_focus_ids:
            raise ValueError(
                "Unknown project knowledge point ids: " + ", ".join(invalid_focus_ids)
            )

        session_id = request.session_id or self._build_next_session_id(
            project_id,
            request.type,
            existing_session_ids,
        )
        if session_id in existing_session_ids:
            raise ValueError(f"Session already exists: {session_id}")

        focus_title = (
            knowledge_point_by_id[requested_focus_ids[0]].title
            if len(requested_focus_ids) == 1
            else None
        )
        title = request.title or build_session_title(
            request.type,
            sum(1 for session in existing_sessions if session.type == request.type) + 1,
            focus_title=focus_title,
        )
        session = Session(
            id=session_id,
            project_id=project_id,
            type=request.type,
            title=title,
            status="active",
            focus_knowledge_point_ids=requested_focus_ids,
            created_at=now_value,
            updated_at=now_value,
        )
        session_attachments = [
            SessionAttachment(
                id=build_session_attachment_id(session_id, project_material_id, "selected"),
                session_id=session_id,
                project_material_id=project_material_id,
                role="selected",
                attached_at=now_value,
            )
            for project_material_id in requested_project_material_ids
        ]

        existing_project_memory = self.get_project_memory(project_id)
        next_project_memory = self._build_project_memory_with_open_threads(
            project=project,
            project_materials=project_materials,
            existing_project_memory=existing_project_memory,
            open_threads=[
                *(
                    existing_project_memory.open_threads
                    if existing_project_memory is not None
                    else []
                ),
                session_id,
            ],
            now_value=now_value,
        )

        with self._connect() as connection:
            self._upsert_session(connection, session, request.entry_mode, now_value)
            self._replace_session_attachments(connection, session.id, session_attachments)
            self._upsert_thread_context(
                connection,
                session.id,
                request.entry_mode,
                requested_project_material_ids,
                now_value,
            )
            self._upsert_project_memory(connection, next_project_memory, now_value)

        detail = self.get_session_detail(project_id, session.id)
        if detail is None:
            raise RuntimeError(f"Session detail not found after create: {session.id}")
        return detail

    def update_session(
        self,
        project_id: str,
        session_id: str,
        request: UpdateSessionRequest,
    ) -> SessionDetail | None:
        self.initialize()
        project = self.get_project(project_id)
        if project is None:
            return None

        existing_session = self.get_session(project_id, session_id)
        if existing_session is None:
            return None

        current_detail = self.get_session_detail(project_id, session_id)
        if current_detail is None:
            return None

        project_materials = self.list_project_materials(project_id)
        project_material_ids = (
            _dedupe_preserving_order(request.project_material_ids)
            if request.project_material_ids is not None
            else [attachment.project_material_id for attachment in current_detail.session_attachments]
        )
        active_project_material_ids = {
            material.id for material in project_materials if material.status == "active"
        }
        invalid_project_material_ids = sorted(set(project_material_ids) - active_project_material_ids)
        if invalid_project_material_ids:
            raise ValueError(
                "Unknown active project material ids: "
                + ", ".join(invalid_project_material_ids)
            )

        knowledge_points = self.list_project_knowledge_points(project_id)
        requested_focus_ids = (
            _dedupe_preserving_order(request.focus_knowledge_point_ids)
            if request.focus_knowledge_point_ids is not None
            else existing_session.focus_knowledge_point_ids
        )
        knowledge_point_ids = {knowledge_point.id for knowledge_point in knowledge_points}
        invalid_focus_ids = sorted(set(requested_focus_ids) - knowledge_point_ids)
        if invalid_focus_ids:
            raise ValueError(
                "Unknown project knowledge point ids: " + ", ".join(invalid_focus_ids)
            )

        next_session = Session(
            id=existing_session.id,
            project_id=existing_session.project_id,
            type=existing_session.type,
            title=request.title or existing_session.title,
            status=request.status or existing_session.status,
            focus_knowledge_point_ids=requested_focus_ids,
            current_activity_id=existing_session.current_activity_id,
            created_at=existing_session.created_at,
            updated_at=existing_session.updated_at,
        )
        materials_changed = (
            request.project_material_ids is not None
            and project_material_ids
            != [attachment.project_material_id for attachment in current_detail.session_attachments]
        )
        session_changed = (
            next_session.title != existing_session.title
            or next_session.status != existing_session.status
            or next_session.focus_knowledge_point_ids != existing_session.focus_knowledge_point_ids
        )
        if not session_changed and not materials_changed:
            return current_detail

        now_value = _utc_now()
        next_session.updated_at = now_value
        current_thread_context = current_detail.thread_context
        entry_mode = (
            current_thread_context.entry_mode
            if current_thread_context is not None
            else "chat-question"
        )
        next_session_attachments = (
            [
                SessionAttachment(
                    id=build_session_attachment_id(session_id, project_material_id, "selected"),
                    session_id=session_id,
                    project_material_id=project_material_id,
                    role="selected",
                    attached_at=now_value,
                )
                for project_material_id in project_material_ids
            ]
            if request.project_material_ids is not None
            else current_detail.session_attachments
        )

        next_project_memory: ProjectMemory | None = None
        if next_session.status != existing_session.status:
            existing_project_memory = self.get_project_memory(project_id)
            next_open_threads = _dedupe_preserving_order(
                [
                    thread_id
                    for thread_id in (
                        existing_project_memory.open_threads
                        if existing_project_memory is not None
                        else [
                            session.id
                            for session in self.list_project_sessions(project_id)
                            if session.status == "active"
                        ]
                    )
                    if thread_id != session_id
                ]
            )
            if next_session.status == "active":
                next_open_threads.append(session_id)
            next_project_memory = self._build_project_memory_with_open_threads(
                project=project,
                project_materials=project_materials,
                existing_project_memory=existing_project_memory,
                open_threads=next_open_threads,
                now_value=now_value,
            )

        with self._connect() as connection:
            self._upsert_session(connection, next_session, entry_mode, now_value)
            if request.project_material_ids is not None:
                self._replace_session_attachments(connection, session_id, next_session_attachments)
                self._upsert_thread_context(
                    connection,
                    session_id,
                    entry_mode,
                    project_material_ids,
                    now_value,
                )
            if next_project_memory is not None:
                self._upsert_project_memory(connection, next_project_memory, now_value)

        detail = self.get_session_detail(project_id, session_id)
        if detail is None:
            raise RuntimeError(f"Session detail not found after update: {session_id}")
        return detail

    def get_session(self, project_id: str, session_id: str) -> Session | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM threads
                WHERE project_id = ? AND thread_id = ?
                """,
                (project_id, session_id),
            ).fetchone()

        return self._row_to_session(row) if row is not None else None

    def get_session_detail(
        self,
        project_id: str,
        session_id: str,
        *,
        recent_message_limit: int = 8,
    ) -> SessionDetail | None:
        session = self.get_session(project_id, session_id)
        if session is None:
            return None

        thread_context = self.get_thread_context(session_id)
        return SessionDetail(
            session=session,
            thread_context=(
                ThreadContextRecord(**thread_context)
                if thread_context is not None
                else None
            ),
            session_attachments=self.list_session_attachments(session_id),
            recent_messages=self.list_recent_messages(session_id, limit=recent_message_limit),
        )

    def list_project_sessions(self, project_id: str) -> list[Session]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM threads
                WHERE project_id = ?
                ORDER BY updated_at DESC, created_at DESC, thread_id ASC
                """,
                (project_id,),
            ).fetchall()

        return [self._row_to_session(row) for row in rows]

    def list_project_materials(self, project_id: str) -> list[ProjectMaterial]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM project_materials
                WHERE project_id = ?
                ORDER BY created_at ASC, project_material_id ASC
                """,
                (project_id,),
            ).fetchall()

        return [self._row_to_project_material(row) for row in rows]

    def list_session_attachments(self, session_id: str) -> list[SessionAttachment]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM session_attachments
                WHERE session_id = ?
                ORDER BY attached_at ASC, attachment_id ASC
                """,
                (session_id,),
            ).fetchall()

        return [self._row_to_session_attachment(row) for row in rows]

    def get_project_context(
        self,
        project_id: str,
        thread_id: str,
        *,
        recent_message_limit: int = 5,
    ) -> dict[str, object] | None:
        project = self.get_project(project_id)
        project_memory = self.get_project_memory(project_id)
        project_learning_profile = self.get_project_learning_profile(project_id)
        project_materials = self.list_project_materials(project_id)
        session_attachments = self.list_session_attachments(thread_id)
        knowledge_points = self.list_project_knowledge_points(project_id)
        thread_context = self.get_thread_context(thread_id)
        recent_messages = self.list_recent_messages(thread_id, limit=recent_message_limit)

        if (
            project is None
            and thread_context is None
            and not recent_messages
            and project_memory is None
            and project_learning_profile is None
            and not project_materials
            and not session_attachments
            and not knowledge_points
        ):
            return None

        return {
            "project": project,
            "project_id": project.id if project is not None else project_id,
            "project_title": project.title if project is not None else None,
            "project_topic": project.topic if project is not None else None,
            "project_description": project.description if project is not None else None,
            "project_special_rules": project.special_rules if project is not None else [],
            "project_updated_at": project.updated_at if project is not None else None,
            "project_memory": project_memory,
            "project_learning_profile": project_learning_profile,
            "project_materials": project_materials,
            "session_attachments": session_attachments,
            "knowledge_points": knowledge_points,
            "thread_context": thread_context,
            "recent_messages": recent_messages,
        }

    def get_project_memory(self, project_id: str) -> ProjectMemory | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM project_memories
                WHERE project_id = ?
                """,
                (project_id,),
            ).fetchone()

        return self._row_to_project_memory(row) if row is not None else None

    def get_project_learning_profile(self, project_id: str) -> ProjectLearningProfile | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM project_learning_profiles
                WHERE project_id = ?
                """,
                (project_id,),
            ).fetchone()

        return self._row_to_project_learning_profile(row) if row is not None else None

    def get_review_state(self, thread_id: str, unit_id: str) -> ReviewPatch | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM review_state
                WHERE thread_id = ? AND unit_id = ?
                """,
                (thread_id, unit_id),
            ).fetchone()

        if row is None:
            return None

        return ReviewPatch(
            due_unit_ids=json.loads(row["due_unit_ids"]) if row["due_unit_ids"] else None,
            scheduled_at=row["scheduled_at"],
            review_reason=row["review_reason"],
            review_count=row["review_count"],
            lapse_count=row["lapse_count"],
        )

    def list_project_knowledge_points(self, project_id: str) -> list[KnowledgePoint]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM knowledge_points
                WHERE project_id = ?
                ORDER BY created_at ASC, knowledge_point_id ASC
                """,
                (project_id,),
            ).fetchall()

        return [self._row_to_knowledge_point(row) for row in rows]

    def list_project_knowledge_point_records(self, project_id: str) -> list[KnowledgePointRecord]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM knowledge_points
                WHERE project_id = ?
                ORDER BY created_at ASC, knowledge_point_id ASC
                """,
                (project_id,),
            ).fetchall()

            return [
                self._build_knowledge_point_record(connection, self._row_to_knowledge_point(row))
                for row in rows
            ]

    def get_knowledge_point(
        self,
        project_id: str,
        knowledge_point_id: str,
    ) -> KnowledgePoint | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM knowledge_points
                WHERE project_id = ? AND knowledge_point_id = ?
                """,
                (project_id, knowledge_point_id),
            ).fetchone()

        return self._row_to_knowledge_point(row) if row is not None else None

    def get_project_knowledge_point_record(
        self,
        project_id: str,
        knowledge_point_id: str,
    ) -> KnowledgePointRecord | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM knowledge_points
                WHERE project_id = ? AND knowledge_point_id = ?
                """,
                (project_id, knowledge_point_id),
            ).fetchone()

            if row is None:
                return None

            return self._build_knowledge_point_record(connection, self._row_to_knowledge_point(row))

    def get_knowledge_point_state(self, knowledge_point_id: str) -> KnowledgePointState | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM knowledge_point_state
                WHERE knowledge_point_id = ?
                """,
                (knowledge_point_id,),
            ).fetchone()

        return self._row_to_knowledge_point_state(row) if row is not None else None

    def update_knowledge_point(
        self,
        project_id: str,
        knowledge_point_id: str,
        request: UpdateKnowledgePointRequest,
    ) -> KnowledgePointRecord | None:
        self.initialize()
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM knowledge_points
                WHERE project_id = ? AND knowledge_point_id = ?
                """,
                (project_id, knowledge_point_id),
            ).fetchone()
            if row is None:
                return None

            knowledge_point = self._row_to_knowledge_point(row)
            next_source_material_refs = (
                request.source_material_refs
                if request.source_material_refs is not None
                else knowledge_point.source_material_refs
            )
            if request.source_material_refs is not None:
                project_material_rows = connection.execute(
                    """
                    SELECT project_material_id
                    FROM project_materials
                    WHERE project_id = ?
                    """,
                    (project_id,),
                ).fetchall()
                valid_material_ids = {material_row["project_material_id"] for material_row in project_material_rows}
                missing_material_refs = [
                    material_id
                    for material_id in request.source_material_refs
                    if material_id not in valid_material_ids
                ]
                if missing_material_refs:
                    missing_refs = ", ".join(sorted(missing_material_refs))
                    raise ValueError(f"Unknown project material refs: {missing_refs}")

            now_value = _utc_now()
            next_knowledge_point = KnowledgePoint(
                id=knowledge_point.id,
                project_id=knowledge_point.project_id,
                title=request.title or knowledge_point.title,
                description=request.description or knowledge_point.description,
                status=knowledge_point.status,
                origin_type=knowledge_point.origin_type,
                origin_session_id=knowledge_point.origin_session_id,
                source_material_refs=next_source_material_refs,
                created_at=knowledge_point.created_at,
                updated_at=now_value,
            )
            self._upsert_knowledge_point(connection, next_knowledge_point, now_value)
            return self._build_knowledge_point_record(connection, next_knowledge_point)

    def list_knowledge_point_suggestions(
        self,
        project_id: str,
        *,
        statuses: list[str] | None = None,
    ) -> list[KnowledgePointSuggestion]:
        query = """
            SELECT *
            FROM knowledge_point_suggestions
            WHERE project_id = ?
        """
        params: list[object] = [project_id]
        if statuses:
            placeholders = ", ".join("?" for _ in statuses)
            query += f" AND status IN ({placeholders})"
            params.extend(statuses)
        query += " ORDER BY created_at ASC, suggestion_id ASC"

        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()

        return [self._row_to_knowledge_point_suggestion(row) for row in rows]

    def get_knowledge_point_suggestion(
        self,
        project_id: str,
        suggestion_id: str,
    ) -> KnowledgePointSuggestion | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM knowledge_point_suggestions
                WHERE project_id = ? AND suggestion_id = ?
                """,
                (project_id, suggestion_id),
            ).fetchone()

        return self._row_to_knowledge_point_suggestion(row) if row is not None else None

    def save_knowledge_point_suggestions(self, suggestions: list[KnowledgePointSuggestion]) -> None:
        if not suggestions:
            return

        self.initialize()
        now_value = _utc_now()
        with self._connect() as connection:
            self._upsert_knowledge_point_suggestions(connection, suggestions, now_value)
            self._mark_archive_suggestion_states(connection, suggestions, now_value)

    def save_knowledge_points(
        self,
        knowledge_points: list[KnowledgePoint],
        *,
        states: list[KnowledgePointState] | None = None,
    ) -> None:
        if not knowledge_points and not states:
            return

        self.initialize()
        now_value = _utc_now()
        with self._connect() as connection:
            for knowledge_point in knowledge_points:
                self._upsert_knowledge_point(connection, knowledge_point, now_value)
            for knowledge_point_state in states or []:
                self._upsert_knowledge_point_state(connection, knowledge_point_state, now_value)

    def create_or_update_project_memory(self, project_memory: ProjectMemory) -> None:
        self.initialize()
        now_value = _utc_now()
        with self._connect() as connection:
            self._upsert_project_memory(connection, project_memory, now_value)

    def create_or_update_project_learning_profile(
        self,
        project_learning_profile: ProjectLearningProfile,
    ) -> None:
        self.initialize()
        now_value = _utc_now()
        with self._connect() as connection:
            self._upsert_project_learning_profile(connection, project_learning_profile, now_value)

    def resolve_knowledge_point_suggestion(
        self,
        project_id: str,
        suggestion_id: str,
        action: Literal["confirm", "dismiss"],
    ) -> KnowledgePointSuggestionResolution | None:
        self.initialize()
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM knowledge_point_suggestions
                WHERE project_id = ? AND suggestion_id = ?
                """,
                (project_id, suggestion_id),
            ).fetchone()

            if row is None:
                return None

            suggestion = self._row_to_knowledge_point_suggestion(row)
            if suggestion.status != "pending":
                return self._build_knowledge_point_suggestion_resolution(connection, suggestion)

            now_value = _utc_now()
            if action == "dismiss":
                connection.execute(
                    """
                    UPDATE knowledge_point_suggestions
                    SET status = ?, resolved_at = ?, updated_at = ?
                    WHERE project_id = ? AND suggestion_id = ?
                    """,
                    ("dismissed", now_value, now_value, project_id, suggestion_id),
                )
                refreshed_row = connection.execute(
                    """
                    SELECT *
                    FROM knowledge_point_suggestions
                    WHERE project_id = ? AND suggestion_id = ?
                    """,
                    (project_id, suggestion_id),
                ).fetchone()
                if refreshed_row is None:
                    return None
                suggestion = self._row_to_knowledge_point_suggestion(refreshed_row)
                return self._build_knowledge_point_suggestion_resolution(connection, suggestion)

            knowledge_point_id = suggestion.knowledge_point_id or build_knowledge_point_id(
                suggestion.project_id,
                suggestion.title,
            )
            if suggestion.kind == "create":
                self._upsert_knowledge_point(
                    connection,
                    KnowledgePoint(
                        id=knowledge_point_id,
                        project_id=suggestion.project_id,
                        title=suggestion.title,
                        description=suggestion.description,
                        status="active",
                        origin_type="session-suggestion",
                        origin_session_id=suggestion.session_id,
                        source_material_refs=suggestion.source_material_refs,
                        created_at=now_value,
                        updated_at=now_value,
                    ),
                    now_value,
                )
                self._upsert_knowledge_point_state(
                    connection,
                    KnowledgePointState(
                        knowledge_point_id=knowledge_point_id,
                        mastery=0,
                        learning_status="new",
                        review_status="idle",
                        archive_suggested=False,
                        updated_at=now_value,
                    ),
                    now_value,
                )
            else:
                if suggestion.knowledge_point_id is None:
                    raise ValueError("archive suggestion requires knowledge_point_id before confirm")
                connection.execute(
                    """
                    UPDATE knowledge_points
                    SET status = ?, updated_at = ?
                    WHERE project_id = ? AND knowledge_point_id = ?
                    """,
                    ("archived", now_value, project_id, suggestion.knowledge_point_id),
                )
                self._upsert_knowledge_point_state(
                    connection,
                    KnowledgePointState(
                        knowledge_point_id=suggestion.knowledge_point_id,
                        mastery=0,
                        learning_status="archived",
                        review_status="archived",
                        archive_suggested=False,
                        updated_at=now_value,
                    ),
                    now_value,
                )

            connection.execute(
                """
                UPDATE knowledge_point_suggestions
                SET status = ?, knowledge_point_id = ?, resolved_at = ?, updated_at = ?
                WHERE project_id = ? AND suggestion_id = ?
                """,
                ("accepted", knowledge_point_id, now_value, now_value, project_id, suggestion_id),
            )
            refreshed_row = connection.execute(
                """
                SELECT *
                FROM knowledge_point_suggestions
                WHERE project_id = ? AND suggestion_id = ?
                """,
                (project_id, suggestion_id),
            ).fetchone()
            if refreshed_row is None:
                return None
            suggestion = self._row_to_knowledge_point_suggestion(refreshed_row)
            return self._build_knowledge_point_suggestion_resolution(connection, suggestion)

    def get_thread_context(self, thread_id: str) -> dict[str, object] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM thread_context
                WHERE thread_id = ?
                """,
                (thread_id,),
            ).fetchone()

        if row is None:
            return None

        return {
            "thread_id": row["thread_id"],
            "entry_mode": row["entry_mode"],
            "source_asset_ids": json.loads(row["source_asset_ids"]),
            "updated_at": row["updated_at"],
        }

    def list_review_events(
        self,
        thread_id: str,
        unit_id: str,
        *,
        limit: int = 32,
        since: str | None = None,
    ) -> list[dict[str, object]]:
        query = """
            SELECT event_kind, event_at, review_reason
            FROM review_events
            WHERE thread_id = ? AND unit_id = ?
        """
        params: list[object] = [thread_id, unit_id]

        if since is not None:
            query += " AND event_at >= ?"
            params.append(since)

        query += " ORDER BY event_at DESC LIMIT ?"
        params.append(limit)

        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()

        return [
            {
                "event_kind": row["event_kind"],
                "event_at": row["event_at"],
                "review_reason": row["review_reason"],
            }
            for row in reversed(rows)
        ]

    def _migrate_schema(self, connection: sqlite3.Connection) -> None:
        self._ensure_column(connection, "projects", "title", "TEXT")
        self._ensure_column(connection, "projects", "description", "TEXT")
        self._ensure_column(connection, "projects", "special_rules", "TEXT NOT NULL DEFAULT '[]'")
        self._ensure_column(connection, "projects", "status", "TEXT NOT NULL DEFAULT 'active'")

        self._ensure_column(connection, "threads", "session_type", "TEXT NOT NULL DEFAULT 'project'")
        self._ensure_column(connection, "threads", "title", "TEXT")
        self._ensure_column(connection, "threads", "status", "TEXT NOT NULL DEFAULT 'active'")
        self._ensure_column(
            connection,
            "threads",
            "focus_knowledge_point_ids",
            "TEXT NOT NULL DEFAULT '[]'",
        )
        self._ensure_column(connection, "threads", "current_activity_id", "TEXT")

        self._ensure_column(connection, "project_memories", "memory_id", "TEXT")
        self._ensure_column(
            connection,
            "project_memories",
            "key_facts",
            "TEXT NOT NULL DEFAULT '[]'",
        )
        self._ensure_column(
            connection,
            "project_memories",
            "open_threads",
            "TEXT NOT NULL DEFAULT '[]'",
        )

        self._ensure_column(connection, "project_learning_profiles", "profile_id", "TEXT")

        connection.execute(
            """
            UPDATE projects
            SET title = COALESCE(NULLIF(title, ''), topic),
                description = COALESCE(NULLIF(description, ''), topic),
                special_rules = COALESCE(NULLIF(special_rules, ''), '[]'),
                status = COALESCE(NULLIF(status, ''), 'active')
            """
        )
        connection.execute(
            """
            UPDATE threads
            SET session_type = COALESCE(NULLIF(session_type, ''), 'project'),
                title = COALESCE(NULLIF(title, ''), topic),
                status = COALESCE(NULLIF(status, ''), 'active'),
                focus_knowledge_point_ids = COALESCE(NULLIF(focus_knowledge_point_ids, ''), '[]')
            """
        )
        connection.execute(
            """
            UPDATE project_memories
            SET memory_id = COALESCE(NULLIF(memory_id, ''), 'pmem-' || project_id),
                key_facts = COALESCE(NULLIF(key_facts, ''), '[]'),
                open_threads = COALESCE(NULLIF(open_threads, ''), '[]')
            """
        )
        connection.execute(
            """
            UPDATE project_learning_profiles
            SET profile_id = COALESCE(NULLIF(profile_id, ''), 'plp-' || project_id)
            """
        )

    def _ensure_column(
        self,
        connection: sqlite3.Connection,
        table_name: str,
        column_name: str,
        column_sql: str,
    ) -> None:
        rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
        existing_columns = {row["name"] for row in rows}
        if column_name in existing_columns:
            return
        connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}")

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _append_messages(
        self,
        connection: sqlite3.Connection,
        thread_id: str,
        messages: list[Message],
        created_at: str,
    ) -> None:
        connection.executemany(
            """
            INSERT INTO thread_messages(thread_id, role, content, created_at)
            VALUES (?, ?, ?, ?)
            """,
            [(thread_id, message.role, message.content, created_at) for message in messages],
        )

    def _build_next_session_id(
        self,
        project_id: str,
        session_type: str,
        existing_session_ids: set[str],
    ) -> str:
        base_id = build_session_id(project_id, session_type)
        if session_type == "project" and base_id not in existing_session_ids:
            return base_id

        next_sequence = 2 if session_type == "project" else 1
        while True:
            candidate = build_session_id(project_id, session_type, next_sequence)
            if candidate not in existing_session_ids:
                return candidate
            next_sequence += 1

    def _upsert_project(
        self,
        connection: sqlite3.Connection,
        project: Project,
        now_value: str,
    ) -> None:
        created_value = (
            project.created_at.isoformat()
            if hasattr(project.created_at, "isoformat")
            else project.created_at
            or now_value
        )
        updated_value = (
            project.updated_at.isoformat()
            if hasattr(project.updated_at, "isoformat")
            else project.updated_at
            or now_value
        )
        connection.execute(
            """
            INSERT INTO projects(
              project_id, title, topic, description, special_rules, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
              title = excluded.title,
              topic = excluded.topic,
              description = excluded.description,
              special_rules = excluded.special_rules,
              status = excluded.status,
              updated_at = excluded.updated_at
            """,
            (
                project.id,
                project.title,
                project.topic,
                project.description,
                json.dumps(project.special_rules, ensure_ascii=False),
                project.status,
                created_value,
                updated_value,
            ),
        )

    def _upsert_session(
        self,
        connection: sqlite3.Connection,
        session: Session,
        entry_mode: str,
        now_value: str,
    ) -> None:
        created_value = (
            session.created_at.isoformat()
            if hasattr(session.created_at, "isoformat")
            else session.created_at
            or now_value
        )
        updated_value = (
            session.updated_at.isoformat()
            if hasattr(session.updated_at, "isoformat")
            else session.updated_at
            or now_value
        )
        connection.execute(
            """
            INSERT INTO threads(
              thread_id, project_id, session_type, title, topic, entry_mode, status,
              focus_knowledge_point_ids, current_activity_id, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(thread_id) DO UPDATE SET
              project_id = excluded.project_id,
              session_type = excluded.session_type,
              title = excluded.title,
              topic = excluded.topic,
              entry_mode = excluded.entry_mode,
              status = excluded.status,
              focus_knowledge_point_ids = excluded.focus_knowledge_point_ids,
              current_activity_id = excluded.current_activity_id,
              updated_at = excluded.updated_at
            """,
            (
                session.id,
                session.project_id,
                session.type,
                session.title,
                session.title,
                entry_mode,
                session.status,
                json.dumps(session.focus_knowledge_point_ids, ensure_ascii=False),
                session.current_activity_id,
                created_value,
                updated_value,
            ),
        )

    def _build_project_material(
        self,
        project_id: str,
        material: ProjectMaterialInput,
        now_value: str,
    ) -> ProjectMaterial:
        material_id = material.id or build_project_material_id(project_id, material.title)
        return ProjectMaterial(
            id=material_id,
            project_id=project_id,
            kind=material.kind,
            title=material.title,
            source_uri=material.source_uri,
            content_ref=material.content_ref,
            summary=material.summary,
            status="active",
            created_at=now_value,
            updated_at=now_value,
        )

    def _upsert_project_material(
        self,
        connection: sqlite3.Connection,
        project_material: ProjectMaterial,
        now_value: str,
    ) -> None:
        created_value = (
            project_material.created_at.isoformat()
            if hasattr(project_material.created_at, "isoformat")
            else project_material.created_at
            or now_value
        )
        updated_value = (
            project_material.updated_at.isoformat()
            if hasattr(project_material.updated_at, "isoformat")
            else project_material.updated_at
            or now_value
        )
        connection.execute(
            """
            INSERT INTO project_materials(
              project_material_id, project_id, kind, title, source_uri,
              content_ref, summary, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_material_id) DO UPDATE SET
              kind = excluded.kind,
              title = excluded.title,
              source_uri = excluded.source_uri,
              content_ref = excluded.content_ref,
              summary = excluded.summary,
              status = excluded.status,
              updated_at = excluded.updated_at
            """,
            (
                project_material.id,
                project_material.project_id,
                project_material.kind,
                project_material.title,
                project_material.source_uri,
                project_material.content_ref,
                project_material.summary,
                project_material.status,
                created_value,
                updated_value,
            ),
        )

    def _replace_session_attachments(
        self,
        connection: sqlite3.Connection,
        session_id: str,
        attachments: list[SessionAttachment],
    ) -> None:
        connection.execute(
            """
            DELETE FROM session_attachments
            WHERE session_id = ?
            """,
            (session_id,),
        )
        if not attachments:
            return
        connection.executemany(
            """
            INSERT INTO session_attachments(
              attachment_id, session_id, project_material_id, role, attached_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    attachment.id,
                    attachment.session_id,
                    attachment.project_material_id,
                    attachment.role,
                    attachment.attached_at.isoformat()
                    if hasattr(attachment.attached_at, "isoformat")
                    else attachment.attached_at,
                )
                for attachment in attachments
            ],
        )

    def _upsert_thread_context(
        self,
        connection: sqlite3.Connection,
        thread_id: str,
        entry_mode: str,
        source_asset_ids: list[str],
        updated_at: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO thread_context(thread_id, entry_mode, source_asset_ids, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(thread_id) DO UPDATE SET
              entry_mode = excluded.entry_mode,
              source_asset_ids = excluded.source_asset_ids,
              updated_at = excluded.updated_at
            """,
            (
                thread_id,
                entry_mode,
                json.dumps(source_asset_ids, ensure_ascii=False),
                updated_at,
            ),
        )

    def _upsert_learner_unit_state(
        self,
        connection: sqlite3.Connection,
        thread_id: str,
        learner_state: LearnerUnitState,
    ) -> None:
        connection.execute(
            """
            INSERT INTO learner_unit_state(
              thread_id,
              unit_id,
              mastery,
              understanding_level,
              memory_strength,
              confusion_level,
              transfer_readiness,
              weak_signals,
              recommended_action,
              confidence,
              based_on,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(thread_id, unit_id) DO UPDATE SET
              mastery = excluded.mastery,
              understanding_level = excluded.understanding_level,
              memory_strength = excluded.memory_strength,
              confusion_level = excluded.confusion_level,
              transfer_readiness = excluded.transfer_readiness,
              weak_signals = excluded.weak_signals,
              recommended_action = excluded.recommended_action,
              confidence = excluded.confidence,
              based_on = excluded.based_on,
              updated_at = excluded.updated_at
            """,
            (
                thread_id,
                learner_state.unit_id,
                learner_state.mastery,
                learner_state.understanding_level,
                learner_state.memory_strength,
                learner_state.confusion_level,
                learner_state.transfer_readiness,
                json.dumps(learner_state.weak_signals, ensure_ascii=False),
                learner_state.recommended_action,
                learner_state.confidence,
                json.dumps(learner_state.based_on, ensure_ascii=False),
                learner_state.updated_at.isoformat() if learner_state.updated_at else None,
            ),
        )

    def _upsert_review_state(
        self,
        connection: sqlite3.Connection,
        thread_id: str,
        unit_id: str | None,
        review_patch: ReviewPatch,
        updated_at: str,
    ) -> None:
        if unit_id is None:
            return

        connection.execute(
            """
            INSERT INTO review_state(
              thread_id, unit_id, due_unit_ids, scheduled_at,
              review_reason, review_count, lapse_count, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(thread_id, unit_id) DO UPDATE SET
              due_unit_ids = excluded.due_unit_ids,
              scheduled_at = excluded.scheduled_at,
              review_reason = excluded.review_reason,
              review_count = excluded.review_count,
              lapse_count = excluded.lapse_count,
              updated_at = excluded.updated_at
            """,
            (
                thread_id,
                unit_id,
                json.dumps(review_patch.due_unit_ids, ensure_ascii=False)
                if review_patch.due_unit_ids is not None
                else None,
                review_patch.scheduled_at.isoformat() if review_patch.scheduled_at else None,
                review_patch.review_reason,
                review_patch.review_count or 0,
                review_patch.lapse_count or 0,
                updated_at,
            ),
        )

    def _upsert_knowledge_point_suggestions(
        self,
        connection: sqlite3.Connection,
        suggestions: list[KnowledgePointSuggestion],
        created_at: str,
    ) -> None:
        rows = []
        for suggestion in suggestions:
            created_value = (
                suggestion.created_at.isoformat()
                if hasattr(suggestion.created_at, "isoformat")
                else suggestion.created_at
                or created_at
            )
            updated_value = (
                suggestion.updated_at.isoformat()
                if hasattr(suggestion.updated_at, "isoformat")
                else suggestion.updated_at
                or created_value
            )
            resolved_value = (
                suggestion.resolved_at.isoformat()
                if hasattr(suggestion.resolved_at, "isoformat")
                else suggestion.resolved_at
            )
            rows.append(
                (
                    suggestion.id,
                    suggestion.project_id,
                    suggestion.session_id,
                    suggestion.kind,
                    suggestion.knowledge_point_id,
                    suggestion.title,
                    suggestion.description,
                    suggestion.reason,
                    json.dumps(suggestion.source_material_refs, ensure_ascii=False),
                    suggestion.status,
                    created_value,
                    resolved_value,
                    updated_value,
                )
            )

        connection.executemany(
            """
            INSERT INTO knowledge_point_suggestions(
              suggestion_id, project_id, session_id, kind, knowledge_point_id,
              title, description, reason, source_material_refs, status,
              created_at, resolved_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(suggestion_id) DO UPDATE SET
              knowledge_point_id = excluded.knowledge_point_id,
              title = excluded.title,
              description = excluded.description,
              reason = excluded.reason,
              source_material_refs = excluded.source_material_refs,
              status = excluded.status,
              resolved_at = excluded.resolved_at,
              updated_at = excluded.updated_at
            """,
            rows,
        )

    def _mark_archive_suggestion_states(
        self,
        connection: sqlite3.Connection,
        suggestions: list[KnowledgePointSuggestion],
        updated_at: str,
    ) -> None:
        archive_ids = [
            suggestion.knowledge_point_id
            for suggestion in suggestions
            if suggestion.kind == "archive"
            and suggestion.status == "pending"
            and suggestion.knowledge_point_id is not None
        ]
        if not archive_ids:
            return

        connection.executemany(
            """
            UPDATE knowledge_point_state
            SET archive_suggested = 1, updated_at = ?
            WHERE knowledge_point_id = ?
            """,
            [(updated_at, knowledge_point_id) for knowledge_point_id in archive_ids],
        )

    def _upsert_knowledge_point(
        self,
        connection: sqlite3.Connection,
        knowledge_point: KnowledgePoint,
        now_value: str,
    ) -> None:
        created_value = (
            knowledge_point.created_at.isoformat()
            if hasattr(knowledge_point.created_at, "isoformat")
            else knowledge_point.created_at
            or now_value
        )
        updated_value = (
            knowledge_point.updated_at.isoformat()
            if hasattr(knowledge_point.updated_at, "isoformat")
            else knowledge_point.updated_at
            or now_value
        )
        connection.execute(
            """
            INSERT INTO knowledge_points(
              knowledge_point_id, project_id, title, description, status,
              origin_type, origin_session_id, source_material_refs, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(knowledge_point_id) DO UPDATE SET
              title = excluded.title,
              description = excluded.description,
              status = excluded.status,
              source_material_refs = excluded.source_material_refs,
              updated_at = excluded.updated_at
            """,
            (
                knowledge_point.id,
                knowledge_point.project_id,
                knowledge_point.title,
                knowledge_point.description,
                knowledge_point.status,
                knowledge_point.origin_type,
                knowledge_point.origin_session_id,
                json.dumps(knowledge_point.source_material_refs, ensure_ascii=False),
                created_value,
                updated_value,
            ),
        )

    def _upsert_knowledge_point_state(
        self,
        connection: sqlite3.Connection,
        knowledge_point_state: KnowledgePointState,
        now_value: str,
    ) -> None:
        updated_value = (
            knowledge_point_state.updated_at.isoformat()
            if hasattr(knowledge_point_state.updated_at, "isoformat")
            else knowledge_point_state.updated_at
            or now_value
        )
        next_review_at = (
            knowledge_point_state.next_review_at.isoformat()
            if hasattr(knowledge_point_state.next_review_at, "isoformat")
            else knowledge_point_state.next_review_at
        )
        connection.execute(
            """
            INSERT INTO knowledge_point_state(
              knowledge_point_id, mastery, learning_status, review_status,
              next_review_at, archive_suggested, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(knowledge_point_id) DO UPDATE SET
              mastery = excluded.mastery,
              learning_status = excluded.learning_status,
              review_status = excluded.review_status,
              next_review_at = excluded.next_review_at,
              archive_suggested = excluded.archive_suggested,
              updated_at = excluded.updated_at
            """,
            (
                knowledge_point_state.knowledge_point_id,
                knowledge_point_state.mastery,
                knowledge_point_state.learning_status,
                knowledge_point_state.review_status,
                next_review_at,
                1 if knowledge_point_state.archive_suggested else 0,
                updated_value,
            ),
        )

    def _upsert_project_memory(
        self,
        connection: sqlite3.Connection,
        project_memory: ProjectMemory,
        now_value: str,
    ) -> None:
        updated_value = (
            project_memory.updated_at.isoformat()
            if hasattr(project_memory.updated_at, "isoformat")
            else project_memory.updated_at
            or now_value
        )
        connection.execute(
            """
            INSERT INTO project_memories(
              project_id, memory_id, summary, key_facts, open_threads, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
              memory_id = excluded.memory_id,
              summary = excluded.summary,
              key_facts = excluded.key_facts,
              open_threads = excluded.open_threads,
              updated_at = excluded.updated_at
            """,
            (
                project_memory.project_id,
                project_memory.id or build_project_memory_id(project_memory.project_id),
                project_memory.summary,
                json.dumps(project_memory.key_facts, ensure_ascii=False),
                json.dumps(project_memory.open_threads, ensure_ascii=False),
                updated_value,
            ),
        )

    def _merge_project_memory(
        self,
        existing_project_memory: ProjectMemory | None,
        incoming_project_memory: ProjectMemory,
    ) -> ProjectMemory:
        return ProjectMemory(
            id=(
                incoming_project_memory.id
                or (existing_project_memory.id if existing_project_memory is not None else None)
            ),
            project_id=incoming_project_memory.project_id,
            summary=incoming_project_memory.summary,
            key_facts=(
                incoming_project_memory.key_facts
                or (
                    existing_project_memory.key_facts
                    if existing_project_memory is not None
                    else []
                )
            ),
            open_threads=(
                incoming_project_memory.open_threads
                or (
                    existing_project_memory.open_threads
                    if existing_project_memory is not None
                    else []
                )
            ),
            updated_at=incoming_project_memory.updated_at,
        )

    def _build_project_memory_with_open_threads(
        self,
        *,
        project: Project,
        project_materials: list[ProjectMaterial],
        existing_project_memory: ProjectMemory | None,
        open_threads: list[str],
        now_value: str,
    ) -> ProjectMemory:
        return self._merge_project_memory(
            existing_project_memory,
            ProjectMemory(
                project_id=project.id,
                summary=(
                    existing_project_memory.summary
                    if existing_project_memory is not None
                    else build_project_memory_summary(project, project_materials)
                ),
                key_facts=(
                    existing_project_memory.key_facts
                    if existing_project_memory is not None
                    else build_project_memory_key_facts(project, project_materials)
                ),
                open_threads=_dedupe_preserving_order(open_threads),
                updated_at=now_value,
            ),
        )

    def _upsert_project_learning_profile(
        self,
        connection: sqlite3.Connection,
        project_learning_profile: ProjectLearningProfile,
        now_value: str,
    ) -> None:
        updated_value = (
            project_learning_profile.updated_at.isoformat()
            if hasattr(project_learning_profile.updated_at, "isoformat")
            else project_learning_profile.updated_at
            or now_value
        )
        connection.execute(
            """
            INSERT INTO project_learning_profiles(
              project_id, profile_id, current_stage, primary_weaknesses,
              learning_preferences, freshness, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
              profile_id = excluded.profile_id,
              current_stage = excluded.current_stage,
              primary_weaknesses = excluded.primary_weaknesses,
              learning_preferences = excluded.learning_preferences,
              freshness = excluded.freshness,
              updated_at = excluded.updated_at
            """,
            (
                project_learning_profile.project_id,
                project_learning_profile.id
                or build_project_learning_profile_id(project_learning_profile.project_id),
                project_learning_profile.current_stage,
                json.dumps(project_learning_profile.primary_weaknesses, ensure_ascii=False),
                json.dumps(project_learning_profile.learning_preferences, ensure_ascii=False),
                project_learning_profile.freshness,
                updated_value,
            ),
        )

    def _append_review_events(
        self,
        connection: sqlite3.Connection,
        thread_id: str,
        unit_id: str | None,
        state_patch: StatePatch,
        created_at: str,
    ) -> None:
        if unit_id is None:
            return

        learner_patch = state_patch.learner_state_patch
        review_patch = state_patch.review_patch
        rows: list[tuple[str, str, str, str, str | None, str]] = []

        if learner_patch is not None and learner_patch.last_reviewed_at is not None:
            rows.append(
                (
                    thread_id,
                    unit_id,
                    "reviewed",
                    learner_patch.last_reviewed_at.isoformat(),
                    review_patch.review_reason if review_patch is not None else None,
                    created_at,
                )
            )

        if review_patch is not None and review_patch.scheduled_at is not None:
            rows.append(
                (
                    thread_id,
                    unit_id,
                    "scheduled",
                    review_patch.scheduled_at.isoformat(),
                    review_patch.review_reason,
                    created_at,
                )
            )

        if not rows:
            return

        connection.executemany(
            """
            INSERT INTO review_events(
              thread_id, unit_id, event_kind, event_at, review_reason, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            rows,
        )

    def _row_to_knowledge_point(self, row: sqlite3.Row) -> KnowledgePoint:
        return KnowledgePoint(
            id=row["knowledge_point_id"],
            project_id=row["project_id"],
            title=row["title"],
            description=row["description"],
            status=row["status"],
            origin_type=row["origin_type"],
            origin_session_id=row["origin_session_id"],
            source_material_refs=json.loads(row["source_material_refs"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _row_to_project(self, row: sqlite3.Row) -> Project:
        return Project(
            id=row["project_id"],
            title=row["title"],
            topic=row["topic"],
            description=row["description"],
            special_rules=json.loads(row["special_rules"]) if row["special_rules"] else [],
            status=row["status"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _row_to_session(self, row: sqlite3.Row) -> Session:
        return Session(
            id=row["thread_id"],
            project_id=row["project_id"],
            type=row["session_type"],
            title=row["title"],
            status=row["status"],
            focus_knowledge_point_ids=(
                json.loads(row["focus_knowledge_point_ids"])
                if row["focus_knowledge_point_ids"]
                else []
            ),
            current_activity_id=row["current_activity_id"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _row_to_project_material(self, row: sqlite3.Row) -> ProjectMaterial:
        return ProjectMaterial(
            id=row["project_material_id"],
            project_id=row["project_id"],
            kind=row["kind"],
            title=row["title"],
            source_uri=row["source_uri"],
            content_ref=row["content_ref"],
            summary=row["summary"],
            status=row["status"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _row_to_session_attachment(self, row: sqlite3.Row) -> SessionAttachment:
        return SessionAttachment(
            id=row["attachment_id"],
            session_id=row["session_id"],
            project_material_id=row["project_material_id"],
            role=row["role"],
            attached_at=row["attached_at"],
        )

    def _build_knowledge_point_record(
        self,
        connection: sqlite3.Connection,
        knowledge_point: KnowledgePoint,
    ) -> KnowledgePointRecord:
        knowledge_point_state_row = connection.execute(
            """
            SELECT *
            FROM knowledge_point_state
            WHERE knowledge_point_id = ?
            """,
            (knowledge_point.id,),
        ).fetchone()
        knowledge_point_state = (
            self._row_to_knowledge_point_state(knowledge_point_state_row)
            if knowledge_point_state_row is not None
            else None
        )
        return KnowledgePointRecord(
            knowledge_point=knowledge_point,
            knowledge_point_state=knowledge_point_state,
        )

    def _row_to_knowledge_point_state(self, row: sqlite3.Row) -> KnowledgePointState:
        return KnowledgePointState(
            knowledge_point_id=row["knowledge_point_id"],
            mastery=row["mastery"],
            learning_status=row["learning_status"],
            review_status=row["review_status"],
            next_review_at=row["next_review_at"],
            archive_suggested=bool(row["archive_suggested"]),
            updated_at=row["updated_at"],
        )

    def _row_to_knowledge_point_suggestion(self, row: sqlite3.Row) -> KnowledgePointSuggestion:
        return KnowledgePointSuggestion(
            id=row["suggestion_id"],
            kind=row["kind"],
            project_id=row["project_id"],
            session_id=row["session_id"],
            knowledge_point_id=row["knowledge_point_id"],
            title=row["title"],
            description=row["description"],
            reason=row["reason"],
            source_material_refs=json.loads(row["source_material_refs"]),
            status=row["status"],
            created_at=row["created_at"],
            resolved_at=row["resolved_at"],
            updated_at=row["updated_at"],
        )

    def _row_to_project_memory(self, row: sqlite3.Row) -> ProjectMemory:
        return ProjectMemory(
            id=row["memory_id"],
            project_id=row["project_id"],
            summary=row["summary"],
            key_facts=json.loads(row["key_facts"]) if row["key_facts"] else [],
            open_threads=json.loads(row["open_threads"]) if row["open_threads"] else [],
            updated_at=row["updated_at"],
        )

    def _row_to_project_learning_profile(
        self,
        row: sqlite3.Row,
    ) -> ProjectLearningProfile:
        return ProjectLearningProfile(
            id=row["profile_id"],
            project_id=row["project_id"],
            current_stage=row["current_stage"],
            primary_weaknesses=json.loads(row["primary_weaknesses"]),
            learning_preferences=json.loads(row["learning_preferences"]),
            freshness=row["freshness"],
            updated_at=row["updated_at"],
        )

    def _build_knowledge_point_suggestion_resolution(
        self,
        connection: sqlite3.Connection,
        suggestion: KnowledgePointSuggestion,
    ) -> KnowledgePointSuggestionResolution:
        knowledge_point = None
        knowledge_point_state = None
        if suggestion.knowledge_point_id is not None:
            knowledge_point_row = connection.execute(
                """
                SELECT *
                FROM knowledge_points
                WHERE project_id = ? AND knowledge_point_id = ?
                """,
                (suggestion.project_id, suggestion.knowledge_point_id),
            ).fetchone()
            if knowledge_point_row is not None:
                knowledge_point = self._row_to_knowledge_point(knowledge_point_row)

            knowledge_point_state_row = connection.execute(
                """
                SELECT *
                FROM knowledge_point_state
                WHERE knowledge_point_id = ?
                """,
                (suggestion.knowledge_point_id,),
            ).fetchone()
            if knowledge_point_state_row is not None:
                knowledge_point_state = self._row_to_knowledge_point_state(knowledge_point_state_row)

        return KnowledgePointSuggestionResolution(
            suggestion=suggestion,
            knowledge_point=knowledge_point,
            knowledge_point_state=knowledge_point_state,
        )


def _utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def _dedupe_preserving_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped
