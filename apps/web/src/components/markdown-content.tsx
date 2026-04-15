import type { ReactElement, ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const inlinePattern =
    /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;

  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] !== undefined && match[3] !== undefined) {
      nodes.push(
        <a
          className="text-[var(--xidea-selection-text)] underline underline-offset-4"
          href={match[3]}
          key={`${keyPrefix}-link-${match.index}`}
          rel="noreferrer"
          target="_blank"
        >
          {match[2]}
        </a>,
      );
    } else if (match[5] !== undefined) {
      nodes.push(
        <code
          className="rounded bg-[var(--xidea-parchment)] px-1.5 py-0.5 text-[0.95em] text-[var(--xidea-near-black)]"
          key={`${keyPrefix}-code-${match.index}`}
        >
          {match[5]}
        </code>,
      );
    } else if (match[7] !== undefined) {
      nodes.push(
        <strong className="font-semibold text-[var(--xidea-near-black)]" key={`${keyPrefix}-strong-${match.index}`}>
          {match[7]}
        </strong>,
      );
    } else if (match[9] !== undefined) {
      nodes.push(
        <em className="italic" key={`${keyPrefix}-em-${match.index}`}>
          {match[9]}
        </em>,
      );
    }

    lastIndex = inlinePattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderParagraph(text: string, key: string): ReactElement {
  return (
    <p className="text-[14px] leading-6 text-[var(--xidea-charcoal)]" key={key}>
      {renderInline(text, key)}
    </p>
  );
}

export function MarkdownContent({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}): ReactElement {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let bulletBuffer: string[] = [];
  let orderedBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }
    nodes.push(renderParagraph(paragraphBuffer.join(" "), `paragraph-${nodes.length}`));
    paragraphBuffer = [];
  };

  const flushBullets = () => {
    if (bulletBuffer.length === 0) {
      return;
    }
    nodes.push(
      <ul className="list-disc space-y-1 pl-5 text-[14px] leading-6 text-[var(--xidea-charcoal)]" key={`bullets-${nodes.length}`}>
        {bulletBuffer.map((item, index) => (
          <li key={`bullet-${index}`}>{renderInline(item, `bullet-${index}`)}</li>
        ))}
      </ul>,
    );
    bulletBuffer = [];
  };

  const flushOrdered = () => {
    if (orderedBuffer.length === 0) {
      return;
    }
    nodes.push(
      <ol className="list-decimal space-y-1 pl-5 text-[14px] leading-6 text-[var(--xidea-charcoal)]" key={`ordered-${nodes.length}`}>
        {orderedBuffer.map((item, index) => (
          <li key={`ordered-item-${index}`}>{renderInline(item, `ordered-${index}`)}</li>
        ))}
      </ol>,
    );
    orderedBuffer = [];
  };

  const flushCode = () => {
    if (codeBuffer.length === 0) {
      return;
    }
    nodes.push(
      <pre
        className="overflow-x-auto rounded-[0.9rem] bg-[var(--xidea-parchment)] px-3 py-2.5 text-[13px] leading-6 text-[var(--xidea-near-black)]"
        key={`code-${nodes.length}`}
      >
        <code>{codeBuffer.join("\n")}</code>
      </pre>,
    );
    codeBuffer = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushBullets();
      flushOrdered();
      if (inCodeBlock) {
        flushCode();
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushBullets();
      flushOrdered();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch !== null) {
      flushParagraph();
      flushBullets();
      flushOrdered();
      const level = (headingMatch[1] ?? "").length;
      const title = headingMatch[2] ?? "";
      const headingClass =
        level === 1
          ? "text-lg font-semibold"
          : level === 2
            ? "text-base font-semibold"
            : "text-sm font-semibold uppercase tracking-[0.08em] text-[var(--xidea-stone)]";
      nodes.push(
        <p className={`${headingClass} text-[var(--xidea-near-black)]`} key={`heading-${nodes.length}`}>
          {renderInline(title, `heading-${nodes.length}`)}
        </p>,
      );
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch !== null) {
      flushParagraph();
      flushOrdered();
      bulletBuffer.push(bulletMatch[1] ?? "");
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch !== null) {
      flushParagraph();
      flushBullets();
      orderedBuffer.push(orderedMatch[1] ?? "");
      continue;
    }

    paragraphBuffer.push(line.trim());
  }

  flushParagraph();
  flushBullets();
  flushOrdered();
  flushCode();

  return <div className={`space-y-3 ${className}`.trim()}>{nodes}</div>;
}
