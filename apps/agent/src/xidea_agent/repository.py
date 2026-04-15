from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from xidea_agent.state import (
    AgentRequest,
    AgentRunResult,
    LearnerUnitState,
    Message,
    ReviewPatch,
    StatePatch,
)


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  thread_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  topic TEXT NOT NULL,
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
"""


class SQLiteRepository:
    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)

    def initialize(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(SCHEMA_SQL)

    def save_run(self, request: AgentRequest, run_result: AgentRunResult) -> None:
        self.initialize()
        state = run_result.graph_state
        now = state.learner_unit_state.updated_at if state.learner_unit_state else None
        now_value = now.isoformat() if now else _utc_now()

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO projects(project_id, topic, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(project_id) DO UPDATE SET
                  topic = excluded.topic,
                  updated_at = excluded.updated_at
                """,
                (request.project_id, request.topic, now_value, now_value),
            )
            connection.execute(
                """
                INSERT INTO threads(thread_id, project_id, topic, entry_mode, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(thread_id) DO UPDATE SET
                  topic = excluded.topic,
                  entry_mode = excluded.entry_mode,
                  updated_at = excluded.updated_at
                """,
                (
                    request.thread_id,
                    request.project_id,
                    request.topic,
                    request.entry_mode,
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


def _utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
