import { Page } from "@sidioralabs/rex/client";
import Mark from "../../../../../components/Mark.tsx";
import { REPOSITORY_URL } from "../../../../../components/Shell.tsx";
import { Separator } from "../../../../../components/ui/separator.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

const SIDIORA_LABS_URL = "https://github.com/Sidiora-Labs";

interface FooterLink {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly external: boolean;
}

const LINKS: readonly FooterLink[] = [
  { id: "repository", label: "Repository", href: REPOSITORY_URL, external: true },
  {
    id: "license",
    label: "MIT License",
    href: `${REPOSITORY_URL}/blob/main/LICENSE`,
    external: true,
  },
  { id: "sidiora", label: "Sidiora Labs", href: SIDIORA_LABS_URL, external: true },
  { id: "docs", label: "Docs", href: "/docs", external: false },
  { id: "changelog", label: "Changelog", href: "/changelog", external: false },
  { id: "about", label: "About", href: "/about", external: false },
];

export default function Footer() {
  return (
    <footer data-site-footer="" className="flex flex-col gap-4">
      <Separator />
      <Page.Stack space={3}>
        <Mark className="h-8 w-auto" />
        <Typography variant="h3" as="h2">
          Rex by Sidiora Labs
        </Typography>
        <Typography variant="muted">
          Rex is open source under the MIT License and built in the open on GitHub. This site is a
          Rex app, built from the repository it documents.
        </Typography>
        <nav aria-label="Footer">
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0">
            {LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={link.href}
                  data-site-footer-link={link.id}
                  {...(link.external ? { rel: "noopener" } : {})}
                  className="focus-ring inline-flex min-h-11 items-center rounded-lg text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Page.Stack>
    </footer>
  );
}
