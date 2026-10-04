import type { AnyPage } from "@sidioralabs/rex";
import {
  PALETTE_TRIGGER_ATTRIBUTE,
  SHEET_FORM_ATTRIBUTE,
  ariaKeyShortcuts,
  outcomeStatusText,
  useActivePage,
  useDensity,
  useLoader,
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
import type { UseQueryResult } from "@tanstack/react-query";
import {
  BlocksIcon,
  CircleCheckIcon,
  CircleXIcon,
  CoinsIcon,
  FileIcon,
  InfoIcon,
  SearchIcon,
  SendIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle.tsx";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.tsx";
import { Avatar, AvatarFallback } from "./ui/avatar.tsx";
import { Badge } from "./ui/badge.tsx";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb.tsx";
import { Button as DesignxButton } from "./ui/button.tsx";
import { DialogHeader } from "./ui/dialog.tsx";
import { Kbd } from "./ui/kbd.tsx";
import { Separator } from "./ui/separator.tsx";
import { SheetHeader } from "./ui/sheet.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "./ui/sidebar.tsx";
import { ThemeProvider } from "./ui/theme-provider.tsx";

const PAGE_ICONS: Readonly<Record<string, LucideIcon>> = {
  portfolio: WalletIcon,
  send: SendIcon,
  tokens: CoinsIcon,
  about: InfoIcon,
  embed: BlocksIcon,
};

const WALLET_LOADER = "wallet";

interface WalletIdentityData {
  readonly account: { readonly name: string; readonly address: string };
}

function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export function Button({ type = "button", ...props }: ShellButtonProps) {
  return (
    <DesignxButton
      type={type}
      variant={type === "submit" ? "default" : "outline"}
      size="sm"
      {...props}
    />
  );
}

export function Sheet({ title, titleId, form, children }: ShellSheetProps) {
  const heading = (
    <h2 id={titleId} className="m-0 text-lg leading-tight font-medium tracking-[-0.01em]">
      {title}
    </h2>
  );
  if (form === "bottom-sheet") {
    return (
      <div
        data-slot="sheet-content"
        data-side="bottom"
        className="flex flex-col gap-4"
        {...{ [SHEET_FORM_ATTRIBUTE]: form }}
      >
        <SheetHeader className="p-0">{heading}</SheetHeader>
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    );
  }
  return (
    <div
      data-slot="dialog-content"
      className="flex flex-col gap-4"
      {...{ [SHEET_FORM_ATTRIBUTE]: form }}
    >
      <DialogHeader className="pr-0">{heading}</DialogHeader>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function PaletteItem({ label, detail, shortcut, allowed, reason }: ShellPaletteItemProps) {
  return (
    <span className="flex w-full min-w-0 items-center gap-3">
      <span className="truncate font-medium">{label}</span>
      <code className="truncate font-mono text-xs text-muted-foreground">{detail}</code>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {allowed ? null : <Badge variant="outline">Not allowed: {reason ?? ""}</Badge>}
        {shortcut === null ? null : <Kbd>{shortcut}</Kbd>}
      </span>
    </span>
  );
}

export function Outcome({ page }: ShellOutcomeProps) {
  const outcome = useOutcome(page);
  if (outcome === null) return null;
  const Icon = outcome.ok ? CircleCheckIcon : CircleXIcon;
  return (
    <Alert role={undefined} variant={outcome.ok ? "success" : "destructive"}>
      <Icon aria-hidden="true" />
      <AlertTitle>{outcomeStatusText(outcome)}</AlertTitle>
      <AlertDescription>
        <p className="m-0">{outcome.message}</p>
      </AlertDescription>
    </Alert>
  );
}

export function Nav({ links, form }: ShellNavProps) {
  if (links.length === 0) return null;
  return (
    <nav aria-label="Pages" data-rex-nav-form={form} className="min-w-0 flex-1">
      <SidebarMenu className="in-data-[rex-screen=phone]:flex-row in-data-[rex-screen=phone]:justify-around in-data-[rex-screen=phone]:gap-0 in-data-[rex-screen=tablet]:w-auto in-data-[rex-screen=tablet]:flex-row in-data-[rex-screen=tablet]:gap-1">
        {links.map((link) => (
          <NavItem key={link.id} link={link} />
        ))}
      </SidebarMenu>
    </nav>
  );
}

function NavItem({ link }: { readonly link: ShellNavLink }) {
  const Icon = PAGE_ICONS[link.id] ?? FileIcon;
  return (
    <SidebarMenuItem className="in-data-[rex-screen=phone]:min-w-0 in-data-[rex-screen=phone]:flex-1">
      <SidebarMenuButton
        isActive={link.current}
        className="in-data-[rex-screen=phone]:h-auto in-data-[rex-screen=phone]:min-h-14 in-data-[rex-screen=phone]:flex-col in-data-[rex-screen=phone]:justify-center in-data-[rex-screen=phone]:gap-1 in-data-[rex-screen=phone]:rounded-lg in-data-[rex-screen=phone]:px-1 in-data-[rex-screen=phone]:text-center in-data-[rex-screen=phone]:text-[11px] in-data-[rex-screen=tablet]:w-auto"
        render={
          <a
            href={link.href}
            aria-label={link.label}
            data-rex-nav={link.address}
            aria-current={link.current ? "page" : undefined}
            onClick={link.onClick}
          />
        }
      >
        <Icon aria-hidden="true" />
        <span>{link.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function PaletteTrigger({ label, shortcut, address, onOpen }: ShellPaletteTriggerProps) {
  const keys = useShortcutText(shortcut);
  return (
    <DesignxButton
      type="button"
      variant="outline"
      size="sm"
      className="text-muted-foreground in-data-[rex-screen=phone]:size-11 in-data-[rex-screen=phone]:px-0"
      {...{ [PALETTE_TRIGGER_ATTRIBUTE]: address }}
      aria-keyshortcuts={ariaKeyShortcuts(shortcut)}
      onClick={onOpen}
    >
      <SearchIcon aria-hidden="true" />
      <span className="in-data-[rex-screen=phone]:sr-only">{label}</span>
      <Kbd className="in-data-[rex-screen=phone]:hidden">{keys}</Kbd>
    </DesignxButton>
  );
}

function IdentityView({ name, address }: { readonly name: string; readonly address: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-1" data-demo-identity="">
      <Avatar className="size-9 bg-linear-to-br from-(--dx-blue-4) to-(--dx-purple-3)">
        <AvatarFallback className="font-semibold text-white">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{name}</span>
        <code className="truncate font-mono text-xs text-muted-foreground" title={address}>
          {shortAddress(address)}
        </code>
      </span>
    </div>
  );
}

function LoadedIdentity({ page, fallback }: { readonly page: AnyPage; readonly fallback: string }) {
  const wallet = useLoader(page, WALLET_LOADER as never) as UseQueryResult<WalletIdentityData>;
  const account = wallet.data?.account;
  if (account === undefined) return <IdentityView name={fallback} address="Loading wallet" />;
  return <IdentityView name={account.name} address={account.address} />;
}

function WalletIdentity({ appName }: { readonly appName: string }) {
  const active = useActivePage();
  const loaded = active?.page.loaders.some((loader) => loader.name === WALLET_LOADER) ?? false;
  if (active === null || !loaded) return <IdentityView name={appName} address="Demo wallet" />;
  return <LoadedIdentity page={active.page} fallback={appName} />;
}

export function Frame({ appName, links, navForm, palette, children }: ShellFrameProps) {
  const NavSlot = useShellComponent("Nav");
  const { density } = useDensity();
  const flat = density === "agent";
  const current = links.find((link) => link.current);
  return (
    <ThemeProvider>
      <SidebarProvider
        data-demo-frame={flat ? "flat" : navForm}
        className="bg-background in-data-[rex-screen=phone]:flex-col in-data-[rex-screen=tablet]:flex-col"
      >
        <Sidebar
          collapsible="none"
          aria-label="Wallet navigation"
          className="in-data-[rex-screen=phone]:order-last in-data-[rex-screen=phone]:h-auto in-data-[rex-screen=phone]:w-full in-data-[rex-screen=phone]:flex-row in-data-[rex-screen=phone]:border-t in-data-[rex-screen=phone]:border-sidebar-border in-data-[rex-screen=phone]:pb-[env(safe-area-inset-bottom)] in-data-[rex-screen=phone]:not-in-data-[rex-density=agent]:fixed in-data-[rex-screen=phone]:not-in-data-[rex-density=agent]:inset-x-0 in-data-[rex-screen=phone]:not-in-data-[rex-density=agent]:bottom-0 in-data-[rex-screen=phone]:not-in-data-[rex-density=agent]:z-20 in-data-[rex-screen=tablet]:h-auto in-data-[rex-screen=tablet]:w-full in-data-[rex-screen=tablet]:flex-row in-data-[rex-screen=tablet]:items-center in-data-[rex-screen=tablet]:gap-2 in-data-[rex-screen=tablet]:border-b in-data-[rex-screen=tablet]:border-sidebar-border in-data-[rex-screen=tablet]:px-2"
        >
          <SidebarHeader className="in-data-[rex-screen=phone]:hidden">
            <span className="flex items-center gap-2.5 px-1.5 py-1">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
              >
                {appName.charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">
                {appName}
              </span>
            </span>
          </SidebarHeader>
          <SidebarContent className="in-data-[rex-screen=phone]:overflow-visible in-data-[rex-screen=tablet]:flex-row in-data-[rex-screen=tablet]:overflow-visible">
            <SidebarGroup className="in-data-[rex-screen=phone]:p-1 in-data-[rex-screen=tablet]:p-0">
              <SidebarGroupLabel className="text-muted-foreground in-data-[rex-screen=phone]:hidden in-data-[rex-screen=tablet]:hidden">
                Wallet
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <NavSlot links={links} form={navForm} />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="in-data-[rex-screen=phone]:hidden in-data-[rex-screen=tablet]:hidden">
            <Separator className="mb-1" />
            <WalletIdentity appName={appName} />
          </SidebarFooter>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col" data-demo-workspace="">
          <header
            data-demo-appbar=""
            className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-border bg-background/85 px-6 backdrop-blur-xl in-data-[rex-screen=phone]:gap-2 in-data-[rex-screen=phone]:px-4"
          >
            <Breadcrumb aria-label="Breadcrumb" className="min-w-0 flex-1">
              <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem className="shrink-0">{appName}</BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="truncate">
                    {current?.label ?? "Page not found"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {palette === null ? null : <PaletteTrigger {...palette} />}
              <ThemeToggle />
            </div>
          </header>
          <div
            data-demo-content=""
            className="mx-auto flex w-full max-w-[72rem] min-w-0 flex-1 flex-col gap-6 px-6 pt-8 pb-16 in-data-[rex-screen=phone]:gap-5 in-data-[rex-screen=phone]:px-4 in-data-[rex-screen=phone]:pt-5 in-data-[rex-screen=phone]:pb-28"
          >
            {children}
          </div>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}
