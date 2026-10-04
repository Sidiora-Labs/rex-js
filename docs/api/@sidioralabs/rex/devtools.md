[@sidioralabs/rex API](../../README.md) / @sidioralabs/rex/devtools

# @sidioralabs/rex/devtools

## Interfaces

<a id="devtoolsproviderprops"></a>

### DevtoolsProviderProps

#### Properties

<a id="children"></a>

##### children

```ts
readonly children: ReactNode;
```

<a id="store"></a>

##### store?

```ts
readonly optional store?: DevtoolsStore;
```

***

<a id="devtoolssnapshot"></a>

### DevtoolsSnapshot

#### Properties

<a id="open"></a>

##### open

```ts
readonly open: boolean;
```

<a id="outcomes"></a>

##### outcomes

```ts
readonly outcomes: readonly OutcomeLogEntry[];
```

<a id="panel"></a>

##### panel

```ts
readonly panel: 
  | "page"
  | "manifest"
  | "sidecar"
  | "outcomes"
  | "queries"
  | "renders"
  | "audit";
```

<a id="renders"></a>

##### renders

```ts
readonly renders: readonly RegionRenderStats[];
```

***

<a id="devtoolsstore"></a>

### DevtoolsStore

#### Methods

<a id="recordoutcome"></a>

##### recordOutcome()

```ts
recordOutcome(page, outcome): void;
```

###### Parameters

###### page

`string`

###### outcome

[`Outcome`](client.md#outcome)

###### Returns

`void`

<a id="recordrenders"></a>

##### recordRenders()

```ts
recordRenders(samples): void;
```

###### Parameters

###### samples

readonly [`RegionRenderSample`](#regionrendersample)[]

###### Returns

`void`

<a id="setopen"></a>

##### setOpen()

```ts
setOpen(open): void;
```

###### Parameters

###### open

`boolean`

###### Returns

`void`

<a id="showpanel"></a>

##### showPanel()

```ts
showPanel(panel): void;
```

###### Parameters

###### panel

  \| `"page"`
  \| `"manifest"`
  \| `"sidecar"`
  \| `"outcomes"`
  \| `"queries"`
  \| `"renders"`
  \| `"audit"`

###### Returns

`void`

<a id="snapshot"></a>

##### snapshot()

```ts
snapshot(): DevtoolsSnapshot;
```

###### Returns

[`DevtoolsSnapshot`](#devtoolssnapshot)

<a id="subscribe"></a>

##### subscribe()

```ts
subscribe(listener): () => void;
```

###### Parameters

###### listener

() => `void`

###### Returns

() => `void`

<a id="toggle"></a>

##### toggle()

```ts
toggle(): void;
```

###### Returns

`void`

***

<a id="outcomelogentry"></a>

### OutcomeLogEntry

#### Properties

<a id="outcome"></a>

##### outcome

```ts
readonly outcome: Outcome;
```

<a id="page"></a>

##### page

```ts
readonly page: string;
```

<a id="sequence"></a>

##### sequence

```ts
readonly sequence: number;
```

***

<a id="regionrendersample"></a>

### RegionRenderSample

#### Properties

<a id="address"></a>

##### address

```ts
readonly address: string;
```

<a id="durationms"></a>

##### durationMs

```ts
readonly durationMs: number;
```

***

<a id="regionrenderstats"></a>

### RegionRenderStats

#### Properties

<a id="address-1"></a>

##### address

```ts
readonly address: string;
```

<a id="commits"></a>

##### commits

```ts
readonly commits: number;
```

<a id="lastms"></a>

##### lastMs

```ts
readonly lastMs: number;
```

<a id="maxms"></a>

##### maxMs

```ts
readonly maxMs: number;
```

<a id="totalms"></a>

##### totalMs

```ts
readonly totalMs: number;
```

***

<a id="rexdevtoolsprops"></a>

### RexDevtoolsProps

#### Properties

<a id="store-1"></a>

##### store

```ts
readonly store: DevtoolsStore;
```

## Type Aliases

<a id="devtoolspanel"></a>

### DevtoolsPanel

```ts
type DevtoolsPanel = typeof DEVTOOLS_PANELS[number];
```

## Variables

<a id="devtools_attribute"></a>

### DEVTOOLS\_ATTRIBUTE

```ts
const DEVTOOLS_ATTRIBUTE: "data-rex-devtools" = "data-rex-devtools";
```

***

<a id="devtools_audit_path"></a>

### DEVTOOLS\_AUDIT\_PATH

```ts
const DEVTOOLS_AUDIT_PATH: "/rex/dev/audit" = "/rex/dev/audit";
```

***

<a id="devtools_define"></a>

### DEVTOOLS\_DEFINE

```ts
const DEVTOOLS_DEFINE: "import.meta.env.REX_DEVTOOLS";
```

***

<a id="devtools_env_key"></a>

### DEVTOOLS\_ENV\_KEY

```ts
const DEVTOOLS_ENV_KEY: "REX_DEVTOOLS" = "REX_DEVTOOLS";
```

***

<a id="devtools_panel_titles"></a>

### DEVTOOLS\_PANEL\_TITLES

```ts
const DEVTOOLS_PANEL_TITLES: { readonly [P in DevtoolsPanel]: string };
```

***

<a id="devtools_panels"></a>

### DEVTOOLS\_PANELS

```ts
const DEVTOOLS_PANELS: readonly ["manifest", "page", "sidecar", "outcomes", "queries", "renders", "audit"];
```

***

<a id="devtools_profiler_id"></a>

### DEVTOOLS\_PROFILER\_ID

```ts
const DEVTOOLS_PROFILER_ID: "rex-devtools" = "rex-devtools";
```

***

<a id="devtools_shortcut"></a>

### DEVTOOLS\_SHORTCUT

```ts
const DEVTOOLS_SHORTCUT: "mod+shift+d" = "mod+shift+d";
```

***

<a id="devtools_title"></a>

### DEVTOOLS\_TITLE

```ts
const DEVTOOLS_TITLE: "Rex devtools" = "Rex devtools";
```

***

<a id="devtoolsstorecontext"></a>

### DevtoolsStoreContext

```ts
const DevtoolsStoreContext: Context<DevtoolsStore | null>;
```

***

<a id="loader_query_scope"></a>

### LOADER\_QUERY\_SCOPE

```ts
const LOADER_QUERY_SCOPE: "loader" = "loader";
```

***

<a id="outcome_log_limit"></a>

### OUTCOME\_LOG\_LIMIT

```ts
const OUTCOME_LOG_LIMIT: 200 = 200;
```

## Functions

<a id="auditpanel"></a>

### AuditPanel()

```ts
function AuditPanel(): Element;
```

#### Returns

`Element`

***

<a id="auditurl"></a>

### auditUrl()

```ts
function auditUrl(): string;
```

#### Returns

`string`

***

<a id="connecteddevtools"></a>

### ConnectedDevtools()

```ts
function ConnectedDevtools(): Element | null;
```

#### Returns

`Element` \| `null`

***

<a id="createdevtoolsstore"></a>

### createDevtoolsStore()

```ts
function createDevtoolsStore(): DevtoolsStore;
```

#### Returns

[`DevtoolsStore`](#devtoolsstore)

***

<a id="devtoolsprovider"></a>

### DevtoolsProvider()

```ts
function DevtoolsProvider(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`DevtoolsProviderProps`](#devtoolsproviderprops)

#### Returns

`Element`

***

<a id="manifestpanel"></a>

### ManifestPanel()

```ts
function ManifestPanel(): Element;
```

#### Returns

`Element`

***

<a id="outcomespanel"></a>

### OutcomesPanel()

```ts
function OutcomesPanel(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

###### snapshot

[`DevtoolsSnapshot`](#devtoolssnapshot)

#### Returns

`Element`

***

<a id="pagepanel"></a>

### PagePanel()

```ts
function PagePanel(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

###### resolution

[`PageResolution`](client.md#pageresolution) \| `null`

#### Returns

`Element`

***

<a id="queriespanel"></a>

### QueriesPanel()

```ts
function QueriesPanel(): Element;
```

#### Returns

`Element`

***

<a id="regionrendersamples"></a>

### regionRenderSamples()

```ts
function regionRenderSamples(root, commitStart): readonly RegionRenderSample[];
```

#### Parameters

##### root

`ParentNode`

##### commitStart

`number`

#### Returns

readonly [`RegionRenderSample`](#regionrendersample)[]

***

<a id="renderspanel"></a>

### RendersPanel()

```ts
function RendersPanel(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

###### snapshot

[`DevtoolsSnapshot`](#devtoolssnapshot)

#### Returns

`Element`

***

<a id="rexdevtools"></a>

### RexDevtools()

```ts
function RexDevtools(__namedParameters): Element | null;
```

#### Parameters

##### \_\_namedParameters

[`RexDevtoolsProps`](#rexdevtoolsprops)

#### Returns

`Element` \| `null`

***

<a id="sidecarpanel"></a>

### SidecarPanel()

```ts
function SidecarPanel(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

###### resolution

[`PageResolution`](client.md#pageresolution) \| `null`

#### Returns

`Element`

***

<a id="usedevtoolsshortcut"></a>

### useDevtoolsShortcut()

```ts
function useDevtoolsShortcut(store): void;
```

#### Parameters

##### store

[`DevtoolsStore`](#devtoolsstore)

#### Returns

`void`

***

<a id="usedevtoolssnapshot"></a>

### useDevtoolsSnapshot()

```ts
function useDevtoolsSnapshot(store): DevtoolsSnapshot;
```

#### Parameters

##### store

[`DevtoolsStore`](#devtoolsstore)

#### Returns

[`DevtoolsSnapshot`](#devtoolssnapshot)

***

<a id="usedevtoolsstore"></a>

### useDevtoolsStore()

```ts
function useDevtoolsStore(): DevtoolsStore | null;
```

#### Returns

[`DevtoolsStore`](#devtoolsstore) \| `null`

***

<a id="usequerycacheentries"></a>

### useQueryCacheEntries()

```ts
function useQueryCacheEntries(): readonly Query<unknown, Error, unknown, readonly unknown[]>[];
```

#### Returns

readonly `Query`\<`unknown`, `Error`, `unknown`, readonly `unknown`[]\>[]

***

<a id="watchoutcomes"></a>

### watchOutcomes()

```ts
function watchOutcomes(
   outcomes, 
   store, 
   keys
): () => void;
```

#### Parameters

##### outcomes

[`OutcomeStore`](client.md#outcomestore)

##### store

[`DevtoolsStore`](#devtoolsstore)

##### keys

() => readonly `string`[]

#### Returns

() => `void`
