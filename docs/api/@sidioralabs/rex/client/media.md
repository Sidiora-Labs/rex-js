[@sidioralabs/rex API](../../../README.md) / @sidioralabs/rex/client/media

# @sidioralabs/rex/client/media

## Interfaces

<a id="imgprops"></a>

### ImgProps

#### Extends

- `Omit`\<`NativeImgProps`, 
  \| `"src"`
  \| `"alt"`
  \| `"width"`
  \| `"height"`
  \| `"loading"`
  \| `"decoding"`
  \| `"fetchPriority"`
  \| `"srcSet"`
  \| `"sizes"`
  \| `"children"`
  \| `"dangerouslySetInnerHTML"`\>

#### Properties

<a id="alt"></a>

##### alt

```ts
readonly alt: string;
```

<a id="decoding"></a>

##### decoding?

```ts
readonly optional decoding?: "auto" | "async" | "sync";
```

<a id="height"></a>

##### height

```ts
readonly height: number;
```

<a id="loading"></a>

##### loading?

```ts
readonly optional loading?: "lazy" | "eager";
```

<a id="priority"></a>

##### priority?

```ts
readonly optional priority?: boolean;
```

<a id="sizes"></a>

##### sizes?

```ts
readonly optional sizes?: string;
```

<a id="src"></a>

##### src

```ts
readonly src: string;
```

<a id="srcset"></a>

##### srcSet?

```ts
readonly optional srcSet?: string;
```

<a id="width"></a>

##### width

```ts
readonly width: number;
```

***

<a id="loadscriptoptions"></a>

### LoadScriptOptions

#### Properties

<a id="id"></a>

##### id?

```ts
readonly optional id?: string;
```

<a id="nonce"></a>

##### nonce?

```ts
readonly optional nonce?: string | null;
```

<a id="strategy"></a>

##### strategy?

```ts
readonly optional strategy?: "idle" | "beforeHydration" | "afterHydration";
```

***

<a id="mediaproviderprops"></a>

### MediaProviderProps

#### Properties

<a id="children"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="value"></a>

##### value

```ts
readonly value: RexMediaCollector;
```

***

<a id="priorityimage"></a>

### PriorityImage

#### Properties

<a id="sizes-1"></a>

##### sizes

```ts
readonly sizes: string | null;
```

<a id="src-1"></a>

##### src

```ts
readonly src: string;
```

<a id="srcset-1"></a>

##### srcSet

```ts
readonly srcSet: string | null;
```

***

<a id="rexmediacollector"></a>

### RexMediaCollector

#### Properties

<a id="nonce-1"></a>

##### nonce

```ts
readonly nonce: string | null;
```

#### Methods

<a id="preloadimage"></a>

##### preloadImage()

```ts
preloadImage(image): void;
```

###### Parameters

###### image

[`PriorityImage`](#priorityimage)

###### Returns

`void`

***

<a id="rexmediarequest"></a>

### RexMediaRequest

#### Properties

<a id="collector"></a>

##### collector

```ts
readonly collector: RexMediaCollector;
```

#### Methods

<a id="images"></a>

##### images()

```ts
images(): readonly PriorityImage[];
```

###### Returns

readonly [`PriorityImage`](#priorityimage)[]

***

<a id="scriptprops"></a>

### ScriptProps

#### Properties

<a id="id-1"></a>

##### id?

```ts
readonly optional id?: string;
```

<a id="onerror"></a>

##### onError?

```ts
readonly optional onError?: (error) => void;
```

###### Parameters

###### error

`Error`

###### Returns

`void`

<a id="onload"></a>

##### onLoad?

```ts
readonly optional onLoad?: () => void;
```

###### Returns

`void`

<a id="src-2"></a>

##### src

```ts
readonly src: string;
```

<a id="strategy-1"></a>

##### strategy?

```ts
readonly optional strategy?: "idle" | "beforeHydration" | "afterHydration";
```

## Type Aliases

<a id="scriptstrategy"></a>

### ScriptStrategy

```ts
type ScriptStrategy = typeof SCRIPT_STRATEGIES[number];
```

## Variables

<a id="default_script_strategy"></a>

### DEFAULT\_SCRIPT\_STRATEGY

```ts
const DEFAULT_SCRIPT_STRATEGY: ScriptStrategy = "afterHydration";
```

***

<a id="idle_fallback_ms"></a>

### IDLE\_FALLBACK\_MS

```ts
const IDLE_FALLBACK_MS: 1 = 1;
```

***

<a id="script_attribute"></a>

### SCRIPT\_ATTRIBUTE

```ts
const SCRIPT_ATTRIBUTE: "data-rex-script" = "data-rex-script";
```

***

<a id="script_strategies"></a>

### SCRIPT\_STRATEGIES

```ts
const SCRIPT_STRATEGIES: readonly ["beforeHydration", "afterHydration", "idle"];
```

## Functions

<a id="createmediacollector"></a>

### createMediaCollector()

```ts
function createMediaCollector(nonce?): RexMediaRequest;
```

#### Parameters

##### nonce?

`string` \| `null`

#### Returns

[`RexMediaRequest`](#rexmediarequest)

***

<a id="img"></a>

### Img()

```ts
function Img(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`ImgProps`](#imgprops)

#### Returns

`Element`

***

<a id="loadscript"></a>

### loadScript()

```ts
function loadScript(src, options?): Promise<void>;
```

#### Parameters

##### src

`string`

##### options?

[`LoadScriptOptions`](#loadscriptoptions) = `{}`

#### Returns

`Promise`\<`void`\>

***

<a id="mediaprovider"></a>

### MediaProvider()

```ts
function MediaProvider(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`MediaProviderProps`](#mediaproviderprops)

#### Returns

`Element`

***

<a id="script"></a>

### Script()

```ts
function Script(__namedParameters): Element | null;
```

#### Parameters

##### \_\_namedParameters

[`ScriptProps`](#scriptprops)

#### Returns

`Element` \| `null`
