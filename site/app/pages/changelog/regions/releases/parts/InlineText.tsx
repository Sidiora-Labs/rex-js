import type { ActionOutput } from "@sidioralabs/rex";
import type { readChangelog } from "../../../../../actions/read-changelog.ts";

type Block = ActionOutput<typeof readChangelog>["intro"][number];
type Inline = Extract<Block, { readonly kind: "paragraph" }>["inlines"][number];
type LeafInline = Exclude<Inline, { readonly kind: "link" }>;

export interface InlineTextProps {
  readonly inlines: readonly Inline[];
}

function Leaf({ inline }: { readonly inline: LeafInline }) {
  if (inline.kind === "code") {
    return (
      <code className="rounded-xs bg-container px-1 py-0.5 font-mono text-sm">{inline.text}</code>
    );
  }
  if (inline.kind === "strong") return <strong>{inline.text}</strong>;
  return <>{inline.text}</>;
}

export default function InlineText({ inlines }: InlineTextProps) {
  return (
    <>
      {inlines.map((inline, index) =>
        inline.kind === "link" ? (
          <a
            key={index}
            href={inline.href}
            rel="noopener"
            className="text-primary underline underline-offset-4"
          >
            {inline.children.map((child, childIndex) => (
              <Leaf key={childIndex} inline={child} />
            ))}
          </a>
        ) : (
          <Leaf key={index} inline={inline} />
        ),
      )}
    </>
  );
}
