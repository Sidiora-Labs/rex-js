[@sidioralabs/rex API](../../../README.md) / @sidioralabs/rex/client/interop

# @sidioralabs/rex/client/interop

## Interfaces

<a id="defineelementoptions"></a>

### DefineElementOptions

#### Type Parameters

##### P

`P`

#### Properties

<a id="props"></a>

##### props

```ts
readonly props: ElementPropMap<P>;
```

***

<a id="mountrexpageoptions"></a>

### MountRexPageOptions

#### Extends

- [`RexEntryOptions`](../client.md#rexentryoptions)

#### Properties

<a id="actor"></a>

##### actor?

```ts
readonly optional actor?: Actor;
```

###### Inherited from

[`CreateRexAppOptions`](../client.md#createrexappoptions).[`actor`](../client.md#actor)

<a id="baseurl"></a>

##### baseUrl?

```ts
readonly optional baseUrl?: string;
```

###### Inherited from

[`CreateRexAppOptions`](../client.md#createrexappoptions).[`baseUrl`](../client.md#baseurl)

<a id="fetch"></a>

##### fetch?

```ts
readonly optional fetch?: RexFetch;
```

###### Inherited from

[`CreateRexAppOptions`](../client.md#createrexappoptions).[`fetch`](../client.md#fetch)

<a id="link"></a>

##### link?

```ts
readonly optional link?: ClientLink<RexClientContext>;
```

###### Inherited from

[`CreateRexAppOptions`](../client.md#createrexappoptions).[`link`](../client.md#link)

<a id="onnavigate"></a>

##### onNavigate?

```ts
readonly optional onNavigate?: RexNavigateHook;
```

###### Inherited from

[`CreateRexAppOptions`](../client.md#createrexappoptions).[`onNavigate`](../client.md#onnavigate)

<a id="onoutcome"></a>

##### onOutcome?

```ts
readonly optional onOutcome?: RexOutcomeHook;
```

###### Inherited from

[`CreateRexAppOptions`](../client.md#createrexappoptions).[`onOutcome`](../client.md#onoutcome)

<a id="params"></a>

##### params?

```ts
readonly optional params?: Readonly<Record<string, unknown>>;
```

<a id="queryclient"></a>

##### queryClient?

```ts
readonly optional queryClient?: QueryClient;
```

###### Inherited from

[`CreateRexAppOptions`](../client.md#createrexappoptions).[`queryClient`](../client.md#queryclient)

***

<a id="nativeprops"></a>

### NativeProps

#### Extends

- `Omit`\<`HTMLAttributes`\<`HTMLElement`\>, `"children"` \| `"dangerouslySetInnerHTML"`\>

#### Properties

<a id="as"></a>

##### as?

```ts
readonly optional as?: NativeTag;
```

<a id="mount"></a>

##### mount?

```ts
readonly optional mount?: NativeMount;
```

***

<a id="rexelementconstructor"></a>

### RexElementConstructor

#### Extends

- `CustomElementConstructor`

#### Constructors

<a id="constructor"></a>

##### Constructor

```ts
new RexElementConstructor(...params): HTMLElement;
```

###### Parameters

###### params

...`any`[]

###### Returns

`HTMLElement`

###### Inherited from

```ts
CustomElementConstructor.constructor
```

#### Properties

<a id="observedattributes"></a>

##### observedAttributes

```ts
readonly observedAttributes: readonly string[];
```

<a id="tagname"></a>

##### tagName

```ts
readonly tagName: string;
```

## Type Aliases

<a id="elementpropkind"></a>

### ElementPropKind

```ts
type ElementPropKind = "string" | "number" | "boolean" | "json";
```

***

<a id="elementpropmap"></a>

### ElementPropMap

```ts
type ElementPropMap<P> = { readonly [K in keyof P & string]?: ElementPropKind };
```

#### Type Parameters

##### P

`P`

***

<a id="nativemount"></a>

### NativeMount

```ts
type NativeMount = (node) => void | (() => void);
```

#### Parameters

##### node

`HTMLElement`

#### Returns

`void` \| (() => `void`)

***

<a id="nativetag"></a>

### NativeTag

```ts
type NativeTag = "div" | "span" | "section" | "article" | "figure";
```

***

<a id="unmountrexpage"></a>

### UnmountRexPage

```ts
type UnmountRexPage = () => void;
```

#### Returns

`void`

## Variables

<a id="native"></a>

### Native

```ts
const Native: ForwardRefExoticComponent<NativeProps & RefAttributes<HTMLElement>>;
```

## Functions

<a id="attributename"></a>

### attributeName()

```ts
function attributeName(prop): string;
```

#### Parameters

##### prop

`string`

#### Returns

`string`

***

<a id="coerceattribute"></a>

### coerceAttribute()

```ts
function coerceAttribute(
   tagName, 
   attribute, 
   kind, 
   value
): unknown;
```

#### Parameters

##### tagName

`string`

##### attribute

`string`

##### kind

[`ElementPropKind`](#elementpropkind)

##### value

`string` \| `null`

#### Returns

`unknown`

***

<a id="defineelement"></a>

### defineElement()

```ts
function defineElement<P>(
   tagName, 
   Part, 
   options
): RexElementConstructor;
```

#### Type Parameters

##### P

`P` *extends* `object`

#### Parameters

##### tagName

`string`

##### Part

`ComponentType`\<`P`\>

##### options

[`DefineElementOptions`](#defineelementoptions)\<`P`\>

#### Returns

[`RexElementConstructor`](#rexelementconstructor)

***

<a id="mountrexpage"></a>

### mountRexPage()

```ts
function mountRexPage(
   element, 
   app, 
   pageId, 
   options?
): UnmountRexPage;
```

#### Parameters

##### element

`Element`

##### app

[`RexEntryBundle`](../client.md#rexentrybundle)

##### pageId

`string`

##### options?

[`MountRexPageOptions`](#mountrexpageoptions) = `{}`

#### Returns

[`UnmountRexPage`](#unmountrexpage)
