import type { UIMessage } from "ai";

export function sanitizeVisibleAssistantText(text: string): string {
  const withoutThinkBlocks = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "");
  const withoutDanglingThink = withoutThinkBlocks.replace(/<think\b[^>]*>[\s\S]*$/i, "");
  const withoutWrappers = withoutDanglingThink
    .replace(/^\s*<(answer|output|response|result|json)\b[^>]*>\s*/i, "")
    .replace(/\s*<\/(answer|output|response|result|json)>\s*$/i, "");
  return withoutWrappers.trim();
}

export function getMessageText(message: UIMessage): string {
  const textFromParts = message.parts
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
  const fallbackText =
    typeof (message as { content?: unknown }).content === "string"
      ? (message as { content?: string }).content ?? ""
      : "";
  const text = (textFromParts || fallbackText).trim();
  const visibleText = message.role === "assistant" ? sanitizeVisibleAssistantText(text) : text;

  if (visibleText === "" && message.role === "assistant") {
    return "";
  }

  return visibleText === "" ? "当前消息没有文本内容。" : visibleText;
}

export function getLatestUserDraft(
  messages: ReadonlyArray<UIMessage>,
  draftPrompt: string,
): string {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (latestUserMessage !== undefined) {
    const text = getMessageText(latestUserMessage);
    if (text !== "当前消息没有文本内容。") {
      return text;
    }
  }

  return draftPrompt.trim();
}

function getMessageSignature(message: UIMessage): string {
  return `${message.role}:${getMessageText(message)}`;
}

function hasMatchingPrefix(
  left: ReadonlyArray<UIMessage>,
  right: ReadonlyArray<UIMessage>,
): boolean {
  return right.every(
    (message, index) => getMessageSignature(left[index] as UIMessage) === getMessageSignature(message),
  );
}

export function areSameMessageHistory(
  left: ReadonlyArray<UIMessage>,
  right: ReadonlyArray<UIMessage>,
): boolean {
  return (
    left.length === right.length &&
    left.every((message, index) => getMessageSignature(message) === getMessageSignature(right[index] as UIMessage))
  );
}

export function mergeMessageHistory(
  base: ReadonlyArray<UIMessage>,
  incoming: ReadonlyArray<UIMessage>,
): UIMessage[] {
  if (incoming.length === 0) {
    return [...base];
  }
  if (base.length === 0) {
    return [...incoming];
  }
  if (areSameMessageHistory(base, incoming)) {
    return [...base];
  }
  if (base.length >= incoming.length && hasMatchingPrefix(base, incoming)) {
    return [...base];
  }
  if (incoming.length >= base.length && hasMatchingPrefix(incoming, base)) {
    return [...incoming];
  }

  const baseSignatures = base.map(getMessageSignature);
  const incomingSignatures = incoming.map(getMessageSignature);

  for (
    let overlap = Math.min(baseSignatures.length, incomingSignatures.length);
    overlap > 0;
    overlap -= 1
  ) {
    const baseTail = baseSignatures.slice(-overlap);
    const incomingHead = incomingSignatures.slice(0, overlap);
    const matched = baseTail.every((signature, index) => signature === incomingHead[index]);
    if (matched) {
      return [...base, ...incoming.slice(overlap)];
    }
  }

  return [...base, ...incoming];
}
