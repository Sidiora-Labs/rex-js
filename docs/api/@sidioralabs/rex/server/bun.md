[@sidioralabs/rex API](../../../README.md) / @sidioralabs/rex/server/bun

# @sidioralabs/rex/server/bun

## Classes

<a id="runtimemissingerror"></a>

### RuntimeMissingError

#### Extends

- `Error`

#### Constructors

<a id="constructor"></a>

##### Constructor

```ts
new RuntimeMissingError(runtime, entry): RuntimeMissingError;
```

###### Parameters

###### runtime

[`AdapterRuntime`](#adapterruntime)

###### entry

`string`

###### Returns

[`RuntimeMissingError`](#runtimemissingerror)

###### Overrides

```ts
Error.constructor
```

#### Properties

<a id="code"></a>

##### code

```ts
readonly code: "REX450" = RUNTIME_MISSING_CODE;
```

<a id="docs"></a>

##### docs

```ts
readonly docs: string;
```

<a id="hint"></a>

##### hint

```ts
readonly hint: string;
```

<a id="runtime"></a>

##### runtime

```ts
readonly runtime: AdapterRuntime;
```

## Interfaces

<a id="bunruntime"></a>

### BunRuntime

#### Methods

<a id="serve"></a>

##### serve()

```ts
serve(options): BunServer;
```

###### Parameters

###### options

[`BunServeOptions`](#bunserveoptions)

###### Returns

[`BunServer`](#bunserver)

***

<a id="bunserveoptions"></a>

### BunServeOptions

#### Properties

<a id="fetch"></a>

##### fetch

```ts
readonly fetch: BunFetchHandler;
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

<a id="bunserver"></a>

### BunServer

#### Properties

<a id="hostname-1"></a>

##### hostname

```ts
readonly hostname: string;
```

<a id="port-1"></a>

##### port

```ts
readonly port: number;
```

<a id="url"></a>

##### url

```ts
readonly url: URL;
```

#### Methods

<a id="stop"></a>

##### stop()

```ts
stop(closeActiveConnections?): void | Promise<void>;
```

###### Parameters

###### closeActiveConnections?

`boolean`

###### Returns

`void` \| `Promise`\<`void`\>

***

<a id="bunserveroptions"></a>

### BunServerOptions

#### Properties

<a id="hostname-2"></a>

##### hostname?

```ts
readonly optional hostname?: string;
```

<a id="port-2"></a>

##### port

```ts
readonly port: number;
```

***

<a id="fetchapp"></a>

### FetchApp

#### Methods

<a id="fetch-1"></a>

##### fetch()

```ts
fetch(request, env?): Response | Promise<Response>;
```

###### Parameters

###### request

`Request`

###### env?

`unknown`

###### Returns

`Response` \| `Promise`\<`Response`\>

***

<a id="runningbunserver"></a>

### RunningBunServer

#### Properties

<a id="port-3"></a>

##### port

```ts
readonly port: number;
```

<a id="server"></a>

##### server

```ts
readonly server: BunServer;
```

<a id="url-1"></a>

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

<a id="adapterruntime"></a>

### AdapterRuntime

```ts
type AdapterRuntime = "Bun" | "Deno";
```

***

<a id="bunfetchhandler"></a>

### BunFetchHandler

```ts
type BunFetchHandler = (request, server) => Response | Promise<Response>;
```

#### Parameters

##### request

`Request`

##### server

[`BunServer`](#bunserver)

#### Returns

`Response` \| `Promise`\<`Response`\>

## Variables

<a id="runtime_missing_code"></a>

### RUNTIME\_MISSING\_CODE

```ts
const RUNTIME_MISSING_CODE: "REX450" = "REX450";
```

## Functions

<a id="bunruntime-1"></a>

### bunRuntime()

```ts
function bunRuntime(): BunRuntime | null;
```

#### Returns

[`BunRuntime`](#bunruntime) \| `null`

***

<a id="startbunserver"></a>

### startBunServer()

```ts
function startBunServer(app, options): Promise<RunningBunServer>;
```

#### Parameters

##### app

[`FetchApp`](#fetchapp)

##### options

[`BunServerOptions`](#bunserveroptions)

#### Returns

`Promise`\<[`RunningBunServer`](#runningbunserver)\>
