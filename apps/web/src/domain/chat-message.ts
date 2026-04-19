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

function normalizeComparableText(text: string): string {
  return text.replace(/\s+/g, "").trim().toLowerCase();
}

function getMessageSignature(message: UIMessage): string {
  return `${message.role}:${normalizeComparableText(getMessageText(message))}`;
}

function pickPreferredMessage(left: UIMessage, right: UIMessage): UIMessage {
  const leftText = getMessageText(left);
  const rightText = getMessageText(right);
  if (rightText.length > leftText.length) {
    return right;
  }
  if (leftText.length > rightText.length) {
    return left;
  }
  return right;
}

function dedupeMessagesById(messages: ReadonlyArray<UIMessage>): UIMessage[] {
  const ordered: UIMessage[] = [];
  const indexById = new Map<string, number>();

  for (const message of messages) {
    const existingIndex = indexById.get(message.id);
    if (existingIndex === undefined) {
      indexById.set(message.id, ordered.length);
      ordered.push(message);
      continue;
    }

    ordered[existingIndex] = pickPreferredMessage(ordered[existingIndex] as UIMessage, message);
  }

  return ordered;
}

function areCompatibleAlignedMessages(
  left: ReadonlyArray<UIMessage>,
  right: ReadonlyArray<UIMessage>,
): boolean {
  return left.every((message, index) => {
    const next = right[index];
    if (next === undefined || message.role !== next.role) {
      return false;
    }

    const leftText = normalizeComparableText(getMessageText(message));
    const rightText = normalizeComparableText(getMessageText(next));
    return (
      leftText === rightText ||
      leftText.startsWith(rightText) ||
      rightText.startsWith(leftText)
    );
  });
}

function areMessagesEquivalent(left: UIMessage, right: UIMessage): boolean {
  if (left.role !== right.role) {
    return false;
  }

  const leftText = normalizeComparableText(getMessageText(left));
  const rightText = normalizeComparableText(getMessageText(right));
  return (
    leftText === rightText ||
    leftText.startsWith(rightText) ||
    rightText.startsWith(leftText)
  );
}

function getHistoryTextLength(messages: ReadonlyArray<UIMessage>): number {
  return messages.reduce((total, message) => total + getMessageText(message).length, 0);
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
  const normalizedBase = dedupeMessagesById(base);
  const normalizedIncoming = dedupeMessagesById(incoming);

  if (normalizedIncoming.length === 0) {
    return [...normalizedBase];
  }
  if (normalizedBase.length === 0) {
    return [...normalizedIncoming];
  }
  if (areSameMessageHistory(normalizedBase, normalizedIncoming)) {
    return [...normalizedBase];
  }
  if (
    normalizedBase.length === normalizedIncoming.length &&
    areCompatibleAlignedMessages(normalizedBase, normalizedIncoming)
  ) {
    return getHistoryTextLength(normalizedBase) >= getHistoryTextLength(normalizedIncoming)
      ? [...normalizedBase]
      : [...normalizedIncoming];
  }
  if (
    normalizedBase.length >= normalizedIncoming.length &&
    hasMatchingPrefix(normalizedBase, normalizedIncoming)
  ) {
    return [...normalizedBase];
  }
  if (
    normalizedIncoming.length >= normalizedBase.length &&
    hasMatchingPrefix(normalizedIncoming, normalizedBase)
  ) {
    return [...normalizedIncoming];
  }

  const unmatchedIncoming = normalizedIncoming.filter(
    (incomingMessage) =>
      !normalizedBase.some((baseMessage) =>
        areMessagesEquivalent(baseMessage, incomingMessage),
      ),
  );

  return dedupeMessagesById([...normalizedBase, ...unmatchedIncoming]);
}
