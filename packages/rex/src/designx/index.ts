import type { ShellNavForm, ShellSheetForm } from "../client/shell/components.ts";
import type { NonReadyState } from "../core/states.ts";
import type { RexScreen } from "../manifest/types.ts";

export const DESIGNX_REGISTRY_URL = "https://dxuireact.com/r";

export const DESIGNX_ITEM_KINDS = ["ui", "hook", "lib", "style"] as const;

export type DesignxItemKind = (typeof DESIGNX_ITEM_KINDS)[number];

export const DESIGNX_ITEMS = Object.freeze({
  theme: "style",
  utils: "lib",
  alert: "ui",
  avatar: "ui",
  badge: "ui",
  breadcrumb: "ui",
  button: "ui",
  card: "ui",
  checkbox: "ui",
  command: "ui",
  "data-table": "ui",
  dialog: "ui",
  empty: "ui",
  field: "ui",
  form: "ui",
  input: "ui",
  kbd: "ui",
  "navigation-menu": "ui",
  "number-field": "ui",
  pagination: "ui",
  progress: "ui",
  "radio-group": "ui",
  "scroll-area": "ui",
  select: "ui",
  separator: "ui",
  sheet: "ui",
  sidebar: "ui",
  skeleton: "ui",
  spinner: "ui",
  switch: "ui",
  table: "ui",
  tabs: "ui",
  textarea: "ui",
  toolbar: "ui",
  tooltip: "ui",
  typography: "ui",
  "use-media-query": "hook",
  "use-touch-capable": "hook",
} as const satisfies Readonly<Record<string, DesignxItemKind>>);

export type DesignxItemName = keyof typeof DESIGNX_ITEMS;

export interface DesignxProvidedItem {
  readonly file: string;
  readonly alias: string;
  readonly from: string;
}

export const DESIGNX_PROVIDED = Object.freeze({
  "use-mobile": Object.freeze({
    file: "use-screen.ts",
    alias: "@/hooks/use-mobile",
    from: "useScreen from @sidioralabs/rex/client",
  }),
} as const satisfies Readonly<Record<string, DesignxProvidedItem>>);

export type DesignxProvidedName = keyof typeof DESIGNX_PROVIDED;

export const DESIGNX_SINGLE_FORM = "default";

export type DesignxSingleForm = typeof DESIGNX_SINGLE_FORM;

export type DesignxForms<F extends string> = Readonly<Record<F, DesignxItemName>>;

export type DesignxStateForm = NonReadyState;

export interface DesignxSurfaces {
  readonly button: DesignxForms<DesignxSingleForm>;
  readonly sheet: DesignxForms<ShellSheetForm>;
  readonly paletteItem: DesignxForms<DesignxSingleForm>;
  readonly outcome: DesignxForms<DesignxSingleForm>;
  readonly nav: DesignxForms<ShellNavForm>;
  readonly breadcrumbs: DesignxForms<DesignxSingleForm>;
  readonly form: DesignxForms<DesignxSingleForm>;
  readonly field: DesignxForms<DesignxSingleForm>;
  readonly input: DesignxForms<DesignxSingleForm>;
  readonly textarea: DesignxForms<DesignxSingleForm>;
  readonly select: DesignxForms<DesignxSingleForm>;
  readonly numberField: DesignxForms<DesignxSingleForm>;
  readonly checkbox: DesignxForms<DesignxSingleForm>;
  readonly switch: DesignxForms<DesignxSingleForm>;
  readonly radioGroup: DesignxForms<DesignxSingleForm>;
  readonly list: DesignxForms<RexScreen>;
  readonly pagination: DesignxForms<DesignxSingleForm>;
  readonly states: DesignxForms<DesignxStateForm>;
  readonly pending: DesignxForms<DesignxSingleForm>;
  readonly progress: DesignxForms<DesignxSingleForm>;
  readonly region: DesignxForms<DesignxSingleForm>;
  readonly badge: DesignxForms<DesignxSingleForm>;
  readonly avatar: DesignxForms<DesignxSingleForm>;
  readonly tooltip: DesignxForms<DesignxSingleForm>;
  readonly kbd: DesignxForms<DesignxSingleForm>;
  readonly tabs: DesignxForms<DesignxSingleForm>;
  readonly toolbar: DesignxForms<DesignxSingleForm>;
  readonly separator: DesignxForms<DesignxSingleForm>;
  readonly scrollArea: DesignxForms<DesignxSingleForm>;
  readonly typography: DesignxForms<DesignxSingleForm>;
  readonly mediaQuery: DesignxForms<DesignxSingleForm>;
  readonly touch: DesignxForms<DesignxSingleForm>;
}

export type DesignxSurface = keyof DesignxSurfaces;

function single(item: DesignxItemName): DesignxForms<DesignxSingleForm> {
  return Object.freeze({ [DESIGNX_SINGLE_FORM]: item });
}

export const DESIGNX_MAP: DesignxSurfaces = Object.freeze({
  button: single("button"),
  sheet: Object.freeze({ dialog: "dialog", "bottom-sheet": "sheet" }),
  paletteItem: single("command"),
  outcome: single("alert"),
  nav: Object.freeze({
    bar: "navigation-menu",
    sidebar: "sidebar",
    dock: "toolbar",
  }),
  breadcrumbs: single("breadcrumb"),
  form: single("form"),
  field: single("field"),
  input: single("input"),
  textarea: single("textarea"),
  select: single("select"),
  numberField: single("number-field"),
  checkbox: single("checkbox"),
  switch: single("switch"),
  radioGroup: single("radio-group"),
  list: Object.freeze({
    phone: "card",
    tablet: "data-table",
    desktop: "data-table",
    wide: "data-table",
  }),
  pagination: single("pagination"),
  states: Object.freeze({
    loading: "skeleton",
    empty: "empty",
    stale: "badge",
    partial: "alert",
    offline: "badge",
    "permission-denied": "alert",
    "recoverable-error": "alert",
    "terminal-error": "alert",
  }),
  pending: single("spinner"),
  progress: single("progress"),
  region: single("card"),
  badge: single("badge"),
  avatar: single("avatar"),
  tooltip: single("tooltip"),
  kbd: single("kbd"),
  tabs: single("tabs"),
  toolbar: single("toolbar"),
  separator: single("separator"),
  scrollArea: single("scroll-area"),
  typography: single("typography"),
  mediaQuery: single("use-media-query"),
  touch: single("use-touch-capable"),
});

export const DESIGNX_SURFACES = Object.freeze(Object.keys(DESIGNX_MAP) as DesignxSurface[]);

export function designxItem<S extends DesignxSurface>(
  surface: S,
  form: keyof DesignxSurfaces[S] & string,
): DesignxItemName {
  const forms = DESIGNX_MAP[surface] as Readonly<Record<string, DesignxItemName>>;
  const item = forms[form];
  if (item === undefined) {
    throw new Error(`rex/designx: the ${surface} surface has no ${form} form`);
  }
  return item;
}

export function designxSurfaceItems(surface: DesignxSurface): readonly DesignxItemName[] {
  const forms = DESIGNX_MAP[surface] as Readonly<Record<string, DesignxItemName>>;
  return [...new Set(Object.values(forms))].sort();
}

export const DESIGNX_THEME_ITEM: DesignxItemName = "theme";

export const DESIGNX_STANDARD: readonly DesignxItemName[] = Object.freeze(
  [
    ...new Set<DesignxItemName>([
      DESIGNX_THEME_ITEM,
      "utils",
      "command",
      "dialog",
      "sheet",
      "table",
      "card",
      "tabs",
      "tooltip",
      "kbd",
      "select",
      "field",
      "input",
      "skeleton",
      "empty",
      "badge",
      ...DESIGNX_SURFACES.flatMap(designxSurfaceItems),
    ]),
  ].sort(),
);

export function isDesignxItem(name: string): name is DesignxItemName {
  return Object.hasOwn(DESIGNX_ITEMS, name);
}

export function isDesignxProvided(name: string): name is DesignxProvidedName {
  return Object.hasOwn(DESIGNX_PROVIDED, name);
}

export function designxItemKind(name: DesignxItemName): DesignxItemKind {
  return DESIGNX_ITEMS[name];
}
