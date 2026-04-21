from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Literal

from xidea_agent.knowledge_points import build_knowledge_point_id
from xidea_agent.state import (
    AgentRequest,
    AgentRunResult,
    GraphState,
    KnowledgePoint,
    KnowledgePointState,
    KnowledgePointSuggestion,
    KnowledgePointSuggestionResolution,
    LearnerUnitState,
    Message,
    Project,
    ProjectLearningProfile,
    ProjectMemory,
    ReviewPatch,
    SessionOrchestration,
    SessionOrchestrationEventRecord,
    SourceAsset,
    StatePatch,
)


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  special_rules TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  thread_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'project',
  knowledge_point_id TEXT,
  title TEXT,
  summary TEXT,
  status TEXT NOT NULL DEFAULT '活跃',
  entry_mode TEXT NOT NULL,
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
  session_orchestration TEXT,
  orchestration_events TEXT NOT NULL DEFAULT '[]',
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
  origin_message_id INTEGER,
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
  summary TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS project_learning_profiles (
  project_id TEXT PRIMARY KEY,
  current_stage TEXT NOT NULL,
  primary_weaknesses TEXT NOT NULL,
  learning_preferences TEXT NOT NULL,
  freshness TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS project_consolidations (
  project_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS project_materials (
  material_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  topic TEXT NOT NULL,
  source_uri TEXT,
  content_ref TEXT,
  summary TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS thread_activity_decks (
  deck_id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  session_type TEXT NOT NULL,
  knowledge_point_id TEXT,
  completed_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  FOREIGN KEY(thread_id) REFERENCES threads(thread_id)
);
"""

THREAD_COLUMN_MIGRATIONS: dict[str, str] = {
    "session_type": "ALTER TABLE threads ADD COLUMN session_type TEXT NOT NULL DEFAULT 'project'",
    "knowledge_point_id": "ALTER TABLE threads ADD COLUMN knowledge_point_id TEXT",
    "title": "ALTER TABLE threads ADD COLUMN title TEXT",
    "summary": "ALTER TABLE threads ADD COLUMN summary TEXT",
    "status": "ALTER TABLE threads ADD COLUMN status TEXT NOT NULL DEFAULT '活跃'",
}

THREAD_CONTEXT_COLUMN_MIGRATIONS: dict[str, str] = {
    "session_orchestration": "ALTER TABLE thread_context ADD COLUMN session_orchestration TEXT",
    "orchestration_events": "ALTER TABLE thread_context ADD COLUMN orchestration_events TEXT NOT NULL DEFAULT '[]'",
}

KNOWLEDGE_POINT_SUGGESTION_COLUMN_MIGRATIONS: dict[str, str] = {
    "origin_message_id": "ALTER TABLE knowledge_point_suggestions ADD COLUMN origin_message_id INTEGER",
}

PROJECT_COLUMN_MIGRATIONS: dict[str, str] = {
    "title": "ALTER TABLE projects ADD COLUMN title TEXT NOT NULL DEFAULT ''",
    "description": "ALTER TABLE projects ADD COLUMN description TEXT NOT NULL DEFAULT ''",
    "special_rules": "ALTER TABLE projects ADD COLUMN special_rules TEXT NOT NULL DEFAULT '[]'",
    "status": "ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
}

REVIEW_STATE_COLUMN_MIGRATIONS: dict[str, str] = {
    "review_count": "ALTER TABLE review_state ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0",
    "lapse_count": "ALTER TABLE review_state ADD COLUMN lapse_count INTEGER NOT NULL DEFAULT 0",
}


class SQLiteRepository:
    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)

    def initialize(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(SCHEMA_SQL)
            self._apply_schema_migrations(connection)

    def save_project(self, project: Project) -> None:
        self.initialize()
        now_value = _utc_now()
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
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO projects(
                  project_id, title, topic, description,
                  special_rules, status, created_at, updated_at
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

    def list_projects(self) -> list[Project]:
        self.initialize()
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM projects
                ORDER BY updated_at DESC, created_at DESC, project_id DESC
                """
            ).fetchall()

        return [self._row_to_project(row) for row in rows]

    def get_project(self, project_id: str) -> Project | None:
        self.initialize()
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

    def save_run(self, request: AgentRequest, run_result: AgentRunResult) -> None:
        self.initialize()
        state = run_result.graph_state
        effective_request = state.request
        now = state.learner_unit_state.updated_at if state.learner_unit_state else None
        now_value = now.isoformat() if now else _utc_now()

        with self._connect() as connection:
            existing_thread = connection.execute(
                """
                SELECT title, summary
                FROM threads
                WHERE thread_id = ?
                """,
                (request.thread_id,),
            ).fetchone()
            thread_title = _resolve_thread_title(
                effective_request,
                state=state,
                connection=connection,
                existing_title=existing_thread["title"] if existing_thread is not None else None,
            )
            thread_summary = _resolve_thread_summary(
                effective_request,
                state.assistant_message,
                existing_summary=existing_thread["summary"] if existing_thread is not None else None,
            )
            thread_status = _resolve_thread_status(state.assistant_message)
            knowledge_point_id = (
                state.session_orchestration.current_focus_id
                if state.session_orchestration is not None
                else effective_request.knowledge_point_id or effective_request.target_unit_id
            )
            connection.execute(
                """
                INSERT INTO projects(
                  project_id, title, topic, description,
                  special_rules, status, created_at, updated_at
                )
                VALUES (?, '', ?, '', '[]', 'active', ?, ?)
                ON CONFLICT(project_id) DO UPDATE SET
                  topic = excluded.topic,
                  updated_at = excluded.updated_at
                """,
                (effective_request.project_id, effective_request.topic, now_value, now_value),
            )
            connection.execute(
                """
                INSERT INTO threads(
                  thread_id, project_id, topic, session_type, knowledge_point_id,
                  title, summary, status, entry_mode, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(thread_id) DO UPDATE SET
                  topic = excluded.topic,
                  session_type = excluded.session_type,
                  knowledge_point_id = excluded.knowledge_point_id,
                  title = excluded.title,
                  summary = excluded.summary,
                  status = excluded.status,
                  entry_mode = excluded.entry_mode,
                  updated_at = excluded.updated_at
                """,
                (
                    effective_request.thread_id,
                    effective_request.project_id,
                    effective_request.topic,
                    effective_request.session_type,
                    knowledge_point_id,
                    thread_title,
                    thread_summary,
                    thread_status,
                    effective_request.entry_mode,
                    now_value,
                    now_value,
                ),
            )

            self._append_messages(connection, effective_request.thread_id, effective_request.messages, now_value)
            self._upsert_thread_context(
                connection,
                effective_request.thread_id,
                effective_request.entry_mode,
                effective_request.source_asset_ids,
                state.session_orchestration,
                state.orchestration_events,
                now_value,
            )
            assistant_message_id: int | None = None
            if state.assistant_message:
                assistant_message_ids = self._append_messages(
                    connection,
                    effective_request.thread_id,
                    [Message(role="assistant", content=state.assistant_message)],
                    now_value,
                )
                assistant_message_id = assistant_message_ids[0] if assistant_message_ids else None

            if state.is_off_topic:
                return

            if state.learner_unit_state:
                self._upsert_learner_unit_state(
                    connection,
                    effective_request.thread_id,
                    state.learner_unit_state,
                )

            if state.state_patch and state.state_patch.review_patch:
                self._upsert_review_state(
                    connection,
                    effective_request.thread_id,
                    state.learner_unit_state.unit_id
                    if state.learner_unit_state
                    else effective_request.target_unit_id,
                    state.state_patch.review_patch,
                    now_value,
                )
                self._append_review_events(
                    connection,
                    effective_request.thread_id,
                    state.learner_unit_state.unit_id
                    if state.learner_unit_state
                    else effective_request.target_unit_id,
                    state.state_patch,
                    now_value,
                )

            if state.knowledge_point_suggestions:
                persisted_suggestions = [
                    suggestion.model_copy(
                        update={
                            "origin_message_id": (
                                assistant_message_id
                                if suggestion.kind == "create"
                                and suggestion.origin_message_id is None
                                else suggestion.origin_message_id
                            )
                        }
                    )
                    for suggestion in state.knowledge_point_suggestions
                ]
                self._upsert_knowledge_point_suggestions(
                    connection,
                    persisted_suggestions,
                    now_value,
                )
                self._mark_archive_suggestion_states(
                    connection,
                    persisted_suggestions,
                    now_value,
                )

            if state.knowledge_point_state_writebacks:
                for knowledge_point_state in state.knowledge_point_state_writebacks:
                    self._upsert_knowledge_point_state(connection, knowledge_point_state, now_value)

            if state.project_memory_writeback is not None:
                self._upsert_project_memory(connection, state.project_memory_writeback, now_value)

            if state.project_learning_profile_writeback is not None:
                self._upsert_project_learning_profile(
                    connection,
                    state.project_learning_profile_writeback,
                    now_value,
                )

            if request.activity_result is not None:
                self._upsert_thread_activity_deck(connection, request, now_value)

    def list_recent_messages(self, thread_id: str, limit: int = 8) -> list[Message]:
        return self.list_thread_messages(thread_id, limit=limit)

    def list_thread_messages(self, thread_id: str, limit: int | None = None) -> list[Message]:
        self.initialize()
        with self._connect() as connection:
            if limit is None:
                rows = connection.execute(
                    """
                    SELECT role, content
                    FROM thread_messages
                    WHERE thread_id = ?
                    ORDER BY message_id ASC
                    """,
                    (thread_id,),
                ).fetchall()
            else:
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
                rows = list(reversed(rows))

        return [Message(role=row["role"], content=row["content"]) for row in rows]

    def list_thread_message_records(
        self,
        thread_id: str,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        self.initialize()
        with self._connect() as connection:
            if limit is None:
                rows = connection.execute(
                    """
                    SELECT message_id, role, content, created_at
                    FROM thread_messages
                    WHERE thread_id = ?
                    ORDER BY message_id ASC
                    """,
                    (thread_id,),
                ).fetchall()
            else:
                rows = connection.execute(
                    """
                    SELECT message_id, role, content, created_at
                    FROM thread_messages
                    WHERE thread_id = ?
                    ORDER BY message_id DESC
                    LIMIT ?
                    """,
                    (thread_id, limit),
                ).fetchall()
                rows = list(reversed(rows))

        return [
            {
                "message_id": row["message_id"],
                "role": row["role"],
                "content": row["content"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def list_thread_activity_decks(self, thread_id: str) -> list[dict[str, Any]]:
        self.initialize()
        with self._connect() as connection:
            thread_row = connection.execute(
                """
                SELECT session_type, knowledge_point_id
                FROM threads
                WHERE thread_id = ?
                """,
                (thread_id,),
            ).fetchone()
            rows = connection.execute(
                """
                SELECT deck_id, session_type, knowledge_point_id, completed_at, payload
                FROM thread_activity_decks
                WHERE thread_id = ?
                ORDER BY completed_at DESC, deck_id DESC
                """,
                (thread_id,),
            ).fetchall()

        records: list[dict[str, Any]] = []
        for row in rows:
            payload = json.loads(row["payload"])
            records.append(
                {
                    "deck_id": row["deck_id"],
                    "session_id": thread_id,
                    "session_type": row["session_type"],
                    "knowledge_point_id": row["knowledge_point_id"],
                    "completed_at": row["completed_at"],
                    "cards": payload.get("cards", []),
                }
            )
        if records:
            return records

        if thread_row is None or thread_row["session_type"] == "project":
            return records

        with self._connect() as connection:
            fallback_rows = connection.execute(
                """
                SELECT message_id, content, created_at
                FROM thread_messages
                WHERE thread_id = ? AND role = 'user' AND content LIKE '已提交本组学习动作结果%'
                ORDER BY message_id DESC
                """,
                (thread_id,),
            ).fetchall()

        for row in fallback_rows:
            records.append(
                {
                    "deck_id": f"recovered-message-{row['message_id']}",
                    "session_id": thread_id,
                    "session_type": thread_row["session_type"],
                    "knowledge_point_id": thread_row["knowledge_point_id"],
                    "completed_at": row["created_at"],
                    "cards": [
                        {
                            "activityId": f"recovered-message-{row['message_id']}",
                            "activityTitle": "已完成牌组",
                            "activityPrompt": row["content"],
                            "knowledgePointId": thread_row["knowledge_point_id"],
                            "kind": "guided-qa",
                            "action": "submit",
                            "responseText": row["content"],
                            "selectedChoiceId": None,
                            "isCorrect": None,
                            "attempts": [],
                            "finalFeedback": None,
                            "finalAnalysis": None,
                        }
                    ],
                }
            )
        return records

    def delete_thread(self, thread_id: str) -> None:
        self.initialize()
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM thread_activity_decks WHERE thread_id = ?",
                (thread_id,),
            )
            connection.execute(
                "DELETE FROM review_events WHERE thread_id = ?",
                (thread_id,),
            )
            connection.execute(
                "DELETE FROM review_state WHERE thread_id = ?",
                (thread_id,),
            )
            connection.execute(
                "DELETE FROM learner_unit_state WHERE thread_id = ?",
                (thread_id,),
            )
            connection.execute(
                "DELETE FROM thread_messages WHERE thread_id = ?",
                (thread_id,),
            )
            connection.execute(
                "DELETE FROM thread_context WHERE thread_id = ?",
                (thread_id,),
            )
            connection.execute(
                "DELETE FROM knowledge_point_suggestions WHERE session_id = ?",
                (thread_id,),
            )
            connection.execute(
                "DELETE FROM threads WHERE thread_id = ?",
                (thread_id,),
            )

    def list_project_threads(self, project_id: str) -> list[dict[str, Any]]:
        self.initialize()
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                  threads.thread_id,
                  threads.project_id,
                  threads.topic,
                  threads.session_type,
                  threads.knowledge_point_id,
                  threads.title,
                  threads.summary,
                  threads.status,
                  threads.entry_mode,
                  threads.created_at,
                  threads.updated_at,
                  thread_context.source_asset_ids
                FROM threads
                LEFT JOIN thread_context
                  ON thread_context.thread_id = threads.thread_id
                WHERE threads.project_id = ?
                ORDER BY threads.updated_at DESC, threads.created_at DESC, threads.thread_id DESC
                """,
                (project_id,),
            ).fetchall()

        return [
            {
                "thread_id": row["thread_id"],
                "project_id": row["project_id"],
                "topic": row["topic"],
                "session_type": row["session_type"] or "project",
                "knowledge_point_id": row["knowledge_point_id"],
                "title": row["title"] or _default_thread_title(row["session_type"] or "project", row["topic"]),
                "summary": row["summary"] or "",
                "status": row["status"] or "已更新",
                "entry_mode": row["entry_mode"],
                "source_asset_ids": json.loads(row["source_asset_ids"]) if row["source_asset_ids"] else [],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
            for row in rows
        ]

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

    def get_project_context(
        self,
        project_id: str,
        thread_id: str,
        *,
        recent_message_limit: int = 5,
    ) -> dict[str, object] | None:
        with self._connect() as connection:
            project_row = connection.execute(
                """
                SELECT project_id, topic, updated_at
                FROM projects
                WHERE project_id = ?
                """,
                (project_id,),
            ).fetchone()
            project_memory_row = connection.execute(
                """
                SELECT *
                FROM project_memories
                WHERE project_id = ?
                """,
                (project_id,),
            ).fetchone()
            project_learning_profile_row = connection.execute(
                """
                SELECT *
                FROM project_learning_profiles
                WHERE project_id = ?
                """,
                (project_id,),
            ).fetchone()

        thread_context = self.get_thread_context(thread_id)
        recent_messages = self.list_recent_messages(thread_id, limit=recent_message_limit)

        if (
            project_row is None
            and thread_context is None
            and not recent_messages
            and project_memory_row is None
            and project_learning_profile_row is None
        ):
            return None

        return {
            "project_id": project_row["project_id"] if project_row is not None else project_id,
            "project_topic": project_row["topic"] if project_row is not None else None,
            "project_updated_at": project_row["updated_at"] if project_row is not None else None,
            "project_memory": (
                self._row_to_project_memory(project_memory_row)
                if project_memory_row is not None
                else None
            ),
            "project_learning_profile": (
                self._row_to_project_learning_profile(project_learning_profile_row)
                if project_learning_profile_row is not None
                else None
            ),
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

    def get_project_consolidation(self, project_id: str) -> dict[str, Any] | None:
        self.initialize()
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT payload
                FROM project_consolidations
                WHERE project_id = ?
                """,
                (project_id,),
            ).fetchone()

        return json.loads(row["payload"]) if row is not None else None

    def save_project_consolidation(self, project_id: str, snapshot: dict[str, Any]) -> None:
        self.initialize()
        generated_at = str(snapshot.get("generated_at") or _utc_now())
        now_value = _utc_now()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO project_consolidations(
                  project_id, payload, generated_at, updated_at
                )
                VALUES (?, ?, ?, ?)
                ON CONFLICT(project_id) DO UPDATE SET
                  payload = excluded.payload,
                  generated_at = excluded.generated_at,
                  updated_at = excluded.updated_at
                """,
                (
                    project_id,
                    json.dumps(snapshot, ensure_ascii=False),
                    generated_at,
                    now_value,
                ),
            )

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

    def delete_knowledge_point(self, project_id: str, knowledge_point_id: str) -> bool:
        self.initialize()
        now_value = _utc_now()
        with self._connect() as connection:
            point_row = connection.execute(
                """
                SELECT knowledge_point_id
                FROM knowledge_points
                WHERE project_id = ? AND knowledge_point_id = ?
                """,
                (project_id, knowledge_point_id),
            ).fetchone()
            if point_row is None:
                return False

            project_thread_ids = [
                row["thread_id"]
                for row in connection.execute(
                    """
                    SELECT thread_id
                    FROM threads
                    WHERE project_id = ?
                    """,
                    (project_id,),
                ).fetchall()
            ]

            if project_thread_ids:
                placeholders = ", ".join("?" for _ in project_thread_ids)
                connection.execute(
                    f"""
                    DELETE FROM learner_unit_state
                    WHERE unit_id = ? AND thread_id IN ({placeholders})
                    """,
                    [knowledge_point_id, *project_thread_ids],
                )
                connection.execute(
                    f"""
                    DELETE FROM review_state
                    WHERE unit_id = ? AND thread_id IN ({placeholders})
                    """,
                    [knowledge_point_id, *project_thread_ids],
                )
                connection.execute(
                    f"""
                    DELETE FROM review_events
                    WHERE unit_id = ? AND thread_id IN ({placeholders})
                    """,
                    [knowledge_point_id, *project_thread_ids],
                )

            connection.execute(
                """
                UPDATE threads
                SET knowledge_point_id = NULL, updated_at = ?
                WHERE project_id = ? AND knowledge_point_id = ?
                """,
                (now_value, project_id, knowledge_point_id),
            )
            connection.execute(
                """
                UPDATE thread_activity_decks
                SET knowledge_point_id = NULL
                WHERE knowledge_point_id = ? AND thread_id IN (
                  SELECT thread_id
                  FROM threads
                  WHERE project_id = ?
                )
                """,
                (knowledge_point_id, project_id),
            )
            connection.execute(
                """
                DELETE FROM knowledge_point_state
                WHERE knowledge_point_id = ?
                """,
                (knowledge_point_id,),
            )
            connection.execute(
                """
                DELETE FROM knowledge_point_suggestions
                WHERE project_id = ? AND knowledge_point_id = ?
                """,
                (project_id, knowledge_point_id),
            )
            connection.execute(
                """
                DELETE FROM knowledge_points
                WHERE project_id = ? AND knowledge_point_id = ?
                """,
                (project_id, knowledge_point_id),
            )
        return True

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

    def save_project_material(self, material: SourceAsset, *, project_id: str) -> None:
        self.initialize()
        now_value = _utc_now()
        with self._connect() as connection:
            self._ensure_project(connection, project_id, material.topic, now_value)
            self._upsert_project_material(connection, project_id, material, now_value)

    def list_project_materials(self, project_id: str) -> list[SourceAsset]:
        self.initialize()
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM project_materials
                WHERE project_id = ?
                ORDER BY created_at DESC, material_id DESC
                """,
                (project_id,),
            ).fetchall()

        return [self._row_to_project_material(row) for row in rows]

    def delete_project_material(self, project_id: str, material_id: str) -> bool:
        self.initialize()
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT 1
                FROM project_materials
                WHERE project_id = ? AND material_id = ?
                """,
                (project_id, material_id),
            ).fetchone()
            if row is None:
                return False

            connection.execute(
                """
                DELETE FROM project_materials
                WHERE project_id = ? AND material_id = ?
                """,
                (project_id, material_id),
            )
        return True

    def get_project_materials_by_ids(
        self,
        project_id: str,
        material_ids: list[str],
    ) -> list[SourceAsset]:
        if not material_ids:
            return []

        self.initialize()
        placeholders = ", ".join("?" for _ in material_ids)
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT *
                FROM project_materials
                WHERE project_id = ? AND material_id IN ({placeholders})
                """,
                [project_id, *material_ids],
            ).fetchall()

        materials_by_id = {
            material.id: material for material in (self._row_to_project_material(row) for row in rows)
        }
        return [materials_by_id[material_id] for material_id in material_ids if material_id in materials_by_id]

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
            "session_orchestration": (
                json.loads(row["session_orchestration"])
                if row["session_orchestration"]
                else None
            ),
            "orchestration_events": json.loads(row["orchestration_events"] or "[]"),
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

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _apply_schema_migrations(self, connection: sqlite3.Connection) -> None:
        project_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(projects)").fetchall()
        }
        for column_name, statement in PROJECT_COLUMN_MIGRATIONS.items():
            if column_name not in project_columns:
                connection.execute(statement)
                project_columns.add(column_name)

        existing_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(threads)").fetchall()
        }
        for column_name, statement in THREAD_COLUMN_MIGRATIONS.items():
            if column_name not in existing_columns:
                connection.execute(statement)
                existing_columns.add(column_name)

        suggestion_columns = {
            row["name"]
            for row in connection.execute(
                "PRAGMA table_info(knowledge_point_suggestions)"
            ).fetchall()
        }
        for column_name, statement in KNOWLEDGE_POINT_SUGGESTION_COLUMN_MIGRATIONS.items():
            if column_name not in suggestion_columns:
                connection.execute(statement)
                suggestion_columns.add(column_name)

        thread_context_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(thread_context)").fetchall()
        }
        for column_name, statement in THREAD_CONTEXT_COLUMN_MIGRATIONS.items():
            if column_name not in thread_context_columns:
                connection.execute(statement)
                thread_context_columns.add(column_name)

        review_state_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(review_state)").fetchall()
        }
        for column_name, statement in REVIEW_STATE_COLUMN_MIGRATIONS.items():
            if column_name not in review_state_columns:
                connection.execute(statement)
                review_state_columns.add(column_name)

    def _append_messages(
        self,
        connection: sqlite3.Connection,
        thread_id: str,
        messages: list[Message],
        created_at: str,
    ) -> list[int]:
        inserted_ids: list[int] = []
        for message in messages:
            cursor = connection.execute(
                """
                INSERT INTO thread_messages(thread_id, role, content, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (thread_id, message.role, message.content, created_at),
            )
            inserted_ids.append(int(cursor.lastrowid))
        return inserted_ids

    def _ensure_project(
        self,
        connection: sqlite3.Connection,
        project_id: str,
        topic: str,
        now_value: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO projects(
              project_id, title, topic, description,
              special_rules, status, created_at, updated_at
            )
            VALUES (?, '', ?, '', '[]', 'active', ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
              topic = CASE
                WHEN excluded.topic != '' THEN excluded.topic
                ELSE projects.topic
              END,
              updated_at = excluded.updated_at
            """,
            (project_id, topic, now_value, now_value),
        )

    def _upsert_thread_context(
        self,
        connection: sqlite3.Connection,
        thread_id: str,
        entry_mode: str,
        source_asset_ids: list[str],
        session_orchestration: SessionOrchestration | None,
        orchestration_events: list[SessionOrchestrationEventRecord],
        updated_at: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO thread_context(
              thread_id, entry_mode, source_asset_ids, session_orchestration, orchestration_events, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(thread_id) DO UPDATE SET
              entry_mode = excluded.entry_mode,
              source_asset_ids = excluded.source_asset_ids,
              session_orchestration = excluded.session_orchestration,
              orchestration_events = excluded.orchestration_events,
              updated_at = excluded.updated_at
            """,
            (
                thread_id,
                entry_mode,
                json.dumps(source_asset_ids, ensure_ascii=False),
                json.dumps(
                    session_orchestration.model_dump(mode="json"),
                    ensure_ascii=False,
                )
                if session_orchestration is not None
                else None,
                json.dumps(
                    [event.model_dump(mode="json") for event in orchestration_events],
                    ensure_ascii=False,
                ),
                updated_at,
            ),
        )

    def _upsert_thread_activity_deck(
        self,
        connection: sqlite3.Connection,
        request: AgentRequest,
        completed_at: str,
    ) -> None:
        result = request.activity_result
        if result is None:
            return

        cards = result.meta.get("items")
        if not isinstance(cards, list) or len(cards) == 0:
            return

        connection.execute(
            """
            INSERT INTO thread_activity_decks(
              deck_id, thread_id, session_type, knowledge_point_id, completed_at, payload
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(deck_id) DO UPDATE SET
              session_type = excluded.session_type,
              knowledge_point_id = excluded.knowledge_point_id,
              completed_at = excluded.completed_at,
              payload = excluded.payload
            """,
            (
                result.run_id,
                request.thread_id,
                request.session_type,
                result.knowledge_point_id,
                completed_at,
                json.dumps({"cards": cards}, ensure_ascii=False),
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
                    suggestion.origin_message_id,
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
              suggestion_id, project_id, session_id, origin_message_id, kind, knowledge_point_id,
              title, description, reason, source_material_refs, status,
              created_at, resolved_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(suggestion_id) DO UPDATE SET
              origin_message_id = COALESCE(knowledge_point_suggestions.origin_message_id, excluded.origin_message_id),
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
            INSERT INTO project_memories(project_id, summary, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
              summary = excluded.summary,
              updated_at = excluded.updated_at
            """,
            (
                project_memory.project_id,
                project_memory.summary,
                updated_value,
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
              project_id, current_stage, primary_weaknesses,
              learning_preferences, freshness, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
              current_stage = excluded.current_stage,
              primary_weaknesses = excluded.primary_weaknesses,
              learning_preferences = excluded.learning_preferences,
              freshness = excluded.freshness,
              updated_at = excluded.updated_at
            """,
            (
                project_learning_profile.project_id,
                project_learning_profile.current_stage,
                json.dumps(project_learning_profile.primary_weaknesses, ensure_ascii=False),
                json.dumps(project_learning_profile.learning_preferences, ensure_ascii=False),
                project_learning_profile.freshness,
                updated_value,
            ),
        )

    def _upsert_project_material(
        self,
        connection: sqlite3.Connection,
        project_id: str,
        material: SourceAsset,
        now_value: str,
    ) -> None:
        created_value = (
            material.created_at.isoformat()
            if hasattr(material.created_at, "isoformat")
            else material.created_at
            or now_value
        )
        updated_value = (
            material.updated_at.isoformat()
            if hasattr(material.updated_at, "isoformat")
            else material.updated_at
            or now_value
        )
        connection.execute(
            """
            INSERT INTO project_materials(
              material_id, project_id, title, kind, topic, source_uri,
              content_ref, summary, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(material_id) DO UPDATE SET
              title = excluded.title,
              kind = excluded.kind,
              topic = excluded.topic,
              source_uri = excluded.source_uri,
              content_ref = excluded.content_ref,
              summary = excluded.summary,
              status = excluded.status,
              updated_at = excluded.updated_at
            """,
            (
                material.id,
                project_id,
                material.title,
                material.kind,
                material.topic,
                material.source_uri,
                material.content_ref,
                material.summary,
                material.status or "ready",
                created_value,
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
        raw_special_rules = row["special_rules"] if "special_rules" in row.keys() else "[]"
        special_rules = json.loads(raw_special_rules) if raw_special_rules else []
        title = row["title"] if "title" in row.keys() and row["title"] else row["topic"]
        description = (
            row["description"]
            if "description" in row.keys() and row["description"]
            else row["topic"]
        )
        status = row["status"] if "status" in row.keys() and row["status"] else "active"
        return Project(
            id=row["project_id"],
            title=title,
            topic=row["topic"],
            description=description,
            special_rules=special_rules,
            status=status,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
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
            origin_message_id=row["origin_message_id"],
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
            project_id=row["project_id"],
            summary=row["summary"],
            updated_at=row["updated_at"],
        )

    def _row_to_project_learning_profile(
        self,
        row: sqlite3.Row,
    ) -> ProjectLearningProfile:
        return ProjectLearningProfile(
            project_id=row["project_id"],
            current_stage=row["current_stage"],
            primary_weaknesses=json.loads(row["primary_weaknesses"]),
            learning_preferences=json.loads(row["learning_preferences"]),
            freshness=row["freshness"],
            updated_at=row["updated_at"],
        )

    def _row_to_project_material(self, row: sqlite3.Row) -> SourceAsset:
        return SourceAsset(
            id=row["material_id"],
            title=row["title"],
            kind=row["kind"],
            topic=row["topic"],
            summary=row["summary"],
            source_uri=row["source_uri"],
            content_ref=row["content_ref"],
            status=row["status"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _build_knowledge_point_suggestion_resolution(
        self,
        connection: sqlite3.Connection,
        suggestion: KnowledgePointSuggestion,
    ) -> KnowledgePointSuggestionResolution:
        knowledge_point = None
        knowledge_point_state = None
        linked_session_message_ids: dict[str, int] = {}
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

            linked_rows = connection.execute(
                """
                SELECT session_id, origin_message_id
                FROM knowledge_point_suggestions
                WHERE project_id = ?
                  AND knowledge_point_id = ?
                  AND kind = 'create'
                  AND status = 'accepted'
                  AND origin_message_id IS NOT NULL
                ORDER BY created_at ASC, suggestion_id ASC
                """,
                (suggestion.project_id, suggestion.knowledge_point_id),
            ).fetchall()
            linked_session_message_ids = {
                row["session_id"]: row["origin_message_id"] for row in linked_rows
            }

        return KnowledgePointSuggestionResolution(
            suggestion=suggestion,
            knowledge_point=knowledge_point,
            knowledge_point_state=knowledge_point_state,
            linked_session_message_ids=linked_session_message_ids,
        )


def _default_thread_title(session_type: str, topic: str) -> str:
    normalized_topic = topic.strip()
    if session_type == "project":
        return "当前研讨"
    if session_type == "review":
        return normalized_topic if normalized_topic else "复习会话"
    return normalized_topic if normalized_topic else "学习会话"


def _is_placeholder_thread_title(title: str, session_type: str) -> bool:
    normalized = " ".join(title.strip().split())
    if normalized == "":
        return True
    placeholders = {
        "project": {"当前研讨", "新研讨"},
        "study": {"学习会话", "新学习"},
        "review": {"复习会话", "新复习"},
    }
    if normalized in placeholders.get(session_type, set()):
        return True
    if session_type == "project" and normalized.startswith("研讨 "):
        return True
    if session_type in {"study", "review"} and normalized.startswith("第 ") and normalized.endswith(" 轮"):
        return True
    return False


def _trim_material_title(title: str) -> str:
    normalized = title.strip()
    if "." in normalized:
        return normalized.rsplit(".", 1)[0]
    return normalized


def _build_generated_thread_title(
    request: AgentRequest,
    *,
    state: GraphState,
    connection: sqlite3.Connection,
) -> str:
    create_suggestion = next(
        (
            suggestion
            for suggestion in state.knowledge_point_suggestions
            if suggestion.kind == "create" and suggestion.title.strip()
        ),
        None,
    )
    if create_suggestion is not None:
        return create_suggestion.title.strip()

    target_point_id = request.knowledge_point_id or request.target_unit_id
    if target_point_id is not None:
        row = connection.execute(
            """
            SELECT title
            FROM knowledge_points
            WHERE project_id = ? AND knowledge_point_id = ?
            """,
            (request.project_id, target_point_id),
        ).fetchone()
        if row is not None and isinstance(row["title"], str) and row["title"].strip():
            return row["title"].strip()

    if request.session_type in {"study", "review"} and request.topic.strip():
        return request.topic.strip()

    if request.entry_mode == "material-import" and request.source_asset_ids:
        row = connection.execute(
            f"""
            SELECT title
            FROM project_materials
            WHERE project_id = ? AND material_id IN ({", ".join("?" for _ in request.source_asset_ids)})
            ORDER BY updated_at DESC, created_at DESC, material_id DESC
            LIMIT 1
            """,
            (request.project_id, *request.source_asset_ids),
        ).fetchone()
        if row is not None and isinstance(row["title"], str) and row["title"].strip():
            return _trim_material_title(row["title"])

    latest_user_message = request.messages[-1].content.strip() if request.messages else ""
    if latest_user_message:
        compact = " ".join(latest_user_message.split())
        return compact[:18]

    return _default_thread_title(request.session_type, request.topic)


def _resolve_thread_title(
    request: AgentRequest,
    *,
    state: GraphState,
    connection: sqlite3.Connection,
    existing_title: str | None,
) -> str:
    if isinstance(existing_title, str) and existing_title.strip():
        if not _is_placeholder_thread_title(existing_title, request.session_type):
            return existing_title.strip()

    title = (request.session_title or "").strip()
    if title and not _is_placeholder_thread_title(title, request.session_type):
        return title

    return _build_generated_thread_title(request, state=state, connection=connection)


def _resolve_thread_summary(
    request: AgentRequest,
    assistant_message: str | None,
    *,
    existing_summary: str | None,
) -> str:
    summary = (request.session_summary or "").strip()
    if summary:
        return summary
    if isinstance(existing_summary, str) and existing_summary.strip():
        return existing_summary.strip()
    if assistant_message and assistant_message.strip():
        return assistant_message.strip()[:140]
    if request.messages:
        return request.messages[-1].content.strip()[:140]
    return ""


def _resolve_thread_status(assistant_message: str | None) -> str:
    return "已更新" if assistant_message and assistant_message.strip() else "活跃"


def _utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
