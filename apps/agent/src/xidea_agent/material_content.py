from __future__ import annotations

import re


_MARKDOWN_FRONTMATTER_PATTERN = re.compile(
    r"^\ufeff?\s*---\s*\n.*?\n---\s*(?:\n|$)",
    re.DOTALL,
)
_MARKDOWN_DECORATION_PATTERNS = (
    (re.compile(r"`{1,3}"), ""),
    (re.compile(r"[*_~]+"), ""),
    (re.compile(r"^#{1,6}\s*", re.MULTILINE), ""),
    (re.compile(r"^\s*[-*+]\s+", re.MULTILINE), ""),
    (re.compile(r"^\s*\d+\.\s+", re.MULTILINE), ""),
    (re.compile(r"!\[[^\]]*\]\([^)]*\)"), ""),
    (re.compile(r"\[([^\]]+)\]\([^)]*\)"), r"\1"),
    (re.compile(r">\s*", re.MULTILINE), ""),
)
_CANDIDATE_EXTRACTION_PATTERNS = (
    (re.compile(r"`{1,3}"), ""),
    (re.compile(r"[*_~]+"), ""),
    (re.compile(r"^#{1,6}\s*", re.MULTILINE), ""),
    (re.compile(r"!\[[^\]]*\]\([^)]*\)"), ""),
    (re.compile(r"\[([^\]]+)\]\([^)]*\)"), r"\1"),
    (re.compile(r">\s*", re.MULTILINE), ""),
)
_METADATA_PREFIXES = (
    "created:",
    "modified:",
    "updated:",
    "date:",
    "tags:",
    "tag:",
    "aliases:",
    "alias:",
    "source:",
)

_KNOWLEDGE_POINT_PATTERNS = (
    re.compile(
        r"(?:一个可学习的知识点是|第(?:一|二|三|四|1|2|3|4)个知识点(?:是)?|"
        r"第(?:一|二|三|四|1|2|3|4)条知识点(?:是)?|知识点(?:一|二|三|四|1|2|3|4)?(?:是)?)[：:]\s*"
        r"(?P<title>[^\n。！？!?]+)"
    ),
    re.compile(
        r"(?:^|[\n；;])\s*(?:\d+|[一二三四])[)）.、]\s*(?P<title>[^；;。\n]+)"
    ),
)

MAX_MATERIAL_KNOWLEDGE_POINT_SUGGESTIONS = 6


def clean_material_text(text: str) -> str:
    if not text.strip():
        return ""

    cleaned = _MARKDOWN_FRONTMATTER_PATTERN.sub("", text, count=1)
    for pattern, replacement in _MARKDOWN_DECORATION_PATTERNS:
        cleaned = pattern.sub(replacement, cleaned)

    lines: list[str] = []
    for raw_line in cleaned.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        lowered = line.lower()
        if any(lowered.startswith(prefix) for prefix in _METADATA_PREFIXES):
            continue
        lines.append(line)

    return "\n".join(lines)


def normalize_material_text(text: str, *, limit: int = 900) -> str:
    cleaned = clean_material_text(text)
    if not cleaned:
        return ""
    normalized = " ".join(cleaned.split())
    return normalized[:limit]


def _prepare_candidate_source_text(text: str) -> str:
    if not text.strip():
        return ""

    prepared = _MARKDOWN_FRONTMATTER_PATTERN.sub("", text, count=1)
    for pattern, replacement in _CANDIDATE_EXTRACTION_PATTERNS:
        prepared = pattern.sub(replacement, prepared)

    lines: list[str] = []
    for raw_line in prepared.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        lowered = line.lower()
        if any(lowered.startswith(prefix) for prefix in _METADATA_PREFIXES):
            continue
        lines.append(line)

    return "\n".join(lines)


def extract_material_knowledge_point_candidates(
    text: str,
    *,
    limit: int = MAX_MATERIAL_KNOWLEDGE_POINT_SUGGESTIONS,
) -> list[str]:
    candidate_source = _prepare_candidate_source_text(text)
    if not candidate_source:
        return []

    titles: list[str] = []

    def _append(candidate: str) -> None:
        normalized = " ".join(candidate.strip().split())
        normalized = normalized.strip(" ：:；;，,。！？!?“”\"'（）()[]【】")
        if len(normalized) < 4:
            return
        if normalized not in titles:
            titles.append(normalized[:48])

    for pattern in _KNOWLEDGE_POINT_PATTERNS:
        for match in pattern.finditer(candidate_source):
            _append(match.group("title"))
            if len(titles) >= limit:
                return titles[:limit]

    return titles[:limit]


def summarize_uploaded_material(filename: str, kind: str, file_bytes: bytes) -> str:
    if kind in {"note", "web"}:
        decoded = file_bytes.decode("utf-8", errors="ignore")
        normalized = normalize_material_text(decoded, limit=420)
        if normalized:
            return normalized

    return f"已上传材料《{filename}》，当前已接入 project 材料池，可用于后续上下文判断与知识点建议。"
