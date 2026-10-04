import { region } from "@sidioralabs/rex/client";
import { REPOSITORY_URL } from "../../../../components/Shell.tsx";
import { Card, CardContent, CardHeader } from "../../../../components/ui/card.tsx";
import { Typography } from "../../../../components/ui/typography.tsx";

export default region("governance", () => (
  <Card>
    <CardHeader>
      <Typography variant="h4" as="h2">
        Governance
      </Typography>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <Typography variant="p" className="m-0">
        The spec is the record: every accepted change is described in a feature spec under spec/
        before it is built, and decisions, reviews and votes happen in public on the repository.
      </Typography>
      <ul aria-label="Governance links" className="m-0 flex list-none flex-col p-0">
        <li>
          <a
            href={`${REPOSITORY_URL}/blob/main/GOVERNANCE.md`}
            data-site-repository-file="GOVERNANCE.md"
            rel="noopener"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            GOVERNANCE.md
          </a>
        </li>
        <li>
          <a
            href={`${REPOSITORY_URL}/blob/main/spec/workflow.kvx`}
            data-site-repository-file="spec/workflow.kvx"
            rel="noopener"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            spec/workflow.kvx
          </a>
        </li>
      </ul>
    </CardContent>
  </Card>
));
