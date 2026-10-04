[@sidioralabs/rex API](../../README.md) / @sidioralabs/rex/server

# @sidioralabs/rex/server

## Classes

<a id="rexdensityerror"></a>

### RexDensityError

#### Extends

- [`RexError`](../rex.md#rexerror)

#### Constructors

<a id="constructor"></a>

##### Constructor

```ts
new RexDensityError(value): RexDensityError;
```

###### Parameters

###### value

`string`

###### Returns

[`RexDensityError`](#rexdensityerror)

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

[`RexError`](../rex.md#rexerror).[`column`](../rex.md#column-2)

<a id="detail"></a>

##### detail

```ts
readonly detail: string;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`detail`](../rex.md#detail-2)

<a id="docs"></a>

##### docs

```ts
readonly docs: string;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`docs`](../rex.md#docs-2)

<a id="file"></a>

##### file

```ts
readonly file: string | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`file`](../rex.md#file-2)

<a id="hint"></a>

##### hint

```ts
readonly hint: string | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`hint`](../rex.md#hint-2)

<a id="line"></a>

##### line

```ts
readonly line: number | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`line`](../rex.md#line-2)

<a id="value"></a>

##### value

```ts
readonly value: string;
```

***

<a id="rexstaticpageerror"></a>

### RexStaticPageError

#### Extends

- [`RexError`](../rex.md#rexerror)

#### Constructors

<a id="constructor-1"></a>

##### Constructor

```ts
new RexStaticPageError(
   page, 
   path, 
   problem
): RexStaticPageError;
```

###### Parameters

###### page

`string`

###### path

`string`

###### problem

`string`

###### Returns

[`RexStaticPageError`](#rexstaticpageerror)

###### Overrides

[`RexError`](../rex.md#rexerror).[`constructor`](../rex.md#constructor-3)

#### Properties

<a id="code-1"></a>

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
  | "REX610"
  | "REX611"
  | "REX612";
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`code`](../rex.md#code-3)

<a id="column-1"></a>

##### column

```ts
readonly column: number | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`column`](../rex.md#column-2)

<a id="detail-1"></a>

##### detail

```ts
readonly detail: string;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`detail`](../rex.md#detail-2)

<a id="docs-1"></a>

##### docs

```ts
readonly docs: string;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`docs`](../rex.md#docs-2)

<a id="file-1"></a>

##### file

```ts
readonly file: string | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`file`](../rex.md#file-2)

<a id="hint-1"></a>

##### hint

```ts
readonly hint: string | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`hint`](../rex.md#hint-2)

<a id="line-1"></a>

##### line

```ts
readonly line: number | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`line`](../rex.md#line-2)

<a id="page"></a>

##### page

```ts
readonly page: string;
```

<a id="path"></a>

##### path

```ts
readonly path: string;
```

## Interfaces

<a id="actionrouteroptions"></a>

### ActionRouterOptions

#### Properties

<a id="confirmttlms"></a>

##### confirmTtlMs?

```ts
readonly optional confirmTtlMs?: number;
```

<a id="ledger"></a>

##### ledger

```ts
readonly ledger: Ledger;
```

<a id="telemetry"></a>

##### telemetry?

```ts
readonly optional telemetry?: RexTelemetry;
```

***

<a id="actionroutersource"></a>

### ActionRouterSource

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Properties

<a id="actions"></a>

##### actions

```ts
readonly actions: readonly A[];
```

***

<a id="auditentryinput"></a>

### AuditEntryInput

#### Properties

<a id="actionid"></a>

##### actionId

```ts
readonly actionId: string;
```

<a id="actor"></a>

##### actor

```ts
readonly actor: string;
```

<a id="at"></a>

##### at

```ts
readonly at: string;
```

<a id="durationms"></a>

##### durationMs

```ts
readonly durationMs: number;
```

<a id="effect"></a>

##### effect

```ts
readonly effect: ActionEffect;
```

<a id="input"></a>

##### input

```ts
readonly input: unknown;
```

<a id="outcome"></a>

##### outcome

```ts
readonly outcome: AuditOutcome;
```

<a id="spanid"></a>

##### spanId?

```ts
readonly optional spanId?: string | null;
```

<a id="traceid"></a>

##### traceId?

```ts
readonly optional traceId?: string | null;
```

***

<a id="auditfilter"></a>

### AuditFilter

#### Properties

<a id="actionid-1"></a>

##### actionId?

```ts
readonly optional actionId?: string;
```

<a id="actor-1"></a>

##### actor?

```ts
readonly optional actor?: string;
```

<a id="from"></a>

##### from?

```ts
readonly optional from?: string;
```

<a id="outcome-1"></a>

##### outcome?

```ts
readonly optional outcome?: "error" | AuditOutcome;
```

<a id="to"></a>

##### to?

```ts
readonly optional to?: string;
```

***

<a id="auditrecord"></a>

### AuditRecord

#### Properties

<a id="actionid-2"></a>

##### actionId

```ts
readonly actionId: string;
```

<a id="actor-2"></a>

##### actor

```ts
readonly actor: string;
```

<a id="at-1"></a>

##### at

```ts
readonly at: string;
```

<a id="durationms-1"></a>

##### durationMs

```ts
readonly durationMs: number;
```

<a id="effect-1"></a>

##### effect

```ts
readonly effect: ActionEffect;
```

<a id="id"></a>

##### id

```ts
readonly id: string;
```

<a id="inputdigest"></a>

##### inputDigest

```ts
readonly inputDigest: string;
```

<a id="outcome-2"></a>

##### outcome

```ts
readonly outcome: AuditOutcome;
```

<a id="spanid-1"></a>

##### spanId?

```ts
readonly optional spanId?: string;
```

<a id="traceid-1"></a>

##### traceId?

```ts
readonly optional traceId?: string;
```

***

<a id="confirmpageoptions"></a>

### ConfirmPageOptions

#### Properties

<a id="actionid-3"></a>

##### actionId

```ts
readonly actionId: string;
```

<a id="cancel"></a>

##### cancel

```ts
readonly cancel: string;
```

<a id="csrf"></a>

##### csrf

```ts
readonly csrf: string;
```

<a id="entries"></a>

##### entries

```ts
readonly entries: readonly readonly [string, FormValue][];
```

<a id="expiresat"></a>

##### expiresAt

```ts
readonly expiresAt: string;
```

<a id="input-1"></a>

##### input

```ts
readonly input: unknown;
```

<a id="label"></a>

##### label

```ts
readonly label: string;
```

<a id="title"></a>

##### title

```ts
readonly title: string;
```

<a id="token"></a>

##### token

```ts
readonly token: string;
```

***

<a id="consoletarget"></a>

### ConsoleTarget

#### Methods

<a id="debug"></a>

##### debug()

```ts
debug(...data): void;
```

###### Parameters

###### data

...`unknown`[]

###### Returns

`void`

<a id="error"></a>

##### error()

```ts
error(...data): void;
```

###### Parameters

###### data

...`unknown`[]

###### Returns

`void`

<a id="info"></a>

##### info()

```ts
info(...data): void;
```

###### Parameters

###### data

...`unknown`[]

###### Returns

`void`

<a id="warn"></a>

##### warn()

```ts
warn(...data): void;
```

###### Parameters

###### data

...`unknown`[]

###### Returns

`void`

***

<a id="csrfgrant"></a>

### CsrfGrant

#### Properties

<a id="setcookie"></a>

##### setCookie

```ts
readonly setCookie: string | null;
```

<a id="token-1"></a>

##### token

```ts
readonly token: string;
```

***

<a id="flowdecisionauditinput"></a>

### FlowDecisionAuditInput

#### Properties

<a id="decision"></a>

##### decision

```ts
readonly decision: FlowDecision;
```

<a id="flow"></a>

##### flow

```ts
readonly flow: string;
```

<a id="gate"></a>

##### gate

```ts
readonly gate: string;
```

<a id="instance"></a>

##### instance

```ts
readonly instance: string;
```

***

<a id="flowgatestate"></a>

### FlowGateState

#### Properties

<a id="id-1"></a>

##### id

```ts
readonly id: string;
```

<a id="label-1"></a>

##### label

```ts
readonly label: string;
```

***

<a id="flowstate"></a>

### FlowState

#### Properties

<a id="completed"></a>

##### completed

```ts
readonly completed: number;
```

<a id="flow-1"></a>

##### flow

```ts
readonly flow: string;
```

<a id="gate-1"></a>

##### gate

```ts
readonly gate: FlowGateState | null;
```

<a id="instance-1"></a>

##### instance

```ts
readonly instance: string;
```

<a id="status"></a>

##### status

```ts
readonly status: FlowStateStatus;
```

***

<a id="formerrorpageoptions"></a>

### FormErrorPageOptions

#### Properties

<a id="back"></a>

##### back

```ts
readonly back: string;
```

<a id="message"></a>

##### message

```ts
readonly message: string;
```

<a id="title-1"></a>

##### title

```ts
readonly title: string;
```

***

<a id="formoutcome"></a>

### FormOutcome

#### Properties

<a id="actionid-4"></a>

##### actionId

```ts
readonly actionId: string;
```

<a id="at-2"></a>

##### at

```ts
readonly at: string;
```

<a id="code-2"></a>

##### code

```ts
readonly code: string | null;
```

<a id="fields"></a>

##### fields

```ts
readonly fields: Readonly<Record<string, readonly string[]>>;
```

<a id="message-1"></a>

##### message

```ts
readonly message: string;
```

<a id="ok"></a>

##### ok

```ts
readonly ok: boolean;
```

***

<a id="ledger-1"></a>

### Ledger

#### Methods

<a id="append"></a>

##### append()

```ts
append(entry): Promise<AuditRecord>;
```

###### Parameters

###### entry

[`AuditEntry`](#auditentry)

###### Returns

`Promise`\<[`AuditRecord`](#auditrecord)\>

<a id="list"></a>

##### list()

```ts
list(filter?): Promise<AuditRecord[]>;
```

###### Parameters

###### filter?

[`AuditFilter`](#auditfilter)

###### Returns

`Promise`\<[`AuditRecord`](#auditrecord)[]\>

***

<a id="loaderrunner"></a>

### LoaderRunner

#### Properties

<a id="telemetry-1"></a>

##### telemetry

```ts
readonly telemetry: RexTelemetry;
```

#### Methods

<a id="run"></a>

##### run()

```ts
run(
   declared, 
   input, 
   context
): Promise<unknown>;
```

###### Parameters

###### declared

[`AnyAction`](../rex.md#anyaction)

###### input

`unknown`

###### context

[`RexContext`](#rexcontext)

###### Returns

`Promise`\<`unknown`\>

***

<a id="mountflowsoptions"></a>

### MountFlowsOptions

#### Properties

<a id="actor-3"></a>

##### actor

```ts
readonly actor: ActorResolver;
```

<a id="flows"></a>

##### flows

```ts
readonly flows: readonly AnyFlow[];
```

<a id="ledger-2"></a>

##### ledger

```ts
readonly ledger: Ledger;
```

***

<a id="pageloaderoutcome"></a>

### PageLoaderOutcome

#### Properties

<a id="error-1"></a>

##### error

```ts
readonly error: RexLoaderError | null;
```

<a id="key"></a>

##### key

```ts
readonly key: LoaderQueryKey;
```

<a id="name"></a>

##### name

```ts
readonly name: string;
```

<a id="ok-1"></a>

##### ok

```ts
readonly ok: boolean;
```

***

<a id="pagetext"></a>

### PageText

#### Properties

<a id="markdown"></a>

##### markdown

```ts
readonly markdown: string;
```

<a id="sidecar"></a>

##### sidecar

```ts
readonly sidecar: object;
```

###### actions

```ts
actions: object[];
```

###### loaders?

```ts
optional loaders?: object[];
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

<a id="pagetextsource"></a>

### PageTextSource

#### Properties

<a id="actor-4"></a>

##### actor

```ts
readonly actor: Actor;
```

<a id="href"></a>

##### href

```ts
readonly href: string | null;
```

<a id="issues"></a>

##### issues

```ts
readonly issues: readonly ParamIssue[];
```

<a id="manifest"></a>

##### manifest

```ts
readonly manifest: Manifest;
```

<a id="page-1"></a>

##### page

```ts
readonly page: AnyPage;
```

<a id="params"></a>

##### params

```ts
readonly params: Readonly<Record<string, unknown>>;
```

<a id="policy"></a>

##### policy

```ts
readonly policy: PolicyResult;
```

<a id="state"></a>

##### state

```ts
readonly state: 
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

<a id="text"></a>

##### text?

```ts
readonly optional text?: TextResolver;
```

***

<a id="prerenderlist"></a>

### PrerenderList

#### Properties

<a id="pages"></a>

##### pages

```ts
readonly pages: readonly StaticPageEntry[];
```

<a id="version"></a>

##### version

```ts
readonly version: 1;
```

***

<a id="renderedstaticpage"></a>

### RenderedStaticPage

#### Properties

<a id="html"></a>

##### html

```ts
readonly html: string;
```

<a id="page-2"></a>

##### page

```ts
readonly page: string;
```

***

<a id="rexcontext"></a>

### RexContext

#### Extended by

- [`RexRequestContext`](#rexrequestcontext)

#### Properties

<a id="actor-5"></a>

##### actor

```ts
readonly actor: Actor;
```

<a id="confirm"></a>

##### confirm?

```ts
readonly optional confirm?: string;
```

<a id="density"></a>

##### density

```ts
readonly density: "default" | "agent";
```

<a id="locale"></a>

##### locale?

```ts
readonly optional locale?: string;
```

<a id="nonce"></a>

##### nonce?

```ts
readonly optional nonce?: string;
```

***

<a id="rexpagerenderer"></a>

### RexPageRenderer

#### Methods

<a id="render"></a>

##### render()

```ts
render(request, context): Promise<RexRenderResult>;
```

###### Parameters

###### request

`Request`

###### context

[`RexRequestContext`](#rexrequestcontext)

###### Returns

`Promise`\<[`RexRenderResult`](#rexrenderresult)\>

***

<a id="rexrenderresult"></a>

### RexRenderResult

#### Properties

<a id="body"></a>

##### body

```ts
readonly body: ReadableStream<Uint8Array<ArrayBufferLike>>;
```

<a id="kind"></a>

##### kind

```ts
readonly kind: "page" | "denied" | "failed" | "not-found";
```

<a id="page-3"></a>

##### page

```ts
readonly page: string | null;
```

***

<a id="rexrequestcontext"></a>

### RexRequestContext

#### Extends

- [`RexContext`](#rexcontext)

#### Properties

<a id="actor-6"></a>

##### actor

```ts
readonly actor: Actor;
```

###### Inherited from

[`RexContext`](#rexcontext).[`actor`](#actor-5)

<a id="confirm-1"></a>

##### confirm?

```ts
readonly optional confirm?: string;
```

###### Inherited from

[`RexContext`](#rexcontext).[`confirm`](#confirm)

<a id="density-1"></a>

##### density

```ts
readonly density: "default" | "agent";
```

###### Inherited from

[`RexContext`](#rexcontext).[`density`](#density)

<a id="locale-1"></a>

##### locale?

```ts
readonly optional locale?: string;
```

###### Inherited from

[`RexContext`](#rexcontext).[`locale`](#locale)

<a id="nonce-1"></a>

##### nonce

```ts
readonly nonce: string;
```

###### Overrides

[`RexContext`](#rexcontext).[`nonce`](#nonce)

***

<a id="rexservercomposition"></a>

### RexServerComposition

#### Properties

<a id="middleware"></a>

##### middleware

```ts
readonly middleware: readonly RexServerInstaller[];
```

<a id="routes"></a>

##### routes

```ts
readonly routes: readonly RexServerInstaller[];
```

***

<a id="rexserveroptions"></a>

### RexServerOptions

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Properties

<a id="actor-7"></a>

##### actor

```ts
readonly actor: ActorResolver;
```

<a id="app"></a>

##### app?

```ts
readonly optional app?: string;
```

<a id="client"></a>

##### client?

```ts
readonly optional client?: ClientConfig;
```

<a id="confirmttlms-1"></a>

##### confirmTtlMs?

```ts
readonly optional confirmTtlMs?: number;
```

<a id="dev"></a>

##### dev?

```ts
readonly optional dev?: boolean;
```

<a id="ledger-3"></a>

##### ledger

```ts
readonly ledger: Ledger;
```

<a id="manifest-1"></a>

##### manifest?

```ts
readonly optional manifest?: Manifest;
```

<a id="registry"></a>

##### registry

```ts
readonly registry: RexServerRegistry<A>;
```

<a id="security"></a>

##### security?

```ts
readonly optional security?: SecurityConfig;
```

<a id="telemetry-2"></a>

##### telemetry?

```ts
readonly optional telemetry?: TelemetryConfig;
```

***

<a id="rexserversetup"></a>

### RexServerSetup

#### Properties

<a id="handler"></a>

##### handler

```ts
readonly handler: RPCHandler<RexContext>;
```

<a id="manifestbody"></a>

##### manifestBody

```ts
readonly manifestBody: string;
```

<a id="options"></a>

##### options

```ts
readonly options: RexServerOptions<AnyAction>;
```

***

<a id="rexspan"></a>

### RexSpan

#### Properties

<a id="name-1"></a>

##### name

```ts
readonly name: RexSpanName;
```

<a id="spanid-2"></a>

##### spanId

```ts
readonly spanId: string | null;
```

<a id="traceid-2"></a>

##### traceId

```ts
readonly traceId: string | null;
```

#### Methods

<a id="outcome-3"></a>

##### outcome()

```ts
outcome(outcome): void;
```

###### Parameters

###### outcome

`string`

###### Returns

`void`

<a id="set"></a>

##### set()

```ts
set(attributes): void;
```

###### Parameters

###### attributes

[`RexSpanAttributes`](#rexspanattributes)

###### Returns

`void`

***

<a id="rextelemetry"></a>

### RexTelemetry

#### Properties

<a id="logger"></a>

##### logger

```ts
readonly logger: RexLogger;
```

<a id="tracer"></a>

##### tracer

```ts
readonly tracer: TelemetryTracer | null;
```

#### Methods

<a id="span"></a>

##### span()

```ts
span<T>(
   name, 
   attributes, 
   run
): Promise<T>;
```

###### Type Parameters

###### T

`T`

###### Parameters

###### name

[`RexSpanName`](#rexspanname-1)

###### attributes

[`RexSpanAttributes`](#rexspanattributes)

###### run

(`span`) => `T` \| `Promise`\<`T`\>

###### Returns

`Promise`\<`T`\>

***

<a id="runpageloadersoptions"></a>

### RunPageLoadersOptions

#### Properties

<a id="context"></a>

##### context

```ts
readonly context: RexContext;
```

<a id="page-4"></a>

##### page

```ts
readonly page: AnyPage;
```

<a id="params-1"></a>

##### params

```ts
readonly params: LoaderParams;
```

<a id="queryclient"></a>

##### queryClient

```ts
readonly queryClient: QueryClient;
```

<a id="runner"></a>

##### runner

```ts
readonly runner: LoaderRunner;
```

***

<a id="securitypolicy"></a>

### SecurityPolicy

#### Properties

<a id="apiorigin"></a>

##### apiOrigin

```ts
readonly apiOrigin: string | null;
```

<a id="security-1"></a>

##### security

```ts
readonly security: ResolvedSecurity;
```

***

<a id="securitypolicyinput"></a>

### SecurityPolicyInput

#### Properties

<a id="client-1"></a>

##### client?

```ts
readonly optional client?: ClientConfig;
```

<a id="security-2"></a>

##### security?

```ts
readonly optional security?: SecurityConfig;
```

***

<a id="staticcache"></a>

### StaticCache

#### Properties

<a id="size"></a>

##### size

```ts
readonly size: number;
```

#### Methods

<a id="entries-1"></a>

##### entries()

```ts
entries(): readonly StaticPageEntry[];
```

###### Returns

readonly [`StaticPageEntry`](#staticpageentry)[]

<a id="entry"></a>

##### entry()

```ts
entry(pathname): StaticPageEntry | undefined;
```

###### Parameters

###### pathname

`string`

###### Returns

[`StaticPageEntry`](#staticpageentry) \| `undefined`

<a id="has"></a>

##### has()

```ts
has(pathname): boolean;
```

###### Parameters

###### pathname

`string`

###### Returns

`boolean`

<a id="regenerate"></a>

##### regenerate()

```ts
regenerate(
   pathname, 
   origin, 
   renderer
): Promise<StaticPageEntry>;
```

###### Parameters

###### pathname

`string`

###### origin

`string`

###### renderer

[`RexPageRenderer`](#rexpagerenderer) \| `undefined`

###### Returns

`Promise`\<[`StaticPageEntry`](#staticpageentry)\>

<a id="serve"></a>

##### serve()

```ts
serve(
   request, 
   renderer, 
   nonce
): Promise<StaticHit | null>;
```

###### Parameters

###### request

`Request`

###### renderer

[`RexPageRenderer`](#rexpagerenderer) \| `undefined`

###### nonce

`string`

###### Returns

`Promise`\<[`StaticHit`](#statichit) \| `null`\>

<a id="settled"></a>

##### settled()

```ts
settled(): Promise<void>;
```

###### Returns

`Promise`\<`void`\>

***

<a id="staticcacheoptions"></a>

### StaticCacheOptions

#### Properties

<a id="actor-8"></a>

##### actor?

```ts
readonly optional actor?: Actor;
```

<a id="onerror"></a>

##### onError?

```ts
readonly optional onError?: StaticCacheErrorHandler;
```

<a id="pages-1"></a>

##### pages

```ts
readonly pages: readonly StaticPageEntry[];
```

<a id="store"></a>

##### store

```ts
readonly store: StaticPageStore;
```

***

<a id="statichit"></a>

### StaticHit

#### Properties

<a id="html-1"></a>

##### html

```ts
readonly html: string;
```

<a id="page-5"></a>

##### page

```ts
readonly page: string;
```

<a id="path-1"></a>

##### path

```ts
readonly path: string;
```

<a id="setcookie-1"></a>

##### setCookie

```ts
readonly setCookie: string | null;
```

<a id="status-1"></a>

##### status

```ts
readonly status: StaticServeStatus;
```

***

<a id="staticpageentry"></a>

### StaticPageEntry

#### Properties

<a id="file-2"></a>

##### file

```ts
readonly file: string;
```

<a id="generatedat"></a>

##### generatedAt

```ts
readonly generatedAt: number;
```

<a id="page-6"></a>

##### page

```ts
readonly page: string;
```

<a id="path-2"></a>

##### path

```ts
readonly path: string;
```

<a id="render-1"></a>

##### render

```ts
readonly render: "ssg" | "static";
```

<a id="revalidate"></a>

##### revalidate

```ts
readonly revalidate: number | null;
```

***

<a id="staticpagestore"></a>

### StaticPageStore

#### Methods

<a id="read"></a>

##### read()

```ts
read(path): Promise<string | null>;
```

###### Parameters

###### path

`string`

###### Returns

`Promise`\<`string` \| `null`\>

<a id="write"></a>

##### write()

```ts
write(path, html): Promise<void>;
```

###### Parameters

###### path

`string`

###### html

`string`

###### Returns

`Promise`\<`void`\>

***

<a id="telemetryspan"></a>

### TelemetrySpan

#### Methods

<a id="end"></a>

##### end()

```ts
end(): void;
```

###### Returns

`void`

<a id="recordexception"></a>

##### recordException()

```ts
recordException(exception): unknown;
```

###### Parameters

###### exception

`string` \| `Error`

###### Returns

`unknown`

<a id="setattribute"></a>

##### setAttribute()

```ts
setAttribute(key, value): unknown;
```

###### Parameters

###### key

`string`

###### value

`string` \| `number` \| `boolean`

###### Returns

`unknown`

<a id="setstatus"></a>

##### setStatus()

```ts
setStatus(status): unknown;
```

###### Parameters

###### status

###### code

`number`

###### message?

`string`

###### Returns

`unknown`

<a id="spancontext"></a>

##### spanContext()

```ts
spanContext(): TelemetrySpanContext;
```

###### Returns

[`TelemetrySpanContext`](#telemetryspancontext)

***

<a id="telemetryspancontext"></a>

### TelemetrySpanContext

#### Properties

<a id="spanid-3"></a>

##### spanId

```ts
readonly spanId: string;
```

<a id="traceid-3"></a>

##### traceId

```ts
readonly traceId: string;
```

***

<a id="telemetrytracer"></a>

### TelemetryTracer

#### Methods

<a id="startspan"></a>

##### startSpan()

```ts
startSpan(name, options?): TelemetrySpan;
```

###### Parameters

###### name

`string`

###### options?

###### attributes?

`Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean`\>\>

###### Returns

[`TelemetrySpan`](#telemetryspan)

## Type Aliases

<a id="actionkey"></a>

### ActionKey

```ts
type ActionKey<Id> = string extends Id ? `${LowerLetter}${string}` : Id;
```

#### Type Parameters

##### Id

`Id` *extends* `string`

***

<a id="actionprocedure"></a>

### ActionProcedure

```ts
type ActionProcedure<A> = Procedure<RexContext, RexContext, A["input"], A["output"], NoErrors, NoMeta>;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

***

<a id="actionrouter"></a>

### ActionRouter

```ts
type ActionRouter<A> = { readonly [K in A as ActionKey<K["id"]>]: ActionProcedure<K> } & object;
```

#### Type Declaration

##### \_confirm

```ts
readonly _confirm: ConfirmProcedure;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

***

<a id="actorresolver"></a>

### ActorResolver

```ts
type ActorResolver = (request) => Actor | Promise<Actor>;
```

#### Parameters

##### request

`Request`

#### Returns

[`Actor`](../rex.md#actor-1) \| `Promise`\<[`Actor`](../rex.md#actor-1)\>

***

<a id="auditentry"></a>

### AuditEntry

```ts
type AuditEntry = Omit<AuditRecord, "id">;
```

***

<a id="auditoutcome"></a>

### AuditOutcome

```ts
type AuditOutcome = typeof AUDIT_OK | string & object;
```

***

<a id="confirminput"></a>

### ConfirmInput

```ts
type ConfirmInput = zm.input<typeof confirmInputSchema>;
```

***

<a id="confirmoutput"></a>

### ConfirmOutput

```ts
type ConfirmOutput = zm.output<typeof confirmOutputSchema>;
```

***

<a id="confirmprocedure"></a>

### ConfirmProcedure

```ts
type ConfirmProcedure = Procedure<RexContext, RexContext, typeof confirmInputSchema, typeof confirmOutputSchema, NoErrors, NoMeta>;
```

***

<a id="flowrouter"></a>

### FlowRouter

```ts
type FlowRouter = ReturnType<typeof buildFlowRouter>;
```

***

<a id="flowstatestatus-1"></a>

### FlowStateStatus

```ts
type FlowStateStatus = FlowStatus | "idle";
```

***

<a id="formvalue"></a>

### FormValue

```ts
type FormValue = string | File;
```

***

<a id="prebuiltrexserveroptions"></a>

### PrebuiltRexServerOptions

```ts
type PrebuiltRexServerOptions<A> = RexServerOptions<A> & object;
```

#### Type Declaration

##### manifest

```ts
readonly manifest: Manifest;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

***

<a id="prerendermode"></a>

### PrerenderMode

```ts
type PrerenderMode = typeof PRERENDER_MODES[number];
```

***

<a id="registryrouterclient"></a>

### RegistryRouterClient

```ts
type RegistryRouterClient<R, C> = RexRouterClient<R["actions"][number], C>;
```

#### Type Parameters

##### R

`R` *extends* `object`

##### C

`C` *extends* `ClientContext` = `Record`\<`never`, `never`\>

***

<a id="renderkind"></a>

### RenderKind

```ts
type RenderKind = keyof typeof RENDER_STATUS;
```

***

<a id="rexdensity"></a>

### RexDensity

```ts
type RexDensity = typeof REX_DENSITIES[number];
```

***

<a id="rexrouter"></a>

### RexRouter

```ts
type RexRouter<A> = ActionRouter<A>;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

***

<a id="rexrouterclient"></a>

### RexRouterClient

```ts
type RexRouterClient<A, C> = RouterClient<ActionRouter<A>, C>;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

##### C

`C` *extends* `ClientContext` = `Record`\<`never`, `never`\>

***

<a id="rexserverinstaller"></a>

### RexServerInstaller

```ts
type RexServerInstaller = (app, setup) => void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="rexserverregistry"></a>

### RexServerRegistry

```ts
type RexServerRegistry<A> = ManifestSource & object;
```

#### Type Declaration

##### actions

```ts
readonly actions: readonly A[];
```

##### flows?

```ts
readonly optional flows?: readonly AnyFlow[];
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

***

<a id="rexspanattributes"></a>

### RexSpanAttributes

```ts
type RexSpanAttributes = Readonly<Record<string, string | number | boolean>>;
```

***

<a id="rexspanname-1"></a>

### RexSpanName

```ts
type RexSpanName = 
  | typeof SPAN_ACTION
  | typeof SPAN_FORM
  | typeof SPAN_LOADER
  | typeof SPAN_RENDER;
```

***

<a id="staticcacheerrorhandler"></a>

### StaticCacheErrorHandler

```ts
type StaticCacheErrorHandler = (error, entry) => void;
```

#### Parameters

##### error

`unknown`

##### entry

[`StaticPageEntry`](#staticpageentry)

#### Returns

`void`

***

<a id="staticservestatus"></a>

### StaticServeStatus

```ts
type StaticServeStatus = "hit" | "stale" | "generated";
```

## Variables

<a id="action_field"></a>

### ACTION\_FIELD

```ts
const ACTION_FIELD: "_action" = "_action";
```

***

<a id="actor_header"></a>

### ACTOR\_HEADER

```ts
const ACTOR_HEADER: "x-rex-actor" = REX_ACTOR_HEADER;
```

***

<a id="attr_action_id"></a>

### ATTR\_ACTION\_ID

```ts
const ATTR_ACTION_ID: "rex.action.id" = "rex.action.id";
```

***

<a id="attr_actor_id"></a>

### ATTR\_ACTOR\_ID

```ts
const ATTR_ACTOR_ID: "rex.actor.id" = "rex.actor.id";
```

***

<a id="attr_outcome"></a>

### ATTR\_OUTCOME

```ts
const ATTR_OUTCOME: "rex.outcome" = "rex.outcome";
```

***

<a id="attr_page_id"></a>

### ATTR\_PAGE\_ID

```ts
const ATTR_PAGE_ID: "rex.page.id" = "rex.page.id";
```

***

<a id="audit_error_filter"></a>

### AUDIT\_ERROR\_FILTER

```ts
const AUDIT_ERROR_FILTER: "error" = "error";
```

***

<a id="audit_ok"></a>

### AUDIT\_OK

```ts
const AUDIT_OK: "ok" = "ok";
```

***

<a id="confirm_field"></a>

### CONFIRM\_FIELD

```ts
const CONFIRM_FIELD: "_confirm" = "_confirm";
```

***

<a id="confirm_header"></a>

### CONFIRM\_HEADER

```ts
const CONFIRM_HEADER: "x-rex-confirm" = REX_CONFIRM_HEADER;
```

***

<a id="confirminputschema"></a>

### confirmInputSchema

```ts
const confirmInputSchema: ZodMiniObject<{
  action: ZodMiniString<string>;
  input: ZodMiniUnknown;
}, $strict>;
```

***

<a id="confirmoutputschema"></a>

### confirmOutputSchema

```ts
const confirmOutputSchema: ZodMiniObject<{
  action: ZodMiniString<string>;
  expiresAt: ZodMiniISODateTime;
  inputDigest: ZodMiniString<string>;
  token: ZodMiniString<string>;
}, $strict>;
```

***

<a id="consolelogger"></a>

### consoleLogger

```ts
const consoleLogger: RexLogger;
```

***

<a id="cors_allow_headers"></a>

### CORS\_ALLOW\_HEADERS

```ts
const CORS_ALLOW_HEADERS: readonly string[];
```

***

<a id="cors_allow_methods"></a>

### CORS\_ALLOW\_METHODS

```ts
const CORS_ALLOW_METHODS: readonly string[];
```

***

<a id="cors_expose_headers"></a>

### CORS\_EXPOSE\_HEADERS

```ts
const CORS_EXPOSE_HEADERS: readonly string[];
```

***

<a id="cors_max_age_seconds"></a>

### CORS\_MAX\_AGE\_SECONDS

```ts
const CORS_MAX_AGE_SECONDS: 600 = 600;
```

***

<a id="csp_header"></a>

### CSP\_HEADER

```ts
const CSP_HEADER: "content-security-policy" = "content-security-policy";
```

***

<a id="csp_report_only_header"></a>

### CSP\_REPORT\_ONLY\_HEADER

```ts
const CSP_REPORT_ONLY_HEADER: "content-security-policy-report-only" = "content-security-policy-report-only";
```

***

<a id="csrf_cookie"></a>

### CSRF\_COOKIE

```ts
const CSRF_COOKIE: "rex-csrf" = "rex-csrf";
```

***

<a id="csrf_field"></a>

### CSRF\_FIELD

```ts
const CSRF_FIELD: "_csrf" = "_csrf";
```

***

<a id="default_confirm_ttl_ms"></a>

### DEFAULT\_CONFIRM\_TTL\_MS

```ts
const DEFAULT_CONFIRM_TTL_MS: 60000 = 60_000;
```

***

<a id="default_density"></a>

### DEFAULT\_DENSITY

```ts
const DEFAULT_DENSITY: RexDensity = "default";
```

***

<a id="default_security_headers"></a>

### DEFAULT\_SECURITY\_HEADERS

```ts
const DEFAULT_SECURITY_HEADERS: Readonly<Record<string, string>>;
```

***

<a id="density_header"></a>

### DENSITY\_HEADER

```ts
const DENSITY_HEADER: "x-rex-density" = REX_DENSITY_HEADER;
```

***

<a id="dev_audit_path"></a>

### DEV\_AUDIT\_PATH

```ts
const DEV_AUDIT_PATH: "/rex/dev/audit" = "/rex/dev/audit";
```

***

<a id="digest_pattern"></a>

### DIGEST\_PATTERN

```ts
const DIGEST_PATTERN: RegExp;
```

***

<a id="error_code_pattern"></a>

### ERROR\_CODE\_PATTERN

```ts
const ERROR_CODE_PATTERN: RegExp;
```

***

<a id="flow_decision_effect"></a>

### FLOW\_DECISION\_EFFECT

```ts
const FLOW_DECISION_EFFECT: ActionEffect = "irreversible";
```

***

<a id="flow_rpc_prefix"></a>

### FLOW\_RPC\_PREFIX

```ts
const FLOW_RPC_PREFIX: "/rex/flow" = "/rex/flow";
```

***

<a id="flowstateschema"></a>

### flowStateSchema

```ts
const flowStateSchema: ZodMiniObject<{
  completed: ZodMiniInt;
  flow: ZodMiniString<string>;
  gate: ZodMiniNullable<ZodMiniObject<{
     id: ZodMiniString<string>;
     label: ZodMiniString<string>;
  }, $strict>>;
  instance: ZodMiniString<string>;
  status: ZodMiniEnum<{
     completed: "completed";
     failed: "failed";
     idle: "idle";
     paused: "paused";
     rejected: "rejected";
     running: "running";
  }>;
}, $strict>;
```

***

<a id="form_errors_key"></a>

### FORM\_ERRORS\_KEY

```ts
const FORM_ERRORS_KEY: "_form" = "_form";
```

***

<a id="form_prefix"></a>

### FORM\_PREFIX

```ts
const FORM_PREFIX: "/rex/form" = "/rex/form";
```

***

<a id="form_reserved_fields"></a>

### FORM\_RESERVED\_FIELDS

```ts
const FORM_RESERVED_FIELDS: readonly ["_csrf", "_confirm", "_action"];
```

***

<a id="form_route"></a>

### FORM\_ROUTE

```ts
const FORM_ROUTE: "/rex/form/:action";
```

***

<a id="health_path"></a>

### HEALTH\_PATH

```ts
const HEALTH_PATH: "/rex/health" = "/rex/health";
```

***

<a id="legacy_action_field"></a>

### LEGACY\_ACTION\_FIELD

```ts
const LEGACY_ACTION_FIELD: "action" = "action";
```

***

<a id="log_prefix"></a>

### LOG\_PREFIX

```ts
const LOG_PREFIX: "rex:" = "rex:";
```

***

<a id="manifest_path"></a>

### MANIFEST\_PATH

```ts
const MANIFEST_PATH: "/rex/manifest" = REX_MANIFEST_PATH;
```

***

<a id="markdown_content_type"></a>

### MARKDOWN\_CONTENT\_TYPE

```ts
const MARKDOWN_CONTENT_TYPE: "text/markdown; charset=utf-8" = "text/markdown; charset=utf-8";
```

***

<a id="origin_header"></a>

### ORIGIN\_HEADER

```ts
const ORIGIN_HEADER: "origin" = "origin";
```

***

<a id="outcome_cookie"></a>

### OUTCOME\_COOKIE

```ts
const OUTCOME_COOKIE: "rex-outcome" = "rex-outcome";
```

***

<a id="outcome_cookie_max_age"></a>

### OUTCOME\_COOKIE\_MAX\_AGE

```ts
const OUTCOME_COOKIE_MAX_AGE: 60 = 60;
```

***

<a id="outcome_error"></a>

### OUTCOME\_ERROR

```ts
const OUTCOME_ERROR: "ERROR" = "ERROR";
```

***

<a id="outcome_ok"></a>

### OUTCOME\_OK

```ts
const OUTCOME_OK: "ok" = "ok";
```

***

<a id="pages_text_extension"></a>

### PAGES\_TEXT\_EXTENSION

```ts
const PAGES_TEXT_EXTENSION: ".md" = ".md";
```

***

<a id="pages_text_prefix"></a>

### PAGES\_TEXT\_PREFIX

```ts
const PAGES_TEXT_PREFIX: "/rex/pages" = "/rex/pages";
```

***

<a id="pages_text_route"></a>

### PAGES\_TEXT\_ROUTE

```ts
const PAGES_TEXT_ROUTE: "/rex/pages/:file";
```

***

<a id="pages_text_status"></a>

### PAGES\_TEXT\_STATUS

```ts
const PAGES_TEXT_STATUS: Readonly<{
  denied: 403;
  not-found: 404;
  page: 200;
}>;
```

***

<a id="precondition_required"></a>

### PRECONDITION\_REQUIRED

```ts
const PRECONDITION_REQUIRED: "PRECONDITION_REQUIRED" = "PRECONDITION_REQUIRED";
```

***

<a id="precondition_required_status"></a>

### PRECONDITION\_REQUIRED\_STATUS

```ts
const PRECONDITION_REQUIRED_STATUS: 428 = 428;
```

***

<a id="prerender_index_file"></a>

### PRERENDER\_INDEX\_FILE

```ts
const PRERENDER_INDEX_FILE: "index.html" = "index.html";
```

***

<a id="prerender_list_file"></a>

### PRERENDER\_LIST\_FILE

```ts
const PRERENDER_LIST_FILE: "prerender.json" = "prerender.json";
```

***

<a id="prerender_list_version"></a>

### PRERENDER\_LIST\_VERSION

```ts
const PRERENDER_LIST_VERSION: 1 = 1;
```

***

<a id="prerender_modes"></a>

### PRERENDER\_MODES

```ts
const PRERENDER_MODES: readonly ["ssg", "static"];
```

***

<a id="prerender_nonce"></a>

### PRERENDER\_NONCE

```ts
const PRERENDER_NONCE: "rex-prerender-nonce" = "rex-prerender-nonce";
```

***

<a id="render_status"></a>

### RENDER\_STATUS

```ts
const RENDER_STATUS: Readonly<{
  denied: 403;
  failed: 500;
  not-found: 404;
  page: 200;
}>;
```

***

<a id="rex_densities"></a>

### REX\_DENSITIES

```ts
const REX_DENSITIES: readonly ["default", "agent"];
```

***

<a id="rex_form_prefix"></a>

### REX\_FORM\_PREFIX

```ts
const REX_FORM_PREFIX: "/rex/form" = "/rex/form";
```

***

<a id="rex_middleware"></a>

### REX\_MIDDLEWARE

```ts
const REX_MIDDLEWARE: readonly RexServerInstaller[];
```

***

<a id="rex_path_prefix"></a>

### REX\_PATH\_PREFIX

```ts
const REX_PATH_PREFIX: "/rex" = "/rex";
```

***

<a id="rex_routes"></a>

### REX\_ROUTES

```ts
const REX_ROUTES: readonly RexServerInstaller[];
```

***

<a id="rex_server_composition"></a>

### REX\_SERVER\_COMPOSITION

```ts
const REX_SERVER_COMPOSITION: RexServerComposition;
```

***

<a id="rpc_prefix"></a>

### RPC\_PREFIX

```ts
const RPC_PREFIX: "/rex/rpc" = REX_RPC_PREFIX;
```

***

<a id="span_action"></a>

### SPAN\_ACTION

```ts
const SPAN_ACTION: "rex.action" = "rex.action";
```

***

<a id="span_form"></a>

### SPAN\_FORM

```ts
const SPAN_FORM: "rex.form" = "rex.form";
```

***

<a id="span_id_pattern"></a>

### SPAN\_ID\_PATTERN

```ts
const SPAN_ID_PATTERN: RegExp;
```

***

<a id="span_loader"></a>

### SPAN\_LOADER

```ts
const SPAN_LOADER: "rex.loader" = "rex.loader";
```

***

<a id="span_render"></a>

### SPAN\_RENDER

```ts
const SPAN_RENDER: "rex.render" = "rex.render";
```

***

<a id="static_header"></a>

### STATIC\_HEADER

```ts
const STATIC_HEADER: "x-rex-static" = "x-rex-static";
```

***

<a id="trace_id_pattern"></a>

### TRACE\_ID\_PATTERN

```ts
const TRACE_ID_PATTERN: RegExp;
```

## Functions

<a id="auditcode"></a>

### auditCode()

```ts
function auditCode(error): string;
```

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

<a id="bindloaderrunner"></a>

### bindLoaderRunner()

```ts
function bindLoaderRunner(request, runner): void;
```

#### Parameters

##### request

`Request`

##### runner

[`LoaderRunner`](#loaderrunner)

#### Returns

`void`

***

<a id="bindtelemetry"></a>

### bindTelemetry()

```ts
function bindTelemetry(ledger, telemetry): void;
```

#### Parameters

##### ledger

[`Ledger`](#ledger-1)

##### telemetry

[`RexTelemetry`](#rextelemetry)

#### Returns

`void`

***

<a id="buildactionrouter"></a>

### buildActionRouter()

```ts
function buildActionRouter<A>(source, options): ActionRouter<A>;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Parameters

##### source

[`ActionRouterSource`](#actionroutersource)\<`A`\>

##### options

[`ActionRouterOptions`](#actionrouteroptions)

#### Returns

[`ActionRouter`](#actionrouter)\<`A`\>

***

<a id="buildflowrouter"></a>

### buildFlowRouter()

```ts
function buildFlowRouter(flows, ledger): object;
```

#### Parameters

##### flows

readonly [`AnyFlow`](../rex.md#anyflow)[]

##### ledger

[`Ledger`](#ledger-1)

#### Returns

`object`

##### decide

```ts
decide: DecoratedProcedure<RexContext & Record<never, never>, RexContext, ZodMiniObject<{
  decision: ZodMiniEnum<{
     approve: "approve";
     reject: "reject";
  }>;
  flow: ZodMiniString<string>;
  instance: ZodMiniString<string>;
}, $strict>, ZodMiniObject<{
  completed: ZodMiniInt;
  flow: ZodMiniString<string>;
  gate: ZodMiniNullable<ZodMiniObject<{
     id: ZodMiniString<string>;
     label: ZodMiniString<string>;
  }, $strict>>;
  instance: ZodMiniString<string>;
  status: ZodMiniEnum<{
     completed: "completed";
     failed: "failed";
     idle: "idle";
     paused: "paused";
     rejected: "rejected";
     running: "running";
  }>;
}, $strict>, Record<never, never>, Record<never, never>>;
```

##### start

```ts
start: DecoratedProcedure<RexContext & Record<never, never>, RexContext, ZodMiniObject<{
  flow: ZodMiniString<string>;
  input: ZodMiniOptional<ZodMiniUnknown>;
  instance: ZodMiniString<string>;
}, $strict>, ZodMiniObject<{
  completed: ZodMiniInt;
  flow: ZodMiniString<string>;
  gate: ZodMiniNullable<ZodMiniObject<{
     id: ZodMiniString<string>;
     label: ZodMiniString<string>;
  }, $strict>>;
  instance: ZodMiniString<string>;
  status: ZodMiniEnum<{
     completed: "completed";
     failed: "failed";
     idle: "idle";
     paused: "paused";
     rejected: "rejected";
     running: "running";
  }>;
}, $strict>, Record<never, never>, Record<never, never>>;
```

##### status

```ts
status: DecoratedProcedure<RexContext & Record<never, never>, RexContext, ZodMiniObject<{
  flow: ZodMiniString<string>;
  instance: ZodMiniString<string>;
}, $strict>, ZodMiniObject<{
  completed: ZodMiniInt;
  flow: ZodMiniString<string>;
  gate: ZodMiniNullable<ZodMiniObject<{
     id: ZodMiniString<string>;
     label: ZodMiniString<string>;
  }, $strict>>;
  instance: ZodMiniString<string>;
  status: ZodMiniEnum<{
     completed: "completed";
     failed: "failed";
     idle: "idle";
     paused: "paused";
     rejected: "rejected";
     running: "running";
  }>;
}, $strict>, Record<never, never>, Record<never, never>>;
```

***

<a id="canonicaljson"></a>

### canonicalJson()

```ts
function canonicalJson(input): string;
```

#### Parameters

##### input

`unknown`

#### Returns

`string`

***

<a id="clearoutcomecookie"></a>

### clearOutcomeCookie()

```ts
function clearOutcomeCookie(request): string;
```

#### Parameters

##### request

`Request`

#### Returns

`string`

***

<a id="coerceformdata"></a>

### coerceFormData()

```ts
function coerceFormData(form, schema): Record<string, unknown>;
```

#### Parameters

##### form

`FormData`

##### schema

[`JsonSchema`](schema.md#jsonschema)

#### Returns

`Record`\<`string`, `unknown`\>

***

<a id="contentsecuritypolicy"></a>

### contentSecurityPolicy()

```ts
function contentSecurityPolicy(nonce, apiOrigin): string;
```

#### Parameters

##### nonce

`string`

##### apiOrigin

`string` \| `null`

#### Returns

`string`

***

<a id="corsmiddleware"></a>

### corsMiddleware()

```ts
function corsMiddleware(origins): MiddlewareHandler;
```

#### Parameters

##### origins

readonly `string`[]

#### Returns

`MiddlewareHandler`

***

<a id="createauditentry"></a>

### createAuditEntry()

```ts
function createAuditEntry(params): Promise<AuditEntry>;
```

#### Parameters

##### params

[`AuditEntryInput`](#auditentryinput)

#### Returns

`Promise`\<[`AuditEntry`](#auditentry)\>

***

<a id="createconsolelogger"></a>

### createConsoleLogger()

```ts
function createConsoleLogger(target?): RexLogger;
```

#### Parameters

##### target?

[`ConsoleTarget`](#consoletarget) = `console`

#### Returns

[`RexLogger`](config.md#rexlogger)

***

<a id="createcsrftoken"></a>

### createCsrfToken()

```ts
function createCsrfToken(): string;
```

#### Returns

`string`

***

<a id="createloaderrunner"></a>

### createLoaderRunner()

```ts
function createLoaderRunner(setup): LoaderRunner;
```

#### Parameters

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

[`LoaderRunner`](#loaderrunner)

***

<a id="createnonce"></a>

### createNonce()

```ts
function createNonce(): string;
```

#### Returns

`string`

***

<a id="createrexcontext"></a>

### createRexContext()

```ts
function createRexContext(
   request, 
   resolveActor, 
   i18n?
): Promise<RexRequestContext>;
```

#### Parameters

##### request

`Request`

##### resolveActor

[`ActorResolver`](#actorresolver)

##### i18n?

[`I18nConfig`](config.md#i18nconfig) \| `null`

#### Returns

`Promise`\<[`RexRequestContext`](#rexrequestcontext)\>

***

<a id="createrexserver"></a>

### createRexServer()

```ts
function createRexServer<A>(options): Hono;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Parameters

##### options

[`RexServerOptions`](#rexserveroptions)\<`A`\>

#### Returns

`Hono`

***

<a id="createstaticcache"></a>

### createStaticCache()

```ts
function createStaticCache(options): StaticCache;
```

#### Parameters

##### options

[`StaticCacheOptions`](#staticcacheoptions)

#### Returns

[`StaticCache`](#staticcache)

***

<a id="createtelemetry"></a>

### createTelemetry()

```ts
function createTelemetry(config?): RexTelemetry;
```

#### Parameters

##### config?

[`TelemetryConfig`](config.md#telemetryconfig) = `{}`

#### Returns

[`RexTelemetry`](#rextelemetry)

***

<a id="cspheadername"></a>

### cspHeaderName()

```ts
function cspHeaderName(mode): string | null;
```

#### Parameters

##### mode

`"off"` \| `"strict"` \| `"report"`

#### Returns

`string` \| `null`

***

<a id="csrfcookie"></a>

### csrfCookie()

```ts
function csrfCookie(token, request): string;
```

#### Parameters

##### token

`string`

##### request

`Request`

#### Returns

`string`

***

<a id="decodeformoutcome"></a>

### decodeFormOutcome()

```ts
function decodeFormOutcome(value): FormOutcome | null;
```

#### Parameters

##### value

`string` \| `null` \| `undefined`

#### Returns

[`FormOutcome`](#formoutcome) \| `null`

***

<a id="digest"></a>

### digest()

```ts
function digest(input): Promise<string>;
```

#### Parameters

##### input

`unknown`

#### Returns

`Promise`\<`string`\>

***

<a id="encodeactorheadervalue"></a>

### encodeActorHeaderValue()

```ts
function encodeActorHeaderValue(subject): string;
```

#### Parameters

##### subject

[`Actor`](../rex.md#actor-1)

#### Returns

`string`

***

<a id="encodeformoutcome"></a>

### encodeFormOutcome()

```ts
function encodeFormOutcome(outcome): string;
```

#### Parameters

##### outcome

[`FormOutcome`](#formoutcome)

#### Returns

`string`

***

<a id="ensurecsrftoken"></a>

### ensureCsrfToken()

```ts
function ensureCsrfToken(request): CsrfGrant;
```

#### Parameters

##### request

`Request`

#### Returns

[`CsrfGrant`](#csrfgrant)

***

<a id="escapehtml"></a>

### escapeHtml()

```ts
function escapeHtml(value): string;
```

#### Parameters

##### value

`string`

#### Returns

`string`

***

<a id="fielderrors"></a>

### fieldErrors()

```ts
function fieldErrors(issues): Record<string, string[]>;
```

#### Parameters

##### issues

readonly `StandardIssue`[]

#### Returns

`Record`\<`string`, `string`[]\>

***

<a id="fillcsrftoken"></a>

### fillCsrfToken()

```ts
function fillCsrfToken(html, token): string;
```

#### Parameters

##### html

`string`

##### token

`string`

#### Returns

`string`

***

<a id="fillnonce"></a>

### fillNonce()

```ts
function fillNonce(html, nonce): string;
```

#### Parameters

##### html

`string`

##### nonce

`string`

#### Returns

`string`

***

<a id="flatteninput"></a>

### flattenInput()

```ts
function flattenInput(value, prefix?): [string, string][];
```

#### Parameters

##### value

`unknown`

##### prefix?

`string` = `""`

#### Returns

\[`string`, `string`\][]

***

<a id="flowstate-1"></a>

### flowState()

```ts
function flowState(
   declared, 
   instanceId, 
   instance
): FlowState;
```

#### Parameters

##### declared

[`AnyFlow`](../rex.md#anyflow)

##### instanceId

`string`

##### instance

[`FlowInstance`](../rex.md#flowinstance) \| `undefined`

#### Returns

[`FlowState`](#flowstate)

***

<a id="formentries"></a>

### formEntries()

```ts
function formEntries(form, schema): [string, FormValue][];
```

#### Parameters

##### form

`FormData`

##### schema

[`JsonSchema`](schema.md#jsonschema)

#### Returns

\[`string`, [`FormValue`](#formvalue)\][]

***

<a id="formpath"></a>

### formPath()

```ts
function formPath(actionId): string;
```

#### Parameters

##### actionId

`string`

#### Returns

`string`

***

<a id="formredirecttarget"></a>

### formRedirectTarget()

```ts
function formRedirectTarget(request, redirect): string;
```

#### Parameters

##### request

`Request`

##### redirect

`string` \| `null`

#### Returns

`string`

***

<a id="gateactionid"></a>

### gateActionId()

```ts
function gateActionId(
   declared, 
   gate, 
   decision
): string;
```

#### Parameters

##### declared

[`AnyFlow`](../rex.md#anyflow)

##### gate

`string`

##### decision

[`FlowDecision`](../rex.md#flowdecision)

#### Returns

`string`

***

<a id="hascsrffield"></a>

### hasCsrfField()

```ts
function hasCsrfField(html): boolean;
```

#### Parameters

##### html

`string`

#### Returns

`boolean`

***

<a id="installcorsmiddleware"></a>

### installCorsMiddleware()

```ts
function installCorsMiddleware(app, setup): void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="installdevroute"></a>

### installDevRoute()

```ts
function installDevRoute(app, setup): void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="installflowroutes"></a>

### installFlowRoutes()

```ts
function installFlowRoutes(app, setup): void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="installformroute"></a>

### installFormRoute()

```ts
function installFormRoute(app, setup): void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="installhealthroute"></a>

### installHealthRoute()

```ts
function installHealthRoute(app): void;
```

#### Parameters

##### app

`Hono`

#### Returns

`void`

***

<a id="installloaderrunner"></a>

### installLoaderRunner()

```ts
function installLoaderRunner(app, setup): void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="installmanifestroute"></a>

### installManifestRoute()

```ts
function installManifestRoute(app, setup): void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="installpagestextroute"></a>

### installPagesTextRoute()

```ts
function installPagesTextRoute(app, setup): void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="installrenderroute"></a>

### installRenderRoute()

```ts
function installRenderRoute(app, setup): void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="installrpcroute"></a>

### installRpcRoute()

```ts
function installRpcRoute(app, setup): void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="installsecuritymiddleware"></a>

### installSecurityMiddleware()

```ts
function installSecurityMiddleware(app, setup): void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="installtelemetry"></a>

### installTelemetry()

```ts
function installTelemetry(app, setup): void;
```

#### Parameters

##### app

`Hono`

##### setup

[`RexServerSetup`](#rexserversetup)

#### Returns

`void`

***

<a id="isallowedorigin"></a>

### isAllowedOrigin()

```ts
function isAllowedOrigin(
   origin, 
   requestUrl, 
   origins
): boolean;
```

#### Parameters

##### origin

`string` \| `null`

##### requestUrl

`string`

##### origins

readonly `string`[]

#### Returns

`boolean`

***

<a id="isauditoutcome"></a>

### isAuditOutcome()

```ts
function isAuditOutcome(value): value is AuditOutcome;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is AuditOutcome`

***

<a id="iscorsorigin"></a>

### isCorsOrigin()

```ts
function isCorsOrigin(origin, origins): boolean;
```

#### Parameters

##### origin

`string` \| `null` \| `undefined`

##### origins

readonly `string`[]

#### Returns

`boolean`

***

<a id="iscsrftoken"></a>

### isCsrfToken()

```ts
function isCsrfToken(value): value is string;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is string`

***

<a id="isdevserver"></a>

### isDevServer()

```ts
function isDevServer(options): boolean;
```

#### Parameters

##### options

`Pick`\<[`RexServerOptions`](#rexserveroptions)\<[`AnyAction`](../rex.md#anyaction)\>, `"dev"`\>

#### Returns

`boolean`

***

<a id="isdocumentpath"></a>

### isDocumentPath()

```ts
function isDocumentPath(path): boolean;
```

#### Parameters

##### path

`string`

#### Returns

`boolean`

***

<a id="isformreservedfield"></a>

### isFormReservedField()

```ts
function isFormReservedField(name): boolean;
```

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

<a id="isprerendermode"></a>

### isPrerenderMode()

```ts
function isPrerenderMode(value): value is "ssg" | "static";
```

#### Parameters

##### value

`unknown`

#### Returns

value is "ssg" \| "static"

***

<a id="isrexdensity"></a>

### isRexDensity()

```ts
function isRexDensity(value): value is "default" | "agent";
```

#### Parameters

##### value

`unknown`

#### Returns

value is "default" \| "agent"

***

<a id="isrexpath"></a>

### isRexPath()

```ts
function isRexPath(path): boolean;
```

#### Parameters

##### path

`string`

#### Returns

`boolean`

***

<a id="isstale"></a>

### isStale()

```ts
function isStale(entry, now): boolean;
```

#### Parameters

##### entry

[`StaticPageEntry`](#staticpageentry)

##### now

`number`

#### Returns

`boolean`

***

<a id="istelemetrytracer"></a>

### isTelemetryTracer()

```ts
function isTelemetryTracer(value): value is TelemetryTracer;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is TelemetryTracer`

***

<a id="loaderrunnerfor"></a>

### loaderRunnerFor()

```ts
function loaderRunnerFor(request): LoaderRunner | undefined;
```

#### Parameters

##### request

`Request`

#### Returns

[`LoaderRunner`](#loaderrunner) \| `undefined`

***

<a id="matchesauditfilter"></a>

### matchesAuditFilter()

```ts
function matchesAuditFilter(record, filter): boolean;
```

#### Parameters

##### record

[`AuditRecord`](#auditrecord)

##### filter

[`AuditFilter`](#auditfilter)

#### Returns

`boolean`

***

<a id="matchpagepath"></a>

### matchPagePath()

```ts
function matchPagePath(matchers, path): AnyPage | null;
```

#### Parameters

##### matchers

readonly `RouteMatcher`[]

##### path

`string`

#### Returns

[`AnyPage`](../rex.md#anypage) \| `null`

***

<a id="memoryledger"></a>

### memoryLedger()

```ts
function memoryLedger(): Ledger;
```

#### Returns

[`Ledger`](#ledger-1)

***

<a id="memorystaticstore"></a>

### memoryStaticStore()

```ts
function memoryStaticStore(initial?): StaticPageStore;
```

#### Parameters

##### initial?

`Iterable`\<readonly \[`string`, `string`\]\> = `[]`

#### Returns

[`StaticPageStore`](#staticpagestore)

***

<a id="mountflows"></a>

### mountFlows()

```ts
function mountFlows(app, options): Hono;
```

#### Parameters

##### app

`Hono`

##### options

[`MountFlowsOptions`](#mountflowsoptions)

#### Returns

`Hono`

***

<a id="mountrexserver"></a>

### mountRexServer()

```ts
function mountRexServer<A>(options): Hono;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Parameters

##### options

[`PrebuiltRexServerOptions`](#prebuiltrexserveroptions)\<`A`\>

#### Returns

`Hono`

***

<a id="normalizepagepath"></a>

### normalizePagePath()

```ts
function normalizePagePath(pathname): string;
```

#### Parameters

##### pathname

`string`

#### Returns

`string`

***

<a id="outcomecookie"></a>

### outcomeCookie()

```ts
function outcomeCookie(outcome, request): string;
```

#### Parameters

##### outcome

[`FormOutcome`](#formoutcome)

##### request

`Request`

#### Returns

`string`

***

<a id="pagerendererfor"></a>

### pageRendererFor()

```ts
function pageRendererFor(registry): RexPageRenderer | undefined;
```

#### Parameters

##### registry

`object`

#### Returns

[`RexPageRenderer`](#rexpagerenderer) \| `undefined`

***

<a id="pagetextpath"></a>

### pageTextPath()

```ts
function pageTextPath(pageId): string;
```

#### Parameters

##### pageId

`string`

#### Returns

`string`

***

<a id="parseprerenderlist"></a>

### parsePrerenderList()

```ts
function parsePrerenderList(value): PrerenderList;
```

#### Parameters

##### value

`unknown`

#### Returns

[`PrerenderList`](#prerenderlist)

***

<a id="prerendercontext"></a>

### prerenderContext()

```ts
function prerenderContext(actor?): RexRequestContext;
```

#### Parameters

##### actor?

[`Actor`](../rex.md#actor-1) = `anonymousActor`

#### Returns

[`RexRequestContext`](#rexrequestcontext)

***

<a id="prerenderedfile"></a>

### prerenderedFile()

```ts
function prerenderedFile(path): string;
```

#### Parameters

##### path

`string`

#### Returns

`string`

***

<a id="readcookie"></a>

### readCookie()

```ts
function readCookie(request, name): string | null;
```

#### Parameters

##### request

`Request`

##### name

`string`

#### Returns

`string` \| `null`

***

<a id="readcsrftoken"></a>

### readCsrfToken()

```ts
function readCsrfToken(request): string | null;
```

#### Parameters

##### request

`Request`

#### Returns

`string` \| `null`

***

<a id="readformoutcome"></a>

### readFormOutcome()

```ts
function readFormOutcome(request): FormOutcome | null;
```

#### Parameters

##### request

`Request`

#### Returns

[`FormOutcome`](#formoutcome) \| `null`

***

<a id="refererpath"></a>

### refererPath()

```ts
function refererPath(request): string | null;
```

#### Parameters

##### request

`Request`

#### Returns

`string` \| `null`

***

<a id="registerpagerenderer"></a>

### registerPageRenderer()

```ts
function registerPageRenderer(registry, renderer): () => void;
```

#### Parameters

##### registry

`object`

##### renderer

[`RexPageRenderer`](#rexpagerenderer)

#### Returns

() => `void`

***

<a id="registerstaticcache"></a>

### registerStaticCache()

```ts
function registerStaticCache(registry, cache): () => void;
```

#### Parameters

##### registry

`object`

##### cache

[`StaticCache`](#staticcache)

#### Returns

() => `void`

***

<a id="renderconfirmpage"></a>

### renderConfirmPage()

```ts
function renderConfirmPage(options): string;
```

#### Parameters

##### options

[`ConfirmPageOptions`](#confirmpageoptions)

#### Returns

`string`

***

<a id="renderformerrorpage"></a>

### renderFormErrorPage()

```ts
function renderFormErrorPage(options): string;
```

#### Parameters

##### options

[`FormErrorPageOptions`](#formerrorpageoptions)

#### Returns

`string`

***

<a id="renderpagetext"></a>

### renderPageText()

```ts
function renderPageText(source): PageText;
```

#### Parameters

##### source

[`PageTextSource`](#pagetextsource)

#### Returns

[`PageText`](#pagetext)

***

<a id="renderprerenderedhtml"></a>

### renderPrerenderedHtml()

```ts
function renderPrerenderedHtml(
   renderer, 
   url, 
   actor?
): Promise<RenderedStaticPage>;
```

#### Parameters

##### renderer

[`RexPageRenderer`](#rexpagerenderer)

##### url

`URL`

##### actor?

[`Actor`](../rex.md#actor-1) = `anonymousActor`

#### Returns

`Promise`\<[`RenderedStaticPage`](#renderedstaticpage)\>

***

<a id="requestnonce"></a>

### requestNonce()

```ts
function requestNonce(request): string;
```

#### Parameters

##### request

`Request`

#### Returns

`string`

***

<a id="requestorigin"></a>

### requestOrigin()

```ts
function requestOrigin(request): string;
```

#### Parameters

##### request

`Request`

#### Returns

`string`

***

<a id="resolvesecuritypolicy"></a>

### resolveSecurityPolicy()

```ts
function resolveSecurityPolicy(input?): SecurityPolicy;
```

#### Parameters

##### input?

[`SecurityPolicyInput`](#securitypolicyinput) = `{}`

#### Returns

[`SecurityPolicy`](#securitypolicy)

***

<a id="runpageloaders"></a>

### runPageLoaders()

```ts
function runPageLoaders(options): Promise<readonly PageLoaderOutcome[]>;
```

#### Parameters

##### options

[`RunPageLoadersOptions`](#runpageloadersoptions)

#### Returns

`Promise`\<readonly [`PageLoaderOutcome`](#pageloaderoutcome)[]\>

***

<a id="schemadeclaresfield"></a>

### schemaDeclaresField()

```ts
function schemaDeclaresField(schema, name): boolean;
```

#### Parameters

##### schema

[`JsonSchema`](schema.md#jsonschema)

##### name

`string`

#### Returns

`boolean`

***

<a id="securityheaders"></a>

### securityHeaders()

```ts
function securityHeaders(policy, nonce): Record<string, string>;
```

#### Parameters

##### policy

[`SecurityPolicy`](#securitypolicy)

##### nonce

`string`

#### Returns

`Record`\<`string`, `string`\>

***

<a id="serializeprerenderlist"></a>

### serializePrerenderList()

```ts
function serializePrerenderList(list): string;
```

#### Parameters

##### list

[`PrerenderList`](#prerenderlist)

#### Returns

`string`

***

<a id="staticcachefor"></a>

### staticCacheFor()

```ts
function staticCacheFor(registry): StaticCache | undefined;
```

#### Parameters

##### registry

`object`

#### Returns

[`StaticCache`](#staticcache) \| `undefined`

***

<a id="submittedactionid"></a>

### submittedActionId()

```ts
function submittedActionId(form, schema): string | null;
```

#### Parameters

##### form

`FormData`

##### schema

[`JsonSchema`](schema.md#jsonschema)

#### Returns

`string` \| `null`

***

<a id="telemetryfor"></a>

### telemetryFor()

```ts
function telemetryFor(ledger): RexTelemetry;
```

#### Parameters

##### ledger

[`Ledger`](#ledger-1)

#### Returns

[`RexTelemetry`](#rextelemetry)

***

<a id="traceloader"></a>

### traceLoader()

```ts
function traceLoader<T>(
   telemetry, 
   attributes, 
   run
): Promise<T>;
```

#### Type Parameters

##### T

`T`

#### Parameters

##### telemetry

[`RexTelemetry`](#rextelemetry)

##### attributes

###### actionId

`string`

###### actorId

`string`

###### pageId

`string`

##### run

(`span`) => `T` \| `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

***

<a id="validateauditentry"></a>

### validateAuditEntry()

```ts
function validateAuditEntry(entry): AuditEntry;
```

#### Parameters

##### entry

[`AuditEntry`](#auditentry)

#### Returns

[`AuditEntry`](#auditentry)

***

<a id="verifycsrf"></a>

### verifyCsrf()

```ts
function verifyCsrf(cookieToken, fieldToken): boolean;
```

#### Parameters

##### cookieToken

`string` \| `null`

##### fieldToken

`unknown`

#### Returns

`boolean`

## References

<a id="confirm_procedure"></a>

### CONFIRM\_PROCEDURE

Re-exports [CONFIRM_PROCEDURE](../rex.md#confirm_procedure)
