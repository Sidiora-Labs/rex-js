# Export a part as a web component

A part is a pure component: props in, events out. `defineElement` from `@sidioralabs/rex/client/interop` registers a part as a custom element, so any page (a CMS template, a server-rendered page, another framework) can use it as an HTML tag. In the other direction, parts may render custom elements and reach plain DOM through `Native`.

## 1. Pick the part

The demo's `TokenChip` component (`examples/demo/app/components/TokenChip.tsx`) takes flat `symbol` and `price` string props and is registered as `<demo-token-chip>` in `examples/demo/app/components/token-chip-element.ts` (`defineElement(TOKEN_CHIP_TAG, TokenChip, { props: { symbol: "string", price: "string" } })`), which the embed page renders. A part exported as an element takes its props from attributes, so give it flat props. The example below extends that chip with a number, a boolean and a json prop to show every attribute kind; its import below is a path to the extended part rather than the demo file:

```tsx
export interface TokenChipProps {
  readonly symbol?: string;
  readonly amount?: number;
  readonly muted?: boolean;
  readonly tags?: readonly string[];
}

export default function TokenChip({ symbol = "?", amount = 0, muted = false, tags = [] }: TokenChipProps) {
  return (
    <span data-chip={symbol}>
      {symbol} {amount.toFixed(2)} {muted ? "muted" : "live"} {tags.join(" ")}
    </span>
  );
}
```

## 2. Register it

Registration is a side effect, so it lives in a module of its own, for example `app/components/token-chip-element.ts` (as the demo does; files under `app/components` are classified as components) or a `widgets/` entry outside `app/`, such as `widgets/token-chip.ts`:

```ts
import { defineElement } from "@sidioralabs/rex/client/interop";
import TokenChip from "../app/pages/portfolio/regions/holdings/parts/TokenChip.tsx";

defineElement("rex-token-chip", TokenChip, {
  props: { symbol: "string", amount: "number", muted: "boolean", tags: "json" },
});
```

`defineElement(tagName, Part, { props })`:

- `tagName` must be a valid custom element name (lowercase, with a dash), not yet defined;
- `props` maps each prop to how its attribute is read: `string`, `number` (a non-numeric value throws), `boolean` (present and not `"false"` is true) or `json` (parsed with `JSON.parse`);
- attribute names are the kebab-case prop names (`tokenCount` reads `token-count`), and they are observed: changing an attribute re-renders the part;
- the element renders the part into itself with its own React root when connected and unmounts it when removed from the document.

It returns the element class, with `tagName` and `observedAttributes`.

## 3. Build and use it

Bundle the entry with Vite in library mode (or any bundler) and load the script on the host page:

```html
<script type="module" src="/widgets/token-chip.js"></script>
<rex-token-chip symbol="ETH" amount="2" tags='["l1","gas"]'></rex-token-chip>
```

A part rendered this way has no Rex page around it: it shows data and raises DOM events, and does not invoke actions. To embed a whole page with its actions, sidecar and outcome region, use `mountRexPage` ([Adopt Rex one page at a time](incremental-adoption.md)).

## Custom elements and plain DOM inside a Rex app

Parts may render custom elements from other libraries. Because an agent and a keyboard user must reach every control, the checker reports `traps/custom-element` for a custom element tag that has neither a `tabIndex` that makes it focusable nor a declared keyboard equivalent:

```tsx
<map-picker tabIndex={0} />
<map-picker data-rex-alternative="send/pick-contact" />
```

For code that needs a DOM node (a chart library, a third-party widget), render `Native`. It forwards its ref to the element it renders (`div` by default, or `as="span" | "section" | "article" | "figure"`) and calls `mount(node)` after mount, running the returned cleanup on unmount or when `mount` changes:

```tsx
import { Native } from "@sidioralabs/rex/client/interop";

export default function PriceChart({ points }: { readonly points: readonly number[] }) {
  return (
    <Native
      aria-label="Price chart"
      mount={(node) => {
        const chart = drawChart(node, points);
        return () => chart.destroy();
      }}
    />
  );
}
```

Here `drawChart` stands for the chart library's own entry point. `Native` does not accept `children` or `dangerouslySetInnerHTML`; raw HTML goes through `unsafeHtml()` only.

Related: [convention.md](../convention.md#file-roles), [agent-contract.md](../agent-contract.md#addressing).
