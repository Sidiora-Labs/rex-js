[@sidioralabs/rex API](../../../README.md) / @sidioralabs/rex/server/deno

# @sidioralabs/rex/server/deno

## Interfaces

<a id="denohttpserver"></a>

### DenoHttpServer

#### Properties

<a id="addr"></a>

##### addr

```ts
readonly addr: DenoNetAddr;
```

<a id="finished"></a>

##### finished

```ts
readonly finished: Promise<void>;
```

#### Methods

<a id="shutdown"></a>

##### shutdown()

```ts
shutdown(): Promise<void>;
```

###### Returns

`Promise`\<`void`\>

***

<a id="denonetaddr"></a>

### DenoNetAddr

#### Properties

<a id="hostname"></a>

##### hostname

```ts
readonly hostname: string;
```

<a id="port"></a>

##### port

```ts
readonly port: number;
```

<a id="transport"></a>

##### transport

```ts
readonly transport: "tcp" | "udp";
```

***

<a id="denoruntime"></a>

### DenoRuntime

#### Methods

<a id="serve"></a>

##### serve()

```ts
serve(options, handler): DenoHttpServer;
```

###### Parameters

###### options

[`DenoServeOptions`](#denoserveoptions)

###### handler

[`DenoServeHandler`](#denoservehandler)

###### Returns

[`DenoHttpServer`](#denohttpserver)

***

<a id="denoservehandlerinfo"></a>

### DenoServeHandlerInfo

#### Properties

<a id="remoteaddr"></a>

##### remoteAddr

```ts
readonly remoteAddr: DenoNetAddr;
```

***

<a id="denoserveoptions"></a>

### DenoServeOptions

#### Properties

<a id="hostname-1"></a>

##### hostname?

```ts
readonly optional hostname?: string;
```

<a id="onlisten"></a>

##### onListen?

```ts
readonly optional onListen?: (localAddr) => void;
```

###### Parameters

###### localAddr

[`DenoNetAddr`](#denonetaddr)

###### Returns

`void`

<a id="port-1"></a>

##### port

```ts
readonly port: number;
```

***

<a id="denoserveroptions"></a>

### DenoServerOptions

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

<a id="runningdenoserver"></a>

### RunningDenoServer

#### Properties

<a id="port-3"></a>

##### port

```ts
readonly port: number;
```

<a id="server"></a>

##### server

```ts
readonly server: DenoHttpServer;
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

<a id="denoservehandler"></a>

### DenoServeHandler

```ts
type DenoServeHandler = (request, info) => Response | Promise<Response>;
```

#### Parameters

##### request

`Request`

##### info

[`DenoServeHandlerInfo`](#denoservehandlerinfo)

#### Returns

`Response` \| `Promise`\<`Response`\>

## Functions

<a id="denoruntime-1"></a>

### denoRuntime()

```ts
function denoRuntime(): DenoRuntime | null;
```

#### Returns

[`DenoRuntime`](#denoruntime) \| `null`

***

<a id="startdenoserver"></a>

### startDenoServer()

```ts
function startDenoServer(app, options): Promise<RunningDenoServer>;
```

#### Parameters

##### app

[`FetchApp`](bun.md#fetchapp)

##### options

[`DenoServerOptions`](#denoserveroptions)

#### Returns

`Promise`\<[`RunningDenoServer`](#runningdenoserver)\>

## References

<a id="adapterruntime"></a>

### AdapterRuntime

Re-exports [AdapterRuntime](bun.md#adapterruntime)

***

<a id="fetchapp"></a>

### FetchApp

Re-exports [FetchApp](bun.md#fetchapp)

***

<a id="runtime_missing_code"></a>

### RUNTIME\_MISSING\_CODE

Re-exports [RUNTIME_MISSING_CODE](bun.md#runtime_missing_code)

***

<a id="runtimemissingerror"></a>

### RuntimeMissingError

Re-exports [RuntimeMissingError](bun.md#runtimemissingerror)
