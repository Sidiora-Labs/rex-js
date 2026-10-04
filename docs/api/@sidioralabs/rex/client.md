[@sidioralabs/rex API](../../README.md) / @sidioralabs/rex/client

# @sidioralabs/rex/client

## Classes

<a id="rexloadererror"></a>

### RexLoaderError

#### Extends

- `Error`

#### Constructors

<a id="constructor"></a>

##### Constructor

```ts
new RexLoaderError(init): RexLoaderError;
```

###### Parameters

###### init

[`LoaderErrorInit`](#loadererrorinit)

###### Returns

[`RexLoaderError`](#rexloadererror)

###### Overrides

```ts
Error.constructor
```

#### Properties

<a id="code"></a>

##### code

```ts
readonly code: string;
```

<a id="loader"></a>

##### loader

```ts
readonly loader: string;
```

<a id="page"></a>

##### page

```ts
readonly page: string;
```

<a id="status"></a>

##### status

```ts
readonly status: number | null;
```

#### Methods

<a id="tojson"></a>

##### toJSON()

```ts
toJSON(): LoaderErrorJson;
```

###### Returns

[`LoaderErrorJson`](#loadererrorjson)

***

<a id="rexpagemoduleerror"></a>

### RexPageModuleError

#### Extends

- [`RexError`](../rex.md#rexerror)

#### Constructors

<a id="constructor-1"></a>

##### Constructor

```ts
new RexPageModuleError(page, problem): RexPageModuleError;
```

###### Parameters

###### page

`string`

###### problem

`string`

###### Returns

[`RexPageModuleError`](#rexpagemoduleerror)

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
  | "REX509"
  | "REX510"
  | "REX511"
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

<a id="page-1"></a>

##### page

```ts
readonly page: string;
```

***

<a id="rexstartuperror"></a>

### RexStartupError

#### Extends

- [`RexError`](../rex.md#rexerror)

#### Constructors

<a id="constructor-2"></a>

##### Constructor

```ts
new RexStartupError(message, code?): RexStartupError;
```

###### Parameters

###### message

`string`

###### code?

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
  \| `"REX509"`
  \| `"REX510"`
  \| `"REX511"`
  \| `"REX600"`
  \| `"REX601"`
  \| `"REX602"`
  \| `"REX603"`
  \| `"REX604"`
  \| `"REX605"`
  \| `"REX610"`
  \| `"REX611"`
  \| `"REX612"`

###### Returns

[`RexStartupError`](#rexstartuperror)

###### Overrides

[`RexError`](../rex.md#rexerror).[`constructor`](../rex.md#constructor-3)

#### Properties

<a id="code-2"></a>

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
  | "REX509"
  | "REX510"
  | "REX511"
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

<a id="column-1"></a>

##### column

```ts
readonly column: number | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`column`](../rex.md#column-3)

<a id="detail-1"></a>

##### detail

```ts
readonly detail: string;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`detail`](../rex.md#detail-3)

<a id="docs-1"></a>

##### docs

```ts
readonly docs: string;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`docs`](../rex.md#docs-3)

<a id="file-1"></a>

##### file

```ts
readonly file: string | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`file`](../rex.md#file-3)

<a id="hint-1"></a>

##### hint

```ts
readonly hint: string | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`hint`](../rex.md#hint-3)

<a id="line-1"></a>

##### line

```ts
readonly line: number | null;
```

###### Inherited from

[`RexError`](../rex.md#rexerror).[`line`](../rex.md#line-3)

## Interfaces

<a id="actcontrolprops"></a>

### ActControlProps

#### Properties

<a id="aria-busy"></a>

##### aria-busy

```ts
readonly aria-busy: boolean;
```

<a id="aria-disabled"></a>

##### aria-disabled

```ts
readonly aria-disabled: boolean;
```

<a id="data-rex"></a>

##### data-rex?

```ts
readonly optional data-rex?: string;
```

<a id="data-rex-allowed"></a>

##### data-rex-allowed

```ts
readonly data-rex-allowed: "true" | "false";
```

<a id="disabled"></a>

##### disabled

```ts
readonly disabled: boolean;
```

<a id="title"></a>

##### title?

```ts
readonly optional title?: string;
```

***

<a id="acthandle"></a>

### ActHandle

#### Extended by

- [`InvokeHandle`](#invokehandle)

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Properties

<a id="action"></a>

##### action

```ts
readonly action: A;
```

<a id="allowed"></a>

##### allowed

```ts
readonly allowed: boolean;
```

<a id="controlprops"></a>

##### controlProps

```ts
readonly controlProps: ActControlProps;
```

<a id="mutation"></a>

##### mutation

```ts
readonly mutation: UseMutationResult<ActionOutput<A>, Error, MutationVariables>;
```

<a id="pending"></a>

##### pending

```ts
readonly pending: boolean;
```

<a id="reason"></a>

##### reason

```ts
readonly reason: ReasonCode | null;
```

#### Methods

<a id="requestconfirm"></a>

##### requestConfirm()

```ts
requestConfirm(input): Promise<ConfirmGrant>;
```

###### Parameters

###### input

[`ActionInput`](../rex.md#actioninput)\<`A`\>

###### Returns

`Promise`\<[`ConfirmGrant`](../rex.md#confirmgrant)\>

<a id="run"></a>

##### run()

```ts
run(input, options?): Promise<ActResult<A>>;
```

###### Parameters

###### input

[`ActionInput`](../rex.md#actioninput)\<`A`\>

###### options?

[`RunOptions`](#runoptions)

###### Returns

`Promise`\<[`ActResult`](#actresult)\<`A`\>\>

***

<a id="actionformprops"></a>

### ActionFormProps

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Properties

<a id="action-1"></a>

##### action

```ts
readonly action: A;
```

<a id="children"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="defaultvalues"></a>

##### defaultValues?

```ts
readonly optional defaultValues?: Partial<ActionInput<A>>;
```

<a id="onresult"></a>

##### onResult?

```ts
readonly optional onResult?: (result) => void;
```

###### Parameters

###### result

[`ActResult`](#actresult)\<`A`\>

###### Returns

`void`

<a id="submitlabel"></a>

##### submitLabel?

```ts
readonly optional submitLabel?: string;
```

***

<a id="actionformviewprops"></a>

### ActionFormViewProps

#### Properties

<a id="actionid"></a>

##### actionId

```ts
readonly actionId: string;
```

<a id="address"></a>

##### address

```ts
readonly address: string;
```

<a id="children-1"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="controlprops-1"></a>

##### controlProps

```ts
readonly controlProps: ActControlProps;
```

<a id="errors"></a>

##### errors

```ts
readonly errors: FieldErrors;
```

<a id="fields"></a>

##### fields

```ts
readonly fields: readonly FormField[] | null;
```

<a id="hidden"></a>

##### hidden

```ts
readonly hidden: readonly readonly [string, string][];
```

<a id="label"></a>

##### label

```ts
readonly label: string;
```

<a id="onsubmit"></a>

##### onSubmit

```ts
readonly onSubmit: (event) => void;
```

###### Parameters

###### event

`FormEvent`\<`HTMLFormElement`\>

###### Returns

`void`

<a id="path"></a>

##### path

```ts
readonly path: string;
```

<a id="submitlabel-1"></a>

##### submitLabel

```ts
readonly submitLabel: string;
```

<a id="unplaced"></a>

##### unplaced

```ts
readonly unplaced: readonly readonly [string, string][];
```

<a id="values"></a>

##### values

```ts
readonly values: readonly unknown[];
```

***

<a id="addressscopeprops"></a>

### AddressScopeProps

#### Properties

<a id="children-2"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="overlay"></a>

##### overlay?

```ts
readonly optional overlay?: string;
```

<a id="region"></a>

##### region?

```ts
readonly optional region?: string;
```

***

<a id="affordance"></a>

### Affordance

#### Properties

<a id="allowed-1"></a>

##### allowed

```ts
readonly allowed: boolean;
```

<a id="effect"></a>

##### effect

```ts
readonly effect: ActionEffect;
```

<a id="id"></a>

##### id

```ts
readonly id: string;
```

<a id="input"></a>

##### input

```ts
readonly input: JsonSchema;
```

<a id="label-1"></a>

##### label

```ts
readonly label: string;
```

<a id="reason-1"></a>

##### reason

```ts
readonly reason: string | null;
```

<a id="via"></a>

##### via

```ts
readonly via: readonly ("url" | "key" | "click" | "palette")[];
```

#### Methods

<a id="invoke"></a>

##### invoke()

```ts
invoke(input): Promise<unknown>;
```

###### Parameters

###### input

`unknown`

###### Returns

`Promise`\<`unknown`\>

***

<a id="affordanceregistry"></a>

### AffordanceRegistry

#### Methods

<a id="list"></a>

##### list()

```ts
list(page): readonly Affordance[];
```

###### Parameters

###### page

`string`

###### Returns

readonly [`Affordance`](#affordance)[]

<a id="register"></a>

##### register()

```ts
register(page, entries): () => void;
```

###### Parameters

###### page

`string`

###### entries

readonly [`Affordance`](#affordance)[]

###### Returns

() => `void`

<a id="subscribe"></a>

##### subscribe()

```ts
subscribe(listener): () => void;
```

###### Parameters

###### listener

`Listener`

###### Returns

() => `void`

***

<a id="affordanceregistryproviderprops"></a>

### AffordanceRegistryProviderProps

#### Properties

<a id="children-3"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="registry"></a>

##### registry

```ts
readonly registry: AffordanceRegistry;
```

***

<a id="agentshellprops"></a>

### AgentShellProps

#### Properties

<a id="pages"></a>

##### pages

```ts
readonly pages: readonly PageModuleSet[];
```

***

<a id="confirmdialogrequest"></a>

### ConfirmDialogRequest

#### Properties

<a id="action-2"></a>

##### action

```ts
readonly action: ConfirmSubject;
```

<a id="input-1"></a>

##### input

```ts
readonly input: unknown;
```

<a id="page-2"></a>

##### page

```ts
readonly page: string | null;
```

***

<a id="confirmpending"></a>

### ConfirmPending

#### Properties

<a id="opener"></a>

##### opener

```ts
readonly opener: Element | null;
```

<a id="request"></a>

##### request

```ts
readonly request: ConfirmDialogRequest;
```

<a id="resolve"></a>

##### resolve

```ts
readonly resolve: (accepted) => void;
```

###### Parameters

###### accepted

`boolean`

###### Returns

`void`

***

<a id="confirmproviderprops"></a>

### ConfirmProviderProps

#### Properties

<a id="children-4"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

***

<a id="confirmrequest"></a>

### ConfirmRequest

#### Properties

<a id="action-3"></a>

##### action

```ts
readonly action: string;
```

<a id="input-2"></a>

##### input

```ts
readonly input: unknown;
```

***

<a id="createrexappoptions"></a>

### CreateRexAppOptions

#### Properties

<a id="actor"></a>

##### actor?

```ts
readonly optional actor?: Actor;
```

<a id="baseurl"></a>

##### baseUrl?

```ts
readonly optional baseUrl?: string;
```

<a id="density"></a>

##### density?

```ts
readonly optional density?: ComponentType<DensitySlotProps>;
```

<a id="fetch"></a>

##### fetch?

```ts
readonly optional fetch?: RexFetch;
```

<a id="link"></a>

##### link?

```ts
readonly optional link?: ClientLink<RexClientContext>;
```

<a id="manifest"></a>

##### manifest?

```ts
readonly optional manifest?: Manifest;
```

<a id="onnavigate"></a>

##### onNavigate?

```ts
readonly optional onNavigate?: RexNavigateHook;
```

<a id="onoutcome"></a>

##### onOutcome?

```ts
readonly optional onOutcome?: RexOutcomeHook;
```

<a id="queryclient"></a>

##### queryClient?

```ts
readonly optional queryClient?: QueryClient;
```

<a id="registry-1"></a>

##### registry

```ts
readonly registry: RegistrySnapshot;
```

***

<a id="datastateinput"></a>

### DataStateInput

#### Properties

<a id="hasdata"></a>

##### hasData

```ts
readonly hasData: boolean;
```

<a id="online"></a>

##### online

```ts
readonly online: boolean;
```

<a id="policy"></a>

##### policy

```ts
readonly policy: Pick<PolicyResult, "allowed">;
```

<a id="queries"></a>

##### queries

```ts
readonly queries: readonly DataStateQuery[];
```

***

<a id="datastatequery"></a>

### DataStateQuery

#### Properties

<a id="error"></a>

##### error

```ts
readonly error: unknown;
```

<a id="fetchstatus"></a>

##### fetchStatus

```ts
readonly fetchStatus: FetchStatus;
```

<a id="hasdata-1"></a>

##### hasData

```ts
readonly hasData: boolean;
```

<a id="status-1"></a>

##### status

```ts
readonly status: QueryStatus;
```

***

<a id="densityinputs"></a>

### DensityInputs

#### Properties

<a id="fallback"></a>

##### fallback?

```ts
readonly optional fallback?: DensityPreference;
```

<a id="header"></a>

##### header?

```ts
readonly optional header?: string | null;
```

<a id="query"></a>

##### query?

```ts
readonly optional query?: string | null;
```

<a id="stored"></a>

##### stored?

```ts
readonly optional stored?: string | null;
```

***

<a id="densityproviderprops"></a>

### DensityProviderProps

#### Properties

<a id="children-5"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="fallback-1"></a>

##### fallback?

```ts
readonly optional fallback?: DensityPreference;
```

<a id="header-1"></a>

##### header?

```ts
readonly optional header?: string | null;
```

<a id="root"></a>

##### root?

```ts
readonly optional root?: HTMLElement;
```

<a id="screen"></a>

##### screen?

```ts
readonly optional screen?: ScreenSource;
```

<a id="search"></a>

##### search?

```ts
readonly optional search?: string;
```

***

<a id="densityslotprops"></a>

### DensitySlotProps

#### Properties

<a id="children-6"></a>

##### children

```ts
readonly children: ReactNode;
```

***

<a id="densityvalue"></a>

### DensityValue

#### Extends

- [`ResolvedDensity`](#resolveddensity)

#### Properties

<a id="density-1"></a>

##### density

```ts
readonly density: DensityPreference;
```

###### Inherited from

[`ResolvedDensity`](#resolveddensity).[`density`](#density-2)

<a id="screendensity"></a>

##### screenDensity

```ts
readonly screenDensity: "comfortable" | "compact" | "agent";
```

<a id="source"></a>

##### source

```ts
readonly source: DensitySource;
```

###### Inherited from

[`ResolvedDensity`](#resolveddensity).[`source`](#source-1)

#### Methods

<a id="setdensity"></a>

##### setDensity()

```ts
setDensity(density): void;
```

###### Parameters

###### density

[`DensityPreference`](#densitypreference)

###### Returns

`void`

***

<a id="destinationscope"></a>

### DestinationScope

#### Properties

<a id="base"></a>

##### base

```ts
readonly base: string;
```

<a id="locales"></a>

##### locales?

```ts
readonly optional locales?: readonly string[] | null;
```

<a id="origin"></a>

##### origin

```ts
readonly origin: string;
```

<a id="pages-1"></a>

##### pages

```ts
readonly pages: readonly AnyPage[];
```

<a id="parser"></a>

##### parser

```ts
readonly parser: Parser;
```

***

<a id="draft"></a>

### Draft

#### Type Parameters

##### T

`T`

#### Properties

<a id="mode"></a>

##### mode

```ts
readonly mode: PageDraft;
```

<a id="value"></a>

##### value

```ts
readonly value: T | null;
```

#### Methods

<a id="set"></a>

##### set()

```ts
set(value): void;
```

###### Parameters

###### value

`T` \| `null`

###### Returns

`void`

***

<a id="eagerpagemoduleset"></a>

### EagerPageModuleSet

#### Type Parameters

##### Pg

`Pg` *extends* [`AnyPage`](../rex.md#anypage) = [`AnyPage`](../rex.md#anypage)

#### Properties

<a id="overlays"></a>

##### overlays?

```ts
readonly optional overlays?: Readonly<Record<string, ComponentType>>;
```

<a id="page-3"></a>

##### page

```ts
readonly page: Pg;
```

<a id="regions"></a>

##### regions?

```ts
readonly optional regions?: Readonly<Record<string, ComponentType>>;
```

<a id="states"></a>

##### states

```ts
readonly states: PageStatesModule<Pg>;
```

<a id="view"></a>

##### view

```ts
readonly view: ComponentType;
```

***

<a id="flowclientoptions"></a>

### FlowClientOptions

#### Properties

<a id="baseurl-1"></a>

##### baseUrl?

```ts
readonly optional baseUrl?: string;
```

<a id="fetch-1"></a>

##### fetch?

```ts
readonly optional fetch?: RexFetch;
```

***

<a id="flowclientproviderprops"></a>

### FlowClientProviderProps

#### Properties

<a id="children-7"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="client"></a>

##### client

```ts
readonly client: object;
```

###### decide

```ts
decide: ProcedureClient<Record<never, never>, ProtocolSchema<FlowDecideInput>, ProtocolSchema<FlowState>, Record<never, never>>;
```

###### start

```ts
start: ProcedureClient<Record<never, never>, ProtocolSchema<FlowStartInput>, ProtocolSchema<FlowState>, Record<never, never>>;
```

###### status

```ts
status: ProcedureClient<Record<never, never>, ProtocolSchema<FlowInstanceInput>, ProtocolSchema<FlowState>, Record<never, never>>;
```

***

<a id="flowhandle"></a>

### FlowHandle

#### Properties

<a id="allowed-2"></a>

##### allowed

```ts
readonly allowed: boolean;
```

<a id="approveprops"></a>

##### approveProps

```ts
readonly approveProps: GateControlProps | null;
```

<a id="error-1"></a>

##### error

```ts
readonly error: string | null;
```

<a id="gate"></a>

##### gate

```ts
readonly gate: ApprovalStep | null;
```

<a id="pending-1"></a>

##### pending

```ts
readonly pending: boolean;
```

<a id="reason-2"></a>

##### reason

```ts
readonly reason: string | null;
```

<a id="rejectprops"></a>

##### rejectProps

```ts
readonly rejectProps: GateControlProps | null;
```

<a id="state"></a>

##### state

```ts
readonly state: FlowState | null;
```

#### Methods

<a id="approve"></a>

##### approve()

```ts
approve(): Promise<FlowDecisionResult>;
```

###### Returns

`Promise`\<[`FlowDecisionResult`](#flowdecisionresult)\>

<a id="refresh"></a>

##### refresh()

```ts
refresh(): Promise<void>;
```

###### Returns

`Promise`\<`void`\>

<a id="reject"></a>

##### reject()

```ts
reject(): Promise<FlowDecisionResult>;
```

###### Returns

`Promise`\<[`FlowDecisionResult`](#flowdecisionresult)\>

<a id="start"></a>

##### start()

```ts
start(input?): Promise<void>;
```

###### Parameters

###### input?

`unknown`

###### Returns

`Promise`\<`void`\>

***

<a id="formfield"></a>

### FormField

#### Properties

<a id="control"></a>

##### control

```ts
readonly control: FormFieldControl;
```

<a id="label-2"></a>

##### label

```ts
readonly label: string;
```

<a id="options"></a>

##### options

```ts
readonly options: readonly string[];
```

<a id="path-1"></a>

##### path

```ts
readonly path: string;
```

<a id="required"></a>

##### required

```ts
readonly required: boolean;
```

<a id="schema"></a>

##### schema

```ts
readonly schema: JsonSchema;
```

<a id="type"></a>

##### type

```ts
readonly type: string;
```

***

<a id="formoutcome"></a>

### FormOutcome

#### Extends

- [`Outcome`](#outcome)

#### Properties

<a id="actionid-1"></a>

##### actionId

```ts
readonly actionId: string;
```

###### Inherited from

[`Outcome`](#outcome).[`actionId`](#actionid-2)

<a id="at"></a>

##### at

```ts
readonly at: string;
```

###### Inherited from

[`Outcome`](#outcome).[`at`](#at-1)

<a id="code-3"></a>

##### code

```ts
readonly code: string | null;
```

<a id="fields-1"></a>

##### fields

```ts
readonly fields: FieldErrors;
```

<a id="message"></a>

##### message

```ts
readonly message: string;
```

###### Inherited from

[`Outcome`](#outcome).[`message`](#message-3)

<a id="ok"></a>

##### ok

```ts
readonly ok: boolean;
```

###### Inherited from

[`Outcome`](#outcome).[`ok`](#ok-1)

***

<a id="foundaddress"></a>

### FoundAddress

#### Properties

<a id="address-1"></a>

##### address

```ts
readonly address: string;
```

<a id="kind"></a>

##### kind

```ts
readonly kind: "page" | "action" | "region" | "overlay";
```

***

<a id="gatecontrolprops"></a>

### GateControlProps

#### Properties

<a id="aria-disabled-1"></a>

##### aria-disabled

```ts
readonly aria-disabled: boolean;
```

<a id="data-rex-1"></a>

##### data-rex

```ts
readonly data-rex: string;
```

<a id="data-rex-allowed-1"></a>

##### data-rex-allowed

```ts
readonly data-rex-allowed: "true" | "false";
```

<a id="disabled-1"></a>

##### disabled

```ts
readonly disabled: boolean;
```

<a id="onclick"></a>

##### onClick

```ts
readonly onClick: () => void;
```

###### Returns

`void`

<a id="title-1"></a>

##### title?

```ts
readonly optional title?: string;
```

***

<a id="gridprops"></a>

### GridProps

#### Properties

<a id="children-8"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="columns"></a>

##### columns?

```ts
readonly optional columns?: 1 | 2 | 4 | 3;
```

<a id="space"></a>

##### space?

```ts
readonly optional space?: 1 | 2 | 4 | 6 | 3 | 8 | 5 | 7;
```

***

<a id="invokehandle"></a>

### InvokeHandle

#### Extends

- [`ActHandle`](#acthandle)\<`A`\>

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Properties

<a id="action-4"></a>

##### action

```ts
readonly action: A;
```

###### Inherited from

[`ActHandle`](#acthandle).[`action`](#action)

<a id="allowed-3"></a>

##### allowed

```ts
readonly allowed: boolean;
```

###### Inherited from

[`ActHandle`](#acthandle).[`allowed`](#allowed)

<a id="controlprops-2"></a>

##### controlProps

```ts
readonly controlProps: ActControlProps;
```

###### Inherited from

[`ActHandle`](#acthandle).[`controlProps`](#controlprops)

<a id="mutation-1"></a>

##### mutation

```ts
readonly mutation: UseMutationResult<ActionOutput<A>, Error, MutationVariables>;
```

###### Inherited from

[`ActHandle`](#acthandle).[`mutation`](#mutation)

<a id="pending-2"></a>

##### pending

```ts
readonly pending: boolean;
```

###### Inherited from

[`ActHandle`](#acthandle).[`pending`](#pending)

<a id="reason-3"></a>

##### reason

```ts
readonly reason: ReasonCode | null;
```

###### Inherited from

[`ActHandle`](#acthandle).[`reason`](#reason)

#### Methods

<a id="invoke-1"></a>

##### invoke()

```ts
invoke(input): Promise<ActResult<A>>;
```

###### Parameters

###### input

[`ActionInput`](../rex.md#actioninput)\<`A`\>

###### Returns

`Promise`\<[`ActResult`](#actresult)\<`A`\>\>

<a id="requestconfirm-1"></a>

##### requestConfirm()

```ts
requestConfirm(input): Promise<ConfirmGrant>;
```

###### Parameters

###### input

[`ActionInput`](../rex.md#actioninput)\<`A`\>

###### Returns

`Promise`\<[`ConfirmGrant`](../rex.md#confirmgrant)\>

###### Inherited from

[`ActHandle`](#acthandle).[`requestConfirm`](#requestconfirm)

<a id="run-1"></a>

##### run()

```ts
run(input, options?): Promise<ActResult<A>>;
```

###### Parameters

###### input

[`ActionInput`](../rex.md#actioninput)\<`A`\>

###### options?

[`RunOptions`](#runoptions)

###### Returns

`Promise`\<[`ActResult`](#actresult)\<`A`\>\>

###### Inherited from

[`ActHandle`](#acthandle).[`run`](#run)

***

<a id="lazypagemoduleset"></a>

### LazyPageModuleSet

#### Type Parameters

##### Pg

`Pg` *extends* [`AnyPage`](../rex.md#anypage) = [`AnyPage`](../rex.md#anypage)

#### Properties

<a id="chunk"></a>

##### chunk?

```ts
readonly optional chunk?: string;
```

<a id="page-4"></a>

##### page

```ts
readonly page: Pg;
```

#### Methods

<a id="load"></a>

##### load()

```ts
load(): Promise<LoadedPageModules>;
```

###### Returns

`Promise`\<[`LoadedPageModules`](#loadedpagemodules)\>

***

<a id="listparamnames"></a>

### ListParamNames

#### Properties

<a id="page-5"></a>

##### page

```ts
readonly page: string;
```

<a id="size"></a>

##### size

```ts
readonly size: string;
```

***

<a id="listparams"></a>

### ListParams

#### Properties

<a id="page-6"></a>

##### page

```ts
readonly page: number;
```

<a id="size-1"></a>

##### size

```ts
readonly size: number;
```

***

<a id="listprops"></a>

### ListProps

#### Type Parameters

##### T

`T`

#### Properties

<a id="children-9"></a>

##### children

```ts
readonly children: (item, index) => ReactNode;
```

###### Parameters

###### item

`T`

###### index

`number`

###### Returns

`ReactNode`

<a id="empty"></a>

##### empty?

```ts
readonly optional empty?: ReactNode;
```

<a id="itemkey"></a>

##### itemKey

```ts
readonly itemKey: (item, index) => string;
```

###### Parameters

###### item

`T`

###### index

`number`

###### Returns

`string`

<a id="items"></a>

##### items

```ts
readonly items: readonly T[];
```

<a id="label-3"></a>

##### label?

```ts
readonly optional label?: string;
```

<a id="morelabel"></a>

##### moreLabel?

```ts
readonly optional moreLabel?: string;
```

<a id="name"></a>

##### name

```ts
readonly name: string;
```

<a id="params"></a>

##### params?

```ts
readonly optional params?: Partial<ListParamNames>;
```

<a id="size-2"></a>

##### size?

```ts
readonly optional size?: number;
```

***

<a id="listwindow"></a>

### ListWindow

#### Properties

<a id="hasmore"></a>

##### hasMore

```ts
readonly hasMore: boolean;
```

<a id="page-7"></a>

##### page

```ts
readonly page: number;
```

<a id="shown"></a>

##### shown

```ts
readonly shown: number;
```

<a id="size-3"></a>

##### size

```ts
readonly size: number;
```

<a id="total"></a>

##### total

```ts
readonly total: number;
```

***

<a id="loadedpagemodules"></a>

### LoadedPageModules

#### Properties

<a id="overlays-1"></a>

##### overlays?

```ts
readonly optional overlays?: Readonly<Record<string, unknown>>;
```

<a id="regions-1"></a>

##### regions?

```ts
readonly optional regions?: Readonly<Record<string, unknown>>;
```

<a id="states-1"></a>

##### states

```ts
readonly states: Readonly<Record<string, unknown>>;
```

<a id="view-1"></a>

##### view

```ts
readonly view: unknown;
```

***

<a id="loadererrorinit"></a>

### LoaderErrorInit

#### Properties

<a id="code-4"></a>

##### code

```ts
readonly code: string;
```

<a id="loader-1"></a>

##### loader

```ts
readonly loader: string;
```

<a id="message-1"></a>

##### message

```ts
readonly message: string;
```

<a id="page-8"></a>

##### page

```ts
readonly page: string;
```

<a id="status-2"></a>

##### status

```ts
readonly status: number | null;
```

***

<a id="loadererrorjson"></a>

### LoaderErrorJson

#### Properties

<a id="code-5"></a>

##### code

```ts
readonly code: string;
```

<a id="loader-2"></a>

##### loader

```ts
readonly loader: string;
```

<a id="message-2"></a>

##### message

```ts
readonly message: string;
```

<a id="name-1"></a>

##### name

```ts
readonly name: "RexLoaderError";
```

<a id="page-9"></a>

##### page

```ts
readonly page: string;
```

<a id="status-3"></a>

##### status

```ts
readonly status: number | null;
```

***

<a id="loaderqueryoptionsinput"></a>

### LoaderQueryOptionsInput

#### Properties

<a id="client-1"></a>

##### client

```ts
readonly client: RexClient;
```

<a id="consumer"></a>

##### consumer?

```ts
readonly optional consumer?: boolean;
```

<a id="enabled"></a>

##### enabled?

```ts
readonly optional enabled?: boolean;
```

<a id="loader-3"></a>

##### loader

```ts
readonly loader: PageLoader;
```

<a id="page-10"></a>

##### page

```ts
readonly page: AnyPage;
```

<a id="params-1"></a>

##### params

```ts
readonly params: LoaderParams;
```

***

<a id="nav"></a>

### Nav

#### Methods

<a id="back"></a>

##### back()

```ts
back(): NavOutcome;
```

###### Returns

[`NavOutcome`](#navoutcome)

<a id="href"></a>

##### href()

```ts
href<Pg>(page, ...params): NavOutcome;
```

###### Type Parameters

###### Pg

`Pg` *extends* [`AnyPage`](../rex.md#anypage)

###### Parameters

###### page

`Pg`

###### params

...[`NavParamsArg`](#navparamsarg)\<`Pg`\>

###### Returns

[`NavOutcome`](#navoutcome)

<a id="replace"></a>

##### replace()

```ts
replace<Pg>(page, ...params): NavOutcome;
```

###### Type Parameters

###### Pg

`Pg` *extends* [`AnyPage`](../rex.md#anypage)

###### Parameters

###### page

`Pg`

###### params

...[`NavParamsArg`](#navparamsarg)\<`Pg`\>

###### Returns

[`NavOutcome`](#navoutcome)

<a id="to"></a>

##### to()

```ts
to<Pg>(page, ...params): NavOutcome;
```

###### Type Parameters

###### Pg

`Pg` *extends* [`AnyPage`](../rex.md#anypage)

###### Parameters

###### page

`Pg`

###### params

...[`NavParamsArg`](#navparamsarg)\<`Pg`\>

###### Returns

[`NavOutcome`](#navoutcome)

***

<a id="navigateeventlike"></a>

### NavigateEventLike

#### Extends

- `Event`

#### Properties

<a id="canintercept"></a>

##### canIntercept

```ts
readonly canIntercept: boolean;
```

<a id="destination"></a>

##### destination

```ts
readonly destination: NavigationDestinationLike;
```

<a id="downloadrequest"></a>

##### downloadRequest

```ts
readonly downloadRequest: string | null;
```

<a id="formdata"></a>

##### formData

```ts
readonly formData: FormData | null;
```

<a id="hashchange"></a>

##### hashChange

```ts
readonly hashChange: boolean;
```

<a id="navigationtype"></a>

##### navigationType

```ts
readonly navigationType: NavigationType;
```

#### Methods

<a id="intercept"></a>

##### intercept()

```ts
intercept(options?): void;
```

###### Parameters

###### options?

[`NavigationInterceptOptions`](#navigationinterceptoptions)

###### Returns

`void`

***

<a id="navigationdestinationlike"></a>

### NavigationDestinationLike

#### Properties

<a id="samedocument"></a>

##### sameDocument

```ts
readonly sameDocument: boolean;
```

<a id="url"></a>

##### url

```ts
readonly url: string;
```

***

<a id="navigationinterceptoptions"></a>

### NavigationInterceptOptions

#### Properties

<a id="focusreset"></a>

##### focusReset?

```ts
readonly optional focusReset?: "after-transition" | "manual";
```

<a id="handler"></a>

##### handler?

```ts
readonly optional handler?: () => Promise<void>;
```

###### Returns

`Promise`\<`void`\>

<a id="scroll"></a>

##### scroll?

```ts
readonly optional scroll?: "after-transition" | "manual";
```

***

<a id="notfoundresolution"></a>

### NotFoundResolution

#### Properties

<a id="kind-1"></a>

##### kind

```ts
readonly kind: "not-found";
```

<a id="path-2"></a>

##### path

```ts
readonly path: string;
```

***

<a id="outcome"></a>

### Outcome

#### Extended by

- [`RexOutcomeEvent`](#rexoutcomeevent)
- [`FormOutcome`](#formoutcome)

#### Properties

<a id="actionid-2"></a>

##### actionId

```ts
readonly actionId: string;
```

<a id="at-1"></a>

##### at

```ts
readonly at: string;
```

<a id="message-3"></a>

##### message

```ts
readonly message: string;
```

<a id="ok-1"></a>

##### ok

```ts
readonly ok: boolean;
```

***

<a id="outcomeprops"></a>

### OutcomeProps

#### Properties

<a id="children-10"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="space-1"></a>

##### space?

```ts
readonly optional space?: 1 | 2 | 4 | 6 | 3 | 8 | 5 | 7;
```

***

<a id="outcomeproviderprops"></a>

### OutcomeProviderProps

#### Properties

<a id="children-11"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="store"></a>

##### store

```ts
readonly store: OutcomeStore;
```

***

<a id="outcomeregionprops"></a>

### OutcomeRegionProps

#### Properties

<a id="page-11"></a>

##### page

```ts
readonly page: string;
```

***

<a id="outcomeslotprops"></a>

### OutcomeSlotProps

#### Properties

<a id="page-12"></a>

##### page

```ts
readonly page: string;
```

***

<a id="outcomestore"></a>

### OutcomeStore

#### Methods

<a id="clear"></a>

##### clear()

```ts
clear(page): void;
```

###### Parameters

###### page

`string`

###### Returns

`void`

<a id="get"></a>

##### get()

```ts
get(page): Outcome | null;
```

###### Parameters

###### page

`string`

###### Returns

[`Outcome`](#outcome) \| `null`

<a id="set-1"></a>

##### set()

```ts
set(page, outcome): void;
```

###### Parameters

###### page

`string`

###### outcome

[`Outcome`](#outcome)

###### Returns

`void`

<a id="subscribe-1"></a>

##### subscribe()

```ts
subscribe(listener): () => void;
```

###### Parameters

###### listener

() => `void`

###### Returns

() => `void`

***

<a id="overlayhandle"></a>

### OverlayHandle

#### Properties

<a id="address-2"></a>

##### address

```ts
readonly address: string;
```

<a id="id-1"></a>

##### id

```ts
readonly id: string;
```

<a id="open"></a>

##### open

```ts
readonly open: boolean;
```

<a id="page-13"></a>

##### page

```ts
readonly page: string;
```

<a id="triggerprops"></a>

##### triggerProps

```ts
readonly triggerProps: object;
```

###### aria-expanded

```ts
readonly aria-expanded: boolean;
```

###### aria-haspopup

```ts
readonly aria-haspopup: "dialog";
```

###### data-rex-overlay-trigger

```ts
readonly data-rex-overlay-trigger: string;
```

###### onClick

```ts
readonly onClick: () => void;
```

###### Returns

`void`

#### Methods

<a id="hide"></a>

##### hide()

```ts
hide(): void;
```

###### Returns

`void`

<a id="show"></a>

##### show()

```ts
show(): void;
```

###### Returns

`void`

<a id="toggle"></a>

##### toggle()

```ts
toggle(): void;
```

###### Returns

`void`

***

<a id="overlayoptions"></a>

### OverlayOptions

#### Properties

<a id="binding"></a>

##### binding

```ts
readonly binding: OverlayBinding;
```

<a id="dismiss"></a>

##### dismiss

```ts
readonly dismiss: OverlayDismiss;
```

***

<a id="overlayregistry"></a>

### OverlayRegistry

#### Methods

<a id="isopen"></a>

##### isOpen()

```ts
isOpen(page, overlay): boolean;
```

###### Parameters

###### page

`string`

###### overlay

`string`

###### Returns

`boolean`

<a id="openoverlays"></a>

##### openOverlays()

```ts
openOverlays(page): readonly string[];
```

###### Parameters

###### page

`string`

###### Returns

readonly `string`[]

<a id="setopen"></a>

##### setOpen()

```ts
setOpen(
   page, 
   overlay, 
   open
): void;
```

###### Parameters

###### page

`string`

###### overlay

`string`

###### open

`boolean`

###### Returns

`void`

<a id="subscribe-2"></a>

##### subscribe()

```ts
subscribe(listener): () => void;
```

###### Parameters

###### listener

`Listener`

###### Returns

() => `void`

***

<a id="overlayregistryproviderprops"></a>

### OverlayRegistryProviderProps

#### Properties

<a id="children-12"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="registry-2"></a>

##### registry

```ts
readonly registry: OverlayRegistry;
```

***

<a id="overlayrendercontext"></a>

### OverlayRenderContext

#### Properties

<a id="id-2"></a>

##### id

```ts
readonly id: string;
```

<a id="page-14"></a>

##### page

```ts
readonly page: string;
```

#### Methods

<a id="close"></a>

##### close()

```ts
close(): void;
```

###### Returns

`void`

***

<a id="overlaysurfaceprops"></a>

### OverlaySurfaceProps

#### Properties

<a id="address-3"></a>

##### address

```ts
readonly address: string;
```

<a id="button"></a>

##### Button

```ts
readonly Button: ComponentType<ShellButtonProps>;
```

<a id="children-13"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="closelabel"></a>

##### closeLabel

```ts
readonly closeLabel: string | null;
```

<a id="dismiss-1"></a>

##### dismiss

```ts
readonly dismiss: OverlayDismiss;
```

<a id="escape"></a>

##### escape

```ts
readonly escape: boolean;
```

<a id="form"></a>

##### form

```ts
readonly form: "dialog" | "bottom-sheet";
```

<a id="hide-1"></a>

##### hide

```ts
readonly hide: () => void;
```

###### Returns

`void`

<a id="sheet"></a>

##### Sheet

```ts
readonly Sheet: ComponentType<ShellSheetProps>;
```

<a id="title-2"></a>

##### title

```ts
readonly title: string;
```

***

<a id="pagehostprops"></a>

### PageHostProps

#### Properties

<a id="modules"></a>

##### modules

```ts
readonly modules: PageModuleSet;
```

***

<a id="pageinvokerset"></a>

### PageInvokerSet

#### Properties

<a id="page-15"></a>

##### page

```ts
readonly page: string | null;
```

#### Methods

<a id="has"></a>

##### has()

```ts
has(actionId): boolean;
```

###### Parameters

###### actionId

`string`

###### Returns

`boolean`

<a id="invoke-2"></a>

##### invoke()

```ts
invoke(actionId, input): Promise<ActResult<AnyAction>>;
```

###### Parameters

###### actionId

`string`

###### input

`unknown`

###### Returns

`Promise`\<[`ActResult`](#actresult)\<[`AnyAction`](../rex.md#anyaction)\>\>

***

<a id="pageinvokersprops"></a>

### PageInvokersProps

#### Properties

<a id="children-14"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

***

<a id="pageresolution"></a>

### PageResolution

#### Properties

<a id="issues"></a>

##### issues

```ts
readonly issues: readonly ParamIssue[];
```

<a id="kind-2"></a>

##### kind

```ts
readonly kind: "page";
```

<a id="page-16"></a>

##### page

```ts
readonly page: AnyPage;
```

<a id="params-2"></a>

##### params

```ts
readonly params: Readonly<Record<string, unknown>>;
```

<a id="policy-1"></a>

##### policy

```ts
readonly policy: PolicyResult;
```

<a id="recovery"></a>

##### recovery

```ts
readonly recovery: AnyPage | null;
```

<a id="search-1"></a>

##### search

```ts
readonly search: string;
```

***

<a id="pageruntime"></a>

### PageRuntime

#### Properties

<a id="page-17"></a>

##### page

```ts
readonly page: AnyPage;
```

<a id="params-3"></a>

##### params

```ts
readonly params: PageParamsValue;
```

<a id="resolution"></a>

##### resolution

```ts
readonly resolution: PageResolution;
```

<a id="state-1"></a>

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

***

<a id="paletteactionentry"></a>

### PaletteActionEntry

#### Properties

<a id="action-5"></a>

##### action

```ts
readonly action: AnyAction | null;
```

<a id="affordance-1"></a>

##### affordance

```ts
readonly affordance: Affordance | null;
```

<a id="allowed-4"></a>

##### allowed

```ts
readonly allowed: boolean;
```

<a id="id-3"></a>

##### id

```ts
readonly id: string;
```

<a id="kind-3"></a>

##### kind

```ts
readonly kind: "action";
```

<a id="label-4"></a>

##### label

```ts
readonly label: string;
```

<a id="reason-4"></a>

##### reason

```ts
readonly reason: string | null;
```

<a id="shortcut"></a>

##### shortcut

```ts
readonly shortcut: string | null;
```

***

<a id="palettemenuprops"></a>

### PaletteMenuProps

#### Properties

<a id="actions"></a>

##### actions

```ts
readonly actions: readonly PaletteActionEntry[];
```

<a id="item"></a>

##### Item

```ts
readonly Item: ComponentType<ShellPaletteItemProps>;
```

<a id="label-5"></a>

##### label

```ts
readonly label: string;
```

<a id="page-18"></a>

##### page

```ts
readonly page: string | null;
```

<a id="pages-2"></a>

##### pages

```ts
readonly pages: readonly PalettePageEntry[];
```

<a id="valueof"></a>

##### valueOf

```ts
readonly valueOf: (kind, id) => string;
```

###### Parameters

###### kind

`"page"` \| `"action"`

###### id

`string`

###### Returns

`string`

#### Methods

<a id="onaction"></a>

##### onAction()

```ts
onAction(entry): void;
```

###### Parameters

###### entry

[`PaletteActionEntry`](#paletteactionentry)

###### Returns

`void`

<a id="onclose"></a>

##### onClose()

```ts
onClose(): void;
```

###### Returns

`void`

<a id="onpage"></a>

##### onPage()

```ts
onPage(entry): void;
```

###### Parameters

###### entry

[`PalettePageEntry`](#palettepageentry)

###### Returns

`void`

***

<a id="palettepageentry"></a>

### PalettePageEntry

#### Properties

<a id="id-4"></a>

##### id

```ts
readonly id: string;
```

<a id="kind-4"></a>

##### kind

```ts
readonly kind: "page";
```

<a id="page-19"></a>

##### page

```ts
readonly page: AnyPage;
```

<a id="route"></a>

##### route

```ts
readonly route: string;
```

<a id="title-3"></a>

##### title

```ts
readonly title: string;
```

***

<a id="paramissue"></a>

### ParamIssue

#### Properties

<a id="message-4"></a>

##### message

```ts
readonly message: string;
```

<a id="path-3"></a>

##### path

```ts
readonly path: string;
```

***

<a id="querylike"></a>

### QueryLike

#### Properties

<a id="data"></a>

##### data

```ts
readonly data: unknown;
```

<a id="error-2"></a>

##### error

```ts
readonly error: unknown;
```

<a id="fetchstatus-1"></a>

##### fetchStatus

```ts
readonly fetchStatus: FetchStatus;
```

<a id="status-4"></a>

##### status

```ts
readonly status: QueryStatus;
```

***

<a id="regionboundaryprops"></a>

### RegionBoundaryProps

#### Properties

<a id="children-15"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="region-1"></a>

##### region

```ts
readonly region: string;
```

***

<a id="regioncontext"></a>

### RegionContext

#### Type Parameters

##### P

`P` = [`PageParamsValue`](#pageparamsvalue)

#### Properties

<a id="act"></a>

##### act

```ts
readonly act: <A>(declared) => InvokeHandle<A>;
```

###### Type Parameters

###### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

###### Parameters

###### declared

`A`

###### Returns

[`InvokeHandle`](#invokehandle)\<`A`\>

<a id="nav-1"></a>

##### nav

```ts
readonly nav: Nav;
```

<a id="page-20"></a>

##### page

```ts
readonly page: string;
```

<a id="params-4"></a>

##### params

```ts
readonly params: P;
```

<a id="region-2"></a>

##### region

```ts
readonly region: string;
```

<a id="state-2"></a>

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

***

<a id="regionfailure"></a>

### RegionFailure

#### Properties

<a id="code-6"></a>

##### code

```ts
readonly code: string;
```

<a id="message-5"></a>

##### message

```ts
readonly message: string;
```

<a id="region-3"></a>

##### region

```ts
readonly region: string;
```

***

<a id="regionfailureregistry"></a>

### RegionFailureRegistry

#### Methods

<a id="clear-1"></a>

##### clear()

```ts
clear(page, region): void;
```

###### Parameters

###### page

`string`

###### region

`string`

###### Returns

`void`

<a id="fail"></a>

##### fail()

```ts
fail(page, failure): void;
```

###### Parameters

###### page

`string`

###### failure

[`RegionFailure`](#regionfailure)

###### Returns

`void`

<a id="failures"></a>

##### failures()

```ts
failures(page): readonly RegionFailure[];
```

###### Parameters

###### page

`string`

###### Returns

readonly [`RegionFailure`](#regionfailure)[]

<a id="subscribe-3"></a>

##### subscribe()

```ts
subscribe(listener): () => void;
```

###### Parameters

###### listener

`Listener`

###### Returns

() => `void`

***

<a id="regionprops"></a>

### RegionProps

#### Properties

<a id="children-16"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="name-2"></a>

##### name

```ts
readonly name: string;
```

***

<a id="resolveddensity"></a>

### ResolvedDensity

#### Extended by

- [`DensityValue`](#densityvalue)

#### Properties

<a id="density-2"></a>

##### density

```ts
readonly density: DensityPreference;
```

<a id="source-1"></a>

##### source

```ts
readonly source: DensitySource;
```

***

<a id="rexaddress"></a>

### RexAddress

#### Properties

<a id="overlay-1"></a>

##### overlay

```ts
readonly overlay: string | null;
```

<a id="overlayaddress"></a>

##### overlayAddress

```ts
readonly overlayAddress: string | null;
```

<a id="page-21"></a>

##### page

```ts
readonly page: string | null;
```

<a id="pageaddress"></a>

##### pageAddress

```ts
readonly pageAddress: string | null;
```

<a id="region-4"></a>

##### region

```ts
readonly region: string | null;
```

<a id="regionaddress"></a>

##### regionAddress

```ts
readonly regionAddress: string | null;
```

#### Methods

<a id="action-6"></a>

##### action()

```ts
action(id): string | null;
```

###### Parameters

###### id

`string`

###### Returns

`string` \| `null`

***

<a id="rexappprops"></a>

### RexAppProps

#### Properties

<a id="children-17"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

***

<a id="rexclientcontext"></a>

### RexClientContext

#### Properties

<a id="confirmtoken"></a>

##### confirmToken?

```ts
readonly optional confirmToken?: string;
```

***

<a id="rexentrybundle"></a>

### RexEntryBundle

#### Properties

<a id="manifest-1"></a>

##### manifest?

```ts
readonly optional manifest?: Manifest;
```

<a id="pages-3"></a>

##### pages

```ts
readonly pages: readonly PageModuleSet[];
```

<a id="registry-3"></a>

##### registry

```ts
readonly registry: RegistrySnapshot;
```

***

<a id="rexnavigateevent"></a>

### RexNavigateEvent

#### Properties

<a id="from"></a>

##### from

```ts
readonly from: string | null;
```

<a id="href-1"></a>

##### href

```ts
readonly href: string;
```

<a id="page-22"></a>

##### page

```ts
readonly page: string | null;
```

<a id="path-4"></a>

##### path

```ts
readonly path: string;
```

<a id="search-2"></a>

##### search

```ts
readonly search: string;
```

***

<a id="rexoutcomeevent"></a>

### RexOutcomeEvent

#### Extends

- [`Outcome`](#outcome)

#### Properties

<a id="actionid-3"></a>

##### actionId

```ts
readonly actionId: string;
```

###### Inherited from

[`Outcome`](#outcome).[`actionId`](#actionid-2)

<a id="at-2"></a>

##### at

```ts
readonly at: string;
```

###### Inherited from

[`Outcome`](#outcome).[`at`](#at-1)

<a id="message-6"></a>

##### message

```ts
readonly message: string;
```

###### Inherited from

[`Outcome`](#outcome).[`message`](#message-3)

<a id="ok-2"></a>

##### ok

```ts
readonly ok: boolean;
```

###### Inherited from

[`Outcome`](#outcome).[`ok`](#ok-1)

<a id="page-23"></a>

##### page

```ts
readonly page: string;
```

***

<a id="rexpaletteprops"></a>

### RexPaletteProps

#### Properties

<a id="defaultopen"></a>

##### defaultOpen?

```ts
readonly optional defaultOpen?: boolean;
```

***

<a id="rexprovider"></a>

### RexProvider

#### Properties

<a id="component"></a>

##### Component

```ts
readonly Component: ComponentType<RexProviderProps>;
```

<a id="id-5"></a>

##### id

```ts
readonly id: string;
```

***

<a id="rexproviderprops"></a>

### RexProviderProps

#### Properties

<a id="children-18"></a>

##### children

```ts
readonly children: ReactNode;
```

***

<a id="rexroutesprops"></a>

### RexRoutesProps

#### Properties

<a id="render"></a>

##### render

```ts
readonly render: RouteRender;
```

***

<a id="rexruntime"></a>

### RexRuntime

#### Properties

<a id="actor-1"></a>

##### actor

```ts
readonly actor: Actor;
```

<a id="baseurl-2"></a>

##### baseUrl?

```ts
readonly optional baseUrl?: string;
```

<a id="client-2"></a>

##### client

```ts
readonly client: RexClient;
```

<a id="density-3"></a>

##### density

```ts
readonly density: string | null;
```

<a id="fetch-2"></a>

##### fetch?

```ts
readonly optional fetch?: ApiFetch;
```

<a id="manifest-2"></a>

##### manifest

```ts
readonly manifest: Manifest;
```

<a id="registry-4"></a>

##### registry

```ts
readonly registry: RegistrySnapshot;
```

***

<a id="rexstore"></a>

### RexStore

#### Type Parameters

##### T

`T`

#### Properties

<a id="expose"></a>

##### expose

```ts
readonly expose: boolean;
```

<a id="id-6"></a>

##### id

```ts
readonly id: string;
```

#### Methods

<a id="get-1"></a>

##### get()

```ts
get(): T;
```

###### Returns

`T`

<a id="reset"></a>

##### reset()

```ts
reset(): void;
```

###### Returns

`void`

<a id="set-2"></a>

##### set()

```ts
set(next): void;
```

###### Parameters

###### next

`T`

###### Returns

`void`

<a id="subscribe-4"></a>

##### subscribe()

```ts
subscribe(listener): () => void;
```

###### Parameters

###### listener

`Listener`

###### Returns

() => `void`

<a id="tojson-1"></a>

##### toJSON()

```ts
toJSON(): T;
```

###### Returns

`T`

<a id="update"></a>

##### update()

```ts
update(change): void;
```

###### Parameters

###### change

(`current`) => `T`

###### Returns

`void`

<a id="usestore"></a>

##### useStore()

```ts
useStore(): T;
```

###### Returns

`T`

***

<a id="routabledestination"></a>

### RoutableDestination

#### Properties

<a id="href-2"></a>

##### href

```ts
readonly href: string;
```

<a id="page-24"></a>

##### page

```ts
readonly page: AnyPage;
```

***

<a id="runoptions"></a>

### RunOptions

#### Properties

<a id="confirmtoken-1"></a>

##### confirmToken?

```ts
readonly optional confirmToken?: string;
```

***

<a id="screenproviderprops"></a>

### ScreenProviderProps

#### Properties

<a id="children-19"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="density-4"></a>

##### density

```ts
readonly density: "comfortable" | "compact" | "agent";
```

<a id="root-1"></a>

##### root?

```ts
readonly optional root?: HTMLElement;
```

<a id="source-2"></a>

##### source?

```ts
readonly optional source?: ScreenSource;
```

***

<a id="screensnapshot"></a>

### ScreenSnapshot

#### Extended by

- [`ScreenState`](#screenstate)

#### Properties

<a id="pointer"></a>

##### pointer

```ts
readonly pointer: "coarse" | "fine";
```

<a id="screen-1"></a>

##### screen

```ts
readonly screen: "phone" | "tablet" | "desktop" | "wide";
```

***

<a id="screensource"></a>

### ScreenSource

#### Methods

<a id="get-2"></a>

##### get()

```ts
get(): ScreenSnapshot;
```

###### Returns

[`ScreenSnapshot`](#screensnapshot)

<a id="subscribe-5"></a>

##### subscribe()

```ts
subscribe(listener): () => void;
```

###### Parameters

###### listener

() => `void`

###### Returns

() => `void`

***

<a id="screensourceoptions"></a>

### ScreenSourceOptions

#### Properties

<a id="matchmedia"></a>

##### matchMedia?

```ts
readonly optional matchMedia?: MatchMedia;
```

<a id="resizeobserver"></a>

##### ResizeObserver?

```ts
readonly optional ResizeObserver?: ResizeObserverConstructor;
```

<a id="root-2"></a>

##### root?

```ts
readonly optional root?: Element;
```

<a id="width"></a>

##### width?

```ts
readonly optional width?: () => number;
```

###### Returns

`number`

***

<a id="screenstate"></a>

### ScreenState

#### Extends

- [`ScreenSnapshot`](#screensnapshot)

#### Properties

<a id="density-5"></a>

##### density

```ts
readonly density: "comfortable" | "compact" | "agent";
```

<a id="pointer-1"></a>

##### pointer

```ts
readonly pointer: "coarse" | "fine";
```

###### Inherited from

[`ScreenSnapshot`](#screensnapshot).[`pointer`](#pointer)

<a id="screen-2"></a>

##### screen

```ts
readonly screen: "phone" | "tablet" | "desktop" | "wide";
```

###### Inherited from

[`ScreenSnapshot`](#screensnapshot).[`screen`](#screen-1)

***

<a id="sectionprops"></a>

### SectionProps

#### Properties

<a id="children-20"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="space-2"></a>

##### space?

```ts
readonly optional space?: 1 | 2 | 4 | 6 | 3 | 8 | 5 | 7;
```

<a id="title-4"></a>

##### title

```ts
readonly title: string;
```

***

<a id="seededcandidate"></a>

### SeededCandidate

#### Properties

<a id="state-3"></a>

##### state

```ts
readonly state: object;
```

###### data

```ts
readonly data: unknown;
```

###### dataUpdatedAt

```ts
readonly dataUpdatedAt: number;
```

***

<a id="shellcomponents"></a>

### ShellComponents

#### Properties

<a id="button-1"></a>

##### Button

```ts
readonly Button: ComponentType<ShellButtonProps>;
```

<a id="frame"></a>

##### Frame

```ts
readonly Frame: ComponentType<ShellFrameProps>;
```

<a id="nav-2"></a>

##### Nav

```ts
readonly Nav: ComponentType<ShellNavProps>;
```

<a id="outcome-1"></a>

##### Outcome

```ts
readonly Outcome: ComponentType<OutcomeSlotProps>;
```

<a id="paletteitem"></a>

##### PaletteItem

```ts
readonly PaletteItem: ComponentType<ShellPaletteItemProps>;
```

<a id="sheet-1"></a>

##### Sheet

```ts
readonly Sheet: ComponentType<ShellSheetProps>;
```

***

<a id="shellcomponentsproviderprops"></a>

### ShellComponentsProviderProps

#### Properties

<a id="children-21"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="components"></a>

##### components

```ts
readonly components: ShellComponents;
```

***

<a id="shellframeprops"></a>

### ShellFrameProps

#### Properties

<a id="appname"></a>

##### appName

```ts
readonly appName: string;
```

<a id="children-22"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="links"></a>

##### links

```ts
readonly links: readonly ShellNavLink[];
```

<a id="navform"></a>

##### navForm

```ts
readonly navForm: "sidebar" | "bar" | "dock";
```

<a id="palette"></a>

##### palette

```ts
readonly palette: ShellPaletteTriggerProps | null;
```

***

<a id="shellnavlink"></a>

### ShellNavLink

#### Properties

<a id="address-4"></a>

##### address

```ts
readonly address: string;
```

<a id="current"></a>

##### current

```ts
readonly current: boolean;
```

<a id="href-3"></a>

##### href

```ts
readonly href: string | undefined;
```

<a id="id-7"></a>

##### id

```ts
readonly id: string;
```

<a id="label-6"></a>

##### label

```ts
readonly label: string;
```

<a id="onclick-1"></a>

##### onClick

```ts
readonly onClick: (event) => void;
```

###### Parameters

###### event

`MouseEvent`\<`HTMLAnchorElement`\>

###### Returns

`void`

***

<a id="shellnavprops"></a>

### ShellNavProps

#### Properties

<a id="form-1"></a>

##### form

```ts
readonly form: "sidebar" | "bar" | "dock";
```

<a id="links-1"></a>

##### links

```ts
readonly links: readonly ShellNavLink[];
```

***

<a id="shellpaletteitemprops"></a>

### ShellPaletteItemProps

#### Properties

<a id="allowed-5"></a>

##### allowed

```ts
readonly allowed: boolean;
```

<a id="detail-2"></a>

##### detail

```ts
readonly detail: string;
```

<a id="id-8"></a>

##### id

```ts
readonly id: string;
```

<a id="kind-5"></a>

##### kind

```ts
readonly kind: "page" | "action";
```

<a id="label-7"></a>

##### label

```ts
readonly label: string;
```

<a id="reason-5"></a>

##### reason

```ts
readonly reason: string | null;
```

<a id="shortcut-1"></a>

##### shortcut

```ts
readonly shortcut: string | null;
```

***

<a id="shellpalettetriggerprops"></a>

### ShellPaletteTriggerProps

#### Properties

<a id="address-5"></a>

##### address

```ts
readonly address: string;
```

<a id="label-8"></a>

##### label

```ts
readonly label: string;
```

<a id="onopen"></a>

##### onOpen

```ts
readonly onOpen: () => void;
```

###### Returns

`void`

<a id="shortcut-2"></a>

##### shortcut

```ts
readonly shortcut: string;
```

***

<a id="shellprops"></a>

### ShellProps

#### Properties

<a id="outcome-2"></a>

##### outcome?

```ts
readonly optional outcome?: ComponentType<OutcomeSlotProps>;
```

<a id="pages-4"></a>

##### pages

```ts
readonly pages: readonly PageModuleSet[];
```

***

<a id="shellsheetprops"></a>

### ShellSheetProps

#### Properties

<a id="address-6"></a>

##### address

```ts
readonly address: string;
```

<a id="children-23"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="form-2"></a>

##### form

```ts
readonly form: "dialog" | "bottom-sheet";
```

<a id="title-5"></a>

##### title

```ts
readonly title: string;
```

<a id="titleid"></a>

##### titleId

```ts
readonly titleId: string;
```

***

<a id="shellslot"></a>

### ShellSlot

#### Properties

<a id="component-1"></a>

##### Component

```ts
readonly Component: ComponentType<ShellSlotProps>;
```

<a id="id-9"></a>

##### id

```ts
readonly id: string;
```

***

<a id="shellslotprops"></a>

### ShellSlotProps

#### Properties

<a id="active"></a>

##### active

```ts
readonly active: AnyPage | null;
```

<a id="modules-1"></a>

##### modules

```ts
readonly modules: ReadonlyMap<string, PageModuleSet>;
```

<a id="navpages"></a>

##### navPages

```ts
readonly navPages: readonly AnyPage[];
```

<a id="outcome-3"></a>

##### Outcome

```ts
readonly Outcome: ComponentType<OutcomeSlotProps>;
```

<a id="resolution-1"></a>

##### resolution

```ts
readonly resolution: RouteResolution;
```

***

<a id="shortcuteventlike"></a>

### ShortcutEventLike

#### Properties

<a id="altkey"></a>

##### altKey

```ts
readonly altKey: boolean;
```

<a id="code-7"></a>

##### code?

```ts
readonly optional code?: string;
```

<a id="ctrlkey"></a>

##### ctrlKey

```ts
readonly ctrlKey: boolean;
```

<a id="key"></a>

##### key

```ts
readonly key: string;
```

<a id="metakey"></a>

##### metaKey

```ts
readonly metaKey: boolean;
```

<a id="shiftkey"></a>

##### shiftKey

```ts
readonly shiftKey: boolean;
```

***

<a id="sidecarsource"></a>

### SidecarSource

#### Properties

<a id="actor-2"></a>

##### actor

```ts
readonly actor: Actor;
```

<a id="affordances"></a>

##### affordances?

```ts
readonly optional affordances?: readonly Affordance[];
```

<a id="failures-1"></a>

##### failures?

```ts
readonly optional failures?: readonly RegionFailure[];
```

<a id="manifest-3"></a>

##### manifest

```ts
readonly manifest: Manifest;
```

<a id="openoverlays-1"></a>

##### openOverlays

```ts
readonly openOverlays: readonly string[];
```

<a id="outcome-4"></a>

##### outcome

```ts
readonly outcome: Outcome | null;
```

<a id="page-25"></a>

##### page

```ts
readonly page: AnyPage;
```

<a id="params-5"></a>

##### params

```ts
readonly params: Readonly<Record<string, unknown>>;
```

<a id="screen-3"></a>

##### screen?

```ts
readonly optional screen?: ScreenState | null;
```

<a id="state-4"></a>

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

<a id="stores"></a>

##### stores?

```ts
readonly optional stores?: Readonly<Record<string, unknown>>;
```

<a id="text"></a>

##### text?

```ts
readonly optional text?: TextResolver;
```

***

<a id="stackprops"></a>

### StackProps

#### Properties

<a id="children-24"></a>

##### children?

```ts
readonly optional children?: ReactNode;
```

<a id="space-3"></a>

##### space?

```ts
readonly optional space?: 1 | 2 | 4 | 6 | 3 | 8 | 5 | 7;
```

***

<a id="startedrex"></a>

### StartedRex

#### Properties

<a id="mode-1"></a>

##### mode

```ts
readonly mode: "hydrate" | "render";
```

<a id="root-3"></a>

##### root

```ts
readonly root: Root;
```

***

<a id="startrexoptions"></a>

### StartRexOptions

#### Extends

- [`RexEntryOptions`](#rexentryoptions)

#### Properties

<a id="actor-3"></a>

##### actor?

```ts
readonly optional actor?: Actor;
```

###### Inherited from

[`CreateRexAppOptions`](#createrexappoptions).[`actor`](#actor)

<a id="baseurl-3"></a>

##### baseUrl?

```ts
readonly optional baseUrl?: string;
```

###### Inherited from

[`CreateRexAppOptions`](#createrexappoptions).[`baseUrl`](#baseurl)

<a id="dev"></a>

##### dev?

```ts
readonly optional dev?: boolean;
```

<a id="fetch-3"></a>

##### fetch?

```ts
readonly optional fetch?: RexFetch;
```

###### Inherited from

[`CreateRexAppOptions`](#createrexappoptions).[`fetch`](#fetch)

<a id="link-1"></a>

##### link?

```ts
readonly optional link?: ClientLink<RexClientContext>;
```

###### Inherited from

[`CreateRexAppOptions`](#createrexappoptions).[`link`](#link)

<a id="onhydrationmismatch"></a>

##### onHydrationMismatch?

```ts
readonly optional onHydrationMismatch?: HydrationReporter;
```

<a id="onnavigate-1"></a>

##### onNavigate?

```ts
readonly optional onNavigate?: RexNavigateHook;
```

###### Inherited from

[`CreateRexAppOptions`](#createrexappoptions).[`onNavigate`](#onnavigate)

<a id="onoutcome-1"></a>

##### onOutcome?

```ts
readonly optional onOutcome?: RexOutcomeHook;
```

###### Inherited from

[`CreateRexAppOptions`](#createrexappoptions).[`onOutcome`](#onoutcome)

<a id="queryclient-1"></a>

##### queryClient?

```ts
readonly optional queryClient?: QueryClient;
```

###### Inherited from

[`CreateRexAppOptions`](#createrexappoptions).[`queryClient`](#queryclient)

***

<a id="storeoptions"></a>

### StoreOptions

#### Type Parameters

##### T

`T`

#### Properties

<a id="expose-1"></a>

##### expose?

```ts
readonly optional expose?: boolean;
```

<a id="initial"></a>

##### initial

```ts
readonly initial: T;
```

***

<a id="storeregistry"></a>

### StoreRegistry

#### Methods

<a id="exposed"></a>

##### exposed()

```ts
exposed(): Readonly<Record<string, unknown>>;
```

###### Returns

`Readonly`\<`Record`\<`string`, `unknown`\>\>

<a id="get-3"></a>

##### get()

```ts
get(id): RexStore<unknown> | undefined;
```

###### Parameters

###### id

`string`

###### Returns

[`RexStore`](#rexstore)\<`unknown`\> \| `undefined`

<a id="register-1"></a>

##### register()

```ts
register(entry): () => void;
```

###### Parameters

###### entry

[`RexStore`](#rexstore)\<`unknown`\>

###### Returns

() => `void`

<a id="subscribe-6"></a>

##### subscribe()

```ts
subscribe(listener): () => void;
```

###### Parameters

###### listener

`Listener`

###### Returns

() => `void`

<a id="tojson-2"></a>

##### toJSON()

```ts
toJSON(): Readonly<Record<string, unknown>>;
```

###### Returns

`Readonly`\<`Record`\<`string`, `unknown`\>\>

***

<a id="unsafehtmloptions"></a>

### UnsafeHtmlOptions

#### Properties

<a id="as"></a>

##### as?

```ts
readonly optional as?: "article" | "div" | "section" | "span";
```

<a id="classname"></a>

##### className?

```ts
readonly optional className?: string;
```

***

<a id="usedatastateoptions"></a>

### UseDataStateOptions

#### Properties

<a id="hasdata-2"></a>

##### hasData?

```ts
readonly optional hasData?: boolean;
```

<a id="policy-2"></a>

##### policy?

```ts
readonly optional policy?: Pick<PolicyResult, "allowed">;
```

***

<a id="viewcontext"></a>

### ViewContext

#### Type Parameters

##### P

`P` = [`PageParamsValue`](#pageparamsvalue)

#### Properties

<a id="params-6"></a>

##### params

```ts
readonly params: P;
```

<a id="state-5"></a>

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

## Type Aliases

<a id="actresult"></a>

### ActResult

```ts
type ActResult<A> = 
  | {
  ok: true;
  output: ActionOutput<A>;
}
  | {
  code: string;
  message: string;
  ok: false;
};
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

***

<a id="addresskind"></a>

### AddressKind

```ts
type AddressKind = keyof typeof ADDRESS_ATTRIBUTES;
```

***

<a id="apifetch"></a>

### ApiFetch

```ts
type ApiFetch = (input, init?) => Promise<Response>;
```

#### Parameters

##### input

`Request` \| `string` \| `URL`

##### init?

`RequestInit`

#### Returns

`Promise`\<`Response`\>

***

<a id="columns-1"></a>

### Columns

```ts
type Columns = typeof COLUMNS[number];
```

***

<a id="confirmfn"></a>

### ConfirmFn

```ts
type ConfirmFn = (request) => Promise<boolean>;
```

#### Parameters

##### request

[`ConfirmDialogRequest`](#confirmdialogrequest)

#### Returns

`Promise`\<`boolean`\>

***

<a id="confirmsubject"></a>

### ConfirmSubject

```ts
type ConfirmSubject = Pick<AnyAction, "id" | "label" | "effect">;
```

***

<a id="densitypreference"></a>

### DensityPreference

```ts
type DensityPreference = 
  | RexDensity
  | RexScreenDensity;
```

***

<a id="densitysource"></a>

### DensitySource

```ts
type DensitySource = "query" | "header" | "stored" | "default" | "set";
```

***

<a id="fetchstatus-2"></a>

### FetchStatus

```ts
type FetchStatus = "fetching" | "paused" | "idle";
```

***

<a id="fielderrors"></a>

### FieldErrors

```ts
type FieldErrors = Readonly<Record<string, readonly string[]>>;
```

***

<a id="flowclient"></a>

### FlowClient

```ts
type FlowClient = RouterClient<FlowRouter>;
```

***

<a id="flowdecisionresult"></a>

### FlowDecisionResult

```ts
type FlowDecisionResult = 
  | {
  ok: true;
  state: FlowState;
}
  | {
  code: string;
  message: string;
  ok: false;
};
```

***

<a id="formfieldcontrol-1"></a>

### FormFieldControl

```ts
type FormFieldControl = "text" | "number" | "checkbox" | "select" | "multiselect";
```

***

<a id="hrefresult"></a>

### HrefResult

```ts
type HrefResult = 
  | {
  href: string;
  ok: true;
}
  | {
  issues: readonly ParamIssue[];
  ok: false;
};
```

***

<a id="loaderaction"></a>

### LoaderAction

```ts
type LoaderAction<S> = S extends AnyAction ? S : S extends object ? A : never;
```

#### Type Parameters

##### S

`S`

***

<a id="loadername"></a>

### LoaderName

```ts
type LoaderName<Pg> = keyof PageLoad<Pg> & string;
```

#### Type Parameters

##### Pg

`Pg`

***

<a id="loaderoutput"></a>

### LoaderOutput

```ts
type LoaderOutput<S> = ActionOutput<LoaderAction<S>>;
```

#### Type Parameters

##### S

`S`

***

<a id="loaderparams"></a>

### LoaderParams

```ts
type LoaderParams = Readonly<Record<string, unknown>>;
```

***

<a id="loaderquerykey"></a>

### LoaderQueryKey

```ts
type LoaderQueryKey = readonly [typeof LOADER_QUERY_SCOPE, string, string, string];
```

***

<a id="loaderqueryoptions"></a>

### LoaderQueryOptions

```ts
type LoaderQueryOptions = UseQueryOptions<unknown, RexLoaderError, unknown, LoaderQueryKey>;
```

***

<a id="loaderresult"></a>

### LoaderResult

```ts
type LoaderResult<Pg, N> = UseQueryResult<LoaderOutput<PageLoad<Pg>[N]>, RexLoaderError>;
```

#### Type Parameters

##### Pg

`Pg`

##### N

`N` *extends* [`LoaderName`](#loadername)\<`Pg`\>

***

<a id="loaderresults"></a>

### LoaderResults

```ts
type LoaderResults<Pg> = { readonly [N in LoaderName<Pg>]: LoaderResult<Pg, N> };
```

#### Type Parameters

##### Pg

`Pg`

***

<a id="matchmedia-1"></a>

### MatchMedia

```ts
type MatchMedia = (query) => MediaQueryList;
```

#### Parameters

##### query

`string`

#### Returns

`MediaQueryList`

***

<a id="navigationlike"></a>

### NavigationLike

```ts
type NavigationLike = EventTarget;
```

***

<a id="navigationtype-1"></a>

### NavigationType

```ts
type NavigationType = "push" | "replace" | "reload" | "traverse";
```

***

<a id="navoutcome"></a>

### NavOutcome

```ts
type NavOutcome = 
  | {
  href: string;
  ok: true;
  page: string;
}
  | {
  issues: readonly ParamIssue[];
  message: string;
  ok: false;
  page: string | null;
};
```

***

<a id="navparamsarg"></a>

### NavParamsArg

```ts
type NavParamsArg<Pg> = object extends PageParamsInput<Pg> ? [PageParamsInput<Pg>] : [PageParamsInput<Pg>];
```

#### Type Parameters

##### Pg

`Pg` *extends* [`AnyPage`](../rex.md#anypage)

***

<a id="overlaycomponent"></a>

### OverlayComponent

```ts
type OverlayComponent = ComponentType & object;
```

#### Type Declaration

##### binding

```ts
readonly binding: OverlayBinding;
```

##### dismiss

```ts
readonly dismiss: OverlayDismiss;
```

##### overlayId

```ts
readonly overlayId: string;
```

##### rexKind

```ts
readonly rexKind: "overlay";
```

***

<a id="pageload"></a>

### PageLoad

```ts
type PageLoad<Pg> = Pg extends PageDeclaration<string, PageParamsSchema, RexDataState, string, string, AnyAction, infer L> ? L : never;
```

#### Type Parameters

##### Pg

`Pg`

***

<a id="pagemoduleset"></a>

### PageModuleSet

```ts
type PageModuleSet<Pg> = 
  | EagerPageModuleSet<Pg>
| LazyPageModuleSet<Pg>;
```

#### Type Parameters

##### Pg

`Pg` *extends* [`AnyPage`](../rex.md#anypage) = [`AnyPage`](../rex.md#anypage)

***

<a id="pageparamsvalue"></a>

### PageParamsValue

```ts
type PageParamsValue = Readonly<Record<string, unknown>>;
```

***

<a id="paramsresult"></a>

### ParamsResult

```ts
type ParamsResult = 
  | {
  ok: true;
  params: Readonly<Record<string, unknown>>;
}
  | {
  issues: readonly ParamIssue[];
  ok: false;
};
```

***

<a id="querystatus"></a>

### QueryStatus

```ts
type QueryStatus = "pending" | "error" | "success";
```

***

<a id="regioncomponent"></a>

### RegionComponent

```ts
type RegionComponent = ComponentType & object;
```

#### Type Declaration

##### regionName

```ts
readonly regionName: string;
```

##### rexKind

```ts
readonly rexKind: "region";
```

***

<a id="resizeobserverconstructor"></a>

### ResizeObserverConstructor

```ts
type ResizeObserverConstructor = (callback) => ResizeObserver;
```

#### Parameters

##### callback

`ResizeObserverCallback`

#### Returns

`ResizeObserver`

***

<a id="rexappcomponent"></a>

### RexAppComponent

```ts
type RexAppComponent = ComponentType<RexAppProps>;
```

***

<a id="rexclient"></a>

### RexClient

```ts
type RexClient = object;
```

#### Index Signature

```ts
[procedure: string]: RexProcedureClient
```

***

<a id="rexentryoptions"></a>

### RexEntryOptions

```ts
type RexEntryOptions = Omit<CreateRexAppOptions, "registry" | "manifest" | "density">;
```

***

<a id="rexfetch"></a>

### RexFetch

```ts
type RexFetch = (input, init?) => Promise<Response>;
```

#### Parameters

##### input

`Request` \| `string` \| `URL`

##### init?

`RequestInit`

#### Returns

`Promise`\<`Response`\>

***

<a id="rexnavigatehook"></a>

### RexNavigateHook

```ts
type RexNavigateHook = (event) => void;
```

#### Parameters

##### event

[`RexNavigateEvent`](#rexnavigateevent)

#### Returns

`void`

***

<a id="rexoutcomehook"></a>

### RexOutcomeHook

```ts
type RexOutcomeHook = (event) => void;
```

#### Parameters

##### event

[`RexOutcomeEvent`](#rexoutcomeevent)

#### Returns

`void`

***

<a id="rexprocedureclient"></a>

### RexProcedureClient

```ts
type RexProcedureClient = Client<RexClientContext, unknown, unknown, Error>;
```

***

<a id="rexreset"></a>

### RexReset

```ts
type RexReset = () => void;
```

#### Returns

`void`

***

<a id="routechange"></a>

### RouteChange

```ts
type RouteChange = (target, href, options) => void;
```

#### Parameters

##### target

[`AnyPage`](../rex.md#anypage)

##### href

`string`

##### options

###### replace

`boolean`

#### Returns

`void`

***

<a id="routerender"></a>

### RouteRender

```ts
type RouteRender = (resolution) => ReactNode;
```

#### Parameters

##### resolution

[`RouteResolution`](#routeresolution)

#### Returns

`ReactNode`

***

<a id="routeresolution"></a>

### RouteResolution

```ts
type RouteResolution = 
  | PageResolution
  | NotFoundResolution;
```

***

<a id="shellbuttonprops"></a>

### ShellButtonProps

```ts
type ShellButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
```

***

<a id="shellcomponentname"></a>

### ShellComponentName

```ts
type ShellComponentName = typeof SHELL_COMPONENT_NAMES[number];
```

***

<a id="shellcomponentsmodule"></a>

### ShellComponentsModule

```ts
type ShellComponentsModule = Readonly<Partial<ShellComponents>>;
```

***

<a id="shellnavform"></a>

### ShellNavForm

```ts
type ShellNavForm = typeof SHELL_NAV_FORMS[number];
```

***

<a id="shelloutcomeprops"></a>

### ShellOutcomeProps

```ts
type ShellOutcomeProps = OutcomeSlotProps;
```

***

<a id="shellsheetform"></a>

### ShellSheetForm

```ts
type ShellSheetForm = typeof SHELL_SHEET_FORMS[number];
```

***

<a id="space-4"></a>

### Space

```ts
type Space = typeof SPACES[number];
```

***

<a id="stateexportcomponent"></a>

### StateExportComponent

```ts
type StateExportComponent = ComponentType<StateProps<PageParamsValue>>;
```

***

<a id="storevalue"></a>

### StoreValue

```ts
type StoreValue<S> = S extends RexStore<infer T> ? T : never;
```

#### Type Parameters

##### S

`S`

***

<a id="unsafehtmltag"></a>

### UnsafeHtmlTag

```ts
type UnsafeHtmlTag = typeof UNSAFE_HTML_TAGS[number];
```

***

<a id="urlinvocation"></a>

### UrlInvocation

```ts
type UrlInvocation = 
  | {
  action: string;
  input: unknown;
  ok: true;
}
  | {
  action: string;
  error: string;
  ok: false;
};
```

***

<a id="viewcomponent"></a>

### ViewComponent

```ts
type ViewComponent = ComponentType & object;
```

#### Type Declaration

##### rexKind

```ts
readonly rexKind: "view";
```

***

<a id="viewtransitionhost"></a>

### ViewTransitionHost

```ts
type ViewTransitionHost = Partial<Pick<Document, "startViewTransition">>;
```

## Variables

<a id="act_query_key"></a>

### ACT\_QUERY\_KEY

```ts
const ACT_QUERY_KEY: "act" = "act";
```

***

<a id="action_field"></a>

### ACTION\_FIELD

```ts
const ACTION_FIELD: "_action" = "_action";
```

***

<a id="activeroutecontext"></a>

### ActiveRouteContext

```ts
const ActiveRouteContext: Context<RouteResolution | null>;
```

***

<a id="actor_header"></a>

### ACTOR\_HEADER

```ts
const ACTOR_HEADER: "x-rex-actor" = REX_ACTOR_HEADER;
```

***

<a id="address_attributes"></a>

### ADDRESS\_ATTRIBUTES

```ts
const ADDRESS_ATTRIBUTES: Readonly<{
  action: "data-rex";
  overlay: "data-rex-overlay";
  page: "data-rex-page";
  region: "data-rex-region";
}>;
```

***

<a id="address_kinds"></a>

### ADDRESS\_KINDS

```ts
const ADDRESS_KINDS: readonly AddressKind[];
```

***

<a id="addressscopecontext"></a>

### AddressScopeContext

```ts
const AddressScopeContext: Context<AddressScopeValue>;
```

***

<a id="affordanceregistrycontext"></a>

### AffordanceRegistryContext

```ts
const AffordanceRegistryContext: Context<AffordanceRegistry>;
```

***

<a id="api_credentials"></a>

### API\_CREDENTIALS

```ts
const API_CREDENTIALS: RequestCredentials = "include";
```

***

<a id="apifetch-1"></a>

### apiFetch

```ts
const apiFetch: ApiFetch;
```

***

<a id="app_outcome_key"></a>

### APP\_OUTCOME\_KEY

```ts
const APP_OUTCOME_KEY: "app" = "app";
```

***

<a id="cancelled"></a>

### CANCELLED

```ts
const CANCELLED: "CANCELLED" = "CANCELLED";
```

***

<a id="coarse_pointer_query"></a>

### COARSE\_POINTER\_QUERY

```ts
const COARSE_POINTER_QUERY: "(pointer: coarse)" = "(pointer: coarse)";
```

***

<a id="columns-2"></a>

### COLUMNS

```ts
const COLUMNS: readonly [1, 2, 3, 4];
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

<a id="confirmcontext"></a>

### ConfirmContext

```ts
const ConfirmContext: Context<ConfirmFn | null>;
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

<a id="csrftokencontext"></a>

### CsrfTokenContext

```ts
const CsrfTokenContext: Context<string | null>;
```

***

<a id="data_state_precedence"></a>

### DATA\_STATE\_PRECEDENCE

```ts
const DATA_STATE_PRECEDENCE: readonly RexDataState[];
```

***

<a id="default_list_size"></a>

### DEFAULT\_LIST\_SIZE

```ts
const DEFAULT_LIST_SIZE: 20 = 20;
```

***

<a id="default_pointer"></a>

### DEFAULT\_POINTER

```ts
const DEFAULT_POINTER: RexPointer = "fine";
```

***

<a id="default_screen"></a>

### DEFAULT\_SCREEN

```ts
const DEFAULT_SCREEN: RexScreen = "desktop";
```

***

<a id="default_screen_density"></a>

### DEFAULT\_SCREEN\_DENSITY

```ts
const DEFAULT_SCREEN_DENSITY: RexScreenDensity = "comfortable";
```

***

<a id="default_shell_components"></a>

### DEFAULT\_SHELL\_COMPONENTS

```ts
const DEFAULT_SHELL_COMPONENTS: ShellComponents;
```

***

<a id="default_space"></a>

### DEFAULT\_SPACE

```ts
const DEFAULT_SPACE: Space = 3;
```

***

<a id="defaultaffordanceregistry"></a>

### defaultAffordanceRegistry

```ts
const defaultAffordanceRegistry: AffordanceRegistry;
```

***

<a id="defaultoutcomestore"></a>

### defaultOutcomeStore

```ts
const defaultOutcomeStore: OutcomeStore;
```

***

<a id="defaultoverlayregistry"></a>

### defaultOverlayRegistry

```ts
const defaultOverlayRegistry: OverlayRegistry;
```

***

<a id="defaultregionfailureregistry"></a>

### defaultRegionFailureRegistry

```ts
const defaultRegionFailureRegistry: RegionFailureRegistry;
```

***

<a id="defaultstoreregistry"></a>

### defaultStoreRegistry

```ts
const defaultStoreRegistry: StoreRegistry;
```

***

<a id="density_attribute"></a>

### DENSITY\_ATTRIBUTE

```ts
const DENSITY_ATTRIBUTE: "data-rex-density" = SCREEN_ATTRIBUTES.density;
```

***

<a id="density_header"></a>

### DENSITY\_HEADER

```ts
const DENSITY_HEADER: "x-rex-density" = REX_DENSITY_HEADER;
```

***

<a id="density_preferences"></a>

### DENSITY\_PREFERENCES

```ts
const DENSITY_PREFERENCES: readonly DensityPreference[];
```

***

<a id="density_query_key"></a>

### DENSITY\_QUERY\_KEY

```ts
const DENSITY_QUERY_KEY: "density" = "density";
```

***

<a id="density_storage_key"></a>

### DENSITY\_STORAGE\_KEY

```ts
const DENSITY_STORAGE_KEY: "rex:density" = "rex:density";
```

***

<a id="densitycontext"></a>

### DensityContext

```ts
const DensityContext: Context<DensityValue | null>;
```

***

<a id="draft_query_key"></a>

### DRAFT\_QUERY\_KEY

```ts
const DRAFT_QUERY_KEY: "draft" = "draft";
```

***

<a id="flowclientcontext"></a>

### FlowClientContext

```ts
const FlowClientContext: Context<
  | {
  decide: ProcedureClient<Record<never, never>, ProtocolSchema<FlowDecideInput>, ProtocolSchema<FlowState>, Record<never, never>>;
  start: ProcedureClient<Record<never, never>, ProtocolSchema<FlowStartInput>, ProtocolSchema<FlowState>, Record<never, never>>;
  status: ProcedureClient<Record<never, never>, ProtocolSchema<FlowInstanceInput>, ProtocolSchema<FlowState>, Record<never, never>>;
}
| null>;
```

***

<a id="form_errors_key"></a>

### FORM\_ERRORS\_KEY

```ts
const FORM_ERRORS_KEY: "_form" = "_form";
```

***

<a id="input_query_key"></a>

### INPUT\_QUERY\_KEY

```ts
const INPUT_QUERY_KEY: "input" = "input";
```

***

<a id="list_empty_text"></a>

### LIST\_EMPTY\_TEXT

```ts
const LIST_EMPTY_TEXT: "Nothing to show" = "Nothing to show";
```

***

<a id="list_more_label"></a>

### LIST\_MORE\_LABEL

```ts
const LIST_MORE_LABEL: "Load more" = "Load more";
```

***

<a id="list_page_param"></a>

### LIST\_PAGE\_PARAM

```ts
const LIST_PAGE_PARAM: "page" = "page";
```

***

<a id="list_size_param"></a>

### LIST\_SIZE\_PARAM

```ts
const LIST_SIZE_PARAM: "size" = "size";
```

***

<a id="loader_query_scope"></a>

### LOADER\_QUERY\_SCOPE

```ts
const LOADER_QUERY_SCOPE: "loader" = "loader";
```

***

<a id="max_list_size"></a>

### MAX\_LIST\_SIZE

```ts
const MAX_LIST_SIZE: 100 = 100;
```

***

<a id="nav_address_attribute"></a>

### NAV\_ADDRESS\_ATTRIBUTE

```ts
const NAV_ADDRESS_ATTRIBUTE: "data-rex-nav" = "data-rex-nav";
```

***

<a id="not_found_title"></a>

### NOT\_FOUND\_TITLE

```ts
const NOT_FOUND_TITLE: "Page not found" = "Page not found";
```

***

<a id="outcome_cookie"></a>

### OUTCOME\_COOKIE

```ts
const OUTCOME_COOKIE: "rex-outcome" = "rex-outcome";
```

***

<a id="outcome_empty_text"></a>

### OUTCOME\_EMPTY\_TEXT

```ts
const OUTCOME_EMPTY_TEXT: "No action has run on this page yet." = "No action has run on this page yet.";
```

***

<a id="outcomestorecontext"></a>

### OutcomeStoreContext

```ts
const OutcomeStoreContext: Context<OutcomeStore>;
```

***

<a id="overlay_dismiss_label"></a>

### OVERLAY\_DISMISS\_LABEL

```ts
const OVERLAY_DISMISS_LABEL: "Close" = "Close";
```

***

<a id="overlay_form_attribute"></a>

### OVERLAY\_FORM\_ATTRIBUTE

```ts
const OVERLAY_FORM_ATTRIBUTE: "data-rex-overlay-form" = "data-rex-overlay-form";
```

***

<a id="overlay_query_key"></a>

### OVERLAY\_QUERY\_KEY

```ts
const OVERLAY_QUERY_KEY: "overlay" = "overlay";
```

***

<a id="overlayregistrycontext"></a>

### OverlayRegistryContext

```ts
const OverlayRegistryContext: Context<OverlayRegistry>;
```

***

<a id="page-26"></a>

### Page

```ts
const Page: Readonly<{
  Grid: (__namedParameters) => Element;
  List: <T>(__namedParameters) => Element | null;
  Outcome: (__namedParameters) => Element;
  Section: (__namedParameters) => Element;
  Stack: (__namedParameters) => Element;
}>;
```

***

<a id="pageinvokerscontext"></a>

### PageInvokersContext

```ts
const PageInvokersContext: Context<PageInvokerSet | null>;
```

***

<a id="pageruntimecontext"></a>

### PageRuntimeContext

```ts
const PageRuntimeContext: Context<PageRuntime | null>;
```

***

<a id="pagestatescontext"></a>

### PageStatesContext

```ts
const PageStatesContext: Context<Readonly<Record<string, unknown>> | null>;
```

***

<a id="palette_input"></a>

### PALETTE\_INPUT

```ts
const PALETTE_INPUT: Readonly<Record<string, never>>;
```

***

<a id="palette_label"></a>

### PALETTE\_LABEL

```ts
const PALETTE_LABEL: "Command palette" = "Command palette";
```

***

<a id="palette_shortcut"></a>

### PALETTE\_SHORTCUT

```ts
const PALETTE_SHORTCUT: "mod+k" = "mod+k";
```

***

<a id="palette_trigger_address"></a>

### PALETTE\_TRIGGER\_ADDRESS

```ts
const PALETTE_TRIGGER_ADDRESS: "palette" = "palette";
```

***

<a id="palette_trigger_attribute"></a>

### PALETTE\_TRIGGER\_ATTRIBUTE

```ts
const PALETTE_TRIGGER_ATTRIBUTE: "data-rex-palette-trigger" = "data-rex-palette-trigger";
```

***

<a id="pointer_attribute"></a>

### POINTER\_ATTRIBUTE

```ts
const POINTER_ATTRIBUTE: "data-rex-pointer" = SCREEN_ATTRIBUTES.pointer;
```

***

<a id="region_error_code"></a>

### REGION\_ERROR\_CODE

```ts
const REGION_ERROR_CODE: "REX330" = "REX330";
```

***

<a id="regionfailureregistrycontext"></a>

### RegionFailureRegistryContext

```ts
const RegionFailureRegistryContext: Context<RegionFailureRegistry>;
```

***

<a id="rex_form_prefix"></a>

### REX\_FORM\_PREFIX

```ts
const REX_FORM_PREFIX: "/rex/form" = "/rex/form";
```

***

<a id="rex_providers"></a>

### REX\_PROVIDERS

```ts
const REX_PROVIDERS: readonly RexProvider[];
```

***

<a id="rex_rpc_path"></a>

### REX\_RPC\_PATH

```ts
const REX_RPC_PATH: "/rex/rpc" = REX_RPC_PREFIX;
```

***

<a id="rexruntimecontext"></a>

### RexRuntimeContext

```ts
const RexRuntimeContext: Context<RexRuntime | null>;
```

***

<a id="route_focus_selectors"></a>

### ROUTE\_FOCUS\_SELECTORS

```ts
const ROUTE_FOCUS_SELECTORS: readonly ["[data-rex-shell] h1", "main h1", "h1", "main"];
```

***

<a id="routechangecontext"></a>

### RouteChangeContext

```ts
const RouteChangeContext: Context<RouteChange | null>;
```

***

<a id="routechangescontext"></a>

### RouteChangesContext

```ts
const RouteChangesContext: Context<number>;
```

***

<a id="screen_attribute"></a>

### SCREEN\_ATTRIBUTE

```ts
const SCREEN_ATTRIBUTE: "data-rex-screen" = SCREEN_ATTRIBUTES.screen;
```

***

<a id="screen_attributes"></a>

### SCREEN\_ATTRIBUTES

```ts
const SCREEN_ATTRIBUTES: Readonly<{
  density: "data-rex-density";
  pointer: "data-rex-pointer";
  screen: "data-rex-screen";
}>;
```

***

<a id="screen_breakpoints"></a>

### SCREEN\_BREAKPOINTS

```ts
const SCREEN_BREAKPOINTS: Readonly<{
  desktop: 1600;
  phone: 600;
  tablet: 1024;
}>;
```

***

<a id="screen_queries"></a>

### SCREEN\_QUERIES

```ts
const SCREEN_QUERIES: Readonly<Record<RexScreen, string>>;
```

***

<a id="screencontext"></a>

### ScreenContext

```ts
const ScreenContext: Context<ScreenState | null>;
```

***

<a id="screenseedcontext"></a>

### ScreenSeedContext

```ts
const ScreenSeedContext: Context<ScreenState | null>;
```

***

<a id="sheet_form_attribute"></a>

### SHEET\_FORM\_ATTRIBUTE

```ts
const SHEET_FORM_ATTRIBUTE: "data-rex-sheet-form" = "data-rex-sheet-form";
```

***

<a id="shell_component_names"></a>

### SHELL\_COMPONENT\_NAMES

```ts
const SHELL_COMPONENT_NAMES: readonly ["Button", "Sheet", "PaletteItem", "Outcome", "Frame", "Nav"];
```

***

<a id="shell_nav_forms"></a>

### SHELL\_NAV\_FORMS

```ts
const SHELL_NAV_FORMS: readonly ["bar", "sidebar", "dock"];
```

***

<a id="shell_sheet_forms"></a>

### SHELL\_SHEET\_FORMS

```ts
const SHELL_SHEET_FORMS: readonly ["dialog", "bottom-sheet"];
```

***

<a id="shell_slots"></a>

### SHELL\_SLOTS

```ts
const SHELL_SLOTS: readonly ShellSlot[];
```

***

<a id="shellcomponentscontext"></a>

### ShellComponentsContext

```ts
const ShellComponentsContext: Context<ShellComponents | null>;
```

***

<a id="shortcut_input"></a>

### SHORTCUT\_INPUT

```ts
const SHORTCUT_INPUT: Readonly<Record<string, never>>;
```

***

<a id="spaces"></a>

### SPACES

```ts
const SPACES: readonly [1, 2, 3, 4, 5, 6, 7, 8];
```

***

<a id="unknown_action"></a>

### UNKNOWN\_ACTION

```ts
const UNKNOWN_ACTION: "NOT_FOUND" = "NOT_FOUND";
```

***

<a id="unsafe_html_attribute"></a>

### UNSAFE\_HTML\_ATTRIBUTE

```ts
const UNSAFE_HTML_ATTRIBUTE: "data-rex-unsafe-html" = "data-rex-unsafe-html";
```

***

<a id="unsafe_html_tags"></a>

### UNSAFE\_HTML\_TAGS

```ts
const UNSAFE_HTML_TAGS: readonly ["div", "span", "section", "article"];
```

## Functions

<a id="actionattributes"></a>

### actionAttributes()

```ts
function actionAttributes(page, action): object;
```

#### Parameters

##### page

`string`

##### action

`string`

#### Returns

`object`

##### data-rex

```ts
readonly data-rex: string;
```

***

<a id="actionform"></a>

### ActionForm()

```ts
function ActionForm<A>(__namedParameters): Element | null;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Parameters

##### \_\_namedParameters

[`ActionFormProps`](#actionformprops)\<`A`\>

#### Returns

`Element` \| `null`

***

<a id="actionlabel"></a>

### actionLabel()

```ts
function actionLabel(declared): string;
```

#### Parameters

##### declared

[`AnyAction`](../rex.md#anyaction)

#### Returns

`string`

***

<a id="actionroutes"></a>

### actionRoutes()

```ts
function actionRoutes(declared): readonly ("url" | "key" | "click" | "palette")[];
```

#### Parameters

##### declared

[`AnyAction`](../rex.md#anyaction)

#### Returns

readonly (`"url"` \| `"key"` \| `"click"` \| `"palette"`)[]

***

<a id="addressscope"></a>

### AddressScope()

```ts
function AddressScope(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`AddressScopeProps`](#addressscopeprops)

#### Returns

`Element`

***

<a id="adoptserverloaders"></a>

### adoptServerLoaders()

```ts
function adoptServerLoaders(queryClient, state): void;
```

#### Parameters

##### queryClient

`QueryClient`

##### state

`DehydratedState`

#### Returns

`void`

***

<a id="affordanceregistryprovider"></a>

### AffordanceRegistryProvider()

```ts
function AffordanceRegistryProvider(__namedParameters): FunctionComponentElement<ProviderProps<AffordanceRegistry>>;
```

#### Parameters

##### \_\_namedParameters

[`AffordanceRegistryProviderProps`](#affordanceregistryproviderprops)

#### Returns

`FunctionComponentElement`\<`ProviderProps`\<[`AffordanceRegistry`](#affordanceregistry)\>\>

***

<a id="agentoutcome"></a>

### AgentOutcome()

```ts
function AgentOutcome(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`OutcomeSlotProps`](#outcomeslotprops)

#### Returns

`Element`

***

<a id="agentshell"></a>

### AgentShell()

```ts
function AgentShell(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`AgentShellProps`](#agentshellprops)

#### Returns

`Element`

***

<a id="ariakeyshortcuts"></a>

### ariaKeyShortcuts()

```ts
function ariaKeyShortcuts(shortcut): string;
```

#### Parameters

##### shortcut

`string`

#### Returns

`string`

***

<a id="buildsidecarpayload"></a>

### buildSidecarPayload()

```ts
function buildSidecarPayload(source): object;
```

#### Parameters

##### source

[`SidecarSource`](#sidecarsource)

#### Returns

`object`

##### actions

```ts
actions: object[];
```

##### density?

```ts
optional density?: "comfortable" | "compact" | "agent";
```

##### loaders?

```ts
optional loaders?: object[];
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

##### pointer?

```ts
optional pointer?: "coarse" | "fine";
```

##### regions?

```ts
optional regions?: object[];
```

##### screen?

```ts
optional screen?: "phone" | "tablet" | "desktop" | "wide";
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

<a id="checkmanifest"></a>

### checkManifest()

```ts
function checkManifest(manifest, registry): Manifest;
```

#### Parameters

##### manifest

[`Manifest`](../rex.md#manifest)

##### registry

[`RegistrySnapshot`](../rex.md#registrysnapshot)

#### Returns

[`Manifest`](../rex.md#manifest)

***

<a id="classifypointer"></a>

### classifyPointer()

```ts
function classifyPointer(coarse): "coarse" | "fine";
```

#### Parameters

##### coarse

`boolean`

#### Returns

`"coarse"` \| `"fine"`

***

<a id="classifyscreen"></a>

### classifyScreen()

```ts
function classifyScreen(width): "phone" | "tablet" | "desktop" | "wide";
```

#### Parameters

##### width

`number`

#### Returns

`"phone"` \| `"tablet"` \| `"desktop"` \| `"wide"`

***

<a id="coerceparam"></a>

### coerceParam()

```ts
function coerceParam(schema, raw): unknown;
```

#### Parameters

##### schema

[`JsonSchema`](schema.md#jsonschema) \| `undefined`

##### raw

`string`

#### Returns

`unknown`

***

<a id="columnsclass"></a>

### columnsClass()

```ts
function columnsClass(columns): string;
```

#### Parameters

##### columns

`1` \| `2` \| `3` \| `4`

#### Returns

`string`

***

<a id="composeproviders"></a>

### composeProviders()

```ts
function composeProviders(providers, children): ReactNode;
```

#### Parameters

##### providers

readonly [`RexProvider`](#rexprovider)[]

##### children

`ReactNode`

#### Returns

`ReactNode`

***

<a id="confirmprovider"></a>

### ConfirmProvider()

```ts
function ConfirmProvider(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`ConfirmProviderProps`](#confirmproviderprops)

#### Returns

`Element`

***

<a id="createaffordanceregistry"></a>

### createAffordanceRegistry()

```ts
function createAffordanceRegistry(): AffordanceRegistry;
```

#### Returns

[`AffordanceRegistry`](#affordanceregistry)

***

<a id="createflowclient"></a>

### createFlowClient()

```ts
function createFlowClient(options?): object;
```

#### Parameters

##### options?

[`FlowClientOptions`](#flowclientoptions) = `{}`

#### Returns

`object`

##### decide

```ts
decide: ProcedureClient<Record<never, never>, ProtocolSchema<FlowDecideInput>, ProtocolSchema<FlowState>, Record<never, never>>;
```

##### start

```ts
start: ProcedureClient<Record<never, never>, ProtocolSchema<FlowStartInput>, ProtocolSchema<FlowState>, Record<never, never>>;
```

##### status

```ts
status: ProcedureClient<Record<never, never>, ProtocolSchema<FlowInstanceInput>, ProtocolSchema<FlowState>, Record<never, never>>;
```

***

<a id="createoutcomestore"></a>

### createOutcomeStore()

```ts
function createOutcomeStore(): OutcomeStore;
```

#### Returns

[`OutcomeStore`](#outcomestore)

***

<a id="createoverlayregistry"></a>

### createOverlayRegistry()

```ts
function createOverlayRegistry(): OverlayRegistry;
```

#### Returns

[`OverlayRegistry`](#overlayregistry)

***

<a id="createregionfailureregistry"></a>

### createRegionFailureRegistry()

```ts
function createRegionFailureRegistry(): RegionFailureRegistry;
```

#### Returns

[`RegionFailureRegistry`](#regionfailureregistry)

***

<a id="createrexapp"></a>

### createRexApp()

```ts
function createRexApp(options): RexAppComponent;
```

#### Parameters

##### options

[`CreateRexAppOptions`](#createrexappoptions)

#### Returns

[`RexAppComponent`](#rexappcomponent)

***

<a id="createrexentry"></a>

### createRexEntry()

```ts
function createRexEntry(bundle, options?): ComponentType;
```

#### Parameters

##### bundle

[`RexEntryBundle`](#rexentrybundle)

##### options?

[`RexEntryOptions`](#rexentryoptions) = `{}`

#### Returns

`ComponentType`

***

<a id="createrexlink"></a>

### createRexLink()

```ts
function createRexLink(base, fetchImpl?): ClientLink<RexClientContext>;
```

#### Parameters

##### base

`string`

##### fetchImpl?

[`RexFetch`](#rexfetch)

#### Returns

`ClientLink`\<[`RexClientContext`](#rexclientcontext)\>

***

<a id="createscreensource"></a>

### createScreenSource()

```ts
function createScreenSource(options?): ScreenSource;
```

#### Parameters

##### options?

[`ScreenSourceOptions`](#screensourceoptions) = `{}`

#### Returns

[`ScreenSource`](#screensource)

***

<a id="createstoreregistry"></a>

### createStoreRegistry()

```ts
function createStoreRegistry(options?): StoreRegistry;
```

#### Parameters

##### options?

`StoreRegistryOptions` = `{}`

#### Returns

[`StoreRegistry`](#storeregistry)

***

<a id="credentialedfetch"></a>

### credentialedFetch()

```ts
function credentialedFetch(fetchImpl?): ApiFetch;
```

#### Parameters

##### fetchImpl?

[`ApiFetch`](#apifetch) = `...`

#### Returns

[`ApiFetch`](#apifetch)

***

<a id="datastateconditions"></a>

### dataStateConditions()

```ts
function dataStateConditions(input): ReadonlySet<
  | "loading"
  | "empty"
  | "stale"
  | "partial"
  | "offline"
  | "permission-denied"
  | "recoverable-error"
  | "terminal-error"
| "ready">;
```

#### Parameters

##### input

[`DataStateInput`](#datastateinput)

#### Returns

`ReadonlySet`\<
  \| `"loading"`
  \| `"empty"`
  \| `"stale"`
  \| `"partial"`
  \| `"offline"`
  \| `"permission-denied"`
  \| `"recoverable-error"`
  \| `"terminal-error"`
  \| `"ready"`\>

***

<a id="decodeactorheader"></a>

### decodeActorHeader()

```ts
function decodeActorHeader(value): Actor;
```

#### Parameters

##### value

`string`

#### Returns

[`Actor`](../rex.md#actor-1)

***

<a id="defaultscreensource"></a>

### defaultScreenSource()

```ts
function defaultScreenSource(): ScreenSource;
```

#### Returns

[`ScreenSource`](#screensource)

***

<a id="defaultstate"></a>

### DefaultState()

```ts
function DefaultState(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

`object` & [`StateProps`](../rex.md#stateprops)\<`Record`\<`string`, `unknown`\>\>

#### Returns

`Element`

***

<a id="definepagemodules"></a>

### definePageModules()

```ts
function definePageModules<Pg>(modules): EagerPageModuleSet<Pg>;
```

#### Type Parameters

##### Pg

`Pg` *extends* [`AnyPage`](../rex.md#anypage)

#### Parameters

##### modules

[`EagerPageModuleSet`](#eagerpagemoduleset)\<`Pg`\>

#### Returns

[`EagerPageModuleSet`](#eagerpagemoduleset)\<`Pg`\>

***

<a id="densityfromsearch"></a>

### densityFromSearch()

```ts
function densityFromSearch(search): string | null;
```

#### Parameters

##### search

`string`

#### Returns

`string` \| `null`

***

<a id="densityprovider"></a>

### DensityProvider()

```ts
function DensityProvider(__namedParameters): FunctionComponentElement<ProviderProps<DensityValue | null>>;
```

#### Parameters

##### \_\_namedParameters

[`DensityProviderProps`](#densityproviderprops)

#### Returns

`FunctionComponentElement`\<`ProviderProps`\<[`DensityValue`](#densityvalue) \| `null`\>\>

***

<a id="describeerror"></a>

### describeError()

```ts
function describeError(error): object;
```

#### Parameters

##### error

`unknown`

#### Returns

`object`

##### code

```ts
code: string;
```

##### message

```ts
message: string;
```

***

<a id="dismissesonbutton"></a>

### dismissesOnButton()

```ts
function dismissesOnButton(dismiss): boolean;
```

#### Parameters

##### dismiss

[`OverlayDismiss`](../rex.md#overlaydismiss)

#### Returns

`boolean`

***

<a id="dismissesonescape"></a>

### dismissesOnEscape()

```ts
function dismissesOnEscape(dismiss): boolean;
```

#### Parameters

##### dismiss

[`OverlayDismiss`](../rex.md#overlaydismiss)

#### Returns

`boolean`

***

<a id="draftstoragekey"></a>

### draftStorageKey()

```ts
function draftStorageKey(page): string;
```

#### Parameters

##### page

`string`

#### Returns

`string`

***

<a id="encodeactorheader"></a>

### encodeActorHeader()

```ts
function encodeActorHeader(subject): string;
```

#### Parameters

##### subject

[`ActorInput`](../rex.md#actorinput)

#### Returns

`string`

***

<a id="encodeoutcomecookie"></a>

### encodeOutcomeCookie()

```ts
function encodeOutcomeCookie(outcome): string;
```

#### Parameters

##### outcome

[`FormOutcome`](#formoutcome)

#### Returns

`string`

***

<a id="ensurecsrfcookie"></a>

### ensureCsrfCookie()

```ts
function ensureCsrfCookie(): string;
```

#### Returns

`string`

***

<a id="eventkeys"></a>

### eventKeys()

```ts
function eventKeys(event): readonly string[];
```

#### Parameters

##### event

[`ShortcutEventLike`](#shortcuteventlike)

#### Returns

readonly `string`[]

***

<a id="expandcollapsedgroups"></a>

### expandCollapsedGroups()

```ts
function expandCollapsedGroups(root): number;
```

#### Parameters

##### root

`ParentNode`

#### Returns

`number`

***

<a id="expirecookie"></a>

### expireCookie()

```ts
function expireCookie(name): void;
```

#### Parameters

##### name

`string`

#### Returns

`void`

***

<a id="fielderrors-1"></a>

### fieldErrors()

```ts
function fieldErrors(issues): FieldErrors;
```

#### Parameters

##### issues

readonly `StandardIssue`[]

#### Returns

[`FieldErrors`](#fielderrors)

***

<a id="fieldlabel"></a>

### fieldLabel()

```ts
function fieldLabel(name, schema): string;
```

#### Parameters

##### name

`string`

##### schema

[`JsonSchema`](schema.md#jsonschema)

#### Returns

`string`

***

<a id="findaddressed"></a>

### findAddressed()

```ts
function findAddressed(
   root, 
   kind, 
   address
): readonly Element[];
```

#### Parameters

##### root

`ParentNode`

##### kind

`"page"` \| `"action"` \| `"region"` \| `"overlay"`

##### address

`string`

#### Returns

readonly `Element`[]

***

<a id="findrootelement"></a>

### findRootElement()

```ts
function findRootElement(id, document?): Element;
```

#### Parameters

##### id

`string`

##### document?

`Document` = `globalThis.document`

#### Returns

`Element`

***

<a id="flowclientprovider"></a>

### FlowClientProvider()

```ts
function FlowClientProvider(__namedParameters): FunctionComponentElement<ProviderProps<
  | {
  decide: ProcedureClient<Record<never, never>, ProtocolSchema<FlowDecideInput>, ProtocolSchema<FlowState>, Record<never, never>>;
  start: ProcedureClient<Record<never, never>, ProtocolSchema<FlowStartInput>, ProtocolSchema<FlowState>, Record<never, never>>;
  status: ProcedureClient<Record<never, never>, ProtocolSchema<FlowInstanceInput>, ProtocolSchema<FlowState>, Record<never, never>>;
}
| null>>;
```

#### Parameters

##### \_\_namedParameters

[`FlowClientProviderProps`](#flowclientproviderprops)

#### Returns

`FunctionComponentElement`\<`ProviderProps`\<
  \| \{
  `decide`: `ProcedureClient`\<`Record`\<`never`, `never`\>, [`ProtocolSchema`](../rex.md#protocolschema)\<[`FlowDecideInput`](../rex.md#flowdecideinput)\>, [`ProtocolSchema`](../rex.md#protocolschema)\<[`FlowState`](../rex.md#flowstate)\>, `Record`\<`never`, `never`\>\>;
  `start`: `ProcedureClient`\<`Record`\<`never`, `never`\>, [`ProtocolSchema`](../rex.md#protocolschema)\<[`FlowStartInput`](../rex.md#flowstartinput)\>, [`ProtocolSchema`](../rex.md#protocolschema)\<[`FlowState`](../rex.md#flowstate)\>, `Record`\<`never`, `never`\>\>;
  `status`: `ProcedureClient`\<`Record`\<`never`, `never`\>, [`ProtocolSchema`](../rex.md#protocolschema)\<[`FlowInstanceInput`](../rex.md#flowinstanceinput-1)\>, [`ProtocolSchema`](../rex.md#protocolschema)\<[`FlowState`](../rex.md#flowstate)\>, `Record`\<`never`, `never`\>\>;
\}
  \| `null`\>\>

***

<a id="focusroutetarget"></a>

### focusRouteTarget()

```ts
function focusRouteTarget(root?): HTMLElement | null;
```

#### Parameters

##### root?

`ParentNode` = `document`

#### Returns

`HTMLElement` \| `null`

***

<a id="formactionpath"></a>

### formActionPath()

```ts
function formActionPath(actionId): string;
```

#### Parameters

##### actionId

`string`

#### Returns

`string`

***

<a id="formfields"></a>

### formFields()

```ts
function formFields(schema, prefix?): readonly FormField[];
```

#### Parameters

##### schema

[`JsonSchema`](schema.md#jsonschema)

##### prefix?

`string` = `""`

#### Returns

readonly [`FormField`](#formfield)[]

***

<a id="forminput"></a>

### formInput()

```ts
function formInput(schema, data): Record<string, unknown>;
```

#### Parameters

##### schema

[`JsonSchema`](schema.md#jsonschema)

##### data

`FormData`

#### Returns

`Record`\<`string`, `unknown`\>

***

<a id="gateaffordanceid"></a>

### gateAffordanceId()

```ts
function gateAffordanceId(
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

<a id="gatelabel"></a>

### gateLabel()

```ts
function gateLabel(gate, decision): string;
```

#### Parameters

##### gate

[`ApprovalStep`](../rex.md#approvalstep)

##### decision

[`FlowDecision`](../rex.md#flowdecision)

#### Returns

`string`

***

<a id="hascontent"></a>

### hasContent()

```ts
function hasContent(data): boolean;
```

#### Parameters

##### data

`unknown`

#### Returns

`boolean`

***

<a id="inputproblem"></a>

### inputProblem()

```ts
function inputProblem(declared, input): Promise<string | null>;
```

#### Parameters

##### declared

[`AnyAction`](../rex.md#anyaction)

##### input

`unknown`

#### Returns

`Promise`\<`string` \| `null`\>

***

<a id="invalidatesloaderquery"></a>

### invalidatesLoaderQuery()

```ts
function invalidatesLoaderQuery(
   registry, 
   key, 
   mutating
): boolean;
```

#### Parameters

##### registry

[`RegistrySnapshot`](../rex.md#registrysnapshot)

##### key

readonly `unknown`[]

##### mutating

[`AnyAction`](../rex.md#anyaction)

#### Returns

`boolean`

***

<a id="isappleplatform"></a>

### isApplePlatform()

```ts
function isApplePlatform(): boolean;
```

#### Returns

`boolean`

***

<a id="isdefaultshellcomponent"></a>

### isDefaultShellComponent()

```ts
function isDefaultShellComponent<Name>(name, component): boolean;
```

#### Type Parameters

##### Name

`Name` *extends* `"Outcome"` \| `"Nav"` \| `"Button"` \| `"Sheet"` \| `"PaletteItem"` \| `"Frame"`

#### Parameters

##### name

`Name`

##### component

[`ShellComponents`](#shellcomponents)\[`Name`\]

#### Returns

`boolean`

***

<a id="isdensitypreference"></a>

### isDensityPreference()

```ts
function isDensityPreference(value): value is DensityPreference;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is DensityPreference`

***

<a id="islazypagemodules"></a>

### isLazyPageModules()

```ts
function isLazyPageModules(modules): modules is LazyPageModuleSet<AnyPage>;
```

#### Parameters

##### modules

[`PageModuleSet`](#pagemoduleset)

#### Returns

`modules is LazyPageModuleSet<AnyPage>`

***

<a id="isloaderquerykey"></a>

### isLoaderQueryKey()

```ts
function isLoaderQueryKey(key): key is LoaderQueryKey;
```

#### Parameters

##### key

readonly `unknown`[]

#### Returns

`key is LoaderQueryKey`

***

<a id="ismodshortcut"></a>

### isModShortcut()

```ts
function isModShortcut(event, key): boolean;
```

#### Parameters

##### event

[`ShortcutEventLike`](#shortcuteventlike)

##### key

`string`

#### Returns

`boolean`

***

<a id="isnavigable"></a>

### isNavigable()

```ts
function isNavigable(declared): boolean;
```

#### Parameters

##### declared

[`AnyPage`](../rex.md#anypage)

#### Returns

`boolean`

***

<a id="isrexpointer"></a>

### isRexPointer()

```ts
function isRexPointer(value): value is "coarse" | "fine";
```

#### Parameters

##### value

`unknown`

#### Returns

value is "coarse" \| "fine"

***

<a id="isrexscreen"></a>

### isRexScreen()

```ts
function isRexScreen(value): value is "phone" | "tablet" | "desktop" | "wide";
```

#### Parameters

##### value

`unknown`

#### Returns

value is "phone" \| "tablet" \| "desktop" \| "wide"

***

<a id="isrexscreendensity"></a>

### isRexScreenDensity()

```ts
function isRexScreenDensity(value): value is "comfortable" | "compact" | "agent";
```

#### Parameters

##### value

`unknown`

#### Returns

value is "comfortable" \| "compact" \| "agent"

***

<a id="isserverseeded"></a>

### isServerSeeded()

```ts
function isServerSeeded(query): boolean;
```

#### Parameters

##### query

[`SeededCandidate`](#seededcandidate)

#### Returns

`boolean`

***

<a id="isterminalerror"></a>

### isTerminalError()

```ts
function isTerminalError(error): boolean;
```

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

<a id="listparamnames-1"></a>

### listParamNames()

```ts
function listParamNames(params?): ListParamNames;
```

#### Parameters

##### params?

`Partial`\<[`ListParamNames`](#listparamnames)\> = `{}`

#### Returns

[`ListParamNames`](#listparamnames)

***

<a id="listsearch"></a>

### listSearch()

```ts
function listSearch(
   search, 
   names, 
   params
): string;
```

#### Parameters

##### search

`string`

##### names

[`ListParamNames`](#listparamnames)

##### params

[`ListParams`](#listparams)

#### Returns

`string`

***

<a id="listwindow-1"></a>

### listWindow()

```ts
function listWindow(total, params): ListWindow;
```

#### Parameters

##### total

`number`

##### params

[`ListParams`](#listparams)

#### Returns

[`ListWindow`](#listwindow)

***

<a id="loadererror"></a>

### loaderError()

```ts
function loaderError(
   page, 
   loader, 
   error
): RexLoaderError;
```

#### Parameters

##### page

`string`

##### loader

`string`

##### error

`unknown`

#### Returns

[`RexLoaderError`](#rexloadererror)

***

<a id="loaderinput"></a>

### loaderInput()

```ts
function loaderInput(loader, params): unknown;
```

#### Parameters

##### loader

[`PageLoader`](../rex.md#pageloader)

##### params

[`LoaderParams`](#loaderparams)

#### Returns

`unknown`

***

<a id="loaderinputdigest"></a>

### loaderInputDigest()

```ts
function loaderInputDigest(input): string;
```

#### Parameters

##### input

`unknown`

#### Returns

`string`

***

<a id="loaderinvalidatedby"></a>

### loaderInvalidatedBy()

```ts
function loaderInvalidatedBy(
   declared, 
   loaderName, 
   mutating
): boolean;
```

#### Parameters

##### declared

[`AnyPage`](../rex.md#anypage)

##### loaderName

`string`

##### mutating

[`AnyAction`](../rex.md#anyaction)

#### Returns

`boolean`

***

<a id="loaderquerykey-1"></a>

### loaderQueryKey()

```ts
function loaderQueryKey(
   page, 
   loader, 
   input
): LoaderQueryKey;
```

#### Parameters

##### page

`string`

##### loader

`string`

##### input

`unknown`

#### Returns

[`LoaderQueryKey`](#loaderquerykey)

***

<a id="loaderqueryoptions-1"></a>

### loaderQueryOptions()

```ts
function loaderQueryOptions(source): LoaderQueryOptions;
```

#### Parameters

##### source

[`LoaderQueryOptionsInput`](#loaderqueryoptionsinput)

#### Returns

[`LoaderQueryOptions`](#loaderqueryoptions)

***

<a id="manifestinputschema"></a>

### manifestInputSchema()

```ts
function manifestInputSchema(manifest, declared): JsonSchema;
```

#### Parameters

##### manifest

[`Manifest`](../rex.md#manifest)

##### declared

[`AnyAction`](../rex.md#anyaction)

#### Returns

[`JsonSchema`](schema.md#jsonschema)

***

<a id="manifestparamsschema"></a>

### manifestParamsSchema()

```ts
function manifestParamsSchema(manifest, declared): JsonSchema;
```

#### Parameters

##### manifest

[`Manifest`](../rex.md#manifest)

##### declared

[`AnyPage`](../rex.md#anypage)

#### Returns

[`JsonSchema`](schema.md#jsonschema)

***

<a id="matchesshortcut"></a>

### matchesShortcut()

```ts
function matchesShortcut(event, shortcut): boolean;
```

#### Parameters

##### event

[`ShortcutEventLike`](#shortcuteventlike)

##### shortcut

[`ParsedShortcut`](../rex.md#parsedshortcut)

#### Returns

`boolean`

***

<a id="navformfor"></a>

### navFormFor()

```ts
function navFormFor(screen): "sidebar" | "bar" | "dock";
```

#### Parameters

##### screen

`"phone"` \| `"tablet"` \| `"desktop"` \| `"wide"`

#### Returns

`"sidebar"` \| `"bar"` \| `"dock"`

***

<a id="navigationhost"></a>

### navigationHost()

```ts
function navigationHost(): EventTarget | undefined;
```

#### Returns

`EventTarget` \| `undefined`

***

<a id="notfound"></a>

### NotFound()

```ts
function NotFound(__namedParameters): Element | null;
```

#### Parameters

##### \_\_namedParameters

###### path

`string`

#### Returns

`Element` \| `null`

***

<a id="observeoutcomes"></a>

### observeOutcomes()

```ts
function observeOutcomes(store, onOutcome): OutcomeStore;
```

#### Parameters

##### store

[`OutcomeStore`](#outcomestore)

##### onOutcome

[`RexOutcomeHook`](#rexoutcomehook)

#### Returns

[`OutcomeStore`](#outcomestore)

***

<a id="openoverlaysfromsearch"></a>

### openOverlaysFromSearch()

```ts
function openOverlaysFromSearch(search): readonly string[];
```

#### Parameters

##### search

`string`

#### Returns

readonly `string`[]

***

<a id="openpalette"></a>

### openPalette()

```ts
function openPalette(): void;
```

#### Returns

`void`

***

<a id="orderpages"></a>

### orderPages()

```ts
function orderPages(pages): readonly AnyPage[];
```

#### Parameters

##### pages

readonly [`AnyPage`](../rex.md#anypage)[]

#### Returns

readonly [`AnyPage`](../rex.md#anypage)[]

***

<a id="outcomeerrors"></a>

### outcomeErrors()

```ts
function outcomeErrors(outcome, actionId): Readonly<Record<string, readonly string[]>> | null;
```

#### Parameters

##### outcome

[`Outcome`](#outcome) \| `null`

##### actionId

`string`

#### Returns

`Readonly`\<`Record`\<`string`, readonly `string`[]\>\> \| `null`

***

<a id="outcomeprovider"></a>

### OutcomeProvider()

```ts
function OutcomeProvider(__namedParameters): FunctionComponentElement<ProviderProps<OutcomeStore>>;
```

#### Parameters

##### \_\_namedParameters

[`OutcomeProviderProps`](#outcomeproviderprops)

#### Returns

`FunctionComponentElement`\<`ProviderProps`\<[`OutcomeStore`](#outcomestore)\>\>

***

<a id="outcomeregion"></a>

### OutcomeRegion()

```ts
function OutcomeRegion(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`OutcomeRegionProps`](#outcomeregionprops)

#### Returns

`Element`

***

<a id="outcomestatustext"></a>

### outcomeStatusText()

```ts
function outcomeStatusText(outcome): "Succeeded" | "Failed";
```

#### Parameters

##### outcome

`Pick`\<[`Outcome`](#outcome), `"ok"`\>

#### Returns

`"Succeeded"` \| `"Failed"`

***

<a id="overlay-2"></a>

### overlay()

```ts
function overlay(
   id, 
   options, 
   render
): OverlayComponent;
```

#### Parameters

##### id

`string`

##### options

[`OverlayOptions`](#overlayoptions)

##### render

(`ctx`) => `ReactNode`

#### Returns

[`OverlayComponent`](#overlaycomponent)

***

<a id="overlayattributes"></a>

### overlayAttributes()

```ts
function overlayAttributes(page, overlay): object;
```

#### Parameters

##### page

`string`

##### overlay

`string`

#### Returns

`object`

##### data-rex-overlay

```ts
readonly data-rex-overlay: string;
```

***

<a id="overlayregistryprovider"></a>

### OverlayRegistryProvider()

```ts
function OverlayRegistryProvider(__namedParameters): FunctionComponentElement<ProviderProps<OverlayRegistry>>;
```

#### Parameters

##### \_\_namedParameters

[`OverlayRegistryProviderProps`](#overlayregistryproviderprops)

#### Returns

`FunctionComponentElement`\<`ProviderProps`\<[`OverlayRegistry`](#overlayregistry)\>\>

***

<a id="overlaysentence"></a>

### overlaySentence()

```ts
function overlaySentence(id): string;
```

#### Parameters

##### id

`string`

#### Returns

`string`

***

<a id="pageatpath"></a>

### pageAtPath()

```ts
function pageAtPath(
   registry, 
   parser, 
   path
): string | null;
```

#### Parameters

##### registry

[`RegistrySnapshot`](../rex.md#registrysnapshot)

##### parser

`Parser`

##### path

`string`

#### Returns

`string` \| `null`

***

<a id="pageattributes"></a>

### pageAttributes()

```ts
function pageAttributes(page): object;
```

#### Parameters

##### page

`string`

#### Returns

`object`

##### data-rex-page

```ts
readonly data-rex-page: string;
```

***

<a id="pagehost"></a>

### PageHost()

```ts
function PageHost(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`PageHostProps`](#pagehostprops)

#### Returns

`Element`

***

<a id="pagehref"></a>

### pageHref()

```ts
function pageHref(
   declared, 
   params, 
   extra, 
   paramsSchema
): HrefResult;
```

#### Parameters

##### declared

[`AnyPage`](../rex.md#anypage)

##### params

`unknown`

##### extra

`Readonly`\<`Record`\<`string`, `string`\>\>

##### paramsSchema

[`JsonSchema`](schema.md#jsonschema)

#### Returns

[`HrefResult`](#hrefresult)

***

<a id="pageinvokers"></a>

### PageInvokers()

```ts
function PageInvokers(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`PageInvokersProps`](#pageinvokersprops)

#### Returns

`Element`

***

<a id="pageloader"></a>

### pageLoader()

```ts
function pageLoader(declared, name): PageLoader;
```

#### Parameters

##### declared

[`AnyPage`](../rex.md#anypage)

##### name

`string`

#### Returns

[`PageLoader`](../rex.md#pageloader)

***

<a id="pageloaderqueryhashes"></a>

### pageLoaderQueryHashes()

```ts
function pageLoaderQueryHashes(declared, params): readonly string[];
```

#### Parameters

##### declared

[`AnyPage`](../rex.md#anypage)

##### params

[`LoaderParams`](#loaderparams)

#### Returns

readonly `string`[]

***

<a id="pageloaderquerykey"></a>

### pageLoaderQueryKey()

```ts
function pageLoaderQueryKey(
   declared, 
   loader, 
   params
): LoaderQueryKey;
```

#### Parameters

##### declared

[`AnyPage`](../rex.md#anypage)

##### loader

[`PageLoader`](../rex.md#pageloader)

##### params

[`LoaderParams`](#loaderparams)

#### Returns

[`LoaderQueryKey`](#loaderquerykey)

***

<a id="pagequeryscope"></a>

### pageQueryScope()

```ts
function pageQueryScope(resolution): string;
```

#### Parameters

##### resolution

[`PageResolution`](#pageresolution)

#### Returns

`string`

***

<a id="palettetrigger"></a>

### paletteTrigger()

```ts
function paletteTrigger(): ShellPaletteTriggerProps;
```

#### Returns

[`ShellPaletteTriggerProps`](#shellpalettetriggerprops)

***

<a id="palettevalue"></a>

### paletteValue()

```ts
function paletteValue(kind, id): string;
```

#### Parameters

##### kind

`"page"` \| `"action"`

##### id

`string`

#### Returns

`string`

***

<a id="paramkeyaccepted"></a>

### paramKeyAccepted()

```ts
function paramKeyAccepted(schema, key): boolean;
```

#### Parameters

##### schema

[`JsonSchema`](schema.md#jsonschema)

##### key

`string`

#### Returns

`boolean`

***

<a id="parsemanifest"></a>

### parseManifest()

```ts
function parseManifest(value): Manifest;
```

#### Parameters

##### value

`unknown`

#### Returns

[`Manifest`](../rex.md#manifest)

***

<a id="parseoutcomecookie"></a>

### parseOutcomeCookie()

```ts
function parseOutcomeCookie(value): FormOutcome | null;
```

#### Parameters

##### value

`string`

#### Returns

[`FormOutcome`](#formoutcome) \| `null`

***

<a id="parsepageparams"></a>

### parsePageParams()

```ts
function parsePageParams(
   declared, 
   routeParams, 
   search, 
   paramsSchema
): ParamsResult;
```

#### Parameters

##### declared

[`AnyPage`](../rex.md#anypage)

##### routeParams

`Readonly`\<`Record`\<`string`, `string` \| `undefined`\>\>

##### search

`string`

##### paramsSchema

[`JsonSchema`](schema.md#jsonschema)

#### Returns

[`ParamsResult`](#paramsresult)

***

<a id="parseurlinvocation"></a>

### parseUrlInvocation()

```ts
function parseUrlInvocation(search): UrlInvocation | null;
```

#### Parameters

##### search

`string`

#### Returns

[`UrlInvocation`](#urlinvocation) \| `null`

***

<a id="procedureof"></a>

### procedureOf()

```ts
function procedureOf(client, id): RexProcedureClient;
```

#### Parameters

##### client

[`RexClient`](#rexclient)

##### id

`string`

#### Returns

[`RexProcedureClient`](#rexprocedureclient)

***

<a id="readaddresses"></a>

### readAddresses()

```ts
function readAddresses(root): readonly FoundAddress[];
```

#### Parameters

##### root

`ParentNode`

#### Returns

readonly [`FoundAddress`](#foundaddress)[]

***

<a id="readcookie"></a>

### readCookie()

```ts
function readCookie(name, source): string | null;
```

#### Parameters

##### name

`string`

##### source

`string`

#### Returns

`string` \| `null`

***

<a id="readlistparams"></a>

### readListParams()

```ts
function readListParams(
   search, 
   size?, 
   names?
): ListParams;
```

#### Parameters

##### search

`string`

##### size?

`number` = `DEFAULT_LIST_SIZE`

##### names?

[`ListParamNames`](#listparamnames) = `...`

#### Returns

[`ListParams`](#listparams)

***

<a id="readonline"></a>

### readOnline()

```ts
function readOnline(source?): boolean;
```

#### Parameters

##### source?

  \| \{
  `onLine?`: `unknown`;
\}
  \| `undefined`

#### Returns

`boolean`

***

<a id="readrootscreen"></a>

### readRootScreen()

```ts
function readRootScreen(root): ScreenState | null;
```

#### Parameters

##### root

`Element` \| `null` \| `undefined`

#### Returns

[`ScreenState`](#screenstate) \| `null`

***

<a id="readsidecar"></a>

### readSidecar()

```ts
function readSidecar(root?): unknown;
```

#### Parameters

##### root?

`ParentNode` = `globalThis.document`

#### Returns

`unknown`

***

<a id="readstoreddensity"></a>

### readStoredDensity()

```ts
function readStoredDensity(): string | null;
```

#### Returns

`string` \| `null`

***

<a id="region-5"></a>

### region()

```ts
function region<P>(name, render): RegionComponent;
```

#### Type Parameters

##### P

`P` = `Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Parameters

##### name

`string`

##### render

(`ctx`) => `ReactNode`

#### Returns

[`RegionComponent`](#regioncomponent)

***

<a id="region-8"></a>

### Region()

```ts
function Region(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`RegionProps`](#regionprops)

#### Returns

`Element`

***

<a id="regionattributes"></a>

### regionAttributes()

```ts
function regionAttributes(page, region): object;
```

#### Parameters

##### page

`string`

##### region

`string`

#### Returns

`object`

##### data-rex-region

```ts
readonly data-rex-region: string;
```

***

<a id="regionboundary"></a>

### RegionBoundary()

```ts
function RegionBoundary(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`RegionBoundaryProps`](#regionboundaryprops)

#### Returns

`Element`

***

<a id="regionfailuremessage-1"></a>

### regionFailureMessage()

```ts
function regionFailureMessage(address, error): string;
```

#### Parameters

##### address

`string`

##### error

`Error`

#### Returns

`string`

***

<a id="registerreset"></a>

### registerReset()

```ts
function registerReset(reset): () => void;
```

#### Parameters

##### reset

[`RexReset`](#rexreset)

#### Returns

() => `void`

***

<a id="registershellcomponents"></a>

### registerShellComponents()

```ts
function registerShellComponents(module): () => void;
```

#### Parameters

##### module

`unknown`

#### Returns

() => `void`

***

<a id="resetall"></a>

### resetAll()

```ts
function resetAll(): void;
```

#### Returns

`void`

***

<a id="resolvedatastate"></a>

### resolveDataState()

```ts
function resolveDataState(input): 
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

#### Parameters

##### input

[`DataStateInput`](#datastateinput)

#### Returns

  \| `"loading"`
  \| `"empty"`
  \| `"stale"`
  \| `"partial"`
  \| `"offline"`
  \| `"permission-denied"`
  \| `"recoverable-error"`
  \| `"terminal-error"`
  \| `"ready"`

***

<a id="resolvedensity"></a>

### resolveDensity()

```ts
function resolveDensity(inputs): ResolvedDensity;
```

#### Parameters

##### inputs

[`DensityInputs`](#densityinputs)

#### Returns

[`ResolvedDensity`](#resolveddensity)

***

<a id="resolvepage"></a>

### resolvePage()

```ts
function resolvePage(
   declared, 
   routeParams, 
   search, 
   subject, 
   registry, 
   paramsSchema
): PageResolution;
```

#### Parameters

##### declared

[`AnyPage`](../rex.md#anypage)

##### routeParams

`Readonly`\<`Record`\<`string`, `string` \| `undefined`\>\>

##### search

`string`

##### subject

[`Actor`](../rex.md#actor-1)

##### registry

[`RegistrySnapshot`](../rex.md#registrysnapshot)

##### paramsSchema

[`JsonSchema`](schema.md#jsonschema)

#### Returns

[`PageResolution`](#pageresolution)

***

<a id="resolveshellcomponents"></a>

### resolveShellComponents()

```ts
function resolveShellComponents(module, base?): ShellComponents;
```

#### Parameters

##### module

`unknown`

##### base?

[`ShellComponents`](#shellcomponents) = `DEFAULT_SHELL_COMPONENTS`

#### Returns

[`ShellComponents`](#shellcomponents)

***

<a id="reviveloadererror"></a>

### reviveLoaderError()

```ts
function reviveLoaderError(key, value): RexLoaderError;
```

#### Parameters

##### key

[`LoaderQueryKey`](#loaderquerykey)

##### value

`unknown`

#### Returns

[`RexLoaderError`](#rexloadererror)

***

<a id="rexpalette"></a>

### RexPalette()

```ts
function RexPalette(__namedParameters): Element | null;
```

#### Parameters

##### \_\_namedParameters

[`RexPaletteProps`](#rexpaletteprops)

#### Returns

`Element` \| `null`

***

<a id="rexproviders"></a>

### RexProviders()

```ts
function RexProviders(__namedParameters): ReactNode;
```

#### Parameters

##### \_\_namedParameters

[`RexProviderProps`](#rexproviderprops)

#### Returns

`ReactNode`

***

<a id="rexroutes"></a>

### RexRoutes()

```ts
function RexRoutes(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`RexRoutesProps`](#rexroutesprops)

#### Returns

`Element`

***

<a id="rexshortcuts"></a>

### RexShortcuts()

```ts
function RexShortcuts(): null;
```

#### Returns

`null`

***

<a id="rexsidecar"></a>

### RexSidecar()

```ts
function RexSidecar(): Element | null;
```

#### Returns

`Element` \| `null`

***

<a id="rexurlinvoke"></a>

### RexUrlInvoke()

```ts
function RexUrlInvoke(): null;
```

#### Returns

`null`

***

<a id="routabledestination-1"></a>

### routableDestination()

```ts
function routableDestination(event, __namedParameters): RoutableDestination | null;
```

#### Parameters

##### event

[`NavigateEventLike`](#navigateeventlike)

##### \_\_namedParameters

[`DestinationScope`](#destinationscope)

#### Returns

[`RoutableDestination`](#routabledestination) \| `null`

***

<a id="runroutechange"></a>

### runRouteChange()

```ts
function runRouteChange(
   transition, 
   update, 
   host?
): void;
```

#### Parameters

##### transition

`"none"` \| `"view"`

##### update

() => `void`

##### host?

`Partial`\<`Pick`\<`Document`, `"startViewTransition"`\>\> \| `undefined`

#### Returns

`void`

***

<a id="screenattributes"></a>

### screenAttributes()

```ts
function screenAttributes(state): Readonly<Record<string, string>>;
```

#### Parameters

##### state

[`ScreenState`](#screenstate)

#### Returns

`Readonly`\<`Record`\<`string`, `string`\>\>

***

<a id="screendensity-1"></a>

### screenDensity()

```ts
function screenDensity(preference): "comfortable" | "compact" | "agent";
```

#### Parameters

##### preference

`string` \| `null` \| `undefined`

#### Returns

`"comfortable"` \| `"compact"` \| `"agent"`

***

<a id="screenprovider"></a>

### ScreenProvider()

```ts
function ScreenProvider(__namedParameters): FunctionComponentElement<ProviderProps<ScreenState | null>>;
```

#### Parameters

##### \_\_namedParameters

[`ScreenProviderProps`](#screenproviderprops)

#### Returns

`FunctionComponentElement`\<`ProviderProps`\<[`ScreenState`](#screenstate) \| `null`\>\>

***

<a id="searchwithoverlay"></a>

### searchWithOverlay()

```ts
function searchWithOverlay(
   search, 
   id, 
   open
): string;
```

#### Parameters

##### search

`string`

##### id

`string`

##### open

`boolean`

#### Returns

`string`

***

<a id="serializesidecar"></a>

### serializeSidecar()

```ts
function serializeSidecar(payload): string;
```

#### Parameters

##### payload

###### actions

`object`[] = `...`

###### density?

`"comfortable"` \| `"compact"` \| `"agent"` = `...`

###### loaders?

`object`[] = `...`

###### outcome

  \| \{
  `action`: `string`;
  `at`: `string`;
  `message`: `string`;
  `ok`: `boolean`;
\}
  \| `null` = `...`

###### overlays

`object`[] = `...`

###### page

`string` = `...`

###### params

`Record`\<`string`, `unknown`\> = `...`

###### pointer?

`"coarse"` \| `"fine"` = `...`

###### regions?

`object`[] = `...`

###### screen?

`"phone"` \| `"tablet"` \| `"desktop"` \| `"wide"` = `...`

###### state

  \| `"loading"`
  \| `"empty"`
  \| `"stale"`
  \| `"partial"`
  \| `"offline"`
  \| `"permission-denied"`
  \| `"recoverable-error"`
  \| `"terminal-error"`
  \| `"ready"` = `...`

###### stores?

`Record`\<`string`, `unknown`\> = `...`

###### version

`1` = `...`

#### Returns

`string`

***

<a id="sheetformfor"></a>

### sheetFormFor()

```ts
function sheetFormFor(screen): "dialog" | "bottom-sheet";
```

#### Parameters

##### screen

`"phone"` \| `"tablet"` \| `"desktop"` \| `"wide"`

#### Returns

`"dialog"` \| `"bottom-sheet"`

***

<a id="shell"></a>

### Shell()

```ts
function Shell(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`ShellProps`](#shellprops)

#### Returns

`Element`

***

<a id="shellcomponentsprovider"></a>

### ShellComponentsProvider()

```ts
function ShellComponentsProvider(__namedParameters): FunctionComponentElement<ProviderProps<ShellComponents | null>>;
```

#### Parameters

##### \_\_namedParameters

[`ShellComponentsProviderProps`](#shellcomponentsproviderprops)

#### Returns

`FunctionComponentElement`\<`ProviderProps`\<[`ShellComponents`](#shellcomponents) \| `null`\>\>

***

<a id="shelloutcome"></a>

### ShellOutcome()

```ts
function ShellOutcome(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`OutcomeSlotProps`](#outcomeslotprops)

#### Returns

`Element`

***

<a id="shortcutaction"></a>

### shortcutAction()

```ts
function shortcutAction(actions, event): AnyAction | null;
```

#### Parameters

##### actions

readonly [`AnyAction`](../rex.md#anyaction)[]

##### event

[`ShortcutEventLike`](#shortcuteventlike)

#### Returns

[`AnyAction`](../rex.md#anyaction) \| `null`

***

<a id="shortcuttext"></a>

### shortcutText()

```ts
function shortcutText(shortcut, apple): string;
```

#### Parameters

##### shortcut

`string`

##### apple

`boolean`

#### Returns

`string`

***

<a id="shoulddehydraterexquery"></a>

### shouldDehydrateRexQuery()

```ts
function shouldDehydrateRexQuery(query): boolean;
```

#### Parameters

##### query

`Query`

#### Returns

`boolean`

***

<a id="sidecaraction"></a>

### sidecarAction()

```ts
function sidecarAction(
   declared, 
   subject, 
   input, 
   text?
): object;
```

#### Parameters

##### declared

[`AnyAction`](../rex.md#anyaction)

##### subject

[`Actor`](../rex.md#actor-1)

##### input

[`JsonSchema`](schema.md#jsonschema)

##### text?

[`TextResolver`](client/i18n.md#textresolver) = `literalText`

#### Returns

`object`

##### allowed

```ts
allowed: boolean;
```

##### effect

```ts
effect: "reversible" | "irreversible" | "read";
```

##### id

```ts
id: string;
```

##### input

```ts
input: Record<string, unknown>;
```

##### label

```ts
label: string;
```

##### reason

```ts
reason: string | null;
```

##### via

```ts
via: ("url" | "key" | "click" | "palette")[];
```

***

<a id="sidecaroutcome"></a>

### sidecarOutcome()

```ts
function sidecarOutcome(outcome, text?): 
  | {
  action: string;
  at: string;
  message: string;
  ok: boolean;
}
  | null;
```

#### Parameters

##### outcome

[`Outcome`](#outcome) \| `null`

##### text?

[`TextResolver`](client/i18n.md#textresolver) = `literalText`

#### Returns

  \| \{
  `action`: `string`;
  `at`: `string`;
  `message`: `string`;
  `ok`: `boolean`;
\}
  \| `null`

***

<a id="sidecarregions"></a>

### sidecarRegions()

```ts
function sidecarRegions(page, failures): readonly object[];
```

#### Parameters

##### page

`string`

##### failures

readonly [`RegionFailure`](#regionfailure)[]

#### Returns

readonly `object`[]

***

<a id="sidecarstores"></a>

### sidecarStores()

```ts
function sidecarStores(stores): Record<string, unknown> | null;
```

#### Parameters

##### stores

`Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

<a id="spaceclass"></a>

### spaceClass()

```ts
function spaceClass(space): string;
```

#### Parameters

##### space

`1` \| `2` \| `3` \| `4` \| `5` \| `6` \| `7` \| `8`

#### Returns

`string`

***

<a id="startrexentry"></a>

### startRexEntry()

```ts
function startRexEntry(
   container, 
   bundle, 
   options?
): StartedRex;
```

#### Parameters

##### container

`Element`

##### bundle

[`RexEntryBundle`](#rexentrybundle)

##### options?

[`StartRexOptions`](#startrexoptions) = `{}`

#### Returns

[`StartedRex`](#startedrex)

***

<a id="store-1"></a>

### store()

```ts
function store<T>(id, options): RexStore<T>;
```

#### Type Parameters

##### T

`T`

#### Parameters

##### id

`string`

##### options

[`StoreOptions`](#storeoptions)\<`T`\>

#### Returns

[`RexStore`](#rexstore)\<`T`\>

***

<a id="storestojson"></a>

### storesToJSON()

```ts
function storesToJSON(): Readonly<Record<string, unknown>>;
```

#### Returns

`Readonly`\<`Record`\<`string`, `unknown`\>\>

***

<a id="takeoutcomecookie"></a>

### takeOutcomeCookie()

```ts
function takeOutcomeCookie(): FormOutcome | null;
```

#### Returns

[`FormOutcome`](#formoutcome) \| `null`

***

<a id="todatastatequery"></a>

### toDataStateQuery()

```ts
function toDataStateQuery(query): DataStateQuery;
```

#### Parameters

##### query

[`QueryLike`](#querylike)

#### Returns

[`DataStateQuery`](#datastatequery)

***

<a id="tokenbutton"></a>

### TokenButton()

```ts
function TokenButton(props): DetailedReactHTMLElement<{
  type: string | undefined;
}, HTMLElement>;
```

#### Parameters

##### props

[`ShellButtonProps`](#shellbuttonprops)

#### Returns

`DetailedReactHTMLElement`\<\{
  `type`: `string` \| `undefined`;
\}, `HTMLElement`\>

***

<a id="tokenframe"></a>

### TokenFrame()

```ts
function TokenFrame(__namedParameters): DetailedReactHTMLElement<{
  className: string;
  data-rex-frame: string;
  data-rex-nav-form: "sidebar" | "bar" | "dock" | undefined;
}, HTMLElement>;
```

#### Parameters

##### \_\_namedParameters

[`ShellFrameProps`](#shellframeprops)

#### Returns

`DetailedReactHTMLElement`\<\{
  `className`: `string`;
  `data-rex-frame`: `string`;
  `data-rex-nav-form`: `"sidebar"` \| `"bar"` \| `"dock"` \| `undefined`;
\}, `HTMLElement`\>

***

<a id="tokennav"></a>

### TokenNav()

```ts
function TokenNav(__namedParameters): 
  | DetailedReactHTMLElement<{
  aria-label: string;
  className: string;
  data-rex-nav-form: "sidebar" | "bar" | "dock";
}, HTMLElement>
  | null;
```

#### Parameters

##### \_\_namedParameters

[`ShellNavProps`](#shellnavprops)

#### Returns

  \| `DetailedReactHTMLElement`\<\{
  `aria-label`: `string`;
  `className`: `string`;
  `data-rex-nav-form`: `"sidebar"` \| `"bar"` \| `"dock"`;
\}, `HTMLElement`\>
  \| `null`

***

<a id="tokenoutcome"></a>

### TokenOutcome()

```ts
function TokenOutcome(__namedParameters): FunctionComponentElement<OutcomeProps>;
```

#### Parameters

##### \_\_namedParameters

[`OutcomeSlotProps`](#outcomeslotprops)

#### Returns

`FunctionComponentElement`\<[`OutcomeProps`](#outcomeprops)\>

***

<a id="tokenpaletteitem"></a>

### TokenPaletteItem()

```ts
function TokenPaletteItem(__namedParameters): FunctionComponentElement<FragmentProps>;
```

#### Parameters

##### \_\_namedParameters

[`ShellPaletteItemProps`](#shellpaletteitemprops)

#### Returns

`FunctionComponentElement`\<`FragmentProps`\>

***

<a id="tokenpalettetrigger"></a>

### TokenPaletteTrigger()

```ts
function TokenPaletteTrigger(__namedParameters): DetailedReactHTMLElement<{
  aria-keyshortcuts: string;
  className: string;
  data-rex-palette-trigger: string;
  onClick: () => void;
  type: string;
}, HTMLElement>;
```

#### Parameters

##### \_\_namedParameters

[`ShellPaletteTriggerProps`](#shellpalettetriggerprops)

#### Returns

`DetailedReactHTMLElement`\<\{
  `aria-keyshortcuts`: `string`;
  `className`: `string`;
  `data-rex-palette-trigger`: `string`;
  `onClick`: () => `void`;
  `type`: `string`;
\}, `HTMLElement`\>

***

<a id="tokensheet"></a>

### TokenSheet()

```ts
function TokenSheet(__namedParameters): DetailedReactHTMLElement<{
  className: string;
  data-rex-sheet-form: "dialog" | "bottom-sheet";
}, HTMLElement>;
```

#### Parameters

##### \_\_namedParameters

[`ShellSheetProps`](#shellsheetprops)

#### Returns

`DetailedReactHTMLElement`\<\{
  `className`: `string`;
  `data-rex-sheet-form`: `"dialog"` \| `"bottom-sheet"`;
\}, `HTMLElement`\>

***

<a id="unsafehtml"></a>

### unsafeHtml()

```ts
function unsafeHtml(html, options?): ReactElement;
```

#### Parameters

##### html

`string`

##### options?

[`UnsafeHtmlOptions`](#unsafehtmloptions) = `{}`

#### Returns

`ReactElement`

***

<a id="useact"></a>

### useAct()

```ts
function useAct<A>(declared): ActHandle<A>;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Parameters

##### declared

`A`

#### Returns

[`ActHandle`](#acthandle)\<`A`\>

***

<a id="useactivepage"></a>

### useActivePage()

```ts
function useActivePage(): PageResolution | null;
```

#### Returns

[`PageResolution`](#pageresolution) \| `null`

***

<a id="useactiveroute"></a>

### useActiveRoute()

```ts
function useActiveRoute(): RouteResolution | null;
```

#### Returns

[`RouteResolution`](#routeresolution) \| `null`

***

<a id="useactor"></a>

### useActor()

```ts
function useActor(): Actor;
```

#### Returns

[`Actor`](../rex.md#actor-1)

***

<a id="useaddress"></a>

### useAddress()

```ts
function useAddress(): RexAddress;
```

#### Returns

[`RexAddress`](#rexaddress)

***

<a id="useaffordanceregistry"></a>

### useAffordanceRegistry()

```ts
function useAffordanceRegistry(): AffordanceRegistry;
```

#### Returns

[`AffordanceRegistry`](#affordanceregistry)

***

<a id="useaffordances"></a>

### useAffordances()

```ts
function useAffordances(page): readonly Affordance[];
```

#### Parameters

##### page

`string`

#### Returns

readonly [`Affordance`](#affordance)[]

***

<a id="useconfirm"></a>

### useConfirm()

```ts
function useConfirm(): ConfirmFn;
```

#### Returns

[`ConfirmFn`](#confirmfn)

***

<a id="usecsrftoken"></a>

### useCsrfToken()

```ts
function useCsrfToken(): string;
```

#### Returns

`string`

***

<a id="usedatastate"></a>

### useDataState()

```ts
function useDataState(pageQueries, options?): 
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

#### Parameters

##### pageQueries

readonly [`QueryLike`](#querylike)[]

##### options?

[`UseDataStateOptions`](#usedatastateoptions) = `{}`

#### Returns

  \| `"loading"`
  \| `"empty"`
  \| `"stale"`
  \| `"partial"`
  \| `"offline"`
  \| `"permission-denied"`
  \| `"recoverable-error"`
  \| `"terminal-error"`
  \| `"ready"`

***

<a id="usedensity"></a>

### useDensity()

```ts
function useDensity(): DensityValue;
```

#### Returns

[`DensityValue`](#densityvalue)

***

<a id="usedraft"></a>

### useDraft()

```ts
function useDraft<S>(schema): Draft<StandardInferOutput<S>>;
```

#### Type Parameters

##### S

`S` *extends* [`StandardSchemaV1`](../rex.md#standardschemav1)\<`unknown`, `unknown`\>

#### Parameters

##### schema

`S`

#### Returns

[`Draft`](#draft)\<[`StandardInferOutput`](../rex.md#standardinferoutput)\<`S`\>\>

***

<a id="useexposedstores"></a>

### useExposedStores()

```ts
function useExposedStores(): Readonly<Record<string, unknown>>;
```

#### Returns

`Readonly`\<`Record`\<`string`, `unknown`\>\>

***

<a id="useflow"></a>

### useFlow()

```ts
function useFlow(declared, instanceId): FlowHandle;
```

#### Parameters

##### declared

[`AnyFlow`](../rex.md#anyflow)

##### instanceId

`string`

#### Returns

[`FlowHandle`](#flowhandle)

***

<a id="useflowclient"></a>

### useFlowClient()

```ts
function useFlowClient(): object;
```

#### Returns

`object`

##### decide

```ts
decide: ProcedureClient<Record<never, never>, ProtocolSchema<FlowDecideInput>, ProtocolSchema<FlowState>, Record<never, never>>;
```

##### start

```ts
start: ProcedureClient<Record<never, never>, ProtocolSchema<FlowStartInput>, ProtocolSchema<FlowState>, Record<never, never>>;
```

##### status

```ts
status: ProcedureClient<Record<never, never>, ProtocolSchema<FlowInstanceInput>, ProtocolSchema<FlowState>, Record<never, never>>;
```

***

<a id="useinvoke"></a>

### useInvoke()

```ts
function useInvoke<A>(declared): InvokeHandle<A>;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Parameters

##### declared

`A`

#### Returns

[`InvokeHandle`](#invokehandle)\<`A`\>

***

<a id="useloader"></a>

### useLoader()

```ts
function useLoader<Pg, N>(declared, name): LoaderResult<Pg, N>;
```

#### Type Parameters

##### Pg

`Pg` *extends* [`AnyPage`](../rex.md#anypage)

##### N

`N` *extends* `string`

#### Parameters

##### declared

`Pg`

##### name

`N`

#### Returns

[`LoaderResult`](#loaderresult)\<`Pg`, `N`\>

***

<a id="useloaders"></a>

### useLoaders()

```ts
function useLoaders<Pg>(declared): LoaderResults<Pg>;
```

#### Type Parameters

##### Pg

`Pg` *extends* [`AnyPage`](../rex.md#anypage)

#### Parameters

##### declared

`Pg`

#### Returns

[`LoaderResults`](#loaderresults)\<`Pg`\>

***

<a id="uselocalehref"></a>

### useLocaleHref()

```ts
function useLocaleHref(): (href) => string;
```

#### Returns

(`href`) => `string`

***

<a id="usemanifest"></a>

### useManifest()

```ts
function useManifest(): Manifest;
```

#### Returns

[`Manifest`](../rex.md#manifest)

***

<a id="usenav"></a>

### useNav()

```ts
function useNav(): Nav;
```

#### Returns

[`Nav`](#nav)

***

<a id="usenavlinks"></a>

### useNavLinks()

```ts
function useNavLinks(active, navPages): readonly ShellNavLink[];
```

#### Parameters

##### active

[`AnyPage`](../rex.md#anypage) \| `null`

##### navPages

readonly [`AnyPage`](../rex.md#anypage)[]

#### Returns

readonly [`ShellNavLink`](#shellnavlink)[]

***

<a id="useonline"></a>

### useOnline()

```ts
function useOnline(): boolean;
```

#### Returns

`boolean`

***

<a id="useopenoverlays"></a>

### useOpenOverlays()

```ts
function useOpenOverlays(page): readonly string[];
```

#### Parameters

##### page

`string`

#### Returns

readonly `string`[]

***

<a id="useoutcome"></a>

### useOutcome()

```ts
function useOutcome(page): Outcome | null;
```

#### Parameters

##### page

`string`

#### Returns

[`Outcome`](#outcome) \| `null`

***

<a id="useoutcomestore"></a>

### useOutcomeStore()

```ts
function useOutcomeStore(): OutcomeStore;
```

#### Returns

[`OutcomeStore`](#outcomestore)

***

<a id="useoverlay"></a>

### useOverlay()

```ts
function useOverlay(component): OverlayHandle;
```

#### Parameters

##### component

[`OverlayComponent`](#overlaycomponent)

#### Returns

[`OverlayHandle`](#overlayhandle)

***

<a id="useoverlayregistry"></a>

### useOverlayRegistry()

```ts
function useOverlayRegistry(): OverlayRegistry;
```

#### Returns

[`OverlayRegistry`](#overlayregistry)

***

<a id="usepagedatastate"></a>

### usePageDataState()

```ts
function usePageDataState(resolution): 
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

#### Parameters

##### resolution

[`PageResolution`](#pageresolution)

#### Returns

  \| `"loading"`
  \| `"empty"`
  \| `"stale"`
  \| `"partial"`
  \| `"offline"`
  \| `"permission-denied"`
  \| `"recoverable-error"`
  \| `"terminal-error"`
  \| `"ready"`

***

<a id="usepageinvokers"></a>

### usePageInvokers()

```ts
function usePageInvokers(): PageInvokerSet;
```

#### Returns

[`PageInvokerSet`](#pageinvokerset)

***

<a id="usepageloaderqueries"></a>

### usePageLoaderQueries()

```ts
function usePageLoaderQueries(
   declared, 
   params, 
   enabled?
): readonly UseQueryResult<unknown, RexLoaderError>[];
```

#### Parameters

##### declared

[`AnyPage`](../rex.md#anypage)

##### params

[`LoaderParams`](#loaderparams)

##### enabled?

`boolean` = `true`

#### Returns

readonly `UseQueryResult`\<`unknown`, [`RexLoaderError`](#rexloadererror)\>[]

***

<a id="usepagequeries"></a>

### usePageQueries()

```ts
function usePageQueries(scope): readonly Query<unknown, Error, unknown, readonly unknown[]>[];
```

#### Parameters

##### scope

`string`

#### Returns

readonly `Query`\<`unknown`, `Error`, `unknown`, readonly `unknown`[]\>[]

***

<a id="usepageruntime"></a>

### usePageRuntime()

```ts
function usePageRuntime(): PageRuntime;
```

#### Returns

[`PageRuntime`](#pageruntime)

***

<a id="useregionact"></a>

### useRegionAct()

```ts
function useRegionAct<A>(declared): InvokeHandle<A>;
```

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](../rex.md#anyaction)

#### Parameters

##### declared

`A`

#### Returns

[`InvokeHandle`](#invokehandle)\<`A`\>

***

<a id="useregionfailureregistry"></a>

### useRegionFailureRegistry()

```ts
function useRegionFailureRegistry(): RegionFailureRegistry;
```

#### Returns

[`RegionFailureRegistry`](#regionfailureregistry)

***

<a id="useregionfailures"></a>

### useRegionFailures()

```ts
function useRegionFailures(page): readonly RegionFailure[];
```

#### Parameters

##### page

`string`

#### Returns

readonly [`RegionFailure`](#regionfailure)[]

***

<a id="useregisteraffordances"></a>

### useRegisterAffordances()

```ts
function useRegisterAffordances(page, entries): void;
```

#### Parameters

##### page

`string` \| `null`

##### entries

readonly [`Affordance`](#affordance)[]

#### Returns

`void`

***

<a id="useregistry"></a>

### useRegistry()

```ts
function useRegistry(): RegistrySnapshot;
```

#### Returns

[`RegistrySnapshot`](../rex.md#registrysnapshot)

***

<a id="userexclient"></a>

### useRexClient()

```ts
function useRexClient(): RexClient;
```

#### Returns

[`RexClient`](#rexclient)

***

<a id="userexruntime"></a>

### useRexRuntime()

```ts
function useRexRuntime(): RexRuntime;
```

#### Returns

[`RexRuntime`](#rexruntime)

***

<a id="useroutechange"></a>

### useRouteChange()

```ts
function useRouteChange(): RouteChange;
```

#### Returns

[`RouteChange`](#routechange)

***

<a id="useroutechanges"></a>

### useRouteChanges()

```ts
function useRouteChanges(): number;
```

#### Returns

`number`

***

<a id="usescreen"></a>

### useScreen()

```ts
function useScreen(): ScreenState;
```

#### Returns

[`ScreenState`](#screenstate)

***

<a id="useshellcomponent"></a>

### useShellComponent()

```ts
function useShellComponent<Name>(name): ShellComponents[Name];
```

#### Type Parameters

##### Name

`Name` *extends* `"Outcome"` \| `"Nav"` \| `"Button"` \| `"Sheet"` \| `"PaletteItem"` \| `"Frame"`

#### Parameters

##### name

`Name`

#### Returns

[`ShellComponents`](#shellcomponents)\[`Name`\]

***

<a id="useshellcomponents"></a>

### useShellComponents()

```ts
function useShellComponents(): ShellComponents;
```

#### Returns

[`ShellComponents`](#shellcomponents)

***

<a id="useshortcuts"></a>

### useShortcuts()

```ts
function useShortcuts(): void;
```

#### Returns

`void`

***

<a id="useshortcuttext"></a>

### useShortcutText()

```ts
function useShortcutText(shortcut): string;
```

#### Parameters

##### shortcut

`string`

#### Returns

`string`

***

<a id="usesidecarpayload"></a>

### useSidecarPayload()

```ts
function useSidecarPayload(resolution): object;
```

#### Parameters

##### resolution

[`PageResolution`](#pageresolution)

#### Returns

`object`

##### actions

```ts
actions: object[];
```

##### density?

```ts
optional density?: "comfortable" | "compact" | "agent";
```

##### loaders?

```ts
optional loaders?: object[];
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

##### pointer?

```ts
optional pointer?: "coarse" | "fine";
```

##### regions?

```ts
optional regions?: object[];
```

##### screen?

```ts
optional screen?: "phone" | "tablet" | "desktop" | "wide";
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

<a id="useurlinvoke"></a>

### useUrlInvoke()

```ts
function useUrlInvoke(): void;
```

#### Returns

`void`

***

<a id="view-2"></a>

### view()

```ts
function view<P>(render): ViewComponent;
```

#### Type Parameters

##### P

`P` = `Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Parameters

##### render

(`ctx`) => `ReactNode`

#### Returns

[`ViewComponent`](#viewcomponent)

***

<a id="withoutinvocation"></a>

### withoutInvocation()

```ts
function withoutInvocation(search): string;
```

#### Parameters

##### search

`string`

#### Returns

`string`

***

<a id="withshellcomponents"></a>

### withShellComponents()

```ts
function withShellComponents(Slot): ComponentType<ShellSlotProps>;
```

#### Parameters

##### Slot

`ComponentType`\<[`ShellSlotProps`](#shellslotprops)\>

#### Returns

`ComponentType`\<[`ShellSlotProps`](#shellslotprops)\>

***

<a id="writestoreddensity"></a>

### writeStoredDensity()

```ts
function writeStoredDensity(density): void;
```

#### Parameters

##### density

[`DensityPreference`](#densitypreference)

#### Returns

`void`

## References

<a id="confirm_procedure"></a>

### CONFIRM\_PROCEDURE

Re-exports [CONFIRM_PROCEDURE](../rex.md#confirm_procedure)

***

<a id="confirmgrant"></a>

### ConfirmGrant

Re-exports [ConfirmGrant](../rex.md#confirmgrant)

***

<a id="confirmgrantschema"></a>

### confirmGrantSchema

Re-exports [confirmGrantSchema](../rex.md#confirmgrantschema)

***

<a id="registeri18n"></a>

### registerI18n

Re-exports [registerI18n](client/i18n.md#registeri18n)

***

<a id="reserved_query_keys"></a>

### RESERVED\_QUERY\_KEYS

Re-exports [RESERVED_QUERY_KEYS](../rex.md#reserved_query_keys)

***

<a id="rex_manifest_path"></a>

### REX\_MANIFEST\_PATH

Re-exports [REX_MANIFEST_PATH](../rex.md#rex_manifest_path)

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

<a id="rexdensity"></a>

### RexDensity

Re-exports [RexDensity](../rex.md#rexdensity)

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
