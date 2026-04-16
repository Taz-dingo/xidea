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
