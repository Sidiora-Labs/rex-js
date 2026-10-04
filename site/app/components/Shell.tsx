import {
  PALETTE_TRIGGER_ATTRIBUTE,
  ariaKeyShortcuts,
  outcomeStatusText,
  useOutcome,
  useShellComponent,
  useShortcutText,
  type ShellButtonProps,
  type ShellFrameProps,
  type ShellNavLink,
  type ShellNavProps,
  type ShellOutcomeProps,
  type ShellPaletteItemProps,
  type ShellPaletteTriggerProps,
  type ShellSheetProps,
} from "@sidioralabs/rex/client";
import {
  BookOpenIcon,
  BracesIcon,
  FileIcon,
  GithubIcon,
  HistoryIcon,
  HouseIcon,
  InfoIcon,
  ListChecksIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import Mark from "./Mark.tsx";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.tsx";
import { Badge } from "./ui/badge.tsx";
import { Button as DesignxButton } from "./ui/button.tsx";
import { CommandShortcut } from "./ui/command.tsx";
import { DialogHeader } from "./ui/dialog.tsx";
import { Kbd } from "./ui/kbd.tsx";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "./ui/navigation-menu.tsx";
import { SheetHeader } from "./ui/sheet.tsx";
import { SidebarMenu, SidebarMenuItem } from "./ui/sidebar.tsx";
import { ThemeProvider, useTheme } from "./ui/theme-provider.tsx";
import { Toolbar, ToolbarLink } from "./ui/toolbar.tsx";

export const REPOSITORY_URL = "https://github.com/Sidiora-Labs/rex-js";

const HOME_PAGE = "home";

const NAV_ITEMS: Readonly<Record<string, LucideIcon>> = {
  home: HouseIcon,
  docs: BookOpenIcon,
  errors: TriangleAlertIcon,
  api: BracesIcon,
  standards: ListChecksIcon,
  changelog: HistoryIcon,
  about: InfoIcon,
};

const NAV_ORDER: readonly string[] = Object.keys(NAV_ITEMS);

const NAV_TARGET = "pointer-coarse:min-h-11";

function navRank(id: string): number {
  const rank = NAV_ORDER.indexOf(id);
  return rank === -1 ? NAV_ORDER.length : rank;
}

function ordered(links: readonly ShellNavLink[]): readonly ShellNavLink[] {
  return [...links].sort((a, b) => navRank(a.id) - navRank(b.id));
}

function NavIcon({ id }: { readonly id: string }) {
  const Icon = NAV_ITEMS[id] ?? FileIcon;
  return <Icon aria-hidden="true" className="size-4 shrink-0" />;
}

export function Button({ type = "button", ...props }: ShellButtonProps) {
  return <DesignxButton type={type} variant="outline" {...props} />;
}

export function Sheet({ title, titleId, form, children }: ShellSheetProps) {
  if (form === "bottom-sheet") {
    return (
      <div
        data-slot="sheet-content"
        data-side="bottom"
        data-rex-sheet-form={form}
        className="flex flex-col gap-4 rounded-t-xl bg-popover pb-6 text-popover-foreground shadow-float"
      >
        <SheetHeader>
          <h2 id={titleId} className="m-0 text-lg font-medium">
            {title}
          </h2>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-6">{children}</div>
      </div>
    );
  }
  return (
    <div
      data-slot="dialog-content"
      data-rex-sheet-form={form}
      className="grid gap-5 rounded-xl bg-popover p-6 text-popover-foreground shadow-float"
    >
      <DialogHeader>
        <h2 id={titleId} className="m-0 text-xl font-medium">
          {title}
        </h2>
      </DialogHeader>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function PaletteItem({ label, detail, shortcut, allowed, reason }: ShellPaletteItemProps) {
  return (
    <span className="flex w-full items-center gap-2">
      <span>{label}</span>
      <code className="text-xs text-muted-foreground">{detail}</code>
      {allowed ? null : <Badge variant="outline">Not allowed: {reason ?? ""}</Badge>}
      {shortcut === null ? null : (
        <CommandShortcut>
          <Kbd>{shortcut}</Kbd>
        </CommandShortcut>
      )}
    </span>
  );
}

export function Outcome({ page }: ShellOutcomeProps) {
  const outcome = useOutcome(page);
  if (outcome === null) return null;
  return (
    <Alert variant={outcome.ok ? "success" : "destructive"} role="none">
      <AlertTitle>{outcomeStatusText(outcome)}</AlertTitle>
      <AlertDescription>{outcome.message}</AlertDescription>
    </Alert>
  );
}

export function Nav({ links, form }: ShellNavProps) {
  if (links.length === 0) return null;
  const items = ordered(links);
  if (form === "bar") {
    return (
      <NavigationMenu aria-label="Pages" data-rex-nav-form={form}>
        <NavigationMenuList>
          {items.map((link) => (
            <NavigationMenuItem key={link.id}>
              <NavigationMenuLink
                href={link.href}
                active={link.current}
                data-rex-nav={link.address}
                aria-current={link.current ? "page" : undefined}
                onClick={link.onClick}
                className={NAV_TARGET}
              >
                {link.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    );
  }
  if (form === "sidebar") {
    return (
      <nav aria-label="Pages" data-rex-nav-form={form}>
        <SidebarMenu>
          {items.map((link) => (
            <SidebarMenuItem key={link.id}>
              <a
                href={link.href}
                data-rex-nav={link.address}
                data-active={link.current}
                aria-current={link.current ? "page" : undefined}
                onClick={link.onClick}
                className="focus-ring flex h-9 w-full items-center gap-2.5 rounded-full px-3 text-sm text-sidebar-foreground/80 pointer-coarse:min-h-11 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
              >
                <NavIcon id={link.id} />
                <span>{link.label}</span>
              </a>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </nav>
    );
  }
  return (
    <nav aria-label="Pages" data-rex-nav-form={form}>
      <Toolbar aria-label="Page links" className="flex w-full justify-between gap-0.5">
        {items.map((link) => (
          <ToolbarLink
            key={link.id}
            href={link.href}
            data-rex-nav={link.address}
            aria-current={link.current ? "page" : undefined}
            onClick={link.onClick}
            className="flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] leading-none aria-[current=page]:text-primary"
          >
            <NavIcon id={link.id} />
            <span>{link.label}</span>
          </ToolbarLink>
        ))}
      </Toolbar>
    </nav>
  );
}

function PaletteTrigger({ label, shortcut, address, onOpen }: ShellPaletteTriggerProps) {
  const keys = useShortcutText(shortcut);
  return (
    <DesignxButton
      type="button"
      variant="outline"
      size="sm"
      className="text-muted-foreground pointer-coarse:min-h-11"
      {...{ [PALETTE_TRIGGER_ATTRIBUTE]: address }}
      aria-keyshortcuts={ariaKeyShortcuts(shortcut)}
      aria-label={label}
      onClick={onOpen}
    >
      <SearchIcon aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      <Kbd className="hidden sm:inline-flex">{keys}</Kbd>
    </DesignxButton>
  );
}

function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const label = dark ? "Switch to light theme" : "Switch to dark theme";
  return (
    <DesignxButton
      type="button"
      variant="ghost"
      size="icon"
      className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      data-site-theme-toggle={resolvedTheme}
      aria-label={label}
      title={label}
      onClick={toggleTheme}
    >
      {dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
    </DesignxButton>
  );
}

function GitHubLink() {
  return (
    <a
      href={REPOSITORY_URL}
      rel="noopener"
      aria-label="Rex on GitHub"
      title="Rex on GitHub"
      data-site-github=""
      className="focus-ring inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground pointer-coarse:min-h-11 pointer-coarse:min-w-11"
    >
      <GithubIcon aria-hidden="true" className="size-4" />
    </a>
  );
}

function BrandLink({ home }: { readonly home: ShellNavLink | undefined }) {
  if (home === undefined) return <Mark />;
  return (
    <a
      href={home.href}
      onClick={home.onClick}
      aria-label="Rex home"
      data-site-brand=""
      className="focus-ring inline-flex min-h-11 items-center rounded-lg"
    >
      <Mark />
    </a>
  );
}

export function Frame({ links, navForm, palette, children }: ShellFrameProps) {
  const NavSlot = useShellComponent("Nav");
  const home = links.find((link) => link.id === HOME_PAGE);
  const sidebar = navForm === "sidebar";
  const dock = navForm === "dock";
  return (
    <ThemeProvider>
      <div
        data-site-frame={navForm}
        className="flex min-h-svh flex-col bg-background text-foreground md:flex-row"
      >
        {sidebar ? (
          <aside
            aria-label="Site"
            data-site-sidebar=""
            className="flex flex-col gap-6 border-b border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground md:sticky md:top-0 md:h-svh md:w-64 md:shrink-0 md:border-r md:border-b-0"
          >
            <BrandLink home={home} />
            <NavSlot links={links} form="sidebar" />
            <div className="mt-auto flex items-center gap-2">
              <GitHubLink />
            </div>
          </aside>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <header
            data-site-appbar=""
            className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl md:px-6"
          >
            {sidebar ? null : <BrandLink home={home} />}
            {navForm === "bar" ? <NavSlot links={links} form="bar" /> : null}
            <div className="ml-auto flex items-center gap-2">
              {palette === null ? null : <PaletteTrigger {...palette} />}
              {sidebar ? null : <GitHubLink />}
              <ThemeToggle />
            </div>
          </header>
          <div
            data-site-content=""
            className={`mx-auto flex w-full max-w-[72rem] min-w-0 flex-1 flex-col gap-6 px-4 pt-8 md:px-6 ${dock ? "pb-28" : "pb-16"}`}
          >
            {children}
          </div>
        </div>
        {dock ? (
          <div
            data-site-dock=""
            className="fixed inset-x-0 bottom-0 z-30 overflow-x-auto border-t border-border bg-background/95 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
          >
            <NavSlot links={links} form="dock" />
          </div>
        ) : null}
      </div>
    </ThemeProvider>
  );
}
