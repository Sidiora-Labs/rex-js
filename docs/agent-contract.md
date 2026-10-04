# The agent contract

A Rex app has one DOM. Humans and agents use the same components; an agent finds controls by address, reads what the page offers from a JSON sidecar, and invokes actions through the same four routes a human has. This page describes what the runtime renders and how to operate it.

Sources: `packages/rex/src/client/agent/*`, `packages/rex/src/client/act.ts`, `packages/rex/src/client/page.tsx`, `packages/rex/src/client/overlay.tsx`, `packages/rex/src/client/shell.tsx`, `packages/rex/src/manifest/sidecar.schema.ts`, `packages/rex/src/core/protocol.ts`, `packages/rex/src/server/router.ts`.

## Addressing

Addresses are built from declaration names by the helpers in `packages/rex/src/core/ids.ts` (`pageAddress`, `regionAddress`, `overlayAddress`, `actionAddress`). They do not depend on markup or styles, so they are identical across builds.

| Attribute | Value | Rendered on |
| --- | --- | --- |
| `data-rex-page` | `<page>` | the `<main>` element of the active page (`PageHost`) |
| `data-rex-region` | `<page>/<region>` | the `<section>` landmark of each region (`Region`), with `aria-label` set to the region title |
| `data-rex-overlay` | `<page>/<Overlay>` | the `role="dialog"` element of an open overlay |
| `data-rex` | `<page>/<action>` | each action control, through `controlProps` from `act()` |

`ADDRESS_ATTRIBUTES` in `packages/rex/src/client/agent/address.tsx` holds this mapping. `readAddresses(root)` lists every address in a subtree and `findAddressed(root, kind, address)` finds the elements for one address. Inside a region, `useAddress()` returns the page, region and overlay in scope and an `action(id)` function that builds the action address.

Other attributes the runtime renders:

| Attribute | Meaning |
| --- | --- |
| `data-rex-allowed="true"` or `"false"` | on action controls and palette items: whether the current actor may run the action |
| `data-rex-nav="<page>"` | shell navigation links, the back button and the recovery button |
| `data-rex-overlay-trigger="<page>/<Overlay>"` | the control that opens an overlay (`useOverlay().triggerProps`) |
| `data-rex-overlay-close="<page>/<Overlay>"` | the overlay's Close button |
| `data-rex-overlay-dismiss` | the overlay's declared dismissal |
| `data-rex-outcome`, `data-rex-outcome-ok`, `data-rex-outcome-at`, `data-rex-outcome-dismiss` | the outcome region |
| `data-rex-confirm`, `data-rex-confirm-accept`, `data-rex-confirm-cancel` | the confirmation dialog and its buttons, each set to `<page>/<action>` |
| `data-rex-palette`, `data-rex-palette-item="<page>/<action>"`, `data-rex-palette-page="<page>"` | the command palette and its entries |
| `data-rex-sidecar="<page>"` | the sidecar script |
| `data-rex-density` | on the document root: `default` or `agent` |
| `data-rex-app-state` | `loading` or `error` while the app starts, `not-found` for an unknown route |
| `data-rex-shell` | the shell container |

An action control from `act(declaration).controlProps` carries `data-rex`, `data-rex-allowed`, `disabled`, `aria-disabled`, `aria-busy`, and, when the actor is not allowed, `title="Not allowed: <reason>"` (`ActControlProps`).

## The sidecar

Each rendered page contains exactly one element:

```html
<script type="application/rex+json" id="rex-page" data-rex-sidecar="send">{...}</script>
```

The MIME type and id are `SIDECAR_MIME_TYPE` and `SIDECAR_ELEMENT_ID`. `RexSidecar` renders it once per page and throws if a second one mounts. The JSON is escaped so `<`, `>`, `&`, U+2028 and U+2029 cannot break out of the script. The same object is assigned to `window.__rex`. The payload is rebuilt whenever the data state, the actor's permissions, an overlay's open state, a registered affordance or the outcome changes.

The payload shape is defined by `sidecarSchema` in `packages/rex/src/manifest/sidecar.schema.ts`. Every object is strict (no extra keys):

```ts
{
  version: 1,                       // SIDECAR_VERSION
  page: string,                     // page id
  params: Record<string, unknown>,  // parsed page params
  state: RexDataState,              // one of the nine data states
  actions: Array<{
    id: string,
    label: string,                  // the action label, or its id when it has none
    allowed: boolean,
    reason: string | null,          // null when allowed; the policy reason code when not
    effect: "reversible" | "irreversible" | "read",
    input: Record<string, unknown>, // JSON Schema of the action input
    via: Array<"click" | "key" | "palette" | "url">,
  }>,
  overlays: Array<{
    id: string,
    open: boolean,
    dismiss: "escape" | "button" | "both",
  }>,
  outcome: { action: string, ok: boolean, message: string, at: string /* ISO datetime */ } | null,
}
```

Additional constraints checked by the schema: an allowed action has `reason: null`, a disallowed action has a non-null reason, and action ids and overlay ids are unique. `actions` lists the page's declared actions in declaration order, followed by registered affordances such as flow approval gates. `via` is `click`, `key`, `palette`, `url` for a declared action, without `key` when the action has no shortcut; flow gate affordances list `click` and `palette`.

The JSON Schema is exported as `sidecarJsonSchema` (`$id` `https://sidioralabs.com/rex/sidecar.schema.json`, title "Rex page sidecar"), and `validateSidecar(payload)` returns either `{ valid: true, payload }` or `{ valid: false, issues }`. `readSidecar(root)` parses the single sidecar element in a document and throws if there is not exactly one.

Policy reason codes (`packages/rex/src/core/policy.ts`): `never`, `locked` (the actor attribute `unlocked` is not true), `no-account` (no `account` attribute), `custody-mismatch`, and `missing-permission:<permission>`.

## The outcome region

`OutcomeRegion` renders inside `Page.Outcome`, a `<section role="status" aria-live="polite" aria-atomic="true" aria-label="Outcome">`. There is one per page, rendered by the shell under the page body.

- With no outcome: `<p data-rex-outcome="none">No action has run on this page yet.</p>`.
- After an invocation: a `<div data-rex-outcome="<action id>" data-rex-outcome-ok="true|false" data-rex-outcome-at="<ISO time>">` containing `<label>: Succeeded` or `<label>: Failed`, the message, and a Dismiss button (`data-rex-outcome-dismiss="<page>"`) that clears it.

Outcomes are kept per page in the outcome store (`packages/rex/src/client/outcome.ts`). The messages the runtime writes are:

| Situation | Message |
| --- | --- |
| success | `<label> succeeded` |
| server or network failure | `<label> failed: <message>` |
| actor not allowed | `<label>: not allowed (<reason>)` |
| input fails the action schema | `<label>: invalid input: <issues>` |
| URL `input` is not JSON | `<label>: invalid input: the input parameter is not valid JSON` |
| confirmation cancelled | `<label> cancelled` |
| action not declared on the page | `page "<page>" declares no action "<id>"` |
| flow gate decision | `<Approve or Reject> <gate label> succeeded; flow <status>` |

The sidecar `outcome` field mirrors the same entry. Rex does not use transient toasts for action results.

## Invoking actions: the four routes

Every action declared in a page's `actions` list is reachable four ways while that page is active. All four go through the same invoker (`useInvoke` in `packages/rex/src/client/agent/confirm.tsx`), so policy checks, input validation, confirmation and outcomes behave the same.

1. **Click.** Click the element with `data-rex="<page>/<action>"`. Regions bind actions with `act(declaration)`, whose `run(input)` routes irreversible actions through the confirmation dialog.
2. **Keyboard.** Press the shortcut declared on the action (for example `shift+t`). `mod` means Meta or Control. Shortcuts are ignored while focus is inside an `aria-modal="true"` element, ignored in inputs, textareas, selects and contenteditable elements unless the shortcut uses `mod`, and ignored on key repeat. Shortcuts run with input `{}`.
3. **URL.** Load `<route>?act=<action id>` and optionally `&input=<URL-encoded JSON>`. `parseUrlInvocation` reads the two parameters; the runtime removes `act` and `input` from the URL (a history replace) and runs the action once. Without `input` the action runs with `{}`.
4. **Palette.** Press mod+k to open the palette, type to filter, and press Enter or click an entry. Selecting an action runs it with input `{}`.

Disallowed actions appear in the sidecar and the palette with their reason. Their controls are disabled, the palette entry is disabled, and URL or shortcut invocation records a `not allowed` outcome without calling the server. The server evaluates the same policy and is authoritative: it rejects a disallowed call with `FORBIDDEN`.

### Reserved query keys

`RESERVED_QUERY_KEYS` in `packages/rex/src/core/protocol.ts` is `act`, `input`, `draft`, `density`. Page params with these names are not read from the query string, and `nav.href()` refuses to put a param with a reserved name into a URL. URL-bound overlays use a separate `overlay` query key (`OVERLAY_QUERY_KEY`).

### The palette

`RexPalette` (cmdk) toggles on mod+k (`PALETTE_SHORTCUT`). It renders `role="dialog" aria-modal="true" aria-label="Command palette"` with `data-rex-palette`, a search input ("Search actions and pages"), and two groups:

- **Actions**: the active page's declared actions and registered affordances. Each item has `data-rex-palette-item="<page>/<id>"`, `data-rex-allowed`, the label, the id, the shortcut if any, and "Not allowed: `<reason>`" when disallowed. Items are filtered by label and id.
- **Pages**: every page whose `chrome.nav` is true and whose params accept `{}`, as "Go to `<title>`" with `data-rex-palette-page="<page>"`. Selecting one navigates.

Escape closes the palette and focus returns to the element that had it.

## Confirmation protocol

Actions with `effect: "irreversible"` need confirmation on every route.

1. The invoker validates the input against the action schema and checks the policy. If either fails, it records the outcome and stops.
2. It opens the confirmation dialog (`ConfirmProvider`): `role="alertdialog" aria-modal="true"` with `data-rex-confirm="<page>/<action>"`, the heading "Confirm `<label>`", the text "`<label>` cannot be undone. Input: `<json>`", a "Confirm `<label>`" button (`data-rex-confirm-accept`) and a Cancel button (`data-rex-confirm-cancel`). The accept button has focus; Escape cancels; Tab cycles between the two buttons.
3. On accept, the client calls the `_confirm` procedure (`CONFIRM_PROCEDURE`) at `/rex/rpc` with `{ action, input }`. The server checks that the action exists (`NOT_FOUND` otherwise), is irreversible (`BAD_REQUEST` otherwise), is allowed for the actor (`FORBIDDEN`) and that the input is valid (`BAD_REQUEST`). It returns `{ token, action, inputDigest, expiresAt }`.
4. The client calls the action procedure with the token in the `x-rex-confirm` header (`REX_CONFIRM_HEADER`).
5. The server consumes the token before running the handler. The token is single use and must match the action id, the SHA-256 digest of the canonical JSON of the parsed input, and the actor id, and must not be expired. The default lifetime is 60 seconds (`DEFAULT_CONFIRM_TTL_MS`, configurable with `confirmTtlMs` on `createRexServer`). Any mismatch fails with `PRECONDITION_REQUIRED` and HTTP status 428; the handler does not run.

Cancelling records `<label> cancelled` with code `CANCELLED`.

## Density

The density preference is `default` or `agent` (`REX_DENSITIES` in `packages/rex/src/server/context.ts`). `DensityProvider`, which `createRexEntry` mounts at the root, resolves it in this order (`resolveDensity` in `packages/rex/src/client/agent/density.ts`):

1. a value set at runtime with `useDensity().setDensity(...)`, which is also stored;
2. the `density` query parameter of the page URL;
3. the `x-rex-density` header on the `GET /rex/manifest` response;
4. the stored preference in `localStorage` under `rex:density`;
5. `default`.

The server echoes `x-rex-density` on the manifest response only when the request carried that header, and sets it on every `/rex/rpc` response to the request's density (`default` when absent). A header value other than `default` or `agent` is answered with status 400 and `{ "code": "BAD_REQUEST" }`. In `rex dev`, the Vite plugin copies a `density` query parameter on a `/rex` request into the `x-rex-density` header (`forwardDensity`).

The resolved density is written to `data-rex-density` on the document root. With `agent`:

- `density.css` sets animation and transition durations and delays to 0 and `--rex-motion-duration` to `0ms`;
- links, buttons, inputs, selects, textareas, summaries, `role="option"` elements and any `[data-rex]` element get a minimum block and inline size of 44px (`--rex-hit-target`);
- every closed `<details>` element is opened, including ones added later (a `MutationObserver`), and `[data-rex-collapsible-content]` is shown.

Density is an attribute on the same component tree, not a separate agent view.

## Overlays

An overlay is declared twice: in `page.ts` (`overlays: [{ id, dismiss, binding }]`) and in its file with `overlay(id, { dismiss, binding }, render)`. The runtime throws if the two disagree.

- `dismiss`: `escape` (Escape closes it), `button` (a Close button closes it), or `both`.
- `binding`: `region` (open state lives in the overlay registry) or `url` (open state is the repeatable `overlay` query parameter, so a reload restores it; opening pushes a history entry and closing replaces it).

A region opens an overlay with `useOverlay(Component)`, which returns `open`, `show()`, `hide()`, `toggle()` and `triggerProps` for the opener (`data-rex-overlay-trigger`, `aria-haspopup="dialog"`, `aria-expanded`, `onClick`). When open, the overlay renders `role="dialog" aria-modal="true"` with `data-rex-overlay`, a heading derived from the id (`TokenSelectorSheet` becomes "Token selector sheet"), the content, and a Close button (`data-rex-overlay-close`) when `dismiss` allows it. Focus moves to the first focusable element, Tab and Shift+Tab stay inside, and on close focus returns to the opener. The sidecar lists every declared overlay with its `open` state.

## Flow approval gates

When a page renders `useFlow(flow, instanceId)` and that flow instance is paused at an approval gate, the page gains two affordances:

- ids `<flow>.<gate>.approve` and `<flow>.<gate>.reject`;
- labels "Approve `<gate label>`" and "Reject `<gate label>`";
- effect `irreversible`, input schema `{}`, routes `click` and `palette`;
- `allowed` and `reason` from evaluating the gate's `approvers` predicate for the current actor.

They appear in the sidecar `actions` list and in the palette, and `approveProps` and `rejectProps` give the controls `data-rex="<page>/<flow>.<gate>.<decision>"`. A decision opens the confirmation dialog, then calls the `decide` procedure at `/rex/flow` through the flow client (`createFlowClient`, or one supplied with `FlowClientProvider`). The result is written to the outcome region.

## Operating a Rex app from a browser

A step-by-step procedure for a browser-driving agent:

1. **Read the app.** Fetch `GET /rex/manifest` for every page (route, params, actions, overlays, states) and action (label, shortcut, effect, policy, input schema), or read the committed `.rex/manifest.json` and `AGENTS.md`.
2. **Choose the density.** Open pages with `?density=agent` to get a still, expanded layout with large hit targets. Confirm with `document.documentElement.getAttribute("data-rex-density")`.
3. **Open the page.** Navigate to the page route. Wait until there is exactly one `script[type="application/rex+json"]#rex-page` whose `page` is the page id and whose `state` is `ready`. If the state is anything else, the page renders the matching state component; `permission-denied` comes with a recovery button (`data-rex-nav`) when the page declares `recovery`.
4. **Read the sidecar.** Parse the sidecar (or read `window.__rex`). Use `actions[].allowed` and `reason` to decide what you can do, `input` to build the input, and `via` to pick a route.
5. **Invoke.** Pick the cheapest route:
   - URL: `<route>?act=<id>&input=<json>` when you need to pass input;
   - click: `main [data-rex="<page>/<id>"]`;
   - key: the declared shortcut, with focus outside text fields;
   - palette: mod+k, type the label, click `[data-rex-palette-item="<page>/<id>"]`.
6. **Confirm.** For `effect: "irreversible"`, wait for `[role="alertdialog"][data-rex-confirm="<page>/<id>"]` and click `[data-rex-confirm-accept="<page>/<id>"]`, or cancel with `[data-rex-confirm-cancel]` or Escape.
7. **Read the result.** Wait until `[data-rex-outcome]` names the action and its `data-rex-outcome-at` changes; read `data-rex-outcome-ok` and the message. `window.__rex.outcome` carries the same values.
8. **Use overlays.** Click `[data-rex-overlay-trigger="<page>/<Overlay>"]`, work inside `[data-rex-overlay="<page>/<Overlay>"]`, and dismiss with Escape or `[data-rex-overlay-close]` as the sidecar `dismiss` allows. Pickers in the demo accept typed input: type into the overlay's input and press Enter.
9. **Navigate.** Use the shell links (`a[data-rex-nav]`), the back button, or the palette's Pages group.

The demo's operability walk (`examples/demo/e2e/walk.ts` and `operability.spec.ts`) follows this procedure for every action and overlay and is a working reference.
