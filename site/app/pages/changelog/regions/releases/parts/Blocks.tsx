import type { ActionOutput } from "@sidioralabs/rex";
import type { readChangelog } from "../../../../../actions/changelog/read-changelog.ts";
import InlineText from "./InlineText.tsx";

type Block = ActionOutput<typeof readChangelog>["intro"][number];
type LeafBlock = Exclude<Block, { readonly kind: "details" }>;

export interface BlocksProps {
  readonly blocks: readonly Block[];
}

function Leaf({ block }: { readonly block: LeafBlock }) {
  if (block.kind === "paragraph") {
    return (
      <p className="m-0 leading-7">
        <InlineText inlines={block.inlines} />
      </p>
    );
  }
  return (
    <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 leading-7">
      {block.items.map((item, index) => (
        <li key={index} className="break-words">
          <InlineText inlines={item} />
        </li>
      ))}
    </ul>
  );
}

export default function Blocks({ blocks }: BlocksProps) {
  return (
    <>
      {blocks.map((block, index) =>
        block.kind === "details" ? (
          <details key={index} className="rounded-xl border border-border">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium">
              <InlineText inlines={block.summary} />
            </summary>
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm">
              {block.blocks.map((leaf, leafIndex) => (
                <Leaf key={leafIndex} block={leaf} />
              ))}
            </div>
          </details>
        ) : (
          <Leaf key={index} block={block} />
        ),
      )}
    </>
  );
}
