[@sidioralabs/rex API](../../README.md) / @sidioralabs/rex/manifest

# @sidioralabs/rex/manifest

## Interfaces

<a id="buildmanifestoptions"></a>

### BuildManifestOptions

#### Properties

<a id="app"></a>

##### app?

```ts
readonly optional app?: string;
```

<a id="render"></a>

##### render?

```ts
readonly optional render?: "ssr" | "csr" | "ssg" | "static";
```

***

<a id="manifestsource"></a>

### ManifestSource

#### Properties

<a id="actions"></a>

##### actions

```ts
readonly actions: readonly AnyAction[];
```

<a id="entities"></a>

##### entities

```ts
readonly entities: readonly AnyEntity[];
```

<a id="flows"></a>

##### flows?

```ts
readonly optional flows?: readonly FlowSource[];
```

<a id="pages"></a>

##### pages

```ts
readonly pages: readonly AnyPage[];
```

<a id="policies"></a>

##### policies

```ts
readonly policies: readonly AnyPolicy[];
```

***

<a id="sidecarissue"></a>

### SidecarIssue

#### Properties

<a id="message"></a>

##### message

```ts
readonly message: string;
```

<a id="path"></a>

##### path

```ts
readonly path: string;
```

## Type Aliases

<a id="sidecaraction"></a>

### SidecarAction

```ts
type SidecarAction = zm.output<typeof sidecarActionSchema>;
```

***

<a id="sidecarloader"></a>

### SidecarLoader

```ts
type SidecarLoader = zm.output<typeof sidecarLoaderSchema>;
```

***

<a id="sidecaroutcome"></a>

### SidecarOutcome

```ts
type SidecarOutcome = zm.output<typeof sidecarOutcomeSchema>;
```

***

<a id="sidecaroverlay"></a>

### SidecarOverlay

```ts
type SidecarOverlay = zm.output<typeof sidecarOverlaySchema>;
```

***

<a id="sidecarpayload"></a>

### SidecarPayload

```ts
type SidecarPayload = zm.output<typeof sidecarSchema>;
```

***

<a id="sidecarregion"></a>

### SidecarRegion

```ts
type SidecarRegion = zm.output<typeof sidecarRegionSchema>;
```

***

<a id="sidecarstores"></a>

### SidecarStores

```ts
type SidecarStores = zm.output<typeof sidecarStoresSchema>;
```

***

<a id="sidecarvalidation"></a>

### SidecarValidation

```ts
type SidecarValidation = 
  | {
  payload: SidecarPayload;
  valid: true;
}
  | {
  issues: readonly SidecarIssue[];
  valid: false;
};
```

## Variables

<a id="default_app_name"></a>

### DEFAULT\_APP\_NAME

```ts
const DEFAULT_APP_NAME: "app" = "app";
```

***

<a id="default_page_render"></a>

### DEFAULT\_PAGE\_RENDER

```ts
const DEFAULT_PAGE_RENDER: PageRender = "ssr";
```

***

<a id="sidecar_error_code_pattern"></a>

### SIDECAR\_ERROR\_CODE\_PATTERN

```ts
const SIDECAR_ERROR_CODE_PATTERN: RegExp;
```

***

<a id="sidecar_screen_fields"></a>

### SIDECAR\_SCREEN\_FIELDS

```ts
const SIDECAR_SCREEN_FIELDS: readonly ["screen", "pointer", "density"];
```

***

<a id="sidecaractionschema"></a>

### sidecarActionSchema

```ts
const sidecarActionSchema: ZodMiniObject<{
  allowed: ZodMiniBoolean<boolean>;
  effect: ZodMiniEnum<{
     irreversible: "irreversible";
     read: "read";
     reversible: "reversible";
  }>;
  id: ZodMiniString<string>;
  input: ZodMiniRecord<ZodMiniString<string>, ZodMiniUnknown>;
  label: ZodMiniString<string>;
  reason: ZodMiniNullable<ZodMiniString<string>>;
  via: ZodMiniArray<ZodMiniEnum<{
     click: "click";
     key: "key";
     palette: "palette";
     url: "url";
  }>>;
}, $strict>;
```

***

<a id="sidecarjsonschema"></a>

### sidecarJsonSchema

```ts
const sidecarJsonSchema: JsonSchema;
```

***

<a id="sidecarloaderschema"></a>

### sidecarLoaderSchema

```ts
const sidecarLoaderSchema: ZodMiniObject<{
  action: ZodMiniString<string>;
  invalidatedBy: ZodMiniArray<ZodMiniString<string>>;
  name: ZodMiniString<string>;
}, $strict>;
```

***

<a id="sidecaroutcomeschema"></a>

### sidecarOutcomeSchema

```ts
const sidecarOutcomeSchema: ZodMiniObject<{
  action: ZodMiniString<string>;
  at: ZodMiniISODateTime;
  message: ZodMiniString<string>;
  ok: ZodMiniBoolean<boolean>;
}, $strict>;
```

***

<a id="sidecaroverlayschema"></a>

### sidecarOverlaySchema

```ts
const sidecarOverlaySchema: ZodMiniObject<{
  dismiss: ZodMiniEnum<{
     both: "both";
     button: "button";
     escape: "escape";
  }>;
  id: ZodMiniString<string>;
  open: ZodMiniBoolean<boolean>;
}, $strict>;
```

***

<a id="sidecarregionschema"></a>

### sidecarRegionSchema

```ts
const sidecarRegionSchema: ZodMiniObject<{
  address: ZodMiniString<string>;
  code: ZodMiniString<string>;
  id: ZodMiniString<string>;
  state: ZodMiniEnum<{
     empty: "empty";
     loading: "loading";
     offline: "offline";
     partial: "partial";
     permission-denied: "permission-denied";
     ready: "ready";
     recoverable-error: "recoverable-error";
     stale: "stale";
     terminal-error: "terminal-error";
  }>;
}, $strict>;
```

***

<a id="sidecarschema"></a>

### sidecarSchema

```ts
const sidecarSchema: ZodMiniObject<{
  actions: ZodMiniArray<ZodMiniObject<{
     allowed: ZodMiniBoolean<boolean>;
     effect: ZodMiniEnum<{
        irreversible: "irreversible";
        read: "read";
        reversible: "reversible";
     }>;
     id: ZodMiniString<string>;
     input: ZodMiniRecord<ZodMiniString<string>, ZodMiniUnknown>;
     label: ZodMiniString<string>;
     reason: ZodMiniNullable<ZodMiniString<string>>;
     via: ZodMiniArray<ZodMiniEnum<{
        click: "click";
        key: "key";
        palette: "palette";
        url: "url";
     }>>;
  }, $strict>>;
  density: ZodMiniOptional<ZodMiniEnum<{
     agent: "agent";
     comfortable: "comfortable";
     compact: "compact";
  }>>;
  loaders: ZodMiniOptional<ZodMiniArray<ZodMiniObject<{
     action: ZodMiniString<string>;
     invalidatedBy: ZodMiniArray<ZodMiniString<string>>;
     name: ZodMiniString<string>;
  }, $strict>>>;
  outcome: ZodMiniNullable<ZodMiniObject<{
     action: ZodMiniString<string>;
     at: ZodMiniISODateTime;
     message: ZodMiniString<string>;
     ok: ZodMiniBoolean<boolean>;
  }, $strict>>;
  overlays: ZodMiniArray<ZodMiniObject<{
     dismiss: ZodMiniEnum<{
        both: "both";
        button: "button";
        escape: "escape";
     }>;
     id: ZodMiniString<string>;
     open: ZodMiniBoolean<boolean>;
  }, $strict>>;
  page: ZodMiniString<string>;
  params: ZodMiniRecord<ZodMiniString<string>, ZodMiniUnknown>;
  pointer: ZodMiniOptional<ZodMiniEnum<{
     coarse: "coarse";
     fine: "fine";
  }>>;
  regions: ZodMiniOptional<ZodMiniArray<ZodMiniObject<{
     address: ZodMiniString<string>;
     code: ZodMiniString<string>;
     id: ZodMiniString<string>;
     state: ZodMiniEnum<{
        empty: "empty";
        loading: "loading";
        offline: "offline";
        partial: "partial";
        permission-denied: "permission-denied";
        ready: "ready";
        recoverable-error: "recoverable-error";
        stale: "stale";
        terminal-error: "terminal-error";
     }>;
  }, $strict>>>;
  screen: ZodMiniOptional<ZodMiniEnum<{
     desktop: "desktop";
     phone: "phone";
     tablet: "tablet";
     wide: "wide";
  }>>;
  state: ZodMiniEnum<{
     empty: "empty";
     loading: "loading";
     offline: "offline";
     partial: "partial";
     permission-denied: "permission-denied";
     ready: "ready";
     recoverable-error: "recoverable-error";
     stale: "stale";
     terminal-error: "terminal-error";
  }>;
  stores: ZodMiniOptional<ZodMiniRecord<ZodMiniString<string>, ZodMiniUnknown>>;
  version: ZodMiniLiteral<1>;
}, $strict>;
```

***

<a id="sidecarstoresschema"></a>

### sidecarStoresSchema

```ts
const sidecarStoresSchema: ZodMiniRecord<ZodMiniString<string>, ZodMiniUnknown>;
```

## Functions

<a id="buildmanifest"></a>

### buildManifest()

```ts
function buildManifest(source, options?): Manifest;
```

#### Parameters

##### source

[`ManifestSource`](#manifestsource)

##### options?

[`BuildManifestOptions`](#buildmanifestoptions) = `{}`

#### Returns

[`Manifest`](../rex.md#manifest)

***

<a id="declaredjsonschema"></a>

### declaredJsonSchema()

```ts
function declaredJsonSchema(
   schema, 
   override, 
   io, 
   subject
): JsonSchema;
```

#### Parameters

##### schema

[`StandardSchemaV1`](../rex.md#standardschemav1)

##### override

[`JsonSchema`](schema.md#jsonschema) \| `null`

##### io

`"input"` \| `"output"`

##### subject

`string`

#### Returns

[`JsonSchema`](schema.md#jsonschema)

***

<a id="objectjsonschema"></a>

### objectJsonSchema()

```ts
function objectJsonSchema(shape, io?): JsonSchema;
```

#### Parameters

##### shape

`Readonly`\<`Record`\<`string`, [`StandardSchemaV1`](../rex.md#standardschemav1)\>\>

##### io?

`"input"` \| `"output"`

#### Returns

[`JsonSchema`](schema.md#jsonschema)

***

<a id="rexobjectshape"></a>

### rexObjectShape()

```ts
function rexObjectShape(schema): 
  | Readonly<Record<string, StandardSchemaV1<unknown, unknown>>>
  | null;
```

#### Parameters

##### schema

`unknown`

#### Returns

  \| `Readonly`\<`Record`\<`string`, [`StandardSchemaV1`](../rex.md#standardschemav1)\<`unknown`, `unknown`\>\>\>
  \| `null`

***

<a id="stablestringify"></a>

### stableStringify()

```ts
function stableStringify(value, indent?): string;
```

#### Parameters

##### value

`unknown`

##### indent?

`number` = `2`

#### Returns

`string`

***

<a id="standardjsonschema"></a>

### standardJsonSchema()

```ts
function standardJsonSchema(schema, io?): JsonSchema;
```

#### Parameters

##### schema

[`StandardSchemaV1`](../rex.md#standardschemav1)

##### io?

`"input"` \| `"output"`

#### Returns

[`JsonSchema`](schema.md#jsonschema)

***

<a id="standardvendorof"></a>

### standardVendorOf()

```ts
function standardVendorOf(schema): string | null;
```

#### Parameters

##### schema

`unknown`

#### Returns

`string` \| `null`

***

<a id="tojsonschema"></a>

### toJsonSchema()

```ts
function toJsonSchema(schema, io?): JsonSchema;
```

#### Parameters

##### schema

`$ZodType`

##### io?

`"input"` \| `"output"`

#### Returns

[`JsonSchema`](schema.md#jsonschema)

***

<a id="validatesidecar"></a>

### validateSidecar()

```ts
function validateSidecar(payload): SidecarValidation;
```

#### Parameters

##### payload

`unknown`

#### Returns

[`SidecarValidation`](#sidecarvalidation)

## References

<a id="flowsource"></a>

### FlowSource

Re-exports [FlowSource](../rex.md#flowsource)

***

<a id="flowstepsource"></a>

### FlowStepSource

Re-exports [FlowStepSource](../rex.md#flowstepsource)

***

<a id="invocation_routes"></a>

### INVOCATION\_ROUTES

Re-exports [INVOCATION_ROUTES](../rex.md#invocation_routes)

***

<a id="invocationroute"></a>

### InvocationRoute

Re-exports [InvocationRoute](../rex.md#invocationroute)

***

<a id="manifest"></a>

### Manifest

Re-exports [Manifest](../rex.md#manifest)

***

<a id="manifest_version"></a>

### MANIFEST\_VERSION

Re-exports [MANIFEST_VERSION](../rex.md#manifest_version)

***

<a id="manifestaction"></a>

### ManifestAction

Re-exports [ManifestAction](../rex.md#manifestaction)

***

<a id="manifestapp"></a>

### ManifestApp

Re-exports [ManifestApp](../rex.md#manifestapp-1)

***

<a id="manifestchrome"></a>

### ManifestChrome

Re-exports [ManifestChrome](../rex.md#manifestchrome)

***

<a id="manifestentity"></a>

### ManifestEntity

Re-exports [ManifestEntity](../rex.md#manifestentity)

***

<a id="manifestfield"></a>

### ManifestField

Re-exports [ManifestField](../rex.md#manifestfield)

***

<a id="manifestflow"></a>

### ManifestFlow

Re-exports [ManifestFlow](../rex.md#manifestflow)

***

<a id="manifestflowstep"></a>

### ManifestFlowStep

Re-exports [ManifestFlowStep](../rex.md#manifestflowstep)

***

<a id="manifestloader"></a>

### ManifestLoader

Re-exports [ManifestLoader](../rex.md#manifestloader)

***

<a id="manifestoverlay"></a>

### ManifestOverlay

Re-exports [ManifestOverlay](../rex.md#manifestoverlay)

***

<a id="manifestpage"></a>

### ManifestPage

Re-exports [ManifestPage](../rex.md#manifestpage)

***

<a id="manifestpolicy"></a>

### ManifestPolicy

Re-exports [ManifestPolicy](../rex.md#manifestpolicy)

***

<a id="rex_pointers"></a>

### REX\_POINTERS

Re-exports [REX_POINTERS](../rex.md#rex_pointers)

***

<a id="rex_screen_densities"></a>

### REX\_SCREEN\_DENSITIES

Re-exports [REX_SCREEN_DENSITIES](../rex.md#rex_screen_densities)

***

<a id="rex_screens"></a>

### REX\_SCREENS

Re-exports [REX_SCREENS](../rex.md#rex_screens)

***

<a id="rexpointer"></a>

### RexPointer

Re-exports [RexPointer](../rex.md#rexpointer)

***

<a id="rexscreen"></a>

### RexScreen

Re-exports [RexScreen](../rex.md#rexscreen)

***

<a id="rexscreendensity"></a>

### RexScreenDensity

Re-exports [RexScreenDensity](../rex.md#rexscreendensity)

***

<a id="sidecar_element_id"></a>

### SIDECAR\_ELEMENT\_ID

Re-exports [SIDECAR_ELEMENT_ID](../rex.md#sidecar_element_id)

***

<a id="sidecar_mime_type"></a>

### SIDECAR\_MIME\_TYPE

Re-exports [SIDECAR_MIME_TYPE](../rex.md#sidecar_mime_type)

***

<a id="sidecar_version"></a>

### SIDECAR\_VERSION

Re-exports [SIDECAR_VERSION](../rex.md#sidecar_version)
