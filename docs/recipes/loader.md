# Load page data with a loader

A page declares the data it needs in `page.ts` with `load`, and its components read it with `useLoader`. There is no second data primitive: a loader is a read action, so it has a policy, validated input and output, an audit record and a manifest entry like every other action.

## 1. Declare a read action

A loader references an action whose `effect` is `"read"`. The demo's `load-wallet` action (`examples/demo/app/actions/load-wallet.ts`) is one:

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

## 2. Declare the loader on the page

`load` maps camelCase loader names to read actions. `load` values are a read action or `{ action, input, invalidatedBy }`: when the action needs input from the route params, give `{ action, input }`, where `input` maps the validated params to the action input; `invalidatedBy` lists mutating action ids that refetch the loader, the reverse of `invalidates`, and `input` may be left out when `invalidatedBy` is given:

```ts
import { page } from "@sidioralabs/rex";
import { id } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { loadWallet } from "../../actions/load-wallet.ts";
import { readToken } from "../../actions/read-token.ts";
import { viewer } from "../../policies/viewer.ts";

export default page("token", {
  route: "/tokens/:token",
  params: z.object({ token: id() }),
  policy: viewer.can("viewer.read"),
  load: {
    wallet: loadWallet,
    token: { action: readToken, input: (params) => ({ id: String(params.token) }) },
  },
  cache: { staleTime: 30_000 },
  regions: ["detail"],
});
```

`page()` validates the declaration and throws a `RexDeclarationError` with code `REX203` when a loader name is not camelCase, when a value is neither an action nor `{ action, input, invalidatedBy }`, or when the action's effect is not `read`; `cache.staleTime` (milliseconds) is validated as `REX204`. The manifest lists each loader under the page as `{ name, action, input }`, where `input` is `"params"` for a bare action and `"mapped"` for `{ action, input }`.

In the demo, the portfolio and send pages declare `load: { wallet: loadWallet }` (`examples/demo/app/pages/portfolio/page.ts` and `examples/demo/app/pages/send/page.ts`), and the embed page declares `load: { tokens: listTokens }` (`examples/demo/app/pages/embed/page.ts`).

## 3. Read it with `useLoader`

`useLoader(page, name)` returns the TanStack Query result for one loader, typed with the action's output. `useLoaders(page)` returns all of them keyed by name.

```ts
import { useLoader } from "@sidioralabs/rex/client";
import tokenPage from "../page.ts";

export function useToken() {
  return useLoader(tokenPage, "token");
}
```

```tsx
import { region } from "@sidioralabs/rex/client";
import { useToken } from "../../hooks/useToken.ts";
import TokenDetail from "./parts/TokenDetail.tsx";

export default region("detail", () => {
  const token = useToken();
  if (token.data === undefined) return null;
  return <TokenDetail symbol={token.data.symbol} balance={token.data.balance} />;
});
```

The demo reads its wallet loader the same way in `examples/demo/app/pages/portfolio/hooks/useWallet.ts`, which calls `useLoader(active.page, "wallet")` for the active page, and its regions call `useWallet()`.

Every consumer of the same loader with the same input shares one query: the key is `["loader", <page id>, <loader name>, <input digest>]`, so two regions reading `token` send one request. `cache.staleTime` applies to every loader of the page.

## What happens at run time

- **Server render.** For a page rendered on the server (the default `render: "ssr"`), the server runs the page's loaders in process through the action router, so policy, validation and audit apply, and writes the results into the HTML in a `<script type="application/rex+data">`. The client hydrates them into the QueryClient before the first render, so the first paint has data and sends no request.
- **Build time.** For a page with `render: "ssg"` or `render: "static"`, `rex build` runs the page's loaders while it prerenders the page, through the same action router as a server render, as the anonymous build actor, so policy, validation and audit apply. An `ssg` page carries the results in its `<script type="application/rex+data">` and hydrates them like a server-rendered page; a `static` page keeps only the rendered HTML, since it ships no JavaScript. When an `ssg` page with `revalidate` is regenerated, its loaders run again.
- **Client navigation.** On a client-side route change the loaders run as RPC calls to `/rex/rpc`.
- **Data states.** A page's loaders feed its data state with the same precedence as any other query: a pending loader without data is `loading`; a failed loader without data is `terminal-error` when the action failed with a 4xx status other than 408, 425 or 429 (for example `NOT_FOUND`), and `recoverable-error` otherwise; a mix of succeeded and missing loaders is `partial`. The `RecoverableError` state's `retry` refetches them. Failures arrive as `RexLoaderError` with `page`, `loader`, `code`, `status` and `message`.
- **Invalidation.** A mutating action refetches every loader it names in `invalidates`, either by loader name or by the loader's read action id, and every loader that lists the action's id in its `invalidatedBy`:

```ts
export const send = action("send", {
  // ...
  effect: "irreversible",
  invalidates: ["wallet"], // the loader name, or "load-wallet", the action id
  handler: async (input, ctx) => {
    // ...
  },
});
```

## Checks

- `page()` rejects malformed `load` and `cache` values when the declaration loads, so `rex dev`, `rex build` and `rex manifest` stop with the `REX203` or `REX204` message and the field name.

Related: [primitives.md](../primitives.md#page), [Ship a static page](static-page.md) for loaders at build time.
