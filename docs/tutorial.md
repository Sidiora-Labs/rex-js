# Tutorial: build the wallet

This tutorial builds the portfolio and send pages of the wallet demo in [`examples/demo`](../examples/demo) from an empty folder with `rex new` and `rex make`, one command and one file at a time. At the end you have the two main pages of the demo, a portfolio and a send form, that a person and an agent operate through the same DOM: every action has a `data-rex` address, a keyboard shortcut, a URL and a palette entry, every page publishes a sidecar, and `rex check` passes. The demo additionally ships a `tokens` page (`render: "ssg"`, `revalidate: 60`), a static `about` page and an `embed` page with their `list-tokens` and `send-feedback` actions; this tutorial does not build them.

Every file of the finished app is in `examples/demo`. Where this page does not print a file in full, it links to it.

You need Node 22.19 or later and pnpm. Inside this repository the `rex` bin is built from the package first (`pnpm install && pnpm -C packages/rex build`); in your own project it comes with `@sidioralabs/rex`.

## What you will build

| Page        | Route   | Regions                       | Overlays                                   | Actions                              |
| ----------- | ------- | ----------------------------- | ------------------------------------------ | ------------------------------------ |
| `portfolio` | `/`     | `hero`, `actions`, `holdings` | `HoldingsFilterSheet` (URL bound)          | `toggle-hide-dust`                   |
| `send`      | `/send` | `form`, `confirm`, `success`  | `TokenSelectorSheet`, `ContactPickerSheet` | `send`, `pick-token`, `pick-contact` |

Three entities (`account`, `token`, `contact`), two policies (`viewer`, `wallet`), one read action (`load-wallet`) and four mutating actions, with data in seeded in-memory stores.

## 1. Create the app

```sh
rex new wallet
cd wallet
```

`rex new` writes a complete app, fetches the DesignX UI components (the default `--ui designx`; `--ui none` skips them) and runs the package manager install (`--no-install` skips it). It prints one `wrote wallet/<path>` line per file:

| Path                                                                                         | Content                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                                               | scripts `dev`, `build`, `check`, `manifest`, `start`, `lint`, `format`; `@sidioralabs/rex` and its peers; DesignX and Tailwind packages; TypeScript, ESLint and Prettier dev dependencies                                                                                                                                                                                                                                               |
| `tsconfig.json`                                                                              | strict compiler options; `include` covers `app`, `rex.config.ts` and the `rex:app` typings of the package                                                                                                                                                                                                                                                                                                                               |
| `index.html`                                                                                 | `<div id="root">`, the `/app/theme.css` stylesheet and `<script type="module" src="/@rex/entry">`                                                                                                                                                                                                                                                                                                                                       |
| `rex.config.ts`                                                                              | `defineConfig({ app, ui: { kit: "designx", components: "app/components/Shell.tsx" }, server })` with `createRexServer`                                                                                                                                                                                                                                                                                                                  |
| `app/entities/note.ts`, `app/policies/viewer.ts`, `app/actions/ping.ts`, `app/data/notes.ts` | a starter entity, policy, action and store                                                                                                                                                                                                                                                                                                                                                                                              |
| `app/components/Button.tsx`                                                                  | a button over the DesignX `Button`                                                                                                                                                                                                                                                                                                                                                                                                      |
| `app/components/Shell.tsx`                                                                   | the shell overrides `Button`, `Sheet`, `PaletteItem`, `Outcome` and `Nav` on the DesignX primitives, registered through `ui.components`                                                                                                                                                                                                                                                                                                 |
| `app/components/ui/`, `app/theme.css`, `dx.json`                                             | the DesignX theme and the standard set from `@sidioralabs/rex/designx` (`DESIGNX_STANDARD`: the 15 base items plus alert, avatar, breadcrumb, checkbox, data-table, form, navigation-menu, number-field, pagination, progress, radio-group, scroll-area, separator, sidebar, spinner, switch, textarea, toolbar, typography and the use-media-query and use-touch-capable hooks), `ui/utils.ts` and `ui/use-screen.ts` over `useScreen` |
| `app/pages/home/...`                                                                         | a `home` page at `/` with `page.ts`, `view.tsx`, `states.tsx`, `hooks/useNotes.ts`, the `welcome` region with its `Welcome` part, and `test/`                                                                                                                                                                                                                                                                                           |
| `app/locales/en.json`                                                                        | the default locale's messages                                                                                                                                                                                                                                                                                                                                                                                                           |
| `eslint.config.js`, `.prettierrc`, `.prettierignore`                                         | the Rex ESLint and Prettier presets                                                                                                                                                                                                                                                                                                                                                                                                     |

Start it to see the starter page:

```sh
rex dev
```

`rex dev` runs `rex check` first, then serves the Vite client and the app's server on one port (5173 by default). Open the printed URL: the home page lists one note and has a `Ping` button.

## 2. Clear the starter

The wallet keeps the `viewer` policy and the shared `Button` and drops the rest of the starter:

```sh
rm -r app/pages/home app/actions/ping.ts app/entities/note.ts app/data/notes.ts
```

Keep `app/locales`: the demo ships English and German messages (`en.json`, `de.json`, whose keys serve the about, tokens and embed pages and the locale switch; see [Translate an app](recipes/i18n.md)) and its `rex.config.ts` declares `i18n`, `fonts` and `check.i18n.allow`. The portfolio and send pages keep literal English labels, listed under `check.i18n.allow` so `i18n/literal` accepts them.

## 3. Entities

Entities declare the shape of records once; the stores, schemas and manifest derive from them.

```sh
rex make entity account
rex make entity token
rex make entity contact
```

Each command writes `app/entities/<name>.ts` with `id` and `name` fields. Fill them in.

`app/entities/account.ts`:

```ts
import { entity } from "@sidioralabs/rex";
import { boolean, id, ref, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

export const account = entity("account", {
  fields: {
    id: id(),
    name: text({ min: 1 }),
    address: text({ min: 1 }),
    hideDust: boolean(),
    sendToken: ref("token"),
    sendContact: ref("contact"),
    lastTransfer: z.nullable(text({ min: 1 })),
  },
  label: (record) => record.name,
});
```

`app/entities/token.ts`:

```ts
import { entity } from "@sidioralabs/rex";
import { id, money, text } from "@sidioralabs/rex/schema";

export const token = entity("token", {
  fields: {
    id: id(),
    symbol: text({ min: 1, max: 12 }),
    name: text({ min: 1 }),
    balance: money(),
    priceUsd: money(),
  },
  label: (record) => `${record.name} (${record.symbol})`,
});
```

`app/entities/contact.ts`:

```ts
import { entity } from "@sidioralabs/rex";
import { id, text } from "@sidioralabs/rex/schema";

export const contact = entity("contact", {
  fields: { id: id(), name: text({ min: 1 }), address: text({ min: 1 }) },
  label: (record) => record.name,
});
```

`id`, `text`, `money`, `boolean` and `ref` are the Rex field helpers, built on `zod/mini`; `money()` is a decimal string, so balances never lose precision. Import `z` from `zod/mini` for anything else.

## 4. Policies

`app/policies/viewer.ts` came with `rex new`:

```ts
import { policy } from "@sidioralabs/rex";

export const viewer = policy("viewer", {
  permissions: ["viewer.read"],
  resolve: (actor) => (actor.permissions.includes("viewer.read") ? ["viewer.read"] : []),
});
```

Add the `wallet` policy:

```sh
rex make policy wallet
```

`app/policies/wallet.ts`:

```ts
import { policy } from "@sidioralabs/rex";

const WALLET_PERMISSIONS = ["wallet.send", "wallet.manage"] as const;

export const wallet = policy("wallet", {
  permissions: WALLET_PERMISSIONS,
  resolve: (actor) =>
    WALLET_PERMISSIONS.filter((permission) => actor.permissions.includes(permission)),
});
```

A policy gives predicates: `viewer.can("viewer.read")`, `wallet.can("wallet.manage")`, and `wallet.requires({ unlocked: true, account: true, permissions: ["wallet.send"] })`, which also checks actor attributes. Actions and pages use them, the server enforces them before every handler, and the sidecar reports `allowed` and `reason` for each action.

## 5. Data

Stores and queries live in `app/data`. `app/data/wallet.ts` binds a seeded in-memory store to each entity and holds the wallet arithmetic (amounts are scaled to integers with `BigInt`, never floats):

```ts
import { bind, memoryStore, type InferEntity } from "@sidioralabs/rex";
import { account } from "../entities/account.ts";
import { contact } from "../entities/contact.ts";
import { token } from "../entities/token.ts";

export type Account = InferEntity<typeof account>;
export type Token = InferEntity<typeof token>;
export type Contact = InferEntity<typeof contact>;

export const DEFAULT_ACCOUNT = "main";
export const DUST_THRESHOLD_USD = "1";
export const DEFAULT_SEND_AMOUNT = "0.001";

const SCALE = 1_000_000n;
const DECIMALS = 6;

export const accounts = bind(
  account,
  memoryStore(account, [
    {
      id: DEFAULT_ACCOUNT,
      name: "Main wallet",
      address: "0x5a1e000000000000000000000000000000c0ffee",
      hideDust: false,
      sendToken: "eth",
      sendContact: "alice",
      lastTransfer: null,
    },
  ]),
);

export const TOKEN_SEED: readonly Token[] = [
  { id: "dust", symbol: "DUST", name: "Dust Token", balance: "0.05", priceUsd: "0.004" },
  { id: "eth", symbol: "ETH", name: "Ether", balance: "25", priceUsd: "3000" },
  { id: "pax", symbol: "PAX", name: "Paxeer", balance: "320", priceUsd: "0.25" },
  { id: "usdc", symbol: "USDC", name: "USD Coin", balance: "1500", priceUsd: "1" },
];

export const tokens = bind(token, memoryStore(token, [...TOKEN_SEED]));

export const contacts = bind(
  contact,
  memoryStore(contact, [
    { id: "alice", name: "Alice", address: "0xa11ce00000000000000000000000000000000001" },
    { id: "bob", name: "Bob", address: "0xb0b0000000000000000000000000000000000002" },
    { id: "carol", name: "Carol", address: "0xca201000000000000000000000000000000000003" },
  ]),
);
```

The rest of the file defines `CHANGE_24H_PCT` and `change24hPct` (the seeded 24h price change per token), `TOKEN_PRICES` and `tokenPrices`, `toUnits` and `fromUnits` (decimal string to scaled `bigint` and back), `valueUsd`, `isDust`, `accountIdOf` (the actor's `account` attribute or `main`), `requireAccount`, `nextId` (the next id in sorted order, used by the pickers) and `walletOverview(accountId)`, which returns the account, every token with its USD value, dust flag and 24h change, the contacts, the total and the 24h change (`change24hUsd`, `change24hPct`). Copy it from [examples/demo/app/data/wallet.ts](../examples/demo/app/data/wallet.ts).

## 6. Actions

Every capability is one `action()` declaration. Generate the five files:

```sh
rex make action load-wallet
rex make action toggle-hide-dust
rex make action pick-token
rex make action pick-contact
rex make action send
```

Each starts as a reversible action with `policy: always()`. Replace them.

`app/actions/load-wallet.ts`, the read action the pages load data through:

```ts
import { action } from "@sidioralabs/rex";
import { boolean, money } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { accountIdOf, walletOverview } from "../data/wallet.ts";
import { account } from "../entities/account.ts";
import { contact } from "../entities/contact.ts";
import { token } from "../entities/token.ts";
import { viewer } from "../policies/viewer.ts";

export const loadWallet = action("load-wallet", {
  input: z.object({}),
  output: z.object({
    account: z.object(account.fields),
    tokens: z.array(
      z.object({
        ...token.fields,
        valueUsd: money(),
        dust: boolean(),
        change24hPct: z.string(),
      }),
    ),
    contacts: z.array(z.object(contact.fields)),
    totalUsd: money(),
    change24hUsd: z.string(),
    change24hPct: z.string(),
  }),
  policy: viewer.can("viewer.read"),
  effect: "read",
  label: "Load wallet",
  handler: (_input, ctx) => walletOverview(accountIdOf(ctx.actor.attributes)),
});
```

`app/actions/toggle-hide-dust.ts`:

```ts
import { action } from "@sidioralabs/rex";
import { boolean } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { accountIdOf, accounts, requireAccount } from "../data/wallet.ts";
import { wallet } from "../policies/wallet.ts";

export const toggleHideDust = action("toggle-hide-dust", {
  input: z.object({ hide: z.optional(boolean()) }),
  output: z.object({ hideDust: boolean() }),
  policy: wallet.can("wallet.manage"),
  effect: "reversible",
  label: "Toggle hide dust",
  shortcut: "shift+d",
  invalidates: ["wallet"],
  handler: async (input, ctx) => {
    const owner = await requireAccount(accountIdOf(ctx.actor.attributes));
    const hideDust = input.hide ?? !owner.hideDust;
    await accounts.put({ ...owner, hideDust });
    return { hideDust };
  },
});
```

`app/actions/pick-token.ts` (`pick-contact.ts` is the same shape over `contacts`, field `contact`, shortcut `shift+c`; see [examples/demo/app/actions/pick-contact.ts](../examples/demo/app/actions/pick-contact.ts)):

```ts
import { action } from "@sidioralabs/rex";
import { id, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { accountIdOf, accounts, nextId, requireAccount, tokens } from "../data/wallet.ts";
import { wallet } from "../policies/wallet.ts";

export const pickToken = action("pick-token", {
  input: z.object({ token: z.optional(id()) }),
  output: z.object({ token: id(), symbol: text({ min: 1 }) }),
  policy: wallet.can("wallet.manage"),
  effect: "reversible",
  label: "Pick token",
  shortcut: "shift+t",
  invalidates: ["wallet"],
  handler: async (input, ctx) => {
    const owner = await requireAccount(accountIdOf(ctx.actor.attributes));
    const held = (await tokens.list()).items;
    const chosen =
      input.token ??
      nextId(
        held.map((entry) => entry.id),
        owner.sendToken,
      );
    const picked = held.find((entry) => entry.id === chosen);
    if (picked === undefined) throw new Error(`token "${chosen}" is not in this wallet`);
    await accounts.put({ ...owner, sendToken: picked.id });
    return { token: picked.id, symbol: picked.symbol };
  },
});
```

`app/actions/send.ts`, the irreversible one:

```ts
import { action } from "@sidioralabs/rex";
import { money, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import {
  DEFAULT_SEND_AMOUNT,
  accountIdOf,
  accounts,
  contacts,
  fromUnits,
  requireAccount,
  toUnits,
  tokens,
} from "../data/wallet.ts";
import { wallet } from "../policies/wallet.ts";

export const send = action("send", {
  input: z.object({ amount: z._default(money(), DEFAULT_SEND_AMOUNT) }),
  output: z.object({ transfer: text({ min: 1 }), balance: money() }),
  policy: wallet.requires({ unlocked: true, account: true, permissions: ["wallet.send"] }),
  effect: "irreversible",
  label: "Send",
  shortcut: "mod+enter",
  form: { redirect: "/send" },
  invalidates: ["wallet"],
  handler: async (input, ctx) => {
    const owner = await requireAccount(accountIdOf(ctx.actor.attributes));
    const held = await tokens.get(owner.sendToken);
    const recipient = await contacts.get(owner.sendContact);
    if (held === undefined) throw new Error(`token "${owner.sendToken}" is not in this wallet`);
    if (recipient === undefined) throw new Error(`contact "${owner.sendContact}" is unknown`);
    const units = toUnits(input.amount);
    if (units <= 0n) throw new Error("the amount must be greater than zero");
    const remaining = toUnits(held.balance) - units;
    if (remaining < 0n) throw new Error(`the ${held.symbol} balance is too low`);
    const balance = fromUnits(remaining);
    await tokens.put({ ...held, balance });
    const transfer = `Sent ${fromUnits(units)} ${held.symbol} to ${recipient.name}`;
    await accounts.put({ ...owner, lastTransfer: transfer });
    return { transfer, balance };
  },
});
```

From each declaration Rex derives an oRPC procedure at `/rex/rpc` that validates input and output and evaluates the policy before the handler, one audit record per call, a palette entry, the shortcut, `?act=<id>` URL invocation, a form route at `/rex/form/<id>`, and a manifest entry. `effect: "irreversible"` puts a confirmation step on every route. `invalidates: ["wallet"]` refetches the `wallet` loader after success.

The pages read the wallet through a loader: `load: { wallet: loadWallet }` in page.ts (see [Load page data with a loader](recipes/loader.md)); during server rendering it runs in process and is dehydrated into the HTML, on the client it is a TanStack query keyed `["loader", <page>, "wallet", <digest>]` that `useLoader(page, "wallet")` reads.

## 7. Server and config

The server resolves who is acting. Create `server.ts` next to `rex.config.ts`:

```ts
import { actor, type Actor, type RegistrySnapshot } from "@sidioralabs/rex";
import { createRexServer, memoryLedger, type Ledger } from "@sidioralabs/rex/server";

export const DEMO_ACTOR_COOKIE = "demo-actor";

export const owner: Actor = actor({
  id: "owner",
  roles: ["owner"],
  permissions: ["viewer.read", "wallet.manage", "wallet.send"],
  attributes: { unlocked: true, account: "main" },
});

export const guest: Actor = actor({
  id: "guest",
  roles: ["viewer"],
  permissions: ["viewer.read"],
  attributes: { unlocked: false, account: "main" },
});

export function cookieValue(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function resolveDemoActor(request: Request): Actor {
  return cookieValue(request, DEMO_ACTOR_COOKIE) === "guest" ? guest : owner;
}

export interface DemoApp {
  readonly name: string;
  readonly registry: RegistrySnapshot;
}

export function createDemoServer(app: DemoApp, ledger: Ledger = memoryLedger()) {
  return createRexServer({
    registry: app.registry,
    ledger,
    actor: resolveDemoActor,
    app: app.name,
  });
}
```

Then point `rex.config.ts` at it. The wallet also overrides the Rex shell components (sheet frame, palette item, outcome) with DesignX ones from `app/components/Shell.tsx`:

```ts
import { defineConfig } from "@sidioralabs/rex/config";
import app from "rex:app";
import { createDemoServer } from "./server.ts";

export default defineConfig({
  app,
  ui: { kit: "designx", components: "app/components/Shell.tsx" },
  i18n: { locales: ["en", "de"], default: "en", routing: "none" },
  fonts: [
    {
      family: "Liberation Mono",
      src: "/fonts/LiberationMono-Regular.ttf",
      weight: 400,
      preload: true,
    },
  ],
  check: { i18n: { allow: [/* the untranslated labels, see examples/demo/rex.config.ts */] } },
  server: (bundle) => createDemoServer(bundle),
});
```

Add `server.ts` to `include` in `tsconfig.json`.

## 8. Shared components

`app/components` holds components every page may use; they import other components and UI packages, never data or actions.

`app/components/Button.tsx` replaces the starter with a toned button:

```tsx
import type { ButtonHTMLAttributes } from "react";
import { Button as DesignxButton } from "./ui/button.tsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly tone?: "primary" | "quiet";
}

export default function Button({ tone = "quiet", type = "button", ...props }: ButtonProps) {
  return (
    <DesignxButton
      type={type}
      {...props}
      data-tone={tone}
      variant={tone === "primary" ? "default" : "outline"}
    />
  );
}
```

Add five more and replace the generated shell overrides:

| File                                                                                  | Role                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [app/components/Card.tsx](../examples/demo/app/components/Card.tsx)                   | a titled card over DesignX `Card`                                                                                                                                                                                                                                                                             |
| [app/components/Field.tsx](../examples/demo/app/components/Field.tsx)                 | a labelled input with hint and error, wired with `aria-describedby` and `aria-invalid`                                                                                                                                                                                                                        |
| [app/components/Sheet.tsx](../examples/demo/app/components/Sheet.tsx)                 | the body of the wallet's sheets, with an optional description                                                                                                                                                                                                                                                 |
| [app/components/BalanceCard.tsx](../examples/demo/app/components/BalanceCard.tsx)     | the balance card: name, token count, the total formatted as USD, the 24h change and the address (with `AnimatedNumber.tsx` and `ChangeBadge.tsx`)                                                                                                                                                             |
| [app/components/HoldingsTable.tsx](../examples/demo/app/components/HoldingsTable.tsx) | the `Holding` type and the holdings rows in a DesignX `DataTable` with a search field (with `TokenAvatar.tsx`)                                                                                                                                                                                                |
| [app/components/Shell.tsx](../examples/demo/app/components/Shell.tsx)                 | `Button`, `Sheet`, `PaletteItem`, `Outcome`, `Nav` and `Frame` overrides for the Rex shell (a DesignX sidebar frame with breadcrumb, palette trigger and theme toggle), typed with `ShellButtonProps`, `ShellSheetProps`, `ShellPaletteItemProps`, `ShellOutcomeProps`, `ShellNavProps` and `ShellFrameProps` |

## 9. The portfolio page

```sh
rex make page portfolio --regions hero,actions,holdings --overlays HoldingsFilterSheet
rex make hook portfolio useWallet
rex make hook portfolio useHoldingsFilter
rex make part portfolio BalanceHero --region hero
rex make part portfolio QuickActions --region actions
rex make part portfolio FilterForm --region actions
rex make part portfolio DustToggle --region holdings
rex make part portfolio HoldingsList --region holdings
```

The row rendering lives in the shared `app/components/HoldingsTable.tsx` over the DesignX `DataTable`, so the holdings region needs no row part.

`rex make page` writes `page.ts`, `view.tsx` (the three regions in `Page.Stack`), `states.tsx` (the eight non-ready states), `hooks/`, one `region.tsx` per region, the overlay file and `test/`. The other commands add one file each.

`app/pages/portfolio/page.ts`: the route is `/`, the page needs `viewer.read`, the filter sheet is bound to the URL, and `draft: "route"` keeps unsaved input per route:

```ts
import { page } from "@sidioralabs/rex";
import { loadWallet } from "../../actions/load-wallet.ts";
import { toggleHideDust } from "../../actions/toggle-hide-dust.ts";
import { viewer } from "../../policies/viewer.ts";

export default page("portfolio", {
  route: "/",
  policy: viewer.can("viewer.read"),
  draft: "route",
  load: { wallet: loadWallet },
  actions: [toggleHideDust],
  chrome: { title: "Portfolio" },
  regions: ["hero", "actions", "holdings"],
  overlays: [{ id: "HoldingsFilterSheet", dismiss: "both", binding: "url" }],
});
```

`view.tsx` keeps the generated shape with a wider gap, `<Page.Stack space={5}>`:

```tsx
import { Page, view } from "@sidioralabs/rex/client";
import ActionsRegion from "./regions/actions/region.tsx";
import HeroRegion from "./regions/hero/region.tsx";
import HoldingsRegion from "./regions/holdings/region.tsx";

export default view(() => (
  <Page.Stack space={5}>
    <HeroRegion />
    <ActionsRegion />
    <HoldingsRegion />
  </Page.Stack>
));
```

In `states.tsx`, import `Button` from `../../components/Button.tsx` and use it for the generated retry buttons ([examples/demo/app/pages/portfolio/states.tsx](../examples/demo/app/pages/portfolio/states.tsx)). Each state receives `params`, `retry` and `error`.

The hooks. `hooks/useWallet.ts` reads the page's `wallet` loader:

```ts
import type { ActionOutput } from "@sidioralabs/rex";
import { useActivePage, useLoader, type RexLoaderError } from "@sidioralabs/rex/client";
import type { UseQueryResult } from "@tanstack/react-query";
import type { loadWallet } from "../../../actions/load-wallet.ts";

type WalletOverview = ActionOutput<typeof loadWallet>;

export function useWallet(): UseQueryResult<WalletOverview, RexLoaderError> {
  const active = useActivePage();
  if (active === null)
    throw new Error("useWallet reads the wallet loader of the active portfolio page");
  return useLoader(active.page, "wallet") as UseQueryResult<WalletOverview, RexLoaderError>;
}
```

`hooks/useHoldingsFilter.ts` keeps the filter text in the page draft, validated by a schema:

```ts
import { useDraft } from "@sidioralabs/rex/client";
import { z } from "zod/mini";

const holdingsFilter = z.object({ query: z.string().check(z.maxLength(40)) });

export function useHoldingsFilter() {
  const draft = useDraft(holdingsFilter);
  const query = draft.value?.query ?? "";
  return {
    query,
    setQuery: (next: string) => draft.set(next.trim() === "" ? null : { query: next }),
  };
}
```

Regions are the only files that call hooks and bind actions; parts receive plain props. `regions/hero/region.tsx`:

```tsx
import { region } from "@sidioralabs/rex/client";
import { useWallet } from "../../hooks/useWallet.ts";
import BalanceHero from "./parts/BalanceHero.tsx";

export default region("hero", () => {
  const wallet = useWallet();
  const data = wallet.data;
  if (data === undefined) return null;
  return (
    <BalanceHero
      name={data.account.name}
      address={data.account.address}
      totalUsd={data.totalUsd}
      tokenCount={data.tokens.length}
      change24hUsd={data.change24hUsd}
      change24hPct={data.change24hPct}
    />
  );
});
```

`regions/hero/parts/BalanceHero.tsx` renders the shared `BalanceCard`:

```tsx
import BalanceCard, { type BalanceCardProps } from "../../../../../components/BalanceCard.tsx";

export type BalanceHeroProps = BalanceCardProps;

export default function BalanceHero(props: BalanceHeroProps) {
  return <BalanceCard {...props} />;
}
```

`regions/holdings/region.tsx` binds the `toggle-hide-dust` action with `act()` and filters the holdings:

```tsx
import { region } from "@sidioralabs/rex/client";
import { toggleHideDust } from "../../../../actions/toggle-hide-dust.ts";
import { useHoldingsFilter } from "../../hooks/useHoldingsFilter.ts";
import { useWallet } from "../../hooks/useWallet.ts";
import DustToggle from "./parts/DustToggle.tsx";
import HoldingsList from "./parts/HoldingsList.tsx";

export default region("holdings", ({ act }) => {
  const wallet = useWallet();
  const filter = useHoldingsFilter();
  const toggle = act(toggleHideDust);
  const data = wallet.data;
  if (data === undefined) return null;
  const hideDust = data.account.hideDust;
  const needle = filter.query.trim().toLowerCase();
  const shown = data.tokens.filter((entry) => !(hideDust && entry.dust));
  const matching = shown.filter(
    (entry) =>
      needle === "" ||
      entry.symbol.toLowerCase().includes(needle) ||
      entry.name.toLowerCase().includes(needle),
  );
  return (
    <HoldingsList
      holdings={matching}
      filter={filter.query}
      onFilter={filter.setQuery}
      toolbar={
        <DustToggle
          hideDust={hideDust}
          hiddenCount={data.tokens.length - shown.length}
          control={toggle.controlProps}
          onToggle={() => {
            void toggle.run({});
          }}
        />
      }
    />
  );
});
```

`act(action)` returns `controlProps` (the `data-rex` address, the allowed state and the reason) and `run(input)`. The part spreads `controlProps` on its DesignX `Switch`, `regions/holdings/parts/DustToggle.tsx`:

```tsx
import type { ActControlProps } from "@sidioralabs/rex/client";
import { useId } from "react";
import { Switch } from "../../../../../components/ui/switch.tsx";

export interface DustToggleProps {
  readonly hideDust: boolean;
  readonly hiddenCount: number;
  readonly control: ActControlProps;
  readonly onToggle: () => void;
}

export default function DustToggle({ hideDust, hiddenCount, control, onToggle }: DustToggleProps) {
  const labelId = useId();
  const statusId = useId();
  return (
    <div className="flex items-center gap-3">
      <Switch
        {...control}
        checked={hideDust}
        aria-labelledby={labelId}
        aria-describedby={statusId}
        onCheckedChange={() => onToggle()}
      />
      <span className="flex flex-col">
        <span id={labelId} className="text-sm font-medium">
          Hide dust
        </span>
        <span
          id={statusId}
          className="text-xs text-muted-foreground"
          data-demo-dust={hideDust ? "hidden" : "shown"}
        >
          {hideDust
            ? `Dust is hidden (${hiddenCount} ${hiddenCount === 1 ? "token" : "tokens"} under $1)`
            : "Dust is shown"}
        </span>
      </span>
    </div>
  );
}
```

`regions/holdings/parts/HoldingsList.tsx` wraps the shared `HoldingsTable` (a DesignX `DataTable` with a search field) in a `Card` whose action slot holds the dust toggle:

```tsx
import type { ReactNode } from "react";
import Card from "../../../../../components/Card.tsx";
import HoldingsTable, { type Holding } from "../../../../../components/HoldingsTable.tsx";

export interface HoldingsListProps {
  readonly holdings: readonly Holding[];
  readonly filter: string;
  readonly onFilter: (query: string) => void;
  readonly toolbar?: ReactNode;
}

export default function HoldingsList({ holdings, filter, onFilter, toolbar }: HoldingsListProps) {
  return (
    <Card
      title="Holdings"
      description={
        filter === "" ? (
          `${holdings.length} ${holdings.length === 1 ? "token" : "tokens"}`
        ) : holdings.length === 0 ? (
          <span role="status">{`No holding matches "${filter}"`}</span>
        ) : (
          `${holdings.length} matching "${filter}"`
        )
      }
      action={toolbar}
    >
      <HoldingsTable holdings={holdings} search={filter} onSearch={onFilter} />
    </Card>
  );
}
```

`Page.List` from `@sidioralabs/rex/client` remains the paged-list primitive (page and size in the URL, a visible "load more" control); the `traps/infinite-list` rule points at it ([migration.md](migration.md#5-fix-the-new-checker-findings)).

`app/components/HoldingsTable.tsx` exports the `Holding` type and renders the rows ([source](../examples/demo/app/components/HoldingsTable.tsx)).

The `actions` region opens the filter sheet and navigates to the send page. It hands the sheet its content through a context the overlay exports, because an overlay may not call hooks itself; [Add an overlay](recipes/overlay.md) walks through `overlays/HoldingsFilterSheet.tsx` and this region:

```tsx
import { region, useOverlay, useRegistry } from "@sidioralabs/rex/client";
import { useHoldingsFilter } from "../../hooks/useHoldingsFilter.ts";
import HoldingsFilterSheet, { HoldingsFilterContent } from "../../overlays/HoldingsFilterSheet.tsx";
import QuickActions from "./parts/QuickActions.tsx";

export default region("actions", ({ nav }) => {
  const registry = useRegistry();
  const filter = useHoldingsFilter();
  const sheet = useOverlay(HoldingsFilterSheet);
  const sendPage = registry.find("page", "send");
  return (
    <HoldingsFilterContent value={{ query: filter.query, onQuery: filter.setQuery }}>
      <QuickActions
        filter={filter.query}
        sheetTrigger={sheet.triggerProps}
        sendPage={sendPage === undefined ? null : sendPage.id}
        onSend={() => {
          if (sendPage !== undefined) nav.to(sendPage);
        }}
      />
      <HoldingsFilterSheet />
    </HoldingsFilterContent>
  );
});
```

Its parts are [QuickActions.tsx](../examples/demo/app/pages/portfolio/regions/actions/parts/QuickActions.tsx) (the Send button with `data-rex-nav`, the sheet trigger and the current filter) and [FilterForm.tsx](../examples/demo/app/pages/portfolio/regions/actions/parts/FilterForm.tsx) (the filter input with Apply and Clear). The overlay is [overlays/HoldingsFilterSheet.tsx](../examples/demo/app/pages/portfolio/overlays/HoldingsFilterSheet.tsx).

Check the page:

```sh
rex check
```

## 10. The send page

```sh
rex make page send --regions form,confirm,success --overlays TokenSelectorSheet,ContactPickerSheet
rex make hook send useWallet
rex make hook send useSendDraft
rex make part send TokenField --region form
rex make part send TokenOptions --region form
rex make part send ContactField --region form
rex make part send ContactOptions --region form
rex make part send AmountField --region form
rex make part send SendSummary --region confirm
rex make part send TransferReceipt --region success
```

`app/pages/send/page.ts`: a guest who may not view it is sent back to the portfolio (`recovery`), and the header shows a back link:

```ts
import { page } from "@sidioralabs/rex";
import { loadWallet } from "../../actions/load-wallet.ts";
import { pickContact } from "../../actions/pick-contact.ts";
import { pickToken } from "../../actions/pick-token.ts";
import { send } from "../../actions/send.ts";
import { viewer } from "../../policies/viewer.ts";

export default page("send", {
  route: "/send",
  policy: viewer.can("viewer.read"),
  recovery: "portfolio",
  draft: "route",
  load: { wallet: loadWallet },
  actions: [send, pickToken, pickContact],
  chrome: { title: "Send", back: "portfolio" },
  regions: ["form", "confirm", "success"],
  overlays: [
    { id: "TokenSelectorSheet", dismiss: "both", binding: "region" },
    { id: "ContactPickerSheet", dismiss: "both", binding: "region" },
  ],
});
```

`view.tsx` stays as generated, `states.tsx` uses `Button` as on the portfolio page, and `hooks/useWallet.ts` is the same as the portfolio's: pages never import each other, so each page has its own hook over its own `wallet` loader.

`hooks/useSendDraft.ts` keeps the amount in the route draft and validates it with `MONEY_PATTERN`:

```ts
import { useDraft } from "@sidioralabs/rex/client";
import { MONEY_PATTERN } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

const sendDraft = z.object({ amount: z.string().check(z.maxLength(32)) });

export function useSendDraft() {
  const draft = useDraft(sendDraft);
  const amount = draft.value?.amount ?? "";
  return {
    amount,
    valid: amount === "" || MONEY_PATTERN.test(amount),
    setAmount: (next: string) => draft.set(next === "" ? null : { amount: next }),
  };
}
```

`regions/confirm/region.tsx` binds the irreversible `send`. The send control is an `ActionForm` (so it also works without JavaScript, see [A form that works without JavaScript](recipes/form-without-js.md)) carrying the draft amount as a hidden input, and a disabled bound `Button` while the draft is invalid:

```tsx
import { ActionForm, region } from "@sidioralabs/rex/client";
import { send } from "../../../../actions/send.ts";
import Button from "../../../../components/Button.tsx";
import { useSendDraft } from "../../hooks/useSendDraft.ts";
import { useWallet } from "../../hooks/useWallet.ts";
import SendSummary from "./parts/SendSummary.tsx";

export default region("confirm", ({ act }) => {
  const wallet = useWallet();
  const draft = useSendDraft();
  const sending = act(send);
  const data = wallet.data;
  if (data === undefined) return null;
  const token = data.tokens.find((entry) => entry.id === data.account.sendToken) ?? null;
  const contact = data.contacts.find((entry) => entry.id === data.account.sendContact) ?? null;
  return (
    <SendSummary
      symbol={token?.symbol ?? null}
      recipient={contact?.name ?? null}
      amount={draft.amount}
      valid={draft.valid}
    >
      {draft.valid ? (
        <ActionForm action={send} submitLabel="Send">
          <input type="hidden" name="amount" value={draft.amount} />
        </ActionForm>
      ) : (
        <Button {...sending.controlProps} tone="primary" disabled aria-disabled>
          Send
        </Button>
      )}
    </SendSummary>
  );
});
```

`regions/confirm/parts/SendSummary.tsx` takes the region's send control as `children`:

```tsx
import { ShieldAlertIcon } from "../../../../../components/icons.ts";
import type { ReactNode } from "react";
import Card from "../../../../../components/Card.tsx";
import { Alert, AlertDescription } from "../../../../../components/ui/alert.tsx";
import { Separator } from "../../../../../components/ui/separator.tsx";

export interface SendSummaryProps {
  readonly symbol: string | null;
  readonly recipient: string | null;
  readonly amount: string;
  readonly valid: boolean;
  readonly children: ReactNode;
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export default function SendSummary({
  symbol,
  recipient,
  amount,
  valid,
  children,
}: SendSummaryProps) {
  const shown = amount === "" ? "0.001 (default)" : amount;
  return (
    <Card title="Review" variant="elevated">
      <p className="m-0 text-[15px] font-medium" data-demo-summary="">
        {`Send ${shown} ${symbol ?? "?"} to ${recipient ?? "?"}`}
      </p>
      <dl className="m-0 flex flex-col gap-2">
        <Row label="Token" value={symbol ?? "Not selected"} />
        <Row label="Amount" value={shown} />
        <Row label="Recipient" value={recipient ?? "Not selected"} />
        <Row label="Network fee" value="Included" />
      </dl>
      <Separator />
      <p className="m-0 flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Sending cannot be undone; you confirm it in the next step.
      </p>
      {valid ? null : (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="m-0">Fix the amount before sending.</p>
          </AlertDescription>
        </Alert>
      )}
      {children}
    </Card>
  );
}
```

Because `send` is irreversible, submitting the `ActionForm` opens the confirmation dialog first; the same happens when the action is invoked by shortcut, URL or palette.

`regions/success/region.tsx` shows the last transfer:

```tsx
import { region } from "@sidioralabs/rex/client";
import { useWallet } from "../../hooks/useWallet.ts";
import TransferReceipt from "./parts/TransferReceipt.tsx";

export default region("success", () => {
  const wallet = useWallet();
  const data = wallet.data;
  if (data === undefined) return null;
  return <TransferReceipt transfer={data.account.lastTransfer} />;
});
```

`regions/success/parts/TransferReceipt.tsx`:

```tsx
import { CircleCheckIcon, HistoryIcon } from "../../../../../components/icons.ts";
import { Alert, AlertDescription, AlertTitle } from "../../../../../components/ui/alert.tsx";

export interface TransferReceiptProps {
  readonly transfer: string | null;
}

export default function TransferReceipt({ transfer }: TransferReceiptProps) {
  const sent = transfer !== null;
  const Icon = sent ? CircleCheckIcon : HistoryIcon;
  return (
    <Alert role="status" variant={sent ? "success" : "outline"}>
      <Icon aria-hidden="true" />
      <AlertTitle>
        <h2 className="m-0 text-sm font-medium">Last transfer</h2>
      </AlertTitle>
      <AlertDescription>
        <p className="m-0 break-all" data-demo-transfer={sent ? "sent" : "none"}>
          {transfer ?? "No transfer has been sent from this wallet yet."}
        </p>
      </AlertDescription>
    </Alert>
  );
}
```

The `form` region binds `pick-token` and `pick-contact`, opens the two pickers and edits the amount draft. Copy it and its parts from the demo:

| File                                                                                                                                                                                                   | Role                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| [regions/form/region.tsx](../examples/demo/app/pages/send/regions/form/region.tsx)                                                                                                                     | binds both pick actions and both sheets, provides the sheet contents, renders the three fields                 |
| [parts/TokenField.tsx](../examples/demo/app/pages/send/regions/form/parts/TokenField.tsx), [parts/ContactField.tsx](../examples/demo/app/pages/send/regions/form/parts/ContactField.tsx)               | the selected token or contact, a Choose button that opens the sheet and a Next button bound to the pick action |
| [parts/TokenOptions.tsx](../examples/demo/app/pages/send/regions/form/parts/TokenOptions.tsx), [parts/ContactOptions.tsx](../examples/demo/app/pages/send/regions/form/parts/ContactOptions.tsx)       | the sheet bodies: a search field that picks on Enter and one bound button per choice                           |
| [parts/AmountField.tsx](../examples/demo/app/pages/send/regions/form/parts/AmountField.tsx)                                                                                                            | the amount input with balance hint and validation message                                                      |
| [overlays/TokenSelectorSheet.tsx](../examples/demo/app/pages/send/overlays/TokenSelectorSheet.tsx), [overlays/ContactPickerSheet.tsx](../examples/demo/app/pages/send/overlays/ContactPickerSheet.tsx) | the two region-bound sheets, each exporting the context its region fills                                       |

## 11. Check and publish the manifest

```sh
rex check
rex manifest
```

`rex check` runs the typecheck and every convention rule and must print `No findings.` `rex manifest` writes `.rex/manifest.json` (every page, action, entity, policy and flow, with input JSON Schemas) and renders `AGENTS.md` from it; commit both, they are what an agent reads before opening the app. The server serves the same manifest at `GET /rex/manifest`.

## 12. Run it as a person and as an agent

```sh
rex dev
```

- Open `/`. Press `shift+d` to toggle dust, or click "Hide dust"; the outcome region under the page states the result.
- Press mod+k: the palette lists every action of the page and every page.
- Open `/?act=toggle-hide-dust` to invoke the action by URL, and `/?overlay=HoldingsFilterSheet` to open the filter sheet.
- Open `/send`, pick a token and a contact, enter an amount, press mod+enter and confirm.
- Open any page with `?density=agent` for the still, expanded agent layout.
- Read the sidecar in the console: `window.__rex`, or the `<script type="application/rex+json" id="rex-page">` element.
- Set the cookie `demo-actor=guest` and reload: the wallet actions are listed with `allowed: false` and a reason, disabled in the DOM and the palette, and refused by URL.

## 13. Test the pages

Page tests live in each page's `test/` folder and use `@sidioralabs/rex/testing`, which renders pages and regions on the real runtime against a real in-process server. Add the test dependencies:

```sh
pnpm add -D vitest happy-dom @testing-library/react @testing-library/dom
```

`vitest.config.ts` uses the Rex Vite plugin so tests import `rex:app`:

```ts
import { rex } from "@sidioralabs/rex/vite";
import { defineConfig } from "vitest/config";

const CLIENT_BUNDLE_ONLY = "rex:boundary";

export default defineConfig({
  plugins: rex().filter((plugin) => plugin.name !== CLIENT_BUNDLE_ONLY),
  test: {
    name: "demo",
    environment: "happy-dom",
    include: ["app/pages/*/test/**/*.test.{ts,tsx}"],
  },
});
```

Add `"test:unit": "vitest run"` to the scripts. Each page's `test/wallet.ts` restores the seeded stores after every test and builds a test app for an actor ([examples/demo/app/pages/portfolio/test/wallet.ts](../examples/demo/app/pages/portfolio/test/wallet.ts)). A region test, trimmed from `test/hero.test.tsx`:

```tsx
import { renderRegion } from "@sidioralabs/rex/testing";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { owner } from "../../../../server.ts";
import { setupWalletTests, walletApp } from "./wallet.ts";

setupWalletTests();

describe("portfolio hero region", () => {
  it("renders the balance hero alone on the page runtime", async () => {
    const view = await renderRegion(walletApp(owner), "portfolio", "hero");
    await waitFor(() =>
      expect(view.container.querySelector("[data-demo-total]")?.textContent).toBe("$76,580.00"),
    );
  });
});
```

The demo has tests for every page and region in [portfolio/test](../examples/demo/app/pages/portfolio/test) and [send/test](../examples/demo/app/pages/send/test). Run them:

```sh
pnpm test:unit
```

## 14. Build and serve

```sh
rex build
node dist/server.js
```

`rex build` runs `rex check`, builds the client into `dist/client/` and the server into `dist/server.js`, prerenders any `ssg` and `static` pages, and checks the page budgets. `node dist/server.js` serves the app on `PORT` (3000 by default). `rex build --target edge | bun | deno | static` builds for other runtimes.

The demo also carries a Playwright operability walk, [e2e/operability.spec.ts](../examples/demo/e2e/operability.spec.ts), which builds the app, opens every page in both densities and invokes every action by click, shortcut, URL and palette; [agent-contract.md](agent-contract.md#operating-a-rex-app-from-a-browser) describes the procedure it follows.

## Next steps

- [Recipes](recipes/README.md): loaders, forms without JavaScript, overlays, flow approvals, static pages, i18n, web components, incremental adoption and the DesignX standard.
- [convention.md](convention.md) for the file roles and the import table, [primitives.md](primitives.md) for the declarations, [cli.md](cli.md) for every command.
- [API reference](api/README.md), generated from the package entries.
