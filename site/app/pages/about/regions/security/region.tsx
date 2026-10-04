import { region } from "@sidioralabs/rex/client";
import { REPOSITORY_URL } from "../../../../components/Shell.tsx";
import { Card, CardContent, CardHeader } from "../../../../components/ui/card.tsx";
import { Typography } from "../../../../components/ui/typography.tsx";

export default region("security", () => (
  <Card>
    <CardHeader>
      <Typography variant="h4" as="h2">
        Security
      </Typography>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <Typography variant="p" className="m-0">
        Report a vulnerability privately through GitHub's private vulnerability reporting, never in
        a public issue. Supported versions and how reports are handled are in the security policy.
      </Typography>
      <ul aria-label="Security links" className="m-0 flex list-none flex-col p-0">
        <li>
          <a
            href={`${REPOSITORY_URL}/blob/main/SECURITY.md`}
            data-site-repository-file="SECURITY.md"
            rel="noopener"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            SECURITY.md
          </a>
        </li>
        <li>
          <a
            href={`${REPOSITORY_URL}/security/advisories/new`}
            rel="noopener"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            Report a vulnerability
          </a>
        </li>
      </ul>
    </CardContent>
  </Card>
));
