import { region } from "@sidioralabs/rex/client";
import { REPOSITORY_URL } from "../../../../components/Shell.tsx";
import { Card, CardContent, CardHeader } from "../../../../components/ui/card.tsx";
import { Typography } from "../../../../components/ui/typography.tsx";

export default region("sidiora", () => (
  <Card>
    <CardHeader>
      <Typography variant="h4" as="h2">
        Sidiora Labs
      </Typography>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <Typography variant="p" className="m-0">
        Rex is built and stewarded by Sidiora Labs and developed in the open on GitHub. The people
        who maintain it, and what each of them may do, are listed in the maintainers file.
      </Typography>
      <ul aria-label="Sidiora Labs links" className="m-0 flex list-none flex-col p-0">
        <li>
          <a
            href={`${REPOSITORY_URL}/blob/main/MAINTAINERS.md`}
            data-site-repository-file="MAINTAINERS.md"
            rel="noopener"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            MAINTAINERS.md
          </a>
        </li>
        <li>
          <a
            href="https://github.com/Sidiora-Labs"
            rel="noopener"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            Sidiora Labs on GitHub
          </a>
        </li>
        <li>
          <a
            href={REPOSITORY_URL}
            rel="noopener"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            The rex-js repository
          </a>
        </li>
      </ul>
    </CardContent>
  </Card>
));
