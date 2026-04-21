from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Literal

from xidea_agent.material_content import clean_material_text
from xidea_agent.state import SourceAsset


MaterialReadMode = Literal["overview", "targeted"]

_TOKEN_PATTERN = re.compile(r"[A-Za-z0-9_-]{2,}|[\u4e00-\u9fff]{2,12}")
_SENTENCE_SPLIT_PATTERN = re.compile(r"(?<=[。！？!?；;])\s+")


@dataclass(frozen=True)
class MaterialChunk:
    chunk_id: str
    material_id: str
    title: str
    topic: str
    text: str
    locator: str | None
    score: float


def read_material_text(asset: SourceAsset) -> str:
    content_ref = getattr(asset, "content_ref", None)
    if not isinstance(content_ref, str) or not content_ref.strip():
        return asset.summary or ""

    path = Path(content_ref)
    if not path.exists() or not path.is_file():
        return asset.summary or ""

    if asset.kind in {"note", "web"}:
        try:
            return path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            return asset.summary or ""

    if asset.kind == "pdf":
        try:
            from pypdf import PdfReader  # type: ignore
        except Exception:
            return asset.summary or ""

        try:
            reader = PdfReader(str(path))
            page_text = []
            for page in reader.pages[:12]:
                extracted = page.extract_text() or ""
                if extracted.strip():
                    page_text.append(extracted)
            return "\n".join(page_text) if page_text else (asset.summary or "")
        except Exception:
            return asset.summary or ""

    return asset.summary or ""


def build_material_chunks(
    asset: SourceAsset,
    *,
    max_chunk_chars: int = 420,
) -> list[MaterialChunk]:
    if asset.kind == "pdf":
        chunks = _build_pdf_chunks(asset, max_chunk_chars=max_chunk_chars)
    else:
        chunks = _build_text_chunks(asset, max_chunk_chars=max_chunk_chars)

    if chunks:
        return chunks

    fallback_text = clean_material_text(asset.summary or "")
    if not fallback_text:
        return []

    return [
        MaterialChunk(
            chunk_id=f"{asset.id}:fallback:1",
            material_id=asset.id,
            title=asset.title,
            topic=asset.topic,
            text=fallback_text[:max_chunk_chars],
            locator=None,
            score=0.0,
        )
    ]


def select_material_chunks(
    chunks: list[MaterialChunk],
    *,
    query: str | None,
    mode: MaterialReadMode,
    max_chunks: int,
) -> list[MaterialChunk]:
    if not chunks or max_chunks <= 0:
        return []

    if mode == "targeted":
        ranked = _rank_material_chunks(chunks, query=query)
        if ranked and ranked[0].score > 0:
            return ranked[:max_chunks]

    return _select_overview_chunks(chunks, max_chunks=max_chunks)


def _build_text_chunks(
    asset: SourceAsset,
    *,
    max_chunk_chars: int,
) -> list[MaterialChunk]:
    raw_text = read_material_text(asset)
    cleaned_text = clean_material_text(raw_text)
    if not cleaned_text:
        return []

    texts = _chunk_text(cleaned_text, max_chunk_chars=max_chunk_chars)
    return [
        MaterialChunk(
            chunk_id=f"{asset.id}:text:{index + 1}",
            material_id=asset.id,
            title=asset.title,
            topic=asset.topic,
            text=text,
            locator=f"片段 {index + 1}",
            score=0.0,
        )
        for index, text in enumerate(texts)
    ]


def _build_pdf_chunks(
    asset: SourceAsset,
    *,
    max_chunk_chars: int,
) -> list[MaterialChunk]:
    content_ref = getattr(asset, "content_ref", None)
    if not isinstance(content_ref, str) or not content_ref.strip():
        return []

    path = Path(content_ref)
    if not path.exists() or not path.is_file():
        return []

    try:
        from pypdf import PdfReader  # type: ignore
    except Exception:
        return []

    try:
        reader = PdfReader(str(path))
    except Exception:
        return []

    chunks: list[MaterialChunk] = []
    for page_index, page in enumerate(reader.pages[:12]):
        extracted = page.extract_text() or ""
        cleaned_page = clean_material_text(extracted)
        if not cleaned_page:
            continue
        texts = _chunk_text(cleaned_page, max_chunk_chars=max_chunk_chars)
        locator = f"第 {page_index + 1} 页"
        for chunk_index, text in enumerate(texts):
            chunks.append(
                MaterialChunk(
                    chunk_id=f"{asset.id}:page:{page_index + 1}:{chunk_index + 1}",
                    material_id=asset.id,
                    title=asset.title,
                    topic=asset.topic,
                    text=text,
                    locator=locator,
                    score=0.0,
                )
            )
    return chunks


def _chunk_text(text: str, *, max_chunk_chars: int) -> list[str]:
    normalized = " ".join(text.split())
    if not normalized:
        return []

    sentences = [part.strip() for part in _SENTENCE_SPLIT_PATTERN.split(normalized) if part.strip()]
    if not sentences:
        return [normalized[:max_chunk_chars]]

    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        if len(sentence) > max_chunk_chars:
            if current:
                chunks.append(current.strip())
                current = ""
            for start in range(0, len(sentence), max_chunk_chars):
                chunk = sentence[start : start + max_chunk_chars].strip()
                if chunk:
                    chunks.append(chunk)
            continue

        candidate = f"{current} {sentence}".strip()
        if current and len(candidate) > max_chunk_chars:
            chunks.append(current.strip())
            current = sentence
        else:
            current = candidate

    if current:
        chunks.append(current.strip())
    return chunks


def _extract_query_terms(query: str | None) -> list[str]:
    if query is None or not query.strip():
        return []

    terms: list[str] = []
    for match in _TOKEN_PATTERN.findall(query):
        normalized = match.strip().lower()
        if len(normalized) < 2:
            continue
        if normalized not in terms:
            terms.append(normalized)
    return terms[:12]


def _rank_material_chunks(
    chunks: list[MaterialChunk],
    *,
    query: str | None,
) -> list[MaterialChunk]:
    terms = _extract_query_terms(query)
    normalized_query = " ".join(query.strip().split()).lower() if query else ""
    ranked: list[MaterialChunk] = []

    for chunk in chunks:
        haystack = "\n".join([chunk.title, chunk.topic, chunk.text]).lower()
        score = 0.0
        if normalized_query and normalized_query in haystack:
            score += 3.0
        for term in terms:
            if term in chunk.title.lower():
                score += 1.5
            elif term in chunk.topic.lower():
                score += 1.2
            elif term in haystack:
                score += 1.0
        ranked.append(
            MaterialChunk(
                chunk_id=chunk.chunk_id,
                material_id=chunk.material_id,
                title=chunk.title,
                topic=chunk.topic,
                text=chunk.text,
                locator=chunk.locator,
                score=round(score, 3),
            )
        )

    return sorted(
        ranked,
        key=lambda item: (item.score, len(item.text)),
        reverse=True,
    )


def _select_overview_chunks(
    chunks: list[MaterialChunk],
    *,
    max_chunks: int,
) -> list[MaterialChunk]:
    chunks_by_material: dict[str, list[MaterialChunk]] = {}
    material_order: list[str] = []
    for chunk in chunks:
        if chunk.material_id not in chunks_by_material:
            chunks_by_material[chunk.material_id] = []
            material_order.append(chunk.material_id)
        chunks_by_material[chunk.material_id].append(chunk)

    selected: list[MaterialChunk] = []
    index = 0
    while len(selected) < max_chunks:
        progressed = False
        for material_id in material_order:
            material_chunks = chunks_by_material[material_id]
            if index < len(material_chunks):
                selected.append(material_chunks[index])
                progressed = True
                if len(selected) >= max_chunks:
                    break
        if not progressed:
            break
        index += 1
    return selected
