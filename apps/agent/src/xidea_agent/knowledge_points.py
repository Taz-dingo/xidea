from __future__ import annotations

import hashlib
import re


COMPARISON_PATTERN = re.compile(
    r"(?P<left>[A-Za-z][A-Za-z0-9_-]{1,32}|[\u4e00-\u9fff]{2,16})"
    r"\s*(?:和|与|vs\.?|VS|/)\s*"
    r"(?P<right>[A-Za-z][A-Za-z0-9_-]{1,32}|[\u4e00-\u9fff]{2,16})"
)
BOUNDARY_TITLE_PATTERN = re.compile(
    r"^(?P<left>[A-Za-z][A-Za-z0-9_-]{1,32}|[\u4e00-\u9fff]{2,16})"
    r"\s*(?:和|与|vs\.?|VS|/)\s*"
    r"(?P<right>[A-Za-z][A-Za-z0-9_-]{1,32}|[\u4e00-\u9fff]{2,16})"
    r"\s*的边界$"
)


def normalize_text_key(text: str) -> str:
    return re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", "", text).lower()


def canonical_boundary_pair(left: str, right: str) -> tuple[str, str]:
    ordered = sorted(
        (
            (normalize_text_key(left), left.strip()),
            (normalize_text_key(right), right.strip()),
        ),
        key=lambda item: (item[0], item[1]),
    )
    return ordered[0][1], ordered[1][1]


def build_boundary_title(left: str, right: str) -> str:
    canonical_left, canonical_right = canonical_boundary_pair(left, right)
    return f"{canonical_left} 与 {canonical_right} 的边界"


def extract_boundary_pair(title: str) -> tuple[str, str] | None:
    match = BOUNDARY_TITLE_PATTERN.match(" ".join(title.strip().split()))
    if match is None:
        return None
    return canonical_boundary_pair(match.group("left"), match.group("right"))


def knowledge_point_identity_key(title: str) -> str:
    pair = extract_boundary_pair(title)
    if pair is not None:
        left, right = pair
        return f"boundary:{normalize_text_key(left)}:{normalize_text_key(right)}"
    return f"title:{normalize_text_key(title)}"


def build_suggestion_id(project_id: str, session_id: str, title: str) -> str:
    digest = hashlib.sha1(
        f"{project_id}:{session_id}:{knowledge_point_identity_key(title)}".encode("utf-8")
    ).hexdigest()[:12]
    return f"suggestion-{digest}"


def build_knowledge_point_id(project_id: str, title: str) -> str:
    digest = hashlib.sha1(
        f"{project_id}:{knowledge_point_identity_key(title)}".encode("utf-8")
    ).hexdigest()[:12]
    return f"kp-{digest}"
