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


def summarize_uploaded_material(filename: str, kind: str, file_bytes: bytes) -> str:
    if kind in {"note", "web"}:
        decoded = file_bytes.decode("utf-8", errors="ignore")
        normalized = normalize_material_text(decoded, limit=420)
        if normalized:
            return normalized

    return f"已上传材料《{filename}》，当前已接入 project 材料池，可用于后续上下文判断与知识点建议。"
