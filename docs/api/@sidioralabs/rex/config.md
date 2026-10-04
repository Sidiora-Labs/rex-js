[@sidioralabs/rex API](../../README.md) / @sidioralabs/rex/config

# @sidioralabs/rex/config

## Classes

<a id="rexconfigerror"></a>

### RexConfigError

#### Extends

- [`RexError`](../rex.md#rexerror)

#### Constructors

<a id="constructor"></a>

##### Constructor

```ts
new RexConfigError(
   code, 
   field, 
   problem
): RexConfigError;
```

###### Parameters

###### code

  \| `"REX100"`
  \| `"REX101"`
  \| `"REX102"`
  \| `"REX110"`
  \| `"REX111"`
  \| `"REX112"`
  \| `"REX113"`
  \| `"REX114"`
  \| `"REX115"`
  \| `"REX116"`
  \| `"REX117"`
  \| `"REX118"`
  \| `"REX119"`
  \| `"REX120"`
  \| `"REX121"`
  \| `"REX122"`
  \| `"REX123"`
  \| `"REX200"`
  \| `"REX201"`
  \| `"REX202"`
  \| `"REX203"`
  \| `"REX204"`
  \| `"REX205"`
  \| `"REX206"`
  \| `"REX207"`
  \| `"REX208"`
  \| `"REX209"`
  \| `"REX210"`
  \| `"REX211"`
  \| `"REX212"`
  \| `"REX213"`
  \| `"REX214"`
  \| `"REX215"`
  \| `"REX216"`
  \| `"REX217"`
  \| `"REX218"`
  \| `"REX219"`
  \| `"REX220"`
  \| `"REX221"`
  \| `"REX222"`
  \| `"REX223"`
  \| `"REX224"`
  \| `"REX300"`
  \| `"REX301"`
  \| `"REX302"`
  \| `"REX303"`
  \| `"REX304"`
  \| `"REX305"`
  \| `"REX306"`
  \| `"REX307"`
  \| `"REX308"`
  \| `"REX309"`
  \| `"REX310"`
  \| `"REX311"`
  \| `"REX312"`
  \| `"REX313"`
  \| `"REX314"`
  \| `"REX315"`
  \| `"REX316"`
  \| `"REX317"`
  \| `"REX318"`
  \| `"REX319"`
  \| `"REX320"`
  \| `"REX321"`
  \| `"REX322"`
  \| `"REX323"`
  \| `"REX324"`
  \| `"REX325"`
  \| `"REX326"`
  \| `"REX327"`
  \| `"REX328"`
  \| `"REX329"`
  \| `"REX330"`
  \| `"REX331"`
  \| `"REX332"`
  \| `"REX333"`
  \| `"REX334"`
  \| `"REX400"`
  \| `"REX401"`
  \| `"REX402"`
  \| `"REX403"`
  \| `"REX404"`
  \| `"REX405"`
  \| `"REX406"`
  \| `"REX407"`
  \| `"REX408"`
  \| `"REX440"`
  \| `"REX441"`
  \| `"REX442"`
  \| `"REX450"`
  \| `"REX460"`
  \| `"REX461"`
  \| `"REX462"`
  \| `"REX463"`
  \| `"REX500"`
  \| `"REX501"`
  \| `"REX502"`
  \| `"REX503"`
  \| `"REX504"`
  \| `"REX505"`
  \| `"REX506"`
  \| `"REX507"`
  \| `"REX508"`
  \| `"REX600"`
  \| `"REX601"`
  \| `"REX602"`
  \| `"REX603"`
  \| `"REX604"`
  \| `"REX605"`
  \| `"REX610"`
  \| `"REX611"`
  \| `"REX612"`

###### field

`string`

###### problem

`string`

###### Returns

[`RexConfigError`](#rexconfigerror)

###### Overrides

[`RexError`](../rex.md#rexerror).[`constructor`](../rex.md#constructor-3)

#### Properties

<a id="code"></a>

##### code

```ts
readonly code: 
  | "REX100"
  | "REX101"
  | "REX102"
  | "REX110"
  | "REX111"
  | "REX112"
  | "REX113"
  | "REX114"
  | "REX115"
  | "REX116"
  | "REX117"
  | "REX118"
  | "REX119"
  | "REX120"
  | "REX121"
  | "REX122"
  | "REX123"
  | "REX200"
  | "REX201"
  | "REX202"
  | "REX203"
  | "REX204"
  | "REX205"
  | "REX206"
  | "REX207"
  | "REX208"
  | "REX209"
  | "REX210"
  | "REX211"
  | "REX212"
  | "REX213"
  | "REX214"
  | "REX215"
  | "REX216"
  | "REX217"
  | "REX218"
  | "REX219"
  | "REX220"
  | "REX221"
  | "REX222"
  | "REX223"
  | "REX224"
  | "REX300"
  | "REX301"
  | "REX302"
  | "REX303"
  | "REX304"
  | "REX305"
  | "REX306"
  | "REX307"
  | "REX308"
  | "REX309"
  | "REX310"
  | "REX311"
  | "REX312"
  | "REX313"
  | "REX314"
  | "REX315"
  | "REX316"
  | "REX317"
  | "REX318"
  | "REX319"
  | "REX320"
  | "REX321"
  | "REX322"
  | "REX323"
  | "REX324"
  | "REX325"
  | "REX326"
  | "REX327"
  | "REX328"
  | "REX329"
  | "REX330"
  | "REX331"
  | "REX332"
  | "REX333"
  | "REX334"
  | "REX400"
  | "REX401"
  | "REX402"
  | "REX403"
  | "REX404"
  | "REX405"
  | "REX406"
  | "REX407"
  | "REX408"
  | "REX440"
  | "REX441"
  | "REX442"
  | "REX450"
  | "REX460"
  | "REX461"
  | "REX462"
  | "REX463"
  | "REX500"
  | "REX501"
  | "REX502"
  | "REX503"
  | "REX504"
  | "REX505"
  | "REX506"
  | "REX507"
  | "REX508"
  | "REX600"
  | "REX601"
  | "REX602"
  | "REX603"
  | "REX604"
  | "REX605"
  | "REX610"
  | "REX611"
  | "REX612";
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`code`](../rex.md#code-3)

<a id="column"></a>

##### column

```ts
readonly column: number | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`column`](../rex.md#column-3)

<a id="detail"></a>

##### detail

```ts
readonly detail: string;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`detail`](../rex.md#detail-3)

<a id="docs"></a>

##### docs

```ts
readonly docs: string;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`docs`](../rex.md#docs-3)

<a id="field"></a>

##### field

```ts
readonly field: string;
```

<a id="file"></a>

##### file

```ts
readonly file: string | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`file`](../rex.md#file-3)

<a id="hint"></a>

##### hint

```ts
readonly hint: string | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`hint`](../rex.md#hint-3)

<a id="line"></a>

##### line

```ts
readonly line: number | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`line`](../rex.md#line-3)

## Interfaces

<a id="budgetsconfig"></a>

### BudgetsConfig

#### Properties

<a id="client"></a>

##### client?

```ts
readonly optional client?: number;
```

<a id="core"></a>

##### core?

```ts
readonly optional core?: number;
```

<a id="page"></a>

##### page?

```ts
readonly optional page?: number;
```

***

<a id="checkconfig"></a>

### CheckConfig

#### Properties

<a id="i18n"></a>

##### i18n?

```ts
readonly optional i18n?: I18nCheckConfig;
```

<a id="tokens"></a>

##### tokens?

```ts
readonly optional tokens?: TokenAllowLists;
```

***

<a id="clientconfig"></a>

### ClientConfig

#### Properties

<a id="apiorigin"></a>

##### apiOrigin?

```ts
readonly optional apiOrigin?: string;
```

***

<a id="configserveroptions"></a>

### ConfigServerOptions

#### Properties

<a id="client-1"></a>

##### client?

```ts
readonly optional client?: ClientConfig;
```

<a id="security"></a>

##### security

```ts
readonly security: SecurityConfig;
```

***

<a id="fontspec"></a>

### FontSpec

#### Properties

<a id="family"></a>

##### family

```ts
readonly family: string;
```

<a id="preload"></a>

##### preload?

```ts
readonly optional preload?: boolean;
```

<a id="src"></a>

##### src

```ts
readonly src: string;
```

<a id="style"></a>

##### style?

```ts
readonly optional style?: "normal" | "italic";
```

<a id="weight"></a>

##### weight?

```ts
readonly optional weight?: string | number;
```

***

<a id="i18ncheckconfig"></a>

### I18nCheckConfig

#### Properties

<a id="allow"></a>

##### allow?

```ts
readonly optional allow?: readonly string[];
```

***

<a id="i18nconfig"></a>

### I18nConfig

#### Properties

<a id="default"></a>

##### default

```ts
readonly default: string;
```

<a id="locales"></a>

##### locales

```ts
readonly locales: readonly string[];
```

<a id="routing"></a>

##### routing?

```ts
readonly optional routing?: "none" | "prefix";
```

***

<a id="imagesconfig"></a>

### ImagesConfig

#### Properties

<a id="formats"></a>

##### formats?

```ts
readonly optional formats?: readonly ("avif" | "webp" | "jpeg" | "png")[];
```

<a id="sizes"></a>

##### sizes?

```ts
readonly optional sizes?: readonly number[];
```

***

<a id="renderconfig"></a>

### RenderConfig

#### Properties

<a id="default-1"></a>

##### default?

```ts
readonly optional default?: "ssr" | "csr" | "ssg" | "static";
```

***

<a id="resolvedbudgets"></a>

### ResolvedBudgets

#### Properties

<a id="client-2"></a>

##### client

```ts
readonly client: number;
```

<a id="core-1"></a>

##### core

```ts
readonly core: number;
```

<a id="page-1"></a>

##### page

```ts
readonly page: number;
```

***

<a id="resolvedfont"></a>

### ResolvedFont

#### Properties

<a id="family-1"></a>

##### family

```ts
readonly family: string;
```

<a id="preload-1"></a>

##### preload

```ts
readonly preload: boolean;
```

<a id="src-1"></a>

##### src

```ts
readonly src: string;
```

<a id="style-1"></a>

##### style

```ts
readonly style: "normal" | "italic";
```

<a id="weight-1"></a>

##### weight

```ts
readonly weight: string | null;
```

***

<a id="resolvedi18n"></a>

### ResolvedI18n

#### Properties

<a id="default-2"></a>

##### default

```ts
readonly default: string;
```

<a id="locales-1"></a>

##### locales

```ts
readonly locales: readonly string[];
```

<a id="routing-1"></a>

##### routing

```ts
readonly routing: "none" | "prefix";
```

***

<a id="resolvedrexconfig"></a>

### ResolvedRexConfig

#### Extends

- [`ResolvedRexOptions`](#resolvedrexoptions)

#### Type Parameters

##### A

`A` *extends* [`RexConfigApp`](#rexconfigapp-1) = [`RexConfigApp`](#rexconfigapp-1)

#### Properties

<a id="app"></a>

##### app

```ts
readonly app: A;
```

<a id="budgets"></a>

##### budgets

```ts
readonly budgets: ResolvedBudgets;
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`budgets`](#budgets-1)

<a id="check"></a>

##### check

```ts
readonly check: object;
```

###### i18n

```ts
readonly i18n: object;
```

###### i18n.allow

```ts
readonly allow: readonly string[];
```

###### tokens

```ts
readonly tokens: object;
```

###### tokens.classes

```ts
readonly classes: readonly string[];
```

###### tokens.colors

```ts
readonly colors: readonly string[];
```

###### tokens.spacing

```ts
readonly spacing: readonly string[];
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`check`](#check-1)

<a id="client-3"></a>

##### client

```ts
readonly client: object;
```

###### apiOrigin

```ts
readonly apiOrigin: string | null;
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`client`](#client-4)

<a id="compiler"></a>

##### compiler

```ts
readonly compiler: boolean;
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`compiler`](#compiler-1)

<a id="devtools"></a>

##### devtools

```ts
readonly devtools: boolean;
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`devtools`](#devtools-1)

<a id="fonts"></a>

##### fonts

```ts
readonly fonts: readonly ResolvedFont[];
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`fonts`](#fonts-1)

<a id="i18n-1"></a>

##### i18n

```ts
readonly i18n: ResolvedI18n | null;
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`i18n`](#i18n-2)

<a id="images"></a>

##### images

```ts
readonly images: object;
```

###### formats

```ts
readonly formats: readonly ("avif" | "webp" | "jpeg" | "png")[];
```

###### sizes

```ts
readonly sizes: readonly number[];
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`images`](#images-1)

<a id="render"></a>

##### render

```ts
readonly render: object;
```

###### default

```ts
readonly default: "ssr" | "csr" | "ssg" | "static";
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`render`](#render-1)

<a id="security-1"></a>

##### security

```ts
readonly security: ResolvedSecurity;
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`security`](#security-2)

<a id="server"></a>

##### server

```ts
readonly server: ((app) => RexFetchHandler) | null;
```

<a id="shellcomponents"></a>

##### shellComponents

```ts
readonly shellComponents: string | null;
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`shellComponents`](#shellcomponents-1)

<a id="tailwind"></a>

##### tailwind

```ts
readonly tailwind: boolean;
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`tailwind`](#tailwind-1)

<a id="telemetry"></a>

##### telemetry

```ts
readonly telemetry: object;
```

###### logger

```ts
readonly logger: RexLogger | null;
```

###### tracer

```ts
readonly tracer: RexTracer | null;
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`telemetry`](#telemetry-1)

<a id="ui"></a>

##### ui

```ts
readonly ui: "none" | "designx";
```

###### Inherited from

[`ResolvedRexOptions`](#resolvedrexoptions).[`ui`](#ui-1)

***

<a id="resolvedrexoptions"></a>

### ResolvedRexOptions

#### Extended by

- [`ResolvedRexConfig`](#resolvedrexconfig)

#### Properties

<a id="budgets-1"></a>

##### budgets

```ts
readonly budgets: ResolvedBudgets;
```

<a id="check-1"></a>

##### check

```ts
readonly check: object;
```

###### i18n

```ts
readonly i18n: object;
```

###### i18n.allow

```ts
readonly allow: readonly string[];
```

###### tokens

```ts
readonly tokens: object;
```

###### tokens.classes

```ts
readonly classes: readonly string[];
```

###### tokens.colors

```ts
readonly colors: readonly string[];
```

###### tokens.spacing

```ts
readonly spacing: readonly string[];
```

<a id="client-4"></a>

##### client

```ts
readonly client: object;
```

###### apiOrigin

```ts
readonly apiOrigin: string | null;
```

<a id="compiler-1"></a>

##### compiler

```ts
readonly compiler: boolean;
```

<a id="devtools-1"></a>

##### devtools

```ts
readonly devtools: boolean;
```

<a id="fonts-1"></a>

##### fonts

```ts
readonly fonts: readonly ResolvedFont[];
```

<a id="i18n-2"></a>

##### i18n

```ts
readonly i18n: ResolvedI18n | null;
```

<a id="images-1"></a>

##### images

```ts
readonly images: object;
```

###### formats

```ts
readonly formats: readonly ("avif" | "webp" | "jpeg" | "png")[];
```

###### sizes

```ts
readonly sizes: readonly number[];
```

<a id="render-1"></a>

##### render

```ts
readonly render: object;
```

###### default

```ts
readonly default: "ssr" | "csr" | "ssg" | "static";
```

<a id="security-2"></a>

##### security

```ts
readonly security: ResolvedSecurity;
```

<a id="shellcomponents-1"></a>

##### shellComponents

```ts
readonly shellComponents: string | null;
```

<a id="tailwind-1"></a>

##### tailwind

```ts
readonly tailwind: boolean;
```

<a id="telemetry-1"></a>

##### telemetry

```ts
readonly telemetry: object;
```

###### logger

```ts
readonly logger: RexLogger | null;
```

###### tracer

```ts
readonly tracer: RexTracer | null;
```

<a id="ui-1"></a>

##### ui

```ts
readonly ui: "none" | "designx";
```

***

<a id="resolvedsecurity"></a>

### ResolvedSecurity

#### Properties

<a id="csp"></a>

##### csp

```ts
readonly csp: "off" | "strict" | "report";
```

<a id="headers"></a>

##### headers

```ts
readonly headers: Readonly<Record<string, string>>;
```

<a id="origins"></a>

##### origins

```ts
readonly origins: readonly string[];
```

<a id="secretnames"></a>

##### secretNames

```ts
readonly secretNames: readonly string[];
```

***

<a id="rexconfig"></a>

### RexConfig

#### Extends

- [`RexOptionsConfig`](#rexoptionsconfig)

#### Type Parameters

##### A

`A` *extends* [`RexConfigApp`](#rexconfigapp-1) = [`RexConfigApp`](#rexconfigapp-1)

#### Properties

<a id="app-1"></a>

##### app

```ts
readonly app: A;
```

<a id="budgets-2"></a>

##### budgets?

```ts
readonly optional budgets?: BudgetsConfig;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`budgets`](#budgets-3)

<a id="check-2"></a>

##### check?

```ts
readonly optional check?: CheckConfig;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`check`](#check-3)

<a id="client-5"></a>

##### client?

```ts
readonly optional client?: ClientConfig;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`client`](#client-6)

<a id="compiler-2"></a>

##### compiler?

```ts
readonly optional compiler?: boolean;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`compiler`](#compiler-3)

<a id="devtools-2"></a>

##### devtools?

```ts
readonly optional devtools?: boolean;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`devtools`](#devtools-3)

<a id="fonts-2"></a>

##### fonts?

```ts
readonly optional fonts?: readonly FontSpec[];
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`fonts`](#fonts-3)

<a id="i18n-3"></a>

##### i18n?

```ts
readonly optional i18n?: I18nConfig;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`i18n`](#i18n-4)

<a id="images-2"></a>

##### images?

```ts
readonly optional images?: ImagesConfig;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`images`](#images-3)

<a id="render-2"></a>

##### render?

```ts
readonly optional render?: RenderConfig;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`render`](#render-3)

<a id="security-3"></a>

##### security?

```ts
readonly optional security?: SecurityConfig;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`security`](#security-4)

<a id="server-1"></a>

##### server?

```ts
readonly optional server?: (app) => RexFetchHandler;
```

###### Parameters

###### app

`A`

###### Returns

[`RexFetchHandler`](#rexfetchhandler)

<a id="tailwind-2"></a>

##### tailwind?

```ts
readonly optional tailwind?: boolean;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`tailwind`](#tailwind-3)

<a id="telemetry-2"></a>

##### telemetry?

```ts
readonly optional telemetry?: TelemetryConfig;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`telemetry`](#telemetry-3)

<a id="ui-2"></a>

##### ui?

```ts
readonly optional ui?: "none" | "designx" | UiConfig;
```

###### Inherited from

[`RexOptionsConfig`](#rexoptionsconfig).[`ui`](#ui-3)

***

<a id="rexconfigapp-1"></a>

### RexConfigApp

#### Properties

<a id="name"></a>

##### name

```ts
readonly name: string;
```

<a id="registry"></a>

##### registry

```ts
readonly registry: RegistrySnapshot;
```

***

<a id="rexfetchhandler"></a>

### RexFetchHandler

#### Methods

<a id="fetch"></a>

##### fetch()

```ts
fetch(request): Response | Promise<Response>;
```

###### Parameters

###### request

`Request`

###### Returns

`Response` \| `Promise`\<`Response`\>

***

<a id="rexlogger"></a>

### RexLogger

#### Methods

<a id="debug"></a>

##### debug()

```ts
debug(message, attributes?): void;
```

###### Parameters

###### message

`string`

###### attributes?

`Readonly`\<`Record`\<`string`, `unknown`\>\>

###### Returns

`void`

<a id="error"></a>

##### error()

```ts
error(message, attributes?): void;
```

###### Parameters

###### message

`string`

###### attributes?

`Readonly`\<`Record`\<`string`, `unknown`\>\>

###### Returns

`void`

<a id="info"></a>

##### info()

```ts
info(message, attributes?): void;
```

###### Parameters

###### message

`string`

###### attributes?

`Readonly`\<`Record`\<`string`, `unknown`\>\>

###### Returns

`void`

<a id="warn"></a>

##### warn()

```ts
warn(message, attributes?): void;
```

###### Parameters

###### message

`string`

###### attributes?

`Readonly`\<`Record`\<`string`, `unknown`\>\>

###### Returns

`void`

***

<a id="rexoptionsconfig"></a>

### RexOptionsConfig

#### Extended by

- [`RexConfig`](#rexconfig)

#### Properties

<a id="budgets-3"></a>

##### budgets?

```ts
readonly optional budgets?: BudgetsConfig;
```

<a id="check-3"></a>

##### check?

```ts
readonly optional check?: CheckConfig;
```

<a id="client-6"></a>

##### client?

```ts
readonly optional client?: ClientConfig;
```

<a id="compiler-3"></a>

##### compiler?

```ts
readonly optional compiler?: boolean;
```

<a id="devtools-3"></a>

##### devtools?

```ts
readonly optional devtools?: boolean;
```

<a id="fonts-3"></a>

##### fonts?

```ts
readonly optional fonts?: readonly FontSpec[];
```

<a id="i18n-4"></a>

##### i18n?

```ts
readonly optional i18n?: I18nConfig;
```

<a id="images-3"></a>

##### images?

```ts
readonly optional images?: ImagesConfig;
```

<a id="render-3"></a>

##### render?

```ts
readonly optional render?: RenderConfig;
```

<a id="security-4"></a>

##### security?

```ts
readonly optional security?: SecurityConfig;
```

<a id="tailwind-3"></a>

##### tailwind?

```ts
readonly optional tailwind?: boolean;
```

<a id="telemetry-3"></a>

##### telemetry?

```ts
readonly optional telemetry?: TelemetryConfig;
```

<a id="ui-3"></a>

##### ui?

```ts
readonly optional ui?: "none" | "designx" | UiConfig;
```

***

<a id="rextracer"></a>

### RexTracer

#### Methods

<a id="startspan"></a>

##### startSpan()

```ts
startSpan(name, ...rest): unknown;
```

###### Parameters

###### name

`string`

###### rest

...`never`[]

###### Returns

`unknown`

***

<a id="securityconfig"></a>

### SecurityConfig

#### Properties

<a id="csp-1"></a>

##### csp?

```ts
readonly optional csp?: "off" | "strict" | "report";
```

<a id="headers-1"></a>

##### headers?

```ts
readonly optional headers?: Readonly<Record<string, string>>;
```

<a id="origins-1"></a>

##### origins?

```ts
readonly optional origins?: readonly string[];
```

<a id="secretnames-1"></a>

##### secretNames?

```ts
readonly optional secretNames?: readonly string[];
```

***

<a id="telemetryconfig"></a>

### TelemetryConfig

#### Properties

<a id="logger"></a>

##### logger?

```ts
readonly optional logger?: RexLogger;
```

<a id="tracer"></a>

##### tracer?

```ts
readonly optional tracer?: RexTracer;
```

***

<a id="tokenallowlists"></a>

### TokenAllowLists

#### Properties

<a id="classes"></a>

##### classes?

```ts
readonly optional classes?: readonly string[];
```

<a id="colors"></a>

##### colors?

```ts
readonly optional colors?: readonly string[];
```

<a id="spacing"></a>

##### spacing?

```ts
readonly optional spacing?: readonly string[];
```

***

<a id="uiconfig"></a>

### UiConfig

#### Properties

<a id="components"></a>

##### components?

```ts
readonly optional components?: string;
```

<a id="kit"></a>

##### kit?

```ts
readonly optional kit?: "none" | "designx";
```

## Type Aliases

<a id="cspmode"></a>

### CspMode

```ts
type CspMode = typeof CSP_MODES[number];
```

***

<a id="defaultserverfactory"></a>

### DefaultServerFactory

```ts
type DefaultServerFactory = (app) => RexFetchHandler;
```

#### Parameters

##### app

[`RexConfigApp`](#rexconfigapp-1)

#### Returns

[`RexFetchHandler`](#rexfetchhandler)

***

<a id="fontstyle"></a>

### FontStyle

```ts
type FontStyle = typeof FONT_STYLES[number];
```

***

<a id="i18nrouting"></a>

### I18nRouting

```ts
type I18nRouting = typeof I18N_ROUTING[number];
```

***

<a id="imageformat"></a>

### ImageFormat

```ts
type ImageFormat = typeof IMAGE_FORMATS[number];
```

***

<a id="rexconfigexport"></a>

### RexConfigExport

```ts
type RexConfigExport = 
  | {
  config: ResolvedRexConfig;
  kind: "config";
  options: ResolvedRexOptions;
}
  | {
  kind: "legacy";
  options: ResolvedRexOptions;
  server: RexFetchHandler;
};
```

***

<a id="uikit"></a>

### UiKit

```ts
type UiKit = typeof UI_KITS[number];
```

## Variables

<a id="config_file"></a>

### CONFIG\_FILE

```ts
const CONFIG_FILE: "rex.config.ts" = "rex.config.ts";
```

***

<a id="csp_modes"></a>

### CSP\_MODES

```ts
const CSP_MODES: readonly ["strict", "report", "off"];
```

***

<a id="default_budgets"></a>

### DEFAULT\_BUDGETS

```ts
const DEFAULT_BUDGETS: ResolvedBudgets;
```

***

<a id="default_image_formats"></a>

### DEFAULT\_IMAGE\_FORMATS

```ts
const DEFAULT_IMAGE_FORMATS: readonly ImageFormat[];
```

***

<a id="default_image_sizes"></a>

### DEFAULT\_IMAGE\_SIZES

```ts
const DEFAULT_IMAGE_SIZES: readonly number[];
```

***

<a id="default_options"></a>

### DEFAULT\_OPTIONS

```ts
const DEFAULT_OPTIONS: ResolvedRexOptions;
```

***

<a id="font_styles"></a>

### FONT\_STYLES

```ts
const FONT_STYLES: readonly ["normal", "italic"];
```

***

<a id="i18n_routing"></a>

### I18N\_ROUTING

```ts
const I18N_ROUTING: readonly ["prefix", "none"];
```

***

<a id="image_formats"></a>

### IMAGE\_FORMATS

```ts
const IMAGE_FORMATS: readonly ["avif", "webp", "jpeg", "png"];
```

***

<a id="legacy_config_message"></a>

### LEGACY\_CONFIG\_MESSAGE

```ts
const LEGACY_CONFIG_MESSAGE: "rex.config.ts default-exports a bare Hono app; wrap it in defineConfig({ app, server }) or run rex migrate";
```

***

<a id="ui_kits"></a>

### UI\_KITS

```ts
const UI_KITS: readonly ["designx", "none"];
```

## Functions

<a id="configserver"></a>

### configServer()

```ts
function configServer(read, fallback): RexFetchHandler;
```

#### Parameters

##### read

[`RexConfigExport`](#rexconfigexport)

##### fallback

[`DefaultServerFactory`](#defaultserverfactory)

#### Returns

[`RexFetchHandler`](#rexfetchhandler)

***

<a id="configserveroptions-1"></a>

### configServerOptions()

```ts
function configServerOptions(read): ConfigServerOptions;
```

#### Parameters

##### read

[`RexConfigExport`](#rexconfigexport)

#### Returns

[`ConfigServerOptions`](#configserveroptions)

***

<a id="defineconfig"></a>

### defineConfig()

```ts
function defineConfig<A>(config): RexConfig<A>;
```

#### Type Parameters

##### A

`A` *extends* [`RexConfigApp`](#rexconfigapp-1)

#### Parameters

##### config

[`RexConfig`](#rexconfig)\<`A`\>

#### Returns

[`RexConfig`](#rexconfig)\<`A`\>

***

<a id="isdefinedconfig"></a>

### isDefinedConfig()

```ts
function isDefinedConfig(value): value is RexConfig<RexConfigApp>;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is RexConfig<RexConfigApp>`

***

<a id="isfetchhandler"></a>

### isFetchHandler()

```ts
function isFetchHandler(value): value is RexFetchHandler;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is RexFetchHandler`

***

<a id="parseconfig"></a>

### parseConfig()

```ts
function parseConfig<A>(value): ResolvedRexConfig<A>;
```

#### Type Parameters

##### A

`A` *extends* [`RexConfigApp`](#rexconfigapp-1) = [`RexConfigApp`](#rexconfigapp-1)

#### Parameters

##### value

`unknown`

#### Returns

[`ResolvedRexConfig`](#resolvedrexconfig)\<`A`\>

***

<a id="readconfigexport"></a>

### readConfigExport()

```ts
function readConfigExport(exported, warn?): RexConfigExport;
```

#### Parameters

##### exported

`unknown`

##### warn?

[`DeprecationWarn`](../rex.md#deprecationwarn)

#### Returns

[`RexConfigExport`](#rexconfigexport)

***

<a id="resolveoptions"></a>

### resolveOptions()

```ts
function resolveOptions(value?): ResolvedRexOptions;
```

#### Parameters

##### value?

[`RexOptionsConfig`](#rexoptionsconfig) = `{}`

#### Returns

[`ResolvedRexOptions`](#resolvedrexoptions)

## References

<a id="deprecated"></a>

### deprecated

Re-exports [deprecated](../rex.md#deprecated)

***

<a id="deprecationmessage"></a>

### deprecationMessage

Re-exports [deprecationMessage](../rex.md#deprecationmessage)

***

<a id="deprecationwarn"></a>

### DeprecationWarn

Re-exports [DeprecationWarn](../rex.md#deprecationwarn)

***

<a id="errordetail"></a>

### errorDetail

Re-exports [errorDetail](../rex.md#errordetail)

***

<a id="errordocs"></a>

### errorDocs

Re-exports [errorDocs](../rex.md#errordocs)

***

<a id="formatrexerror"></a>

### formatRexError

Re-exports [formatRexError](../rex.md#formatrexerror)

***

<a id="haswarned"></a>

### hasWarned

Re-exports [hasWarned](../rex.md#haswarned)

***

<a id="isrexerror"></a>

### isRexError

Re-exports [isRexError](../rex.md#isrexerror)

***

<a id="isrexerrorcode"></a>

### isRexErrorCode

Re-exports [isRexErrorCode](../rex.md#isrexerrorcode)

***

<a id="locaterexerror"></a>

### locateRexError

Re-exports [locateRexError](../rex.md#locaterexerror)

***

<a id="resetdeprecations"></a>

### resetDeprecations

Re-exports [resetDeprecations](../rex.md#resetdeprecations)

***

<a id="rex_error_catalog"></a>

### REX\_ERROR\_CATALOG

Re-exports [REX_ERROR_CATALOG](../rex.md#rex_error_catalog)

***

<a id="rex_error_code_pattern"></a>

### REX\_ERROR\_CODE\_PATTERN

Re-exports [REX_ERROR_CODE_PATTERN](../rex.md#rex_error_code_pattern)

***

<a id="rex_errors_docs_base"></a>

### REX\_ERRORS\_DOCS\_BASE

Re-exports [REX_ERRORS_DOCS_BASE](../rex.md#rex_errors_docs_base)

***

<a id="rexdeclarationerrordetails"></a>

### RexDeclarationErrorDetails

Re-exports [RexDeclarationErrorDetails](../rex.md#rexdeclarationerrordetails)

***

<a id="rexdeclarationoptionerror"></a>

### RexDeclarationOptionError

Re-exports [RexDeclarationOptionError](../rex.md#rexdeclarationoptionerror)

***

<a id="rexerror"></a>

### RexError

Re-exports [RexError](../rex.md#rexerror)

***

<a id="rexerrorcode"></a>

### RexErrorCode

Re-exports [RexErrorCode](../rex.md#rexerrorcode-1)

***

<a id="rexerrorlocation"></a>

### RexErrorLocation

Re-exports [RexErrorLocation](../rex.md#rexerrorlocation)

***

<a id="rexerroroptions"></a>

### RexErrorOptions

Re-exports [RexErrorOptions](../rex.md#rexerroroptions)

***

<a id="rexstackframe"></a>

### RexStackFrame

Re-exports [RexStackFrame](../rex.md#rexstackframe)

***

<a id="stackframes"></a>

### stackFrames

Re-exports [stackFrames](../rex.md#stackframes)
