[@sidioralabs/rex API](../../README.md) / @sidioralabs/rex/designx

# @sidioralabs/rex/designx

## Interfaces

<a id="designxprovideditem"></a>

### DesignxProvidedItem

#### Properties

<a id="alias"></a>

##### alias

```ts
readonly alias: string;
```

<a id="file"></a>

##### file

```ts
readonly file: string;
```

<a id="from"></a>

##### from

```ts
readonly from: string;
```

***

<a id="designxsurfaces"></a>

### DesignxSurfaces

#### Properties

<a id="avatar"></a>

##### avatar

```ts
readonly avatar: DesignxForms<DesignxSingleForm>;
```

<a id="badge"></a>

##### badge

```ts
readonly badge: DesignxForms<DesignxSingleForm>;
```

<a id="breadcrumbs"></a>

##### breadcrumbs

```ts
readonly breadcrumbs: DesignxForms<DesignxSingleForm>;
```

<a id="button"></a>

##### button

```ts
readonly button: DesignxForms<DesignxSingleForm>;
```

<a id="checkbox"></a>

##### checkbox

```ts
readonly checkbox: DesignxForms<DesignxSingleForm>;
```

<a id="field"></a>

##### field

```ts
readonly field: DesignxForms<DesignxSingleForm>;
```

<a id="form"></a>

##### form

```ts
readonly form: DesignxForms<DesignxSingleForm>;
```

<a id="input"></a>

##### input

```ts
readonly input: DesignxForms<DesignxSingleForm>;
```

<a id="kbd"></a>

##### kbd

```ts
readonly kbd: DesignxForms<DesignxSingleForm>;
```

<a id="list"></a>

##### list

```ts
readonly list: DesignxForms<RexScreen>;
```

<a id="mediaquery"></a>

##### mediaQuery

```ts
readonly mediaQuery: DesignxForms<DesignxSingleForm>;
```

<a id="nav"></a>

##### nav

```ts
readonly nav: DesignxForms<ShellNavForm>;
```

<a id="numberfield"></a>

##### numberField

```ts
readonly numberField: DesignxForms<DesignxSingleForm>;
```

<a id="outcome"></a>

##### outcome

```ts
readonly outcome: DesignxForms<DesignxSingleForm>;
```

<a id="pagination"></a>

##### pagination

```ts
readonly pagination: DesignxForms<DesignxSingleForm>;
```

<a id="paletteitem"></a>

##### paletteItem

```ts
readonly paletteItem: DesignxForms<DesignxSingleForm>;
```

<a id="pending"></a>

##### pending

```ts
readonly pending: DesignxForms<DesignxSingleForm>;
```

<a id="progress"></a>

##### progress

```ts
readonly progress: DesignxForms<DesignxSingleForm>;
```

<a id="radiogroup"></a>

##### radioGroup

```ts
readonly radioGroup: DesignxForms<DesignxSingleForm>;
```

<a id="region"></a>

##### region

```ts
readonly region: DesignxForms<DesignxSingleForm>;
```

<a id="scrollarea"></a>

##### scrollArea

```ts
readonly scrollArea: DesignxForms<DesignxSingleForm>;
```

<a id="select"></a>

##### select

```ts
readonly select: DesignxForms<DesignxSingleForm>;
```

<a id="separator"></a>

##### separator

```ts
readonly separator: DesignxForms<DesignxSingleForm>;
```

<a id="sheet"></a>

##### sheet

```ts
readonly sheet: DesignxForms<ShellSheetForm>;
```

<a id="states"></a>

##### states

```ts
readonly states: DesignxForms<DesignxStateForm>;
```

<a id="switch"></a>

##### switch

```ts
readonly switch: DesignxForms<DesignxSingleForm>;
```

<a id="tabs"></a>

##### tabs

```ts
readonly tabs: DesignxForms<DesignxSingleForm>;
```

<a id="textarea"></a>

##### textarea

```ts
readonly textarea: DesignxForms<DesignxSingleForm>;
```

<a id="toolbar"></a>

##### toolbar

```ts
readonly toolbar: DesignxForms<DesignxSingleForm>;
```

<a id="tooltip"></a>

##### tooltip

```ts
readonly tooltip: DesignxForms<DesignxSingleForm>;
```

<a id="touch"></a>

##### touch

```ts
readonly touch: DesignxForms<DesignxSingleForm>;
```

<a id="typography"></a>

##### typography

```ts
readonly typography: DesignxForms<DesignxSingleForm>;
```

## Type Aliases

<a id="designxforms"></a>

### DesignxForms

```ts
type DesignxForms<F> = Readonly<Record<F, DesignxItemName>>;
```

#### Type Parameters

##### F

`F` *extends* `string`

***

<a id="designxitemkind"></a>

### DesignxItemKind

```ts
type DesignxItemKind = typeof DESIGNX_ITEM_KINDS[number];
```

***

<a id="designxitemname"></a>

### DesignxItemName

```ts
type DesignxItemName = keyof typeof DESIGNX_ITEMS;
```

***

<a id="designxprovidedname"></a>

### DesignxProvidedName

```ts
type DesignxProvidedName = keyof typeof DESIGNX_PROVIDED;
```

***

<a id="designxsingleform"></a>

### DesignxSingleForm

```ts
type DesignxSingleForm = typeof DESIGNX_SINGLE_FORM;
```

***

<a id="designxstateform"></a>

### DesignxStateForm

```ts
type DesignxStateForm = NonReadyState;
```

***

<a id="designxsurface"></a>

### DesignxSurface

```ts
type DesignxSurface = keyof DesignxSurfaces;
```

## Variables

<a id="designx_item_kinds"></a>

### DESIGNX\_ITEM\_KINDS

```ts
const DESIGNX_ITEM_KINDS: readonly ["ui", "hook", "lib", "style"];
```

***

<a id="designx_items"></a>

### DESIGNX\_ITEMS

```ts
const DESIGNX_ITEMS: Readonly<{
  alert: "ui";
  avatar: "ui";
  badge: "ui";
  breadcrumb: "ui";
  button: "ui";
  card: "ui";
  checkbox: "ui";
  command: "ui";
  data-table: "ui";
  dialog: "ui";
  empty: "ui";
  field: "ui";
  form: "ui";
  input: "ui";
  kbd: "ui";
  navigation-menu: "ui";
  number-field: "ui";
  pagination: "ui";
  progress: "ui";
  radio-group: "ui";
  scroll-area: "ui";
  select: "ui";
  separator: "ui";
  sheet: "ui";
  sidebar: "ui";
  skeleton: "ui";
  spinner: "ui";
  switch: "ui";
  table: "ui";
  tabs: "ui";
  textarea: "ui";
  theme: "style";
  toolbar: "ui";
  tooltip: "ui";
  typography: "ui";
  use-media-query: "hook";
  use-touch-capable: "hook";
  utils: "lib";
}>;
```

***

<a id="designx_map"></a>

### DESIGNX\_MAP

```ts
const DESIGNX_MAP: DesignxSurfaces;
```

***

<a id="designx_provided"></a>

### DESIGNX\_PROVIDED

```ts
const DESIGNX_PROVIDED: Readonly<{
  use-mobile: Readonly<{
     alias: "@/hooks/use-mobile";
     file: "use-screen.ts";
     from: "useScreen from @sidioralabs/rex/client";
  }>;
}>;
```

***

<a id="designx_registry_url"></a>

### DESIGNX\_REGISTRY\_URL

```ts
const DESIGNX_REGISTRY_URL: "https://dxuireact.com/r" = "https://dxuireact.com/r";
```

***

<a id="designx_single_form"></a>

### DESIGNX\_SINGLE\_FORM

```ts
const DESIGNX_SINGLE_FORM: "default" = "default";
```

***

<a id="designx_standard"></a>

### DESIGNX\_STANDARD

```ts
const DESIGNX_STANDARD: readonly DesignxItemName[];
```

***

<a id="designx_surfaces"></a>

### DESIGNX\_SURFACES

```ts
const DESIGNX_SURFACES: readonly keyof DesignxSurfaces[];
```

***

<a id="designx_theme_item"></a>

### DESIGNX\_THEME\_ITEM

```ts
const DESIGNX_THEME_ITEM: DesignxItemName = "theme";
```

## Functions

<a id="designxitem"></a>

### designxItem()

```ts
function designxItem<S>(surface, form): 
  | "input"
  | "empty"
  | "button"
  | "sheet"
  | "form"
  | "field"
  | "textarea"
  | "select"
  | "checkbox"
  | "switch"
  | "pagination"
  | "progress"
  | "badge"
  | "avatar"
  | "tooltip"
  | "kbd"
  | "tabs"
  | "toolbar"
  | "separator"
  | "typography"
  | "theme"
  | "utils"
  | "alert"
  | "breadcrumb"
  | "card"
  | "command"
  | "data-table"
  | "dialog"
  | "navigation-menu"
  | "number-field"
  | "radio-group"
  | "scroll-area"
  | "sidebar"
  | "skeleton"
  | "spinner"
  | "table"
  | "use-media-query"
  | "use-touch-capable";
```

#### Type Parameters

##### S

`S` *extends* keyof [`DesignxSurfaces`](#designxsurfaces)

#### Parameters

##### surface

`S`

##### form

keyof [`DesignxSurfaces`](#designxsurfaces)\[`S`\] & `string`

#### Returns

  \| `"input"`
  \| `"empty"`
  \| `"button"`
  \| `"sheet"`
  \| `"form"`
  \| `"field"`
  \| `"textarea"`
  \| `"select"`
  \| `"checkbox"`
  \| `"switch"`
  \| `"pagination"`
  \| `"progress"`
  \| `"badge"`
  \| `"avatar"`
  \| `"tooltip"`
  \| `"kbd"`
  \| `"tabs"`
  \| `"toolbar"`
  \| `"separator"`
  \| `"typography"`
  \| `"theme"`
  \| `"utils"`
  \| `"alert"`
  \| `"breadcrumb"`
  \| `"card"`
  \| `"command"`
  \| `"data-table"`
  \| `"dialog"`
  \| `"navigation-menu"`
  \| `"number-field"`
  \| `"radio-group"`
  \| `"scroll-area"`
  \| `"sidebar"`
  \| `"skeleton"`
  \| `"spinner"`
  \| `"table"`
  \| `"use-media-query"`
  \| `"use-touch-capable"`

***

<a id="designxitemkind-1"></a>

### designxItemKind()

```ts
function designxItemKind(name): "ui" | "hook" | "lib" | "style";
```

#### Parameters

##### name

  \| `"input"`
  \| `"empty"`
  \| `"button"`
  \| `"sheet"`
  \| `"form"`
  \| `"field"`
  \| `"textarea"`
  \| `"select"`
  \| `"checkbox"`
  \| `"switch"`
  \| `"pagination"`
  \| `"progress"`
  \| `"badge"`
  \| `"avatar"`
  \| `"tooltip"`
  \| `"kbd"`
  \| `"tabs"`
  \| `"toolbar"`
  \| `"separator"`
  \| `"typography"`
  \| `"theme"`
  \| `"utils"`
  \| `"alert"`
  \| `"breadcrumb"`
  \| `"card"`
  \| `"command"`
  \| `"data-table"`
  \| `"dialog"`
  \| `"navigation-menu"`
  \| `"number-field"`
  \| `"radio-group"`
  \| `"scroll-area"`
  \| `"sidebar"`
  \| `"skeleton"`
  \| `"spinner"`
  \| `"table"`
  \| `"use-media-query"`
  \| `"use-touch-capable"`

#### Returns

`"ui"` \| `"hook"` \| `"lib"` \| `"style"`

***

<a id="designxsurfaceitems"></a>

### designxSurfaceItems()

```ts
function designxSurfaceItems(surface): readonly (
  | "input"
  | "empty"
  | "button"
  | "sheet"
  | "form"
  | "field"
  | "textarea"
  | "select"
  | "checkbox"
  | "switch"
  | "pagination"
  | "progress"
  | "badge"
  | "avatar"
  | "tooltip"
  | "kbd"
  | "tabs"
  | "toolbar"
  | "separator"
  | "typography"
  | "theme"
  | "utils"
  | "alert"
  | "breadcrumb"
  | "card"
  | "command"
  | "data-table"
  | "dialog"
  | "navigation-menu"
  | "number-field"
  | "radio-group"
  | "scroll-area"
  | "sidebar"
  | "skeleton"
  | "spinner"
  | "table"
  | "use-media-query"
  | "use-touch-capable")[];
```

#### Parameters

##### surface

keyof [`DesignxSurfaces`](#designxsurfaces)

#### Returns

readonly (
  \| `"input"`
  \| `"empty"`
  \| `"button"`
  \| `"sheet"`
  \| `"form"`
  \| `"field"`
  \| `"textarea"`
  \| `"select"`
  \| `"checkbox"`
  \| `"switch"`
  \| `"pagination"`
  \| `"progress"`
  \| `"badge"`
  \| `"avatar"`
  \| `"tooltip"`
  \| `"kbd"`
  \| `"tabs"`
  \| `"toolbar"`
  \| `"separator"`
  \| `"typography"`
  \| `"theme"`
  \| `"utils"`
  \| `"alert"`
  \| `"breadcrumb"`
  \| `"card"`
  \| `"command"`
  \| `"data-table"`
  \| `"dialog"`
  \| `"navigation-menu"`
  \| `"number-field"`
  \| `"radio-group"`
  \| `"scroll-area"`
  \| `"sidebar"`
  \| `"skeleton"`
  \| `"spinner"`
  \| `"table"`
  \| `"use-media-query"`
  \| `"use-touch-capable"`)[]

***

<a id="isdesignxitem"></a>

### isDesignxItem()

```ts
function isDesignxItem(name): name is "input" | "empty" | "button" | "sheet" | "form" | "field" | "textarea" | "select" | "checkbox" | "switch" | "pagination" | "progress" | "badge" | "avatar" | "tooltip" | "kbd" | "tabs" | "toolbar" | "separator" | "typography" | "theme" | "utils" | "alert" | "breadcrumb" | "card" | "command" | "data-table" | "dialog" | "navigation-menu" | "number-field" | "radio-group" | "scroll-area" | "sidebar" | "skeleton" | "spinner" | "table" | "use-media-query" | "use-touch-capable";
```

#### Parameters

##### name

`string`

#### Returns

name is "input" \| "empty" \| "button" \| "sheet" \| "form" \| "field" \| "textarea" \| "select" \| "checkbox" \| "switch" \| "pagination" \| "progress" \| "badge" \| "avatar" \| "tooltip" \| "kbd" \| "tabs" \| "toolbar" \| "separator" \| "typography" \| "theme" \| "utils" \| "alert" \| "breadcrumb" \| "card" \| "command" \| "data-table" \| "dialog" \| "navigation-menu" \| "number-field" \| "radio-group" \| "scroll-area" \| "sidebar" \| "skeleton" \| "spinner" \| "table" \| "use-media-query" \| "use-touch-capable"

***

<a id="isdesignxprovided"></a>

### isDesignxProvided()

```ts
function isDesignxProvided(name): name is "use-mobile";
```

#### Parameters

##### name

`string`

#### Returns

`name is "use-mobile"`
