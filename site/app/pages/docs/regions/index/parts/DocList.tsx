import { Page } from "@sidioralabs/rex/client";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../../components/ui/card.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

interface DocListEntry {
  readonly slug: string;
  readonly title: string;
  readonly route: string;
  readonly summary: string;
}

interface DocListProps {
  readonly title: string;
  readonly docs: readonly DocListEntry[];
}

export default function DocList({ title, docs }: DocListProps) {
  return (
    <div data-site-doc-list={title} className="flex flex-col gap-4">
      <Typography variant="h3" as="h2" className="m-0">
        {title}
      </Typography>
      <Page.Grid columns={2} space={4}>
        {docs.map((doc) => (
          <a
            key={doc.route}
            href={doc.route}
            data-site-doc={doc.slug}
            className="focus-ring block rounded-xl no-underline pointer-coarse:min-h-11"
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <Typography variant="h4" as="h3" className="m-0">
                    {doc.title}
                  </Typography>
                </CardTitle>
                <CardDescription className="line-clamp-3">{doc.summary}</CardDescription>
              </CardHeader>
            </Card>
          </a>
        ))}
      </Page.Grid>
    </div>
  );
}
