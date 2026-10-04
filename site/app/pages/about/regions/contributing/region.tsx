import { region } from "@sidioralabs/rex/client";
import { REPOSITORY_URL } from "../../../../components/Shell.tsx";
import { Card, CardContent, CardHeader } from "../../../../components/ui/card.tsx";
import { Typography } from "../../../../components/ui/typography.tsx";

export default region("contributing", () => (
  <Card>
    <CardHeader>
      <Typography variant="h4" as="h2">
        Contributing
      </Typography>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <Typography variant="p" className="m-0">
        People and agents contribute through the same contract: take a task from the active
        feature's spec, edit only the files it touches, qualify it once and commit it in the house
        format.
      </Typography>
      <ul aria-label="Contributing links" className="m-0 flex list-none flex-col p-0">
        <li>
          <a
            href={`${REPOSITORY_URL}/blob/main/CONTRIBUTING.md`}
            data-site-repository-file="CONTRIBUTING.md"
            rel="noopener"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            CONTRIBUTING.md
          </a>
        </li>
        <li>
          <a
            href={`${REPOSITORY_URL}/blob/main/docs/development.md`}
            data-site-repository-file="docs/development.md"
            rel="noopener"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            docs/development.md
          </a>
        </li>
        <li>
          <a
            href={`${REPOSITORY_URL}/blob/main/CODE_OF_CONDUCT.md`}
            data-site-repository-file="CODE_OF_CONDUCT.md"
            rel="noopener"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            CODE_OF_CONDUCT.md
          </a>
        </li>
      </ul>
    </CardContent>
  </Card>
));
