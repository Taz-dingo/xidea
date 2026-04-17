import type { SourceAsset } from "@/domain/types";
import type {
  KnowledgePointItem,
  KnowledgePointSuggestion,
} from "@/domain/project-workspace";

const LEADING_PROMPT_PREFIXES = [
  "我想搞清楚",
  "我想理解",
  "我想知道",
  "想搞清楚",
  "想理解",
  "想知道",
  "请解释一下",
  "请解释",
  "帮我梳理一下",
  "帮我梳理",
  "帮我总结一下",
  "帮我总结",
  "关于",
];

function trimAssetTitle(title: string): string {
  return title.replace(/\.(pdf|md|txt|pptx|docx)$/i, "").trim();
}

function extractQuotedTopic(text: string): string | null {
  const match = text.match(/[“"「]([^”"」]{2,24})[”"」]/u);
  return match?.[1]?.trim() ?? null;
}

function normalizeTopicSeed(raw: string): string {
  let seed = raw.trim();

  for (const prefix of LEADING_PROMPT_PREFIXES) {
    if (seed.startsWith(prefix)) {
      seed = seed.slice(prefix.length).trim();
      break;
    }
  }

  if (seed.startsWith("为什么要")) {
    seed = `${seed.replace(/^为什么要/u, "").trim()}的原因`;
  } else if (seed.startsWith("为什么")) {
    seed = `${seed.replace(/^为什么/u, "").trim()}的原因`;
  } else if (seed.startsWith("如何")) {
    seed = `${seed.replace(/^如何/u, "").trim()}的方法`;
  } else if (seed.startsWith("怎么")) {
    seed = `${seed.replace(/^怎么/u, "").trim()}的方法`;
  } else if (seed.startsWith("什么是")) {
    seed = seed.replace(/^什么是/u, "").trim();
  }

  return seed.replace(/^[：:，,\s]+|[：:，,。？！\s]+$/gu, "").trim();
}

function extractTopicSeed(text: string): string | null {
  const quotedTopic = extractQuotedTopic(text);
  if (quotedTopic !== null) {
    return normalizeTopicSeed(quotedTopic);
  }

  const clause = text
    .split(/[\n。？！?!]/u)[0]
    ?.split(/[，,；;]/u)[0]
    ?.trim();

  if (clause === undefined || clause === "") {
    return null;
  }

  const normalizedClause = normalizeTopicSeed(clause);
  if (normalizedClause === "") {
    return null;
  }

  return normalizedClause.length > 24
    ? normalizedClause.slice(0, 24).trim()
    : normalizedClause;
}

function buildSuggestionDescription({
  prompt,
  sourceAssets,
  title,
}: {
  prompt: string;
  sourceAssets: ReadonlyArray<SourceAsset>;
  title: string;
}): string {
  const normalizedPrompt = prompt.replace(/\s+/gu, " ").trim();
  const baseDescription =
    normalizedPrompt.length > 96
      ? `${normalizedPrompt.slice(0, 96).trim()}...`
      : normalizedPrompt;

  if (sourceAssets.length === 0) {
    return baseDescription === ""
      ? `围绕「${title}」沉淀一个后续可学习、可复习的独立知识点。`
      : baseDescription;
  }

  const sourceLabel = sourceAssets
    .slice(0, 2)
    .map((asset) => trimAssetTitle(asset.title))
    .join("、");
  return `${baseDescription || `围绕「${title}」沉淀一条知识点。`} 来源材料：${sourceLabel}`;
}

export function buildKnowledgePointSuggestion({
  existingKnowledgePoints,
  projectId,
  prompt,
  sessionId,
  sourceAssets,
}: {
  existingKnowledgePoints: ReadonlyArray<KnowledgePointItem>;
  projectId: string;
  prompt: string;
  sessionId: string;
  sourceAssets: ReadonlyArray<SourceAsset>;
}): KnowledgePointSuggestion | null {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.length < 6 && sourceAssets.length === 0) {
    return null;
  }

  const extractedTopic =
    extractTopicSeed(normalizedPrompt) ??
    trimAssetTitle(sourceAssets[0]?.title ?? "");
  const title = extractedTopic.replace(/\s+/gu, " ").trim();

  if (title === "" || title.length < 2) {
    return null;
  }

  const normalizedTitle = title.toLowerCase();
  const hasExistingPoint = existingKnowledgePoints.some(
    (point) => point.title.trim().toLowerCase() === normalizedTitle,
  );
  if (hasExistingPoint) {
    return null;
  }

  return {
    id: `kp-suggestion-${Date.now()}`,
    sessionId,
    projectId,
    title,
    description: buildSuggestionDescription({
      prompt: normalizedPrompt,
      sourceAssets,
      title,
    }),
    reason:
      sourceAssets.length > 0
        ? `这轮 project chat 已经围绕这个主题讨论，并且引用了 ${sourceAssets.length} 份材料，适合先沉淀成候选知识点。`
        : "这轮 project chat 已经在围绕这个主题持续追问，适合先沉淀成候选知识点。",
    sourceAssetIds: sourceAssets.map((asset) => asset.id),
    acceptedKnowledgePointId: null,
  };
}
