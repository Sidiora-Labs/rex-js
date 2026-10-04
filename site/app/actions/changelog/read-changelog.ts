import { action, always } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { readChangelog as readChangelogFile } from "../../server/content/changelog.ts";

const leafInline = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("code"), text: z.string() }),
  z.object({ kind: z.literal("strong"), text: z.string() }),
]);

const inline = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("code"), text: z.string() }),
  z.object({ kind: z.literal("strong"), text: z.string() }),
  z.object({ kind: z.literal("link"), href: z.string(), children: z.array(leafInline) }),
]);

const paragraph = z.object({ kind: z.literal("paragraph"), inlines: z.array(inline) });
const list = z.object({ kind: z.literal("list"), items: z.array(z.array(inline)) });
const leafBlock = z.discriminatedUnion("kind", [paragraph, list]);
const block = z.discriminatedUnion("kind", [
  paragraph,
  list,
  z.object({ kind: z.literal("details"), summary: z.array(inline), blocks: z.array(leafBlock) }),
]);

export const readChangelog = action("read-changelog", {
  input: z.object({}),
  output: z.object({
    source: z.string(),
    title: z.string(),
    intro: z.array(block),
    releases: z.array(
      z.object({
        version: z.string(),
        slug: z.string(),
        blocks: z.array(block),
        sections: z.array(
          z.object({ title: z.string(), slug: z.string(), blocks: z.array(block) }),
        ),
      }),
    ),
  }),
  policy: always(),
  effect: "read",
  label: "Read the changelog",
  handler: () => readChangelogFile(),
});
