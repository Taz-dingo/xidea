from __future__ import annotations

import hashlib
import re

from xidea_agent.knowledge_points import build_knowledge_point_id
from xidea_agent.state import AgentRequest, KnowledgePoint, Project, ProjectMaterial


def build_project_id(title: str) -> str:
    return _build_scoped_id("project", title)


def build_session_id(
    project_id: str,
    session_type: str,
    sequence: int | None = None,
) -> str:
    if sequence is None:
        return f"session-{project_id}-{session_type}"
    return f"session-{project_id}-{session_type}-{sequence}"


def build_session_title(
    session_type: str,
    sequence: int,
    focus_title: str | None = None,
) -> str:
    if focus_title:
        if session_type == "review":
            return f"复习：{focus_title}"
        if session_type == "study":
            return f"学习：{focus_title}"

    if session_type == "review":
        return f"复习 session {sequence}"
    if session_type == "study":
        return f"学习 session {sequence}"
    return f"project session {sequence}"


def build_project_material_id(project_id: str, title: str) -> str:
    digest = hashlib.sha1(f"{project_id}:{title.strip().lower()}".encode("utf-8")).hexdigest()[:12]
    return f"material-{digest}"


def build_session_attachment_id(session_id: str, project_material_id: str, role: str) -> str:
    digest = hashlib.sha1(
        f"{session_id}:{project_material_id}:{role}".encode("utf-8")
    ).hexdigest()[:12]
    return f"attachment-{digest}"


def build_project_memory_id(project_id: str) -> str:
    return f"pmem-{project_id}"


def build_project_learning_profile_id(project_id: str) -> str:
    return f"plp-{project_id}"


def infer_session_type(request: AgentRequest) -> str:
    if request.activity_result is not None and request.activity_result.result_type == "review":
        return "review"
    if request.target_unit_id:
        return "study"
    return "project"


def default_session_title(request: AgentRequest) -> str:
    session_type = infer_session_type(request)
    if session_type == "review":
        return f"复习：{request.topic}"
    if session_type == "study":
        return f"学习：{request.topic}"
    return f"Project session：{request.topic}"


def build_bootstrap_knowledge_points(
    project: Project,
    project_materials: list[ProjectMaterial],
    session_id: str,
    now_value: str,
) -> list[KnowledgePoint]:
    titles: list[tuple[str, str]] = []
    for material in project_materials[:3]:
        titles.append(
            (
                material.title,
                f"围绕材料《{material.title}》抽出与项目主题直接相关的第一版知识点。",
            )
        )
    if not titles:
        titles.append(
            (
                project.topic,
                f"围绕“{project.topic}”建立第一版项目知识点，用于后续学习与复习编排。",
            )
        )

    knowledge_points: list[KnowledgePoint] = []
    seen_titles: set[str] = set()
    material_refs = [material.id for material in project_materials]
    for title, description in titles:
        normalized_title = " ".join(title.split())
        if normalized_title in seen_titles:
            continue
        seen_titles.add(normalized_title)
        knowledge_points.append(
            KnowledgePoint(
                id=build_knowledge_point_id(project.id, normalized_title),
                project_id=project.id,
                title=normalized_title,
                description=description,
                status="active",
                origin_type="bootstrap",
                origin_session_id=session_id,
                source_material_refs=material_refs,
                created_at=now_value,
                updated_at=now_value,
            )
        )
    return knowledge_points


def build_project_memory_summary(
    project: Project,
    project_materials: list[ProjectMaterial],
) -> str:
    if project_materials:
        return (
            f"当前 project 聚焦“{project.topic}”，已带入 {len(project_materials)} 份初始材料，"
            "等待围绕主题收敛知识点池与第一轮学习动作。"
        )
    return f"当前 project 聚焦“{project.topic}”，尚未补入初始材料，等待建立第一版知识点池。"


def build_project_memory_key_facts(
    project: Project,
    project_materials: list[ProjectMaterial],
) -> list[str]:
    facts = [
        f"topic: {project.topic}",
        f"description: {project.description}",
    ]
    facts.extend(f"rule: {rule}" for rule in project.special_rules[:3])
    facts.extend(f"material: {material.title}" for material in project_materials[:3])
    return facts


def _build_scoped_id(prefix: str, value: str) -> str:
    normalized = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", "-", value.strip().lower()).strip("-")
    if normalized:
        normalized = normalized[:40]
    else:
        normalized = hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{normalized}"
