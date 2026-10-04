[@sidioralabs/rex API](../../README.md) / @sidioralabs/rex/testing

# @sidioralabs/rex/testing

## Classes

<a id="rextestingerror"></a>

### RexTestingError

#### Extends

- `Error`

#### Constructors

<a id="constructor"></a>

##### Constructor

```ts
new RexTestingError(message): RexTestingError;
```

###### Parameters

###### message

`string`

###### Returns

[`RexTestingError`](#rextestingerror)

###### Overrides

```ts
Error.constructor
```

## Interfaces

<a id="renderpageoptions"></a>

### RenderPageOptions

#### Properties

<a id="density"></a>

##### density?

```ts
readonly optional density?: "default" | "agent";
```

<a id="locale"></a>

##### locale?

```ts
readonly optional locale?: string;
```

<a id="params"></a>

##### params?

```ts
readonly optional params?: Readonly<Record<string, unknown>>;
```

***

<a id="rexrenderresult"></a>

### RexRenderResult

#### Extends

- `RenderResult`

#### Properties

<a id="app"></a>

##### app

```ts
readonly app: TestApp;
```

<a id="history"></a>

##### history

```ts
readonly history: readonly string[];
```

<a id="href"></a>

##### href

```ts
readonly href: string;
```

<a id="outcomes"></a>

##### outcomes

```ts
readonly outcomes: OutcomeStore;
```

<a id="page"></a>

##### page

```ts
readonly page: AnyPage;
```

<a id="queryclient"></a>

##### queryClient

```ts
readonly queryClient: QueryClient;
```

#### Methods

<a id="navigate"></a>

##### navigate()

```ts
navigate(to, options?): void;
```

###### Parameters

###### to

`string`

###### options?

###### replace?

`boolean`

###### Returns

`void`

<a id="sidecar"></a>

##### sidecar()

```ts
sidecar(): object;
```

###### Returns

`object`

###### actions

```ts
actions: object[];
```

###### outcome

```ts
outcome: 
  | {
  action: string;
  at: string;
  message: string;
  ok: boolean;
}
  | null;
```

###### overlays

```ts
overlays: object[];
```

###### page

```ts
page: string;
```

###### params

```ts
params: Record<string, unknown>;
```

###### regions?

```ts
optional regions?: object[];
```

###### state

```ts
state: 
  | "loading"
  | "empty"
  | "stale"
  | "partial"
  | "offline"
  | "permission-denied"
  | "recoverable-error"
  | "terminal-error"
  | "ready";
```

###### stores?

```ts
optional stores?: Record<string, unknown>;
```

###### version

```ts
version: 1;
```

***

<a id="rextesthooks"></a>

### RexTestHooks

#### Methods

<a id="aftereach"></a>

##### afterEach()

```ts
afterEach(cleanup): unknown;
```

###### Parameters

###### cleanup

() => `void`

###### Returns

`unknown`

***

<a id="testapp"></a>

### TestApp

#### Properties

<a id="actor"></a>

##### actor

```ts
readonly actor: Actor;
```

<a id="baseurl"></a>

##### baseUrl

```ts
readonly baseUrl: string;
```

<a id="ledger"></a>

##### ledger

```ts
readonly ledger: Ledger;
```

<a id="pages"></a>

##### pages

```ts
readonly pages: readonly PageModuleSet[];
```

<a id="registry"></a>

##### registry

```ts
readonly registry: RegistrySnapshot;
```

<a id="server"></a>

##### server

```ts
readonly server: Hono;
```

<a id="source"></a>

##### source

```ts
readonly source: TestAppSource;
```

#### Methods

<a id="page-1"></a>

##### page()

```ts
page(id): AnyPage;
```

###### Parameters

###### id

`string`

###### Returns

[`AnyPage`](../rex.md#anypage)

***

<a id="testappoptions"></a>

### TestAppOptions

#### Properties

<a id="actor-1"></a>

##### actor

```ts
readonly actor: Actor | ActorInput;
```

<a id="server-1"></a>

##### server?

```ts
readonly optional server?: TestServerOptions;
```

***

<a id="testappsource-1"></a>

### TestAppSource

#### Properties

<a id="manifest"></a>

##### manifest?

```ts
readonly optional manifest?: Manifest;
```

<a id="name"></a>

##### name?

```ts
readonly optional name?: string;
```

<a id="pages-1"></a>

##### pages

```ts
readonly pages: readonly PageModuleSet[];
```

<a id="registry-1"></a>

##### registry

```ts
readonly registry: RegistrySnapshot;
```

***

<a id="testserver"></a>

### TestServer

#### Properties

<a id="client"></a>

##### client

```ts
readonly client: RexClient;
```

<a id="fetch"></a>

##### fetch

```ts
readonly fetch: TestFetch;
```

<a id="ledger-1"></a>

##### ledger

```ts
readonly ledger: Ledger;
```

<a id="server-2"></a>

##### server

```ts
readonly server: Hono;
```

***

<a id="testserveroptions"></a>

### TestServerOptions

#### Properties

<a id="app-1"></a>

##### app?

```ts
readonly optional app?: string;
```

<a id="confirmttlms"></a>

##### confirmTtlMs?

```ts
readonly optional confirmTtlMs?: number;
```

<a id="ledger-2"></a>

##### ledger?

```ts
readonly optional ledger?: Ledger;
```

## Type Aliases

<a id="testfetch"></a>

### TestFetch

```ts
type TestFetch = (input, init?) => Promise<Response>;
```

#### Parameters

##### input

`string` \| `URL` \| `Request`

##### init?

`RequestInit`

#### Returns

`Promise`\<`Response`\>

## Variables

<a id="accept_language_header"></a>

### ACCEPT\_LANGUAGE\_HEADER

```ts
const ACCEPT_LANGUAGE_HEADER: "accept-language" = "accept-language";
```

***

<a id="test_base_url"></a>

### TEST\_BASE\_URL

```ts
const TEST_BASE_URL: "http://rex.test" = "http://rex.test";
```

## Functions

<a id="cleanuprex"></a>

### cleanupRex()

```ts
function cleanupRex(): void;
```

#### Returns

`void`

***

<a id="createtestapp"></a>

### createTestApp()

```ts
function createTestApp(source, options): TestApp;
```

#### Parameters

##### source

[`TestAppSource`](#testappsource-1)

##### options

[`TestAppOptions`](#testappoptions)

#### Returns

[`TestApp`](#testapp)

***

<a id="readsidecar"></a>

### readSidecar()

```ts
function readSidecar(container?): object;
```

#### Parameters

##### container?

`ParentNode` = `globalThis.document`

#### Returns

`object`

##### actions

```ts
actions: object[];
```

##### outcome

```ts
outcome: 
  | {
  action: string;
  at: string;
  message: string;
  ok: boolean;
}
  | null;
```

##### overlays

```ts
overlays: object[];
```

##### page

```ts
page: string;
```

##### params

```ts
params: Record<string, unknown>;
```

##### regions?

```ts
optional regions?: object[];
```

##### state

```ts
state: 
  | "loading"
  | "empty"
  | "stale"
  | "partial"
  | "offline"
  | "permission-denied"
  | "recoverable-error"
  | "terminal-error"
  | "ready";
```

##### stores?

```ts
optional stores?: Record<string, unknown>;
```

##### version

```ts
version: 1;
```

***

<a id="renderpage"></a>

### renderPage()

```ts
function renderPage(
   app, 
   pageId, 
   options?
): Promise<RexRenderResult>;
```

#### Parameters

##### app

[`TestApp`](#testapp)

##### pageId

`string`

##### options?

[`RenderPageOptions`](#renderpageoptions) = `{}`

#### Returns

`Promise`\<[`RexRenderResult`](#rexrenderresult)\>

***

<a id="renderregion"></a>

### renderRegion()

```ts
function renderRegion(
   app, 
   pageId, 
   regionName, 
   props?, 
   options?
): Promise<RexRenderResult>;
```

#### Parameters

##### app

[`TestApp`](#testapp)

##### pageId

`string`

##### regionName

`string`

##### props?

`Readonly`\<`Record`\<`string`, `unknown`\>\> = `{}`

##### options?

[`RenderPageOptions`](#renderpageoptions) = `{}`

#### Returns

`Promise`\<[`RexRenderResult`](#rexrenderresult)\>

***

<a id="setuprextesting"></a>

### setupRexTesting()

```ts
function setupRexTesting(hooks): void;
```

#### Parameters

##### hooks

[`RexTestHooks`](#rextesthooks)

#### Returns

`void`

***

<a id="testserver-1"></a>

### testServer()

```ts
function testServer(app): TestServer;
```

#### Parameters

##### app

[`TestApp`](#testapp)

#### Returns

[`TestServer`](#testserver)
