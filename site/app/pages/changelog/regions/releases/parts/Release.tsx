import type { ActionOutput } from "@sidioralabs/rex";
import type { readChangelog } from "../../../../../actions/read-changelog.ts";
import { Separator } from "../../../../../components/ui/separator.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";
import Blocks from "./Blocks.tsx";

export interface ReleaseProps {
  readonly release: ActionOutput<typeof readChangelog>["releases"][number];
}

export default function Release({ release }: ReleaseProps) {
  return (
    <article
      aria-labelledby={release.slug}
      data-site-release={release.version}
      className="flex flex-col gap-5"
    >
      <Separator />
      <Typography variant="h2" as="h2" id={release.slug}>
        {release.version}
      </Typography>
      <Blocks blocks={release.blocks} />
      {release.sections.map((section) => (
        <section
          key={section.slug}
          aria-labelledby={section.slug}
          data-site-release-section={section.title}
          className="flex flex-col gap-3"
        >
          <Typography variant="h4" as="h3" id={section.slug}>
            {section.title}
          </Typography>
          <Blocks blocks={section.blocks} />
        </section>
      ))}
    </article>
  );
}
