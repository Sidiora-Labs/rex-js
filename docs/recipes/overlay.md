# Add an overlay

An overlay is a sheet or dialog that belongs to one page. It is declared twice, in `page.ts` and in its own file, and the runtime throws if the two disagree. This recipe adds the demo's holdings filter sheet to the `portfolio` page.

## 1. Generate the file

```sh
rex make overlay portfolio HoldingsFilterSheet
```

This writes `app/pages/portfolio/overlays/HoldingsFilterSheet.tsx` with `dismiss: "both"` and `binding: "region"`. `rex make overlay` writes only the file, so add the declaration to `page.ts` yourself.

## 2. Declare it on the page

```ts
export default page("portfolio", {
  route: "/",
  // ...
  overlays: [{ id: "HoldingsFilterSheet", dismiss: "both", binding: "url" }],
});
```

- `dismiss` is `escape` (Escape closes it), `button` (a Close button closes it) or `both`.
- `binding` is `region` (open state lives in the page's overlay registry) or `url` (open state is the repeatable `overlay` query parameter, so a reload or a shared link restores it; opening pushes a history entry and closing replaces it).

## 3. Write the overlay

The overlay file default-exports `overlay(id, { dismiss, binding }, render)` with the same id, dismissal and binding. An overlay may not fetch data or bind actions, so the region that opens it passes the content in, here through a React context the overlay file exports (`examples/demo/app/pages/portfolio/overlays/HoldingsFilterSheet.tsx`):

```tsx
import { overlay } from "@sidioralabs/rex/client";
import { createContext, use } from "react";
import Sheet from "../../../components/Sheet.tsx";
import FilterForm, { type FilterFormProps } from "../regions/actions/parts/FilterForm.tsx";

export const HoldingsFilterContent = createContext<FilterFormProps | null>(null);

export default overlay("HoldingsFilterSheet", { dismiss: "both", binding: "url" }, ({ close }) => {
  const content = use(HoldingsFilterContent);
  return (
    <Sheet description="Show only the holdings whose symbol or name contains the text.">
      {content === null ? (
        <p>Open the filter from the actions region.</p>
      ) : (
        <FilterForm {...content} onDone={close} />
      )}
    </Sheet>
  );
});
```

The render function receives `close`. Rex renders the frame around it: `role="dialog"`, `aria-modal="true"`, `data-rex-overlay="portfolio/HoldingsFilterSheet"`, a heading derived from the id ("Holdings filter sheet") and, when `dismiss` allows it, a Close button with `data-rex-overlay-close`.

## 4. Open it from a region

A region opens the overlay with `useOverlay(Overlay)`, renders the overlay component, and spreads `triggerProps` on the control that opens it (`examples/demo/app/pages/portfolio/regions/actions/region.tsx`):

```tsx
import { region, useOverlay } from "@sidioralabs/rex/client";
import { useHoldingsFilter } from "../../hooks/useHoldingsFilter.ts";
import HoldingsFilterSheet, { HoldingsFilterContent } from "../../overlays/HoldingsFilterSheet.tsx";
import QuickActions from "./parts/QuickActions.tsx";

export default region("actions", ({ nav }) => {
  const filter = useHoldingsFilter();
  const sheet = useOverlay(HoldingsFilterSheet);
  return (
    <HoldingsFilterContent value={{ query: filter.query, onQuery: filter.setQuery }}>
      <QuickActions filter={filter.query} sheetTrigger={sheet.triggerProps} /* ... */ />
      <HoldingsFilterSheet />
    </HoldingsFilterContent>
  );
});
```

`useOverlay` returns `open`, `show()`, `hide()`, `toggle()` and `triggerProps` (`data-rex-overlay-trigger`, `aria-haspopup="dialog"`, `aria-expanded` and `onClick`). The part spreads them on its button:

```tsx
<Button {...sheetTrigger}>Filter holdings</Button>
```

## What you get

- Focus moves into the overlay when it opens, Tab and Shift+Tab stay inside, and focus returns to the opener when it closes.
- The sidecar lists every declared overlay with `id`, `open` and `dismiss`, so an agent knows what is open and how to close it.
- With `binding: "url"`, `/?overlay=HoldingsFilterSheet` opens the page with the sheet open.

## Checks

| Rule | Reports |
| --- | --- |
| `parity/overlay-missing` | an overlay declared in `page.ts` without `overlays/<Id>.tsx` |
| `parity/overlay-undeclared` | an overlay file that `page.ts` does not declare |
| `naming/overlay-name` | an overlay file name that is not PascalCase |
| `boundaries/import-table` | an overlay importing data, actions or hooks |
| `render/static-needs-js` | a region-bound overlay on a page rendered `static` |

Related: [agent-contract.md](../agent-contract.md#overlays), [convention.md](../convention.md#import-table).
