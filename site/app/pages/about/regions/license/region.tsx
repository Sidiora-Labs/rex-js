import { region } from "@sidioralabs/rex/client";
import { REPOSITORY_URL } from "../../../../components/Shell.tsx";
import { Card, CardContent, CardHeader } from "../../../../components/ui/card.tsx";
import { Typography } from "../../../../components/ui/typography.tsx";

export default region("license", () => (
  <Card>
    <CardHeader>
      <Typography variant="h4" as="h2">
        License
      </Typography>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <Typography variant="p" className="m-0">
        Rex is released under the MIT License, copyright 2026 Sidiora Labs.
      </Typography>
      <ul aria-label="License links" className="m-0 flex list-none flex-col p-0">
        <li>
          <a
            href={`${REPOSITORY_URL}/blob/main/LICENSE`}
            data-site-repository-file="LICENSE"
            rel="noopener"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            LICENSE
          </a>
        </li>
      </ul>
    </CardContent>
  </Card>
));
