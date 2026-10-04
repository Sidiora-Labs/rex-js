import { Badge } from "../../../../../components/ui/badge.tsx";
import { Separator } from "../../../../../components/ui/separator.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface ErrorDetailProps {
  readonly code: string;
  readonly prefix: string;
  readonly areaTitle: string;
  readonly message: string;
  readonly hint: string;
  readonly docs: string;
  readonly doc: { readonly title: string; readonly href: string };
  readonly catalogHref: string;
}

export default function ErrorDetail({
  code,
  prefix,
  areaTitle,
  message,
  hint,
  docs,
  doc,
  catalogHref,
}: ErrorDetailProps) {
  return (
    <article aria-labelledby="error-code" data-site-error={code} className="flex flex-col gap-6">
      <a
        href={catalogHref}
        className="focus-ring inline-flex min-h-11 w-fit items-center rounded-sm text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        All error codes
      </a>
      <div className="flex flex-col gap-3">
        <Typography variant="h1" as="h1" id="error-code" className="font-mono">
          {code}
        </Typography>
        <Badge variant="tonal" data-site-error-area={prefix}>
          {prefix}xx {areaTitle}
        </Badge>
        <Typography variant="lead" data-site-error-message="">
          {message}
        </Typography>
      </div>
      <Separator />
      <section aria-labelledby="error-hint" className="flex flex-col gap-2">
        <Typography variant="h4" as="h2" id="error-hint">
          How to fix it
        </Typography>
        <Typography variant="p" data-site-error-hint="">
          {hint}
        </Typography>
      </section>
      <section aria-labelledby="error-docs" className="flex flex-col gap-2">
        <Typography variant="h4" as="h2" id="error-docs">
          Where this page is linked from
        </Typography>
        <Typography variant="p">
          Rex prints this address with every {code} it raises, in the terminal, the Vite overlay and
          the devtools:
        </Typography>
        <Typography variant="code" data-site-error-docs="" className="w-fit break-all">
          {docs}
        </Typography>
        <Typography variant="p">
          The {areaTitle.toLowerCase()} errors are explained in{" "}
          <a
            href={doc.href}
            data-site-error-doc=""
            className="focus-ring inline-flex min-h-11 items-center rounded-sm underline underline-offset-4"
          >
            {doc.title}
          </a>
          .
        </Typography>
      </section>
    </article>
  );
}
