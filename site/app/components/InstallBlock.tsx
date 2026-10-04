import CodeBlock from "./CodeBlock.tsx";
import { Badge } from "./ui/badge.tsx";

export const INSTALL_COMMANDS: readonly string[] = [
  "pnpm dlx @sidioralabs/rex new my-app",
  "cd my-app",
  "pnpm rex dev",
];

export interface InstallBlockProps {
  readonly version: string;
}

export default function InstallBlock({ version }: InstallBlockProps) {
  return (
    <div data-site-install="" className="flex min-w-0 flex-col gap-3">
      <Badge variant="tonal">
        @sidioralabs/rex <span data-site-fact="version">{version}</span>
      </Badge>
      <CodeBlock
        language="sh"
        code={INSTALL_COMMANDS.join("\n")}
        caption={
          <>
            Rex <span data-site-fact="version">{version}</span> is published to npm with the
            release. rex new installs the DesignX standard set, and rex dev serves the app with hot
            reload.
          </>
        }
      />
    </div>
  );
}
