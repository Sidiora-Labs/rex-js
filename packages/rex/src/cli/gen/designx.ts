import { UI_KITS, type UiKit } from "../../core/config.ts";
import { titleFromId } from "../../core/page.ts";
import { DESIGNX_MAP } from "../../designx/index.ts";
import type { PlannedEntry, PlannedFile } from "../commands/make.ts";
import {
  DESIGNX_CONFIG_FILE,
  formatDesignxFiles,
  withDesignxDependencies,
  withDesignxStylesheet,
  type DesignxInstall,
} from "../designx.ts";
import type { RexNewContext, RexNewGenerator } from "../generators.ts";
import { CLIENT_IMPORT, CORE_IMPORT, appPaths } from "../templates.ts";

export const DEFAULT_UI: UiKit = "designx";
export const DESIGNX_BUTTON = "app/components/Button.tsx";
export const DESIGNX_CONFIG = "rex.config.ts";
export const DESIGNX_SHELL = "app/components/Shell.tsx";

export interface DesignxHome {
  readonly page: string;
  readonly region: string;
  readonly part: string;
}

export function designxStatesPath(home: DesignxHome): string {
  return appPaths.states(home.page);
}

export function designxPartPath(home: DesignxHome): string {
  return appPaths.part(home.page, home.region, home.part);
}

export function designxTemplatePaths(home: DesignxHome): readonly string[] {
  return [DESIGNX_BUTTON, DESIGNX_SHELL, designxStatesPath(home), designxPartPath(home)];
}

function lines(...parts: readonly (string | readonly string[])[]): string {
  return `${parts.flat().join("\n")}\n`;
}

function only(forms: Readonly<Record<"default", string>>): string {
  return forms.default;
}

function uiModule(from: string, item: string): string {
  return `${from}/${item}.tsx`;
}

export function designxShellTemplate(): string {
  const ui = "./ui";
  const nav = DESIGNX_MAP.nav;
  const sheet = DESIGNX_MAP.sheet;
  return lines(
    "import {",
    "  outcomeStatusText,",
    "  useOutcome,",
    "  type ShellButtonProps,",
    "  type ShellNavProps,",
    "  type ShellOutcomeProps,",
    "  type ShellPaletteItemProps,",
    "  type ShellSheetProps,",
    `} from "${CLIENT_IMPORT}";`,
    `import { Alert, AlertDescription, AlertTitle } from "${uiModule(ui, only(DESIGNX_MAP.outcome))}";`,
    `import { Badge } from "${uiModule(ui, only(DESIGNX_MAP.badge))}";`,
    `import { Button as DesignxButton } from "${uiModule(ui, only(DESIGNX_MAP.button))}";`,
    `import { CommandShortcut } from "${uiModule(ui, only(DESIGNX_MAP.paletteItem))}";`,
    `import { DialogHeader } from "${uiModule(ui, sheet.dialog)}";`,
    `import { Kbd } from "${uiModule(ui, only(DESIGNX_MAP.kbd))}";`,
    "import {",
    "  NavigationMenu,",
    "  NavigationMenuItem,",
    "  NavigationMenuLink,",
    "  NavigationMenuList,",
    `} from "${uiModule(ui, nav.bar)}";`,
    `import { SheetHeader } from "${uiModule(ui, sheet["bottom-sheet"])}";`,
    `import { SidebarMenu, SidebarMenuItem } from "${uiModule(ui, nav.sidebar)}";`,
    `import { Toolbar, ToolbarLink } from "${uiModule(ui, nav.dock)}";`,
    "",
    'const NAV_TARGET = "pointer-coarse:min-h-11";',
    "",
    'export function Button({ type = "button", ...props }: ShellButtonProps) {',
    '  return <DesignxButton type={type} variant="outline" {...props} />;',
    "}",
    "",
    "export function Sheet({ title, titleId, form, children }: ShellSheetProps) {",
    '  if (form === "bottom-sheet") {',
    "    return (",
    "      <div",
    '        data-slot="sheet-content"',
    '        data-side="bottom"',
    "        data-rex-sheet-form={form}",
    '        className="flex flex-col gap-4 rounded-t-xl bg-popover pb-6 text-popover-foreground shadow-float"',
    "      >",
    "        <SheetHeader>",
    '          <h2 id={titleId} className="m-0 text-lg font-medium">',
    "            {title}",
    "          </h2>",
    "        </SheetHeader>",
    '        <div className="flex flex-col gap-3 px-6">{children}</div>',
    "      </div>",
    "    );",
    "  }",
    "  return (",
    "    <div",
    '      data-slot="dialog-content"',
    "      data-rex-sheet-form={form}",
    '      className="grid gap-5 rounded-xl bg-popover p-6 text-popover-foreground shadow-float"',
    "    >",
    "      <DialogHeader>",
    '        <h2 id={titleId} className="m-0 text-xl font-medium">',
    "          {title}",
    "        </h2>",
    "      </DialogHeader>",
    '      <div className="flex flex-col gap-3">{children}</div>',
    "    </div>",
    "  );",
    "}",
    "",
    "export function PaletteItem({ label, detail, shortcut, allowed, reason }: ShellPaletteItemProps) {",
    "  return (",
    '    <span className="flex w-full items-center gap-2">',
    "      <span>{label}</span>",
    '      <code className="text-xs text-muted-foreground">{detail}</code>',
    '      {allowed ? null : <Badge variant="outline">Not allowed: {reason ?? ""}</Badge>}',
    "      {shortcut === null ? null : (",
    "        <CommandShortcut>",
    "          <Kbd>{shortcut}</Kbd>",
    "        </CommandShortcut>",
    "      )}",
    "    </span>",
    "  );",
    "}",
    "",
    "export function Outcome({ page }: ShellOutcomeProps) {",
    "  const outcome = useOutcome(page);",
    "  if (outcome === null) return null;",
    "  return (",
    '    <Alert variant={outcome.ok ? "success" : "destructive"} role="none">',
    "      <AlertTitle>{outcomeStatusText(outcome)}</AlertTitle>",
    "      <AlertDescription>{outcome.message}</AlertDescription>",
    "    </Alert>",
    "  );",
    "}",
    "",
    "export function Nav({ links, form }: ShellNavProps) {",
    "  if (links.length === 0) return null;",
    '  if (form === "bar") {',
    "    return (",
    '      <NavigationMenu aria-label="Pages" data-rex-nav-form={form}>',
    "        <NavigationMenuList>",
    "          {links.map((link) => (",
    "            <NavigationMenuItem key={link.id}>",
    "              <NavigationMenuLink",
    "                href={link.href}",
    "                active={link.current}",
    "                data-rex-nav={link.address}",
    "                onClick={link.onClick}",
    "                className={NAV_TARGET}",
    "              >",
    "                {link.label}",
    "              </NavigationMenuLink>",
    "            </NavigationMenuItem>",
    "          ))}",
    "        </NavigationMenuList>",
    "      </NavigationMenu>",
    "    );",
    "  }",
    '  if (form === "sidebar") {',
    "    return (",
    '      <nav aria-label="Pages" data-rex-nav-form={form}>',
    "        <SidebarMenu>",
    "          {links.map((link) => (",
    "            <SidebarMenuItem key={link.id}>",
    "              <a",
    "                href={link.href}",
    "                data-rex-nav={link.address}",
    "                data-active={link.current}",
    '                aria-current={link.current ? "page" : undefined}',
    "                onClick={link.onClick}",
    '                className="focus-ring flex h-9 w-full items-center rounded-full px-3 text-sm text-sidebar-foreground/80 pointer-coarse:min-h-11 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"',
    "              >",
    "                {link.label}",
    "              </a>",
    "            </SidebarMenuItem>",
    "          ))}",
    "        </SidebarMenu>",
    "      </nav>",
    "    );",
    "  }",
    "  return (",
    '    <nav aria-label="Pages" data-rex-nav-form={form}>',
    '      <Toolbar aria-label="Page links">',
    "        {links.map((link) => (",
    "          <ToolbarLink",
    "            key={link.id}",
    "            href={link.href}",
    "            data-rex-nav={link.address}",
    '            aria-current={link.current ? "page" : undefined}',
    "            onClick={link.onClick}",
    "            className={NAV_TARGET}",
    "          >",
    "            {link.label}",
    "          </ToolbarLink>",
    "        ))}",
    "      </Toolbar>",
    "    </nav>",
    "  );",
    "}",
  );
}

export function designxStatesTemplate(page: string): string {
  const ui = "../../components/ui";
  const states = DESIGNX_MAP.states;
  const title = titleFromId(page);
  const subject = title.toLowerCase();
  return lines(
    `import type { StateProps } from "${CORE_IMPORT}";`,
    `import { Alert, AlertDescription, AlertTitle } from "${uiModule(ui, states["terminal-error"])}";`,
    `import { Badge } from "${uiModule(ui, states.stale)}";`,
    `import { Button } from "${uiModule(ui, only(DESIGNX_MAP.button))}";`,
    "import {",
    "  Empty as EmptyFrame,",
    "  EmptyDescription,",
    "  EmptyHeader,",
    "  EmptyTitle,",
    `} from "${uiModule(ui, states.empty)}";`,
    `import { Skeleton } from "${uiModule(ui, states.loading)}";`,
    "",
    "export function Loading() {",
    "  return (",
    `    <div role="status" aria-label="Loading ${subject}" className="flex flex-col gap-3">`,
    '      <Skeleton className="h-6 w-1/3" />',
    '      <Skeleton className="h-4 w-full" />',
    '      <Skeleton className="h-4 w-2/3" />',
    "    </div>",
    "  );",
    "}",
    "",
    "export function Empty() {",
    "  return (",
    "    <EmptyFrame>",
    "      <EmptyHeader>",
    `        <EmptyTitle>Nothing in ${subject} yet</EmptyTitle>`,
    "        <EmptyDescription>New entries appear here.</EmptyDescription>",
    "      </EmptyHeader>",
    "    </EmptyFrame>",
    "  );",
    "}",
    "",
    "export function Stale({ retry }: StateProps) {",
    "  return (",
    '    <div role="status" className="flex flex-wrap items-center gap-3">',
    '      <Badge variant="warning">Stale</Badge>',
    `      <p className="m-0">${title} may be out of date</p>`,
    '      <Button variant="outline" onClick={retry}>',
    "        Refresh",
    "      </Button>",
    "    </div>",
    "  );",
    "}",
    "",
    "export function Partial({ retry }: StateProps) {",
    "  return (",
    '    <Alert variant="warning">',
    `      <AlertTitle>Part of ${subject} could not be loaded</AlertTitle>`,
    "      <AlertDescription>",
    '        <Button variant="outline" onClick={retry}>',
    "          Refresh",
    "        </Button>",
    "      </AlertDescription>",
    "    </Alert>",
    "  );",
    "}",
    "",
    "export function Offline({ retry }: StateProps) {",
    "  return (",
    '    <div role="status" className="flex flex-wrap items-center gap-3">',
    '      <Badge variant="info">Offline</Badge>',
    `      <p className="m-0">${title} will refresh when the connection returns</p>`,
    '      <Button variant="outline" onClick={retry}>',
    "        Refresh",
    "      </Button>",
    "    </div>",
    "  );",
    "}",
    "",
    "export function PermissionDenied() {",
    "  return (",
    '    <Alert variant="destructive">',
    `      <AlertTitle>You do not have access to ${subject}</AlertTitle>`,
    "    </Alert>",
    "  );",
    "}",
    "",
    "export function RecoverableError({ error, retry }: StateProps) {",
    "  return (",
    '    <Alert variant="destructive">',
    `      <AlertTitle>${title} failed to load</AlertTitle>`,
    "      <AlertDescription>",
    "        {error === null ? null : <p>{error.message}</p>}",
    '        <Button variant="outline" onClick={retry}>',
    "          Try again",
    "        </Button>",
    "      </AlertDescription>",
    "    </Alert>",
    "  );",
    "}",
    "",
    "export function TerminalError({ error }: StateProps) {",
    "  return (",
    '    <Alert variant="destructive">',
    `      <AlertTitle>${title} is unavailable</AlertTitle>`,
    "      {error === null ? null : <AlertDescription>{error.message}</AlertDescription>}",
    "    </Alert>",
    "  );",
    "}",
  );
}

export function designxPartTemplate(part: string): string {
  const ui = "../../../../../components/ui";
  const region = only(DESIGNX_MAP.region);
  return lines(
    'import { useState } from "react";',
    `import type { ActControlProps } from "${CLIENT_IMPORT}";`,
    `import { Button } from "${uiModule(ui, only(DESIGNX_MAP.button))}";`,
    "import {",
    "  Card,",
    "  CardContent,",
    "  CardDescription,",
    "  CardFooter,",
    "  CardHeader,",
    "  CardTitle,",
    `} from "${uiModule(ui, region)}";`,
    `import { Field, FieldLabel } from "${uiModule(ui, only(DESIGNX_MAP.field))}";`,
    `import { Input } from "${uiModule(ui, only(DESIGNX_MAP.input))}";`,
    "",
    `export default function ${part}(props: {`,
    "  readonly notes: readonly { readonly id: string; readonly name: string }[];",
    "  readonly actionLabel: string;",
    "  readonly control: ActControlProps;",
    "  readonly onAction: () => void;",
    "}) {",
    '  const [filter, setFilter] = useState("");',
    "  const query = filter.trim().toLowerCase();",
    "  const shown = props.notes.filter((note) => note.name.toLowerCase().includes(query));",
    "  return (",
    "    <Card>",
    "      <CardHeader>",
    "        <CardTitle>Notes</CardTitle>",
    "        <CardDescription>{shown.length} shown</CardDescription>",
    "      </CardHeader>",
    '      <CardContent className="flex flex-col gap-4">',
    "        <Field>",
    "          <FieldLabel>Filter notes</FieldLabel>",
    "          <Input value={filter} onValueChange={setFilter} />",
    "        </Field>",
    '        <ul className="m-0 flex flex-col gap-2 p-0">',
    "          {shown.map((note) => (",
    "            <li key={note.id}>{note.name}</li>",
    "          ))}",
    "        </ul>",
    "      </CardContent>",
    "      <CardFooter>",
    "        <Button {...props.control} onClick={props.onAction}>",
    "          {props.actionLabel}",
    "        </Button>",
    "      </CardFooter>",
    "    </Card>",
    "  );",
    "}",
  );
}

export async function formatDesignxTemplates(
  plan: readonly PlannedEntry[],
  home: DesignxHome,
): Promise<readonly PlannedEntry[]> {
  const targets = new Set(designxTemplatePaths(home));
  const chosen = plan.filter(
    (entry): entry is PlannedFile => entry.kind === "file" && targets.has(entry.path),
  );
  const formatted = new Map(
    (await formatDesignxFiles(chosen)).map((entry) => [entry.path, entry] as const),
  );
  return plan.map((entry) => formatted.get(entry.path) ?? entry);
}

export interface DesignxNewContext extends RexNewContext {
  readonly ui: UiKit;
  readonly designx: DesignxInstall | null;
  readonly home: DesignxHome;
}

export function isUiKit(value: unknown): value is UiKit {
  return typeof value === "string" && (UI_KITS as readonly string[]).includes(value);
}

export function designxOf(context: RexNewContext): DesignxInstall | null {
  if (!("ui" in context) || !("designx" in context)) return null;
  const { ui, designx } = context as DesignxNewContext;
  if (ui !== "designx") return null;
  if (designx === null) {
    throw new Error("rex new: ui designx needs the DesignX registry items fetched first");
  }
  return designx;
}

export function designxButtonTemplate(): string {
  return [
    'import type { ButtonHTMLAttributes } from "react";',
    'import { Button as DesignxButton } from "./ui/button.tsx";',
    "",
    "export default function Button({",
    '  type = "button",',
    "  ...props",
    "}: ButtonHTMLAttributes<HTMLButtonElement>) {",
    "  return <DesignxButton type={type} {...props} />;",
    "}",
    "",
  ].join("\n");
}

export function withDesignxUi(config: string): string {
  if (config.includes("\n  ui: ")) return config;
  return config.replace(
    "  app,\n",
    `  app,\n  ui: { kit: "designx", components: ${JSON.stringify(DESIGNX_SHELL)} },\n`,
  );
}

function replaced(entry: PlannedEntry, install: DesignxInstall, home: DesignxHome): PlannedEntry {
  if (entry.kind !== "file") return entry;
  switch (entry.path) {
    case "package.json":
      return {
        ...entry,
        content: withDesignxDependencies(entry.content, install),
      };
    case "index.html":
      return { ...entry, content: withDesignxStylesheet(entry.content) };
    case DESIGNX_CONFIG:
      return { ...entry, content: withDesignxUi(entry.content) };
    case DESIGNX_BUTTON:
      return { ...entry, content: designxButtonTemplate() };
    default:
      if (entry.path === designxStatesPath(home)) {
        return { ...entry, content: designxStatesTemplate(home.page) };
      }
      if (entry.path === designxPartPath(home)) {
        return { ...entry, content: designxPartTemplate(home.part) };
      }
      return entry;
  }
}

export const designxGenerator: RexNewGenerator = {
  id: "designx",
  contribute(plan, context) {
    const install = designxOf(context);
    if (install === null) return plan;
    if (!install.files.some((file) => file.path === DESIGNX_CONFIG_FILE)) {
      throw new Error(`rex new: the DesignX install has no ${DESIGNX_CONFIG_FILE}`);
    }
    return [
      ...plan.map((entry) => replaced(entry, install, (context as DesignxNewContext).home)),
      { kind: "file", path: DESIGNX_SHELL, content: designxShellTemplate() },
      ...install.files,
    ];
  },
};
