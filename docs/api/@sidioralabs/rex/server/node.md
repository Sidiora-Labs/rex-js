[@sidioralabs/rex API](../../../README.md) / @sidioralabs/rex/server/node

# @sidioralabs/rex/server/node

## Interfaces

<a id="nodeserveroptions"></a>

### NodeServerOptions

#### Extended by

- [`PrerenderedNodeServerOptions`](#prerenderednodeserveroptions)

#### Properties

<a id="clientdir"></a>

##### clientDir

```ts
readonly clientDir: string;
```

<a id="hostname"></a>

##### hostname?

```ts
readonly optional hostname?: string;
```

<a id="port"></a>

##### port

```ts
readonly port: number;
```

***

<a id="nodestaticpagesoptions"></a>

### NodeStaticPagesOptions

#### Properties

<a id="clientdir-1"></a>

##### clientDir

```ts
readonly clientDir: string;
```

<a id="list"></a>

##### list

```ts
readonly list: string | PrerenderList;
```

<a id="onerror"></a>

##### onError?

```ts
readonly optional onError?: StaticCacheErrorHandler;
```

***

<a id="prerenderednodeserveroptions"></a>

### PrerenderedNodeServerOptions

#### Extends

- [`NodeServerOptions`](#nodeserveroptions)

#### Properties

<a id="clientdir-2"></a>

##### clientDir

```ts
readonly clientDir: string;
```

###### Inherited from

[`NodeServerOptions`](#nodeserveroptions).[`clientDir`](#clientdir)

<a id="hostname-1"></a>

##### hostname?

```ts
readonly optional hostname?: string;
```

###### Inherited from

[`NodeServerOptions`](#nodeserveroptions).[`hostname`](#hostname)

<a id="port-1"></a>

##### port

```ts
readonly port: number;
```

###### Inherited from

[`NodeServerOptions`](#nodeserveroptions).[`port`](#port)

<a id="registry"></a>

##### registry

```ts
readonly registry: object;
```

***

<a id="runningnodeserver"></a>

### RunningNodeServer

#### Properties

<a id="port-2"></a>

##### port

```ts
readonly port: number;
```

<a id="server"></a>

##### server

```ts
readonly server: ServerType;
```

<a id="url"></a>

##### url

```ts
readonly url: string;
```

#### Methods

<a id="close"></a>

##### close()

```ts
close(): Promise<void>;
```

###### Returns

`Promise`\<`void`\>

## Type Aliases

<a id="nodefetchapp"></a>

### NodeFetchApp

```ts
type NodeFetchApp = FetchApp;
```

## Variables

<a id="api_prefix"></a>

### API\_PREFIX

```ts
const API_PREFIX: "/rex" = "/rex";
```

***

<a id="createprerenderednodeapp"></a>

### createPrerenderedNodeApp

```ts
const createPrerenderedNodeApp: (app, clientDir, registry?) => Hono = createNodeApp;
```

#### Parameters

##### app

[`NodeFetchApp`](#nodefetchapp)

##### clientDir

`string`

##### registry?

`object`

#### Returns

`Hono`

***

<a id="index_file"></a>

### INDEX\_FILE

```ts
const INDEX_FILE: "index.html" = "index.html";
```

## Functions

<a id="createnodeapp"></a>

### createNodeApp()

```ts
function createNodeApp(app, clientDir): Hono;
```

#### Parameters

##### app

[`FetchApp`](bun.md#fetchapp)

##### clientDir

`string`

#### Returns

`Hono`

***

<a id="installnodestaticpages"></a>

### installNodeStaticPages()

```ts
function installNodeStaticPages(registry, options): Promise<StaticCache>;
```

#### Parameters

##### registry

`object`

##### options

[`NodeStaticPagesOptions`](#nodestaticpagesoptions)

#### Returns

`Promise`\<[`StaticCache`](../server.md#staticcache)\>

***

<a id="isapipath"></a>

### isApiPath()

```ts
function isApiPath(path): boolean;
```

#### Parameters

##### path

`string`

#### Returns

`boolean`

***

<a id="ispageroutepath"></a>

### isPageRoutePath()

```ts
function isPageRoutePath(path): boolean;
```

#### Parameters

##### path

`string`

#### Returns

`boolean`

***

<a id="nodestaticstore"></a>

### nodeStaticStore()

```ts
function nodeStaticStore(clientDir): StaticPageStore;
```

#### Parameters

##### clientDir

`string`

#### Returns

[`StaticPageStore`](../server.md#staticpagestore)

***

<a id="readprerenderlist"></a>

### readPrerenderList()

```ts
function readPrerenderList(file): Promise<PrerenderList>;
```

#### Parameters

##### file

`string`

#### Returns

`Promise`\<[`PrerenderList`](../server.md#prerenderlist)\>

***

<a id="startnodeserver"></a>

### startNodeServer()

```ts
function startNodeServer(app, options): Promise<RunningNodeServer>;
```

#### Parameters

##### app

[`FetchApp`](bun.md#fetchapp)

##### options

[`NodeServerOptions`](#nodeserveroptions)

#### Returns

`Promise`\<[`RunningNodeServer`](#runningnodeserver)\>

***

<a id="startprerenderednodeserver"></a>

### startPrerenderedNodeServer()

```ts
function startPrerenderedNodeServer(app, options): Promise<RunningNodeServer>;
```

#### Parameters

##### app

[`FetchApp`](bun.md#fetchapp)

##### options

[`PrerenderedNodeServerOptions`](#prerenderednodeserveroptions)

#### Returns

`Promise`\<[`RunningNodeServer`](#runningnodeserver)\>
