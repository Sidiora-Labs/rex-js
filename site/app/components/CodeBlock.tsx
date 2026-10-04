import type { ReactNode } from "react";

export interface CodeBlockProps {
  readonly code: string;
  readonly language: string;
  readonly caption?: ReactNode;
}

export default function CodeBlock({ code, language, caption }: CodeBlockProps) {
  return (
    <figure data-site-code={language} className="m-0 flex min-w-0 flex-col gap-2">
      <pre className="m-0 min-w-0 rounded-lg border border-border bg-container p-4 font-mono text-[13px] leading-6 break-words whitespace-pre-wrap text-foreground">
        <code data-site-code-body={language}>{code}</code>
      </pre>
      {caption === undefined ? null : (
        <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  );
}
