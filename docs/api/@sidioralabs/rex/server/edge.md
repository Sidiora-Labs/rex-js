[@sidioralabs/rex API](../../../README.md) / @sidioralabs/rex/server/edge

# @sidioralabs/rex/server/edge

## Interfaces

<a id="edgefetchapp"></a>

### EdgeFetchApp

#### Methods

<a id="fetch"></a>

##### fetch()

```ts
fetch(
   request, 
   env?, 
   executionCtx?
): Response | Promise<Response>;
```

###### Parameters

###### request

`Request`

###### env?

`unknown`

###### executionCtx?

`ExecutionContext`

###### Returns

`Response` \| `Promise`\<`Response`\>

***

<a id="edgehandler"></a>

### EdgeHandler

#### Properties

<a id="fetch-1"></a>

##### fetch

```ts
readonly fetch: EdgeFetchHandler;
```

## Type Aliases

<a id="edgefetchhandler"></a>

### EdgeFetchHandler

```ts
type EdgeFetchHandler = (request, env?, executionCtx?) => Promise<Response>;
```

#### Parameters

##### request

`Request`

##### env?

`unknown`

##### executionCtx?

`ExecutionContext`

#### Returns

`Promise`\<`Response`\>

***

<a id="edgeserveroptions"></a>

### EdgeServerOptions

```ts
type EdgeServerOptions<A> = PrebuiltRexServerOptions<A>;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../../rex.md#anyaction)

## Functions

<a id="createedgehandler"></a>

### createEdgeHandler()

```ts
function createEdgeHandler(app): EdgeHandler;
```

#### Parameters

##### app

[`EdgeFetchApp`](#edgefetchapp)

#### Returns

[`EdgeHandler`](#edgehandler)

***

<a id="createedgeserver"></a>

### createEdgeServer()

```ts
function createEdgeServer<A>(options): EdgeHandler;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../../rex.md#anyaction)

#### Parameters

##### options

[`EdgeServerOptions`](#edgeserveroptions)\<`A`\>

#### Returns

[`EdgeHandler`](#edgehandler)
