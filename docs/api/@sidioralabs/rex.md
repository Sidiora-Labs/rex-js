[@sidioralabs/rex API](../README.md) / @sidioralabs/rex

# @sidioralabs/rex

## Classes

<a id="flowdecisionerror"></a>

### FlowDecisionError

#### Extends

- [`RexError`](#rexerror)

#### Constructors

<a id="constructor"></a>

##### Constructor

```ts
new FlowDecisionError(
   code, 
   message, 
   reason
): FlowDecisionError;
```

###### Parameters

###### code

[`FlowDecisionErrorCode`](#flowdecisionerrorcode-1)

###### message

`string`

###### reason

[`ReasonCode`](#reasoncode) \| `null`

###### Returns

[`FlowDecisionError`](#flowdecisionerror)

###### Overrides

[`RexError`](#rexerror).[`constructor`](#constructor-3)

#### Properties

<a id="code"></a>

##### code

```ts
readonly code: FlowDecisionErrorCode;
```

###### Overrides

[`RexError`](#rexerror).[`code`](#code-3)

<a id="column"></a>

##### column

```ts
readonly column: number | null;
```

###### Inherited from

[`RexError`](#rexerror).[`column`](#column-3)

<a id="detail"></a>

##### detail

```ts
readonly detail: string;
```

###### Inherited from

[`RexError`](#rexerror).[`detail`](#detail-3)

<a id="docs"></a>

##### docs

```ts
readonly docs: string;
```

###### Inherited from

[`RexError`](#rexerror).[`docs`](#docs-3)

<a id="file"></a>

##### file

```ts
readonly file: string | null;
```

###### Inherited from

[`RexError`](#rexerror).[`file`](#file-3)

<a id="hint"></a>

##### hint

```ts
readonly hint: string | null;
```

###### Inherited from

[`RexError`](#rexerror).[`hint`](#hint-3)

<a id="line"></a>

##### line

```ts
readonly line: number | null;
```

###### Inherited from

[`RexError`](#rexerror).[`line`](#line-3)

<a id="reason"></a>

##### reason

```ts
readonly reason: ReasonCode | null;
```

***

<a id="rexdeclarationerror"></a>

### RexDeclarationError

#### Extends

- [`RexError`](#rexerror)

#### Constructors

<a id="constructor-1"></a>

##### Constructor

```ts
new RexDeclarationError(
   declaration, 
   id, 
   field, 
   problem, 
   code?
): RexDeclarationError;
```

###### Parameters

###### declaration

[`DeclarationName`](#declarationname)

###### id

`string`

###### field

`string`

###### problem

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

[`RexDeclarationError`](#rexdeclarationerror)

###### Overrides

[`RexError`](#rexerror).[`constructor`](#constructor-3)

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

[`RexError`](#rexerror).[`code`](#code-3)

<a id="column-1"></a>

##### column

```ts
readonly column: number | null;
```

###### Inherited from

[`RexError`](#rexerror).[`column`](#column-3)

<a id="declaration"></a>

##### declaration

```ts
readonly declaration: DeclarationName;
```

<a id="detail-1"></a>

##### detail

```ts
readonly detail: string;
```

###### Inherited from

[`RexError`](#rexerror).[`detail`](#detail-3)

<a id="docs-1"></a>

##### docs

```ts
readonly docs: string;
```

###### Inherited from

[`RexError`](#rexerror).[`docs`](#docs-3)

<a id="field"></a>

##### field

```ts
readonly field: string;
```

<a id="file-1"></a>

##### file

```ts
readonly file: string | null;
```

###### Inherited from

[`RexError`](#rexerror).[`file`](#file-3)

<a id="hint-1"></a>

##### hint

```ts
readonly hint: string | null;
```

###### Inherited from

[`RexError`](#rexerror).[`hint`](#hint-3)

<a id="id"></a>

##### id

```ts
readonly id: string;
```

<a id="line-1"></a>

##### line

```ts
readonly line: number | null;
```

###### Inherited from

[`RexError`](#rexerror).[`line`](#line-3)

***

<a id="rexdeclarationoptionerror"></a>

### RexDeclarationOptionError

#### Extends

- [`RexError`](#rexerror)

#### Constructors

<a id="constructor-2"></a>

##### Constructor

```ts
new RexDeclarationOptionError(code, details): RexDeclarationOptionError;
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

###### details

[`RexDeclarationErrorDetails`](#rexdeclarationerrordetails)

###### Returns

[`RexDeclarationOptionError`](#rexdeclarationoptionerror)

###### Overrides

[`RexError`](#rexerror).[`constructor`](#constructor-3)

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

[`RexError`](#rexerror).[`code`](#code-3)

<a id="column-2"></a>

##### column

```ts
readonly column: number | null;
```

###### Inherited from

[`RexError`](#rexerror).[`column`](#column-3)

<a id="declaration-1"></a>

##### declaration

```ts
readonly declaration: string;
```

<a id="detail-2"></a>

##### detail

```ts
readonly detail: string;
```

###### Inherited from

[`RexError`](#rexerror).[`detail`](#detail-3)

<a id="docs-2"></a>

##### docs

```ts
readonly docs: string;
```

###### Inherited from

[`RexError`](#rexerror).[`docs`](#docs-3)

<a id="field-1"></a>

##### field

```ts
readonly field: string;
```

<a id="file-2"></a>

##### file

```ts
readonly file: string | null;
```

###### Inherited from

[`RexError`](#rexerror).[`file`](#file-3)

<a id="hint-2"></a>

##### hint

```ts
readonly hint: string | null;
```

###### Inherited from

[`RexError`](#rexerror).[`hint`](#hint-3)

<a id="id-1"></a>

##### id

```ts
readonly id: string;
```

<a id="line-2"></a>

##### line

```ts
readonly line: number | null;
```

###### Inherited from

[`RexError`](#rexerror).[`line`](#line-3)

***

<a id="rexerror"></a>

### RexError

#### Extends

- `Error`

#### Extended by

- [`RexDeclarationOptionError`](#rexdeclarationoptionerror)
- [`RexNameError`](#rexnameerror)
- [`RexDeclarationError`](#rexdeclarationerror)
- [`FlowDecisionError`](#flowdecisionerror)
- [`RexConfigError`](rex/config.md#rexconfigerror)
- [`RexStartupError`](rex/client.md#rexstartuperror)
- [`RexPageModuleError`](rex/client.md#rexpagemoduleerror)
- [`MessageFormatError`](rex/client/i18n.md#messageformaterror)
- [`RexDensityError`](rex/server.md#rexdensityerror)
- [`RexStaticPageError`](rex/server.md#rexstaticpageerror)
- [`RuntimeMissingError`](rex/server/bun.md#runtimemissingerror)
- [`RexAppScanError`](rex/vite.md#rexappscanerror)

#### Constructors

<a id="constructor-3"></a>

##### Constructor

```ts
new RexError(
   code, 
   message, 
   options?
): RexError;
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

###### message

`string`

###### options?

[`RexErrorOptions`](#rexerroroptions) = `{}`

###### Returns

[`RexError`](#rexerror)

###### Overrides

```ts
Error.constructor
```

#### Properties

<a id="code-3"></a>

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

<a id="column-3"></a>

##### column

```ts
readonly column: number | null;
```

<a id="detail-3"></a>

##### detail

```ts
readonly detail: string;
```

<a id="docs-3"></a>

##### docs

```ts
readonly docs: string;
```

<a id="file-3"></a>

##### file

```ts
readonly file: string | null;
```

<a id="hint-3"></a>

##### hint

```ts
readonly hint: string | null;
```

<a id="line-3"></a>

##### line

```ts
readonly line: number | null;
```

***

<a id="rexnameerror"></a>

### RexNameError

#### Extends

- [`RexError`](#rexerror)

#### Constructors

<a id="constructor-4"></a>

##### Constructor

```ts
new RexNameError(
   kind, 
   value, 
   rule
): RexNameError;
```

###### Parameters

###### kind

`string`

###### value

`unknown`

###### rule

`string`

###### Returns

[`RexNameError`](#rexnameerror)

###### Overrides

[`RexError`](#rexerror).[`constructor`](#constructor-3)

#### Properties

<a id="code-4"></a>

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

[`RexError`](#rexerror).[`code`](#code-3)

<a id="column-4"></a>

##### column

```ts
readonly column: number | null;
```

###### Inherited from

[`RexError`](#rexerror).[`column`](#column-3)

<a id="detail-4"></a>

##### detail

```ts
readonly detail: string;
```

###### Inherited from

[`RexError`](#rexerror).[`detail`](#detail-3)

<a id="docs-4"></a>

##### docs

```ts
readonly docs: string;
```

###### Inherited from

[`RexError`](#rexerror).[`docs`](#docs-3)

<a id="file-4"></a>

##### file

```ts
readonly file: string | null;
```

###### Inherited from

[`RexError`](#rexerror).[`file`](#file-3)

<a id="hint-4"></a>

##### hint

```ts
readonly hint: string | null;
```

###### Inherited from

[`RexError`](#rexerror).[`hint`](#hint-3)

<a id="kind"></a>

##### kind

```ts
readonly kind: string;
```

<a id="line-4"></a>

##### line

```ts
readonly line: number | null;
```

###### Inherited from

[`RexError`](#rexerror).[`line`](#line-3)

<a id="value"></a>

##### value

```ts
readonly value: unknown;
```

## Interfaces

<a id="actionconfig"></a>

### ActionConfig

#### Type Parameters

##### I

`I` *extends* [`StandardSchemaV1`](#standardschemav1)

##### O

`O` *extends* [`StandardSchemaV1`](#standardschemav1)

#### Properties

<a id="effect"></a>

##### effect

```ts
readonly effect: ActionEffect;
```

<a id="form"></a>

##### form?

```ts
readonly optional form?: ActionFormConfig;
```

<a id="handler"></a>

##### handler

```ts
readonly handler: (input, ctx) => 
  | StandardInferInput<O>
| Promise<StandardInferInput<O>>;
```

###### Parameters

###### input

[`StandardInferOutput`](#standardinferoutput)\<`I`\>

###### ctx

[`ActionContext`](#actioncontext)

###### Returns

  \| [`StandardInferInput`](#standardinferinput)\<`O`\>
  \| `Promise`\<[`StandardInferInput`](#standardinferinput)\<`O`\>\>

<a id="input"></a>

##### input

```ts
readonly input: I;
```

<a id="invalidates"></a>

##### invalidates?

```ts
readonly optional invalidates?: readonly string[];
```

<a id="jsonschema"></a>

##### jsonSchema?

```ts
readonly optional jsonSchema?: ActionJsonSchemaConfig;
```

<a id="label"></a>

##### label?

```ts
readonly optional label?: string;
```

<a id="output"></a>

##### output

```ts
readonly output: O;
```

<a id="policy"></a>

##### policy

```ts
readonly policy: Predicate;
```

<a id="shortcut"></a>

##### shortcut?

```ts
readonly optional shortcut?: string;
```

***

<a id="actioncontext"></a>

### ActionContext

#### Properties

<a id="actor"></a>

##### actor

```ts
readonly actor: Actor;
```

***

<a id="actiondeclaration"></a>

### ActionDeclaration

#### Type Parameters

##### N

`N` *extends* `string` = `string`

##### I

`I` *extends* [`StandardSchemaV1`](#standardschemav1) = [`StandardSchemaV1`](#standardschemav1)

##### O

`O` *extends* [`StandardSchemaV1`](#standardschemav1) = [`StandardSchemaV1`](#standardschemav1)

#### Properties

<a id="effect-1"></a>

##### effect

```ts
readonly effect: ActionEffect;
```

<a id="form-1"></a>

##### form

```ts
readonly form: ActionForm | null;
```

<a id="id-2"></a>

##### id

```ts
readonly id: N;
```

<a id="input-1"></a>

##### input

```ts
readonly input: I;
```

<a id="invalidates-1"></a>

##### invalidates

```ts
readonly invalidates: readonly string[];
```

<a id="jsonschema-1"></a>

##### jsonSchema

```ts
readonly jsonSchema: ActionJsonSchema | null;
```

<a id="kind-1"></a>

##### kind

```ts
readonly kind: "action";
```

<a id="label-1"></a>

##### label

```ts
readonly label: string | null;
```

<a id="name"></a>

##### name

```ts
readonly name: N;
```

<a id="output-1"></a>

##### output

```ts
readonly output: O;
```

<a id="policy-1"></a>

##### policy

```ts
readonly policy: Predicate;
```

<a id="shortcut-1"></a>

##### shortcut

```ts
readonly shortcut: string | null;
```

#### Methods

<a id="handler-1"></a>

##### handler()

```ts
handler(input, ctx): 
  | StandardInferInput<O>
| Promise<StandardInferInput<O>>;
```

###### Parameters

###### input

[`StandardInferOutput`](#standardinferoutput)\<`I`\>

###### ctx

[`ActionContext`](#actioncontext)

###### Returns

  \| [`StandardInferInput`](#standardinferinput)\<`O`\>
  \| `Promise`\<[`StandardInferInput`](#standardinferinput)\<`O`\>\>

***

<a id="actionform"></a>

### ActionForm

#### Properties

<a id="confirmtitle"></a>

##### confirmTitle

```ts
readonly confirmTitle: string | null;
```

<a id="redirect"></a>

##### redirect

```ts
readonly redirect: string | null;
```

***

<a id="actionformconfig"></a>

### ActionFormConfig

#### Properties

<a id="confirmtitle-1"></a>

##### confirmTitle?

```ts
readonly optional confirmTitle?: string;
```

<a id="redirect-1"></a>

##### redirect?

```ts
readonly optional redirect?: string;
```

***

<a id="actionjsonschema"></a>

### ActionJsonSchema

#### Properties

<a id="input-2"></a>

##### input

```ts
readonly input: JsonSchema | null;
```

<a id="output-2"></a>

##### output

```ts
readonly output: JsonSchema | null;
```

***

<a id="actionjsonschemaconfig"></a>

### ActionJsonSchemaConfig

#### Properties

<a id="input-3"></a>

##### input?

```ts
readonly optional input?: JsonSchema;
```

<a id="output-3"></a>

##### output?

```ts
readonly optional output?: JsonSchema;
```

***

<a id="actionstep"></a>

### ActionStep

#### Properties

<a id="action"></a>

##### action

```ts
readonly action: AnyAction;
```

<a id="kind-2"></a>

##### kind

```ts
readonly kind: "action";
```

#### Methods

<a id="input-4"></a>

##### input()

```ts
input(ctx): unknown;
```

###### Parameters

###### ctx

[`FlowStepContext`](#flowstepcontext)

###### Returns

`unknown`

***

<a id="actionstepconfig"></a>

### ActionStepConfig

#### Type Parameters

##### A

`A` *extends* [`AnyAction`](#anyaction) = [`AnyAction`](#anyaction)

#### Properties

<a id="action-1"></a>

##### action

```ts
readonly action: A;
```

<a id="input-5"></a>

##### input

```ts
readonly input: (ctx) => unknown;
```

###### Parameters

###### ctx

[`FlowStepContext`](#flowstepcontext)

###### Returns

`unknown`

***

<a id="actor-1"></a>

### Actor

#### Properties

<a id="attributes"></a>

##### attributes

```ts
readonly attributes: ActorAttributes;
```

<a id="id-3"></a>

##### id

```ts
readonly id: string;
```

<a id="permissions"></a>

##### permissions

```ts
readonly permissions: readonly string[];
```

<a id="roles"></a>

##### roles

```ts
readonly roles: readonly string[];
```

***

<a id="actorattributes-1"></a>

### ActorAttributes

#### Indexable

```ts
[attribute: string]: unknown
```

#### Properties

<a id="account"></a>

##### account?

```ts
readonly optional account?: string;
```

<a id="custody"></a>

##### custody?

```ts
readonly optional custody?: string;
```

<a id="unlocked"></a>

##### unlocked?

```ts
readonly optional unlocked?: boolean;
```

***

<a id="actorinput"></a>

### ActorInput

#### Properties

<a id="attributes-1"></a>

##### attributes?

```ts
readonly optional attributes?: ActorAttributes;
```

<a id="id-4"></a>

##### id

```ts
readonly id: string;
```

<a id="permissions-1"></a>

##### permissions?

```ts
readonly optional permissions?: readonly string[];
```

<a id="roles-1"></a>

##### roles?

```ts
readonly optional roles?: readonly string[];
```

***

<a id="approvalstep"></a>

### ApprovalStep

#### Properties

<a id="approvers"></a>

##### approvers

```ts
readonly approvers: Predicate;
```

<a id="id-5"></a>

##### id

```ts
readonly id: string;
```

<a id="kind-3"></a>

##### kind

```ts
readonly kind: "approval";
```

<a id="label-2"></a>

##### label

```ts
readonly label: string;
```

***

<a id="approvalstepconfig"></a>

### ApprovalStepConfig

#### Properties

<a id="approval"></a>

##### approval

```ts
readonly approval: string;
```

<a id="approvers-1"></a>

##### approvers

```ts
readonly approvers: Predicate;
```

<a id="label-3"></a>

##### label

```ts
readonly label: string;
```

***

<a id="confirmgrant"></a>

### ConfirmGrant

#### Properties

<a id="expiresat"></a>

##### expiresAt

```ts
readonly expiresAt: string;
```

<a id="token"></a>

##### token

```ts
readonly token: string;
```

***

<a id="confirminput"></a>

### ConfirmInput

#### Properties

<a id="action-2"></a>

##### action

```ts
readonly action: string;
```

<a id="input-6"></a>

##### input?

```ts
readonly optional input?: unknown;
```

***

<a id="confirmoutput"></a>

### ConfirmOutput

#### Properties

<a id="action-3"></a>

##### action

```ts
readonly action: string;
```

<a id="expiresat-1"></a>

##### expiresAt

```ts
readonly expiresAt: string;
```

<a id="inputdigest"></a>

##### inputDigest

```ts
readonly inputDigest: string;
```

<a id="token-1"></a>

##### token

```ts
readonly token: string;
```

***

<a id="entityconfig"></a>

### EntityConfig

#### Type Parameters

##### F

`F` *extends* [`EntityFields`](#entityfields)

##### K

`K` *extends* [`StringFieldOf`](#stringfieldof)\<`F`\>

#### Properties

<a id="fields"></a>

##### fields

```ts
readonly fields: F;
```

<a id="key"></a>

##### key?

```ts
readonly optional key?: K;
```

<a id="label-4"></a>

##### label

```ts
readonly label: (record) => string;
```

###### Parameters

###### record

[`EntityRecord`](#entityrecord)\<`F`\>

###### Returns

`string`

***

<a id="entitydeclaration"></a>

### EntityDeclaration

#### Type Parameters

##### N

`N` *extends* `string` = `string`

##### F

`F` *extends* [`EntityFields`](#entityfields) = [`EntityFields`](#entityfields)

##### K

`K` *extends* `string` = [`StringFieldOf`](#stringfieldof)\<`F`\>

#### Properties

<a id="fieldkinds"></a>

##### fieldKinds

```ts
readonly fieldKinds: Readonly<Record<keyof F & string, FieldKind | undefined>>;
```

<a id="fields-1"></a>

##### fields

```ts
readonly fields: Readonly<F>;
```

<a id="id-6"></a>

##### id

```ts
readonly id: N;
```

<a id="key-1"></a>

##### key

```ts
readonly key: K;
```

<a id="kind-4"></a>

##### kind

```ts
readonly kind: "entity";
```

<a id="name-1"></a>

##### name

```ts
readonly name: N;
```

<a id="schema"></a>

##### schema

```ts
readonly schema: EntitySchema<F>;
```

#### Methods

<a id="keyof"></a>

##### keyOf()

```ts
keyOf(record): string;
```

###### Parameters

###### record

[`EntityRecord`](#entityrecord)\<`F`\>

###### Returns

`string`

<a id="label-5"></a>

##### label()

```ts
label(record): string;
```

###### Parameters

###### record

[`EntityRecord`](#entityrecord)\<`F`\>

###### Returns

`string`

<a id="parse"></a>

##### parse()

```ts
parse(value): EntityRecord<F>;
```

###### Parameters

###### value

`unknown`

###### Returns

[`EntityRecord`](#entityrecord)\<`F`\>

***

<a id="entitystore"></a>

### EntityStore

#### Extends

- [`Store`](#store)\<[`InferEntity`](#inferentity)\<`E`\>\>

#### Type Parameters

##### E

`E` *extends* [`AnyEntity`](#anyentity)

#### Properties

<a id="entity"></a>

##### entity

```ts
readonly entity: E;
```

#### Methods

<a id="delete"></a>

##### delete()

```ts
delete(id): Promise<boolean>;
```

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`boolean`\>

###### Inherited from

[`Store`](#store).[`delete`](#delete-1)

<a id="get"></a>

##### get()

```ts
get(id): Promise<InferEntity<E> | undefined>;
```

###### Parameters

###### id

`string`

###### Returns

`Promise`\<[`InferEntity`](#inferentity)\<`E`\> \| `undefined`\>

###### Inherited from

[`Store`](#store).[`get`](#get-1)

<a id="list"></a>

##### list()

```ts
list(query?): Promise<ListResult<InferEntity<E>>>;
```

###### Parameters

###### query?

[`ListQuery`](#listquery)\<[`InferEntity`](#inferentity)\<`E`\>\>

###### Returns

`Promise`\<[`ListResult`](#listresult)\<[`InferEntity`](#inferentity)\<`E`\>\>\>

###### Inherited from

[`Store`](#store).[`list`](#list-2)

<a id="put"></a>

##### put()

```ts
put(record): Promise<InferEntity<E>>;
```

###### Parameters

###### record

[`InferEntity`](#inferentity)

###### Returns

`Promise`\<[`InferEntity`](#inferentity)\<`E`\>\>

###### Inherited from

[`Store`](#store).[`put`](#put-1)

***

<a id="flowconfig"></a>

### FlowConfig

#### Properties

<a id="journal"></a>

##### journal

```ts
readonly journal: Journal;
```

<a id="steps"></a>

##### steps

```ts
readonly steps: readonly FlowStepConfig[];
```

***

<a id="flowdecideinput"></a>

### FlowDecideInput

#### Extends

- [`FlowInstanceInput`](#flowinstanceinput-1)

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

###### Inherited from

[`FlowInstanceInput`](#flowinstanceinput-1).[`flow`](#flow-1)

<a id="instance"></a>

##### instance

```ts
readonly instance: string;
```

###### Inherited from

[`FlowInstanceInput`](#flowinstanceinput-1).[`instance`](#instance-1)

***

<a id="flowdeclaration"></a>

### FlowDeclaration

#### Type Parameters

##### N

`N` *extends* `string` = `string`

#### Properties

<a id="id-7"></a>

##### id

```ts
readonly id: N;
```

<a id="journal-1"></a>

##### journal

```ts
readonly journal: Journal;
```

<a id="kind-5"></a>

##### kind

```ts
readonly kind: "flow";
```

<a id="name-2"></a>

##### name

```ts
readonly name: N;
```

<a id="steps-1"></a>

##### steps

```ts
readonly steps: readonly FlowStep[];
```

***

<a id="flowgatestate"></a>

### FlowGateState

#### Properties

<a id="id-8"></a>

##### id

```ts
readonly id: string;
```

<a id="label-6"></a>

##### label

```ts
readonly label: string;
```

***

<a id="flowinstance"></a>

### FlowInstance

#### Properties

<a id="entries"></a>

##### entries

```ts
readonly entries: readonly JournalEntry[];
```

<a id="flowid"></a>

##### flowId

```ts
readonly flowId: string;
```

<a id="input-7"></a>

##### input

```ts
readonly input: unknown;
```

<a id="instanceid"></a>

##### instanceId

```ts
readonly instanceId: string;
```

<a id="status"></a>

##### status

```ts
readonly status: FlowStatus;
```

***

<a id="flowinstanceinput-1"></a>

### FlowInstanceInput

#### Extended by

- [`FlowStartInput`](#flowstartinput)
- [`FlowDecideInput`](#flowdecideinput)

#### Properties

<a id="flow-1"></a>

##### flow

```ts
readonly flow: string;
```

<a id="instance-1"></a>

##### instance

```ts
readonly instance: string;
```

***

<a id="flowruncontext"></a>

### FlowRunContext

#### Properties

<a id="actor-2"></a>

##### actor

```ts
readonly actor: Actor;
```

<a id="input-8"></a>

##### input?

```ts
readonly optional input?: unknown;
```

***

<a id="flowrunresult"></a>

### FlowRunResult

#### Properties

<a id="gate"></a>

##### gate

```ts
readonly gate: ApprovalStep | null;
```

<a id="instance-2"></a>

##### instance

```ts
readonly instance: FlowInstance;
```

<a id="status-1"></a>

##### status

```ts
readonly status: FlowStatus;
```

***

<a id="flowsource"></a>

### FlowSource

#### Properties

<a id="id-9"></a>

##### id

```ts
readonly id: string;
```

<a id="steps-2"></a>

##### steps

```ts
readonly steps: readonly FlowStepSource[];
```

***

<a id="flowstartinput"></a>

### FlowStartInput

#### Extends

- [`FlowInstanceInput`](#flowinstanceinput-1)

#### Properties

<a id="flow-2"></a>

##### flow

```ts
readonly flow: string;
```

###### Inherited from

[`FlowInstanceInput`](#flowinstanceinput-1).[`flow`](#flow-1)

<a id="input-9"></a>

##### input?

```ts
readonly optional input?: unknown;
```

<a id="instance-3"></a>

##### instance

```ts
readonly instance: string;
```

###### Inherited from

[`FlowInstanceInput`](#flowinstanceinput-1).[`instance`](#instance-1)

***

<a id="flowstate"></a>

### FlowState

#### Properties

<a id="completed"></a>

##### completed

```ts
readonly completed: number;
```

<a id="flow-3"></a>

##### flow

```ts
readonly flow: string;
```

<a id="gate-1"></a>

##### gate

```ts
readonly gate: FlowGateState | null;
```

<a id="instance-4"></a>

##### instance

```ts
readonly instance: string;
```

<a id="status-2"></a>

##### status

```ts
readonly status: FlowStateStatus;
```

***

<a id="flowstepcontext"></a>

### FlowStepContext

#### Properties

<a id="actor-3"></a>

##### actor

```ts
readonly actor: Actor;
```

<a id="input-10"></a>

##### input

```ts
readonly input: unknown;
```

<a id="outputs"></a>

##### outputs

```ts
readonly outputs: readonly unknown[];
```

***

<a id="journal-2"></a>

### Journal

#### Methods

<a id="list-1"></a>

##### list()

```ts
list(filter?): Promise<FlowInstance[]>;
```

###### Parameters

###### filter?

[`JournalListFilter`](#journallistfilter)

###### Returns

`Promise`\<[`FlowInstance`](#flowinstance)[]\>

<a id="load"></a>

##### load()

```ts
load(instanceId): Promise<FlowInstance | undefined>;
```

###### Parameters

###### instanceId

`string`

###### Returns

`Promise`\<[`FlowInstance`](#flowinstance) \| `undefined`\>

<a id="open"></a>

##### open()

```ts
open(
   flowId, 
   instanceId, 
   input
): Promise<FlowInstance>;
```

###### Parameters

###### flowId

`string`

###### instanceId

`string`

###### input

`unknown`

###### Returns

`Promise`\<[`FlowInstance`](#flowinstance)\>

<a id="record"></a>

##### record()

```ts
record(instanceId, entry): Promise<FlowInstance>;
```

###### Parameters

###### instanceId

`string`

###### entry

[`JournalEntry`](#journalentry)

###### Returns

`Promise`\<[`FlowInstance`](#flowinstance)\>

***

<a id="journallistfilter"></a>

### JournalListFilter

#### Properties

<a id="flowid-1"></a>

##### flowId?

```ts
readonly optional flowId?: string;
```

<a id="status-3"></a>

##### status?

```ts
readonly optional status?: FlowStatus;
```

***

<a id="listquery"></a>

### ListQuery

#### Type Parameters

##### T

`T`

#### Properties

<a id="filter"></a>

##### filter?

```ts
readonly optional filter?: StoreFilter<T>;
```

<a id="page"></a>

##### page?

```ts
readonly optional page?: number;
```

<a id="size"></a>

##### size?

```ts
readonly optional size?: number;
```

***

<a id="listresult"></a>

### ListResult

#### Type Parameters

##### T

`T`

#### Properties

<a id="items"></a>

##### items

```ts
readonly items: T[];
```

<a id="page-1"></a>

##### page

```ts
readonly page: number;
```

<a id="size-1"></a>

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

<a id="manifest"></a>

### Manifest

#### Properties

<a id="actions"></a>

##### actions

```ts
readonly actions: readonly ManifestAction[];
```

<a id="app"></a>

##### app

```ts
readonly app: ManifestApp;
```

<a id="entities"></a>

##### entities

```ts
readonly entities: readonly ManifestEntity[];
```

<a id="flows"></a>

##### flows

```ts
readonly flows: readonly ManifestFlow[];
```

<a id="pages"></a>

##### pages

```ts
readonly pages: readonly ManifestPage[];
```

<a id="policies"></a>

##### policies

```ts
readonly policies: readonly ManifestPolicy[];
```

<a id="version"></a>

##### version

```ts
readonly version: 1;
```

***

<a id="manifestaction"></a>

### ManifestAction

#### Properties

<a id="effect-2"></a>

##### effect

```ts
readonly effect: ActionEffect;
```

<a id="form-2"></a>

##### form

```ts
readonly form: ActionForm | null;
```

<a id="id-10"></a>

##### id

```ts
readonly id: string;
```

<a id="input-11"></a>

##### input

```ts
readonly input: JsonSchema;
```

<a id="invalidates-2"></a>

##### invalidates

```ts
readonly invalidates: readonly string[];
```

<a id="label-7"></a>

##### label

```ts
readonly label: string | null;
```

<a id="output-4"></a>

##### output

```ts
readonly output: JsonSchema;
```

<a id="policy-2"></a>

##### policy

```ts
readonly policy: PredicateJson;
```

<a id="shortcut-2"></a>

##### shortcut

```ts
readonly shortcut: string | null;
```

***

<a id="manifestapp-1"></a>

### ManifestApp

#### Properties

<a id="name-3"></a>

##### name

```ts
readonly name: string;
```

***

<a id="manifestchrome"></a>

### ManifestChrome

#### Properties

<a id="back"></a>

##### back

```ts
readonly back: string | null;
```

<a id="header"></a>

##### header

```ts
readonly header: boolean;
```

<a id="nav"></a>

##### nav

```ts
readonly nav: boolean;
```

<a id="title"></a>

##### title

```ts
readonly title: string;
```

***

<a id="manifestentity"></a>

### ManifestEntity

#### Properties

<a id="fields-2"></a>

##### fields

```ts
readonly fields: readonly ManifestField[];
```

<a id="id-11"></a>

##### id

```ts
readonly id: string;
```

<a id="key-2"></a>

##### key

```ts
readonly key: string;
```

<a id="schema-1"></a>

##### schema

```ts
readonly schema: JsonSchema;
```

***

<a id="manifestfield"></a>

### ManifestField

#### Properties

<a id="kind-6"></a>

##### kind

```ts
readonly kind: FieldKind | null;
```

<a id="name-4"></a>

##### name

```ts
readonly name: string;
```

<a id="ref"></a>

##### ref

```ts
readonly ref: string | null;
```

<a id="required"></a>

##### required

```ts
readonly required: boolean;
```

***

<a id="manifestflow"></a>

### ManifestFlow

#### Properties

<a id="id-12"></a>

##### id

```ts
readonly id: string;
```

<a id="steps-3"></a>

##### steps

```ts
readonly steps: readonly ManifestFlowStep[];
```

***

<a id="manifestloader"></a>

### ManifestLoader

#### Properties

<a id="action-4"></a>

##### action

```ts
readonly action: string;
```

<a id="input-12"></a>

##### input

```ts
readonly input: "params" | "mapped";
```

<a id="invalidatedby"></a>

##### invalidatedBy

```ts
readonly invalidatedBy: readonly string[];
```

<a id="name-5"></a>

##### name

```ts
readonly name: string;
```

***

<a id="manifestoverlay"></a>

### ManifestOverlay

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

<a id="id-13"></a>

##### id

```ts
readonly id: string;
```

***

<a id="manifestpage"></a>

### ManifestPage

#### Properties

<a id="actions-1"></a>

##### actions

```ts
readonly actions: readonly string[];
```

<a id="cache"></a>

##### cache

```ts
readonly cache: PageCacheConfig | null;
```

<a id="chrome"></a>

##### chrome

```ts
readonly chrome: ManifestChrome;
```

<a id="draft"></a>

##### draft

```ts
readonly draft: PageDraft;
```

<a id="id-14"></a>

##### id

```ts
readonly id: string;
```

<a id="loaders"></a>

##### loaders

```ts
readonly loaders: readonly ManifestLoader[];
```

<a id="overlays"></a>

##### overlays

```ts
readonly overlays: readonly ManifestOverlay[];
```

<a id="params"></a>

##### params

```ts
readonly params: JsonSchema;
```

<a id="paths"></a>

##### paths

```ts
readonly paths: boolean;
```

<a id="policy-3"></a>

##### policy

```ts
readonly policy: PredicateJson;
```

<a id="recovery"></a>

##### recovery

```ts
readonly recovery: string | null;
```

<a id="regions"></a>

##### regions

```ts
readonly regions: readonly string[];
```

<a id="render"></a>

##### render

```ts
readonly render: "ssr" | "csr" | "ssg" | "static";
```

<a id="revalidate"></a>

##### revalidate

```ts
readonly revalidate: number | null;
```

<a id="route"></a>

##### route

```ts
readonly route: string;
```

<a id="routeparams"></a>

##### routeParams

```ts
readonly routeParams: readonly string[];
```

<a id="states"></a>

##### states

```ts
readonly states: readonly (
  | "loading"
  | "empty"
  | "stale"
  | "partial"
  | "offline"
  | "permission-denied"
  | "recoverable-error"
  | "terminal-error"
  | "ready")[];
```

<a id="transition"></a>

##### transition

```ts
readonly transition: "none" | "view";
```

***

<a id="manifestpolicy"></a>

### ManifestPolicy

#### Properties

<a id="id-15"></a>

##### id

```ts
readonly id: string;
```

<a id="permissions-2"></a>

##### permissions

```ts
readonly permissions: readonly string[];
```

***

<a id="normalizedlistquery"></a>

### NormalizedListQuery

#### Type Parameters

##### T

`T`

#### Properties

<a id="filter-1"></a>

##### filter

```ts
readonly filter: StoreFilter<T>;
```

<a id="offset"></a>

##### offset

```ts
readonly offset: number;
```

<a id="page-2"></a>

##### page

```ts
readonly page: number;
```

<a id="size-2"></a>

##### size

```ts
readonly size: number;
```

***

<a id="overlaydeclaration"></a>

### OverlayDeclaration

#### Type Parameters

##### N

`N` *extends* `string` = `string`

#### Properties

<a id="binding-1"></a>

##### binding

```ts
readonly binding: OverlayBinding;
```

<a id="dismiss-1"></a>

##### dismiss

```ts
readonly dismiss: OverlayDismiss;
```

<a id="id-16"></a>

##### id

```ts
readonly id: N;
```

***

<a id="pagecacheconfig"></a>

### PageCacheConfig

#### Properties

<a id="staletime"></a>

##### staleTime

```ts
readonly staleTime: number;
```

***

<a id="pagechrome"></a>

### PageChrome

#### Properties

<a id="back-1"></a>

##### back

```ts
readonly back: string | null;
```

<a id="header-1"></a>

##### header

```ts
readonly header: boolean;
```

<a id="nav-1"></a>

##### nav

```ts
readonly nav: boolean;
```

<a id="title-1"></a>

##### title

```ts
readonly title: string;
```

***

<a id="pagechromeconfig"></a>

### PageChromeConfig

#### Properties

<a id="back-2"></a>

##### back?

```ts
readonly optional back?: string | null;
```

<a id="header-2"></a>

##### header?

```ts
readonly optional header?: boolean;
```

<a id="nav-2"></a>

##### nav?

```ts
readonly optional nav?: boolean;
```

<a id="title-2"></a>

##### title?

```ts
readonly optional title?: string;
```

***

<a id="pageconfig"></a>

### PageConfig

#### Type Parameters

##### P

`P` *extends* [`StandardSchemaV1`](#standardschemav1)

##### S

`S` *extends* readonly [`RexDataState`](#rexdatastate)[]

##### R

`R` *extends* `string`

##### O

`O` *extends* `string`

##### A

`A` *extends* [`AnyAction`](#anyaction)

##### L

`L` *extends* [`PageLoadMap`](#pageloadmap) = [`PageLoadMap`](#pageloadmap)

#### Properties

<a id="actions-2"></a>

##### actions?

```ts
readonly optional actions?: readonly A[];
```

<a id="cache-1"></a>

##### cache?

```ts
readonly optional cache?: PageCacheConfig;
```

<a id="chrome-1"></a>

##### chrome?

```ts
readonly optional chrome?: PageChromeConfig;
```

<a id="draft-1"></a>

##### draft?

```ts
readonly optional draft?: PageDraft;
```

<a id="load-1"></a>

##### load?

```ts
readonly optional load?: L;
```

<a id="overlays-1"></a>

##### overlays?

```ts
readonly optional overlays?: readonly OverlayDeclaration<O>[];
```

<a id="params-1"></a>

##### params?

```ts
readonly optional params?: P;
```

<a id="paths-1"></a>

##### paths?

```ts
readonly optional paths?: PagePaths<StandardInferInput<P>>;
```

<a id="policy-4"></a>

##### policy?

```ts
readonly optional policy?: Predicate;
```

<a id="recovery-1"></a>

##### recovery?

```ts
readonly optional recovery?: string;
```

<a id="regions-1"></a>

##### regions?

```ts
readonly optional regions?: readonly R[];
```

<a id="render-1"></a>

##### render?

```ts
readonly optional render?: "ssr" | "csr" | "ssg" | "static";
```

<a id="revalidate-1"></a>

##### revalidate?

```ts
readonly optional revalidate?: number;
```

<a id="route-1"></a>

##### route

```ts
readonly route: string;
```

<a id="states-1"></a>

##### states?

```ts
readonly optional states?: S;
```

<a id="transition-1"></a>

##### transition?

```ts
readonly optional transition?: "none" | "view";
```

***

<a id="pagedeclaration"></a>

### PageDeclaration

#### Type Parameters

##### N

`N` *extends* `string` = `string`

##### P

`P` *extends* [`PageParamsSchema`](#pageparamsschema) = [`PageParamsSchema`](#pageparamsschema)

##### S

`S` *extends* [`RexDataState`](#rexdatastate) = [`RexDataState`](#rexdatastate)

##### R

`R` *extends* `string` = `string`

##### O

`O` *extends* `string` = `string`

##### A

`A` *extends* [`AnyAction`](#anyaction) = [`AnyAction`](#anyaction)

##### L

`L` *extends* [`PageLoadMap`](#pageloadmap) = [`PageLoadMap`](#pageloadmap)

#### Properties

<a id="actions-3"></a>

##### actions

```ts
readonly actions: readonly A[];
```

<a id="cache-2"></a>

##### cache

```ts
readonly cache: PageCacheConfig | null;
```

<a id="chrome-2"></a>

##### chrome

```ts
readonly chrome: PageChrome;
```

<a id="draft-2"></a>

##### draft

```ts
readonly draft: PageDraft;
```

<a id="id-17"></a>

##### id

```ts
readonly id: N;
```

<a id="kind-7"></a>

##### kind

```ts
readonly kind: "page";
```

<a id="load-2"></a>

##### load

```ts
readonly load: L;
```

<a id="loaders-1"></a>

##### loaders

```ts
readonly loaders: readonly PageLoader[];
```

<a id="name-6"></a>

##### name

```ts
readonly name: N;
```

<a id="overlays-2"></a>

##### overlays

```ts
readonly overlays: readonly OverlayDeclaration<O>[];
```

<a id="params-2"></a>

##### params

```ts
readonly params: P;
```

<a id="paths-2"></a>

##### paths

```ts
readonly paths: 
  | PagePaths<StandardInferInput<P>>
  | null;
```

<a id="policy-5"></a>

##### policy

```ts
readonly policy: Predicate;
```

<a id="recovery-2"></a>

##### recovery

```ts
readonly recovery: string | null;
```

<a id="regions-2"></a>

##### regions

```ts
readonly regions: readonly R[];
```

<a id="render-2"></a>

##### render

```ts
readonly render: "ssr" | "csr" | "ssg" | "static" | null;
```

<a id="revalidate-2"></a>

##### revalidate

```ts
readonly revalidate: number | null;
```

<a id="route-2"></a>

##### route

```ts
readonly route: string;
```

<a id="routeparams-1"></a>

##### routeParams

```ts
readonly routeParams: readonly string[];
```

<a id="states-2"></a>

##### states

```ts
readonly states: readonly S[];
```

<a id="transition-2"></a>

##### transition

```ts
readonly transition: "none" | "view";
```

***

<a id="pageloader"></a>

### PageLoader

#### Properties

<a id="action-5"></a>

##### action

```ts
readonly action: AnyAction;
```

<a id="input-13"></a>

##### input

```ts
readonly input: ((params) => unknown) | null;
```

<a id="invalidatedby-1"></a>

##### invalidatedBy

```ts
readonly invalidatedBy: readonly string[];
```

<a id="name-7"></a>

##### name

```ts
readonly name: string;
```

***

<a id="pageloaderinput-1"></a>

### PageLoaderInput

#### Type Parameters

##### Act

`Act` *extends* [`AnyAction`](#anyaction) = [`AnyAction`](#anyaction)

#### Properties

<a id="action-6"></a>

##### action

```ts
readonly action: Act;
```

<a id="invalidatedby-2"></a>

##### invalidatedBy?

```ts
readonly optional invalidatedBy?: readonly string[];
```

#### Methods

<a id="input-14"></a>

##### input()?

```ts
optional input(params): unknown;
```

###### Parameters

###### params

`Readonly`\<`Record`\<`string`, `unknown`\>\>

###### Returns

`unknown`

***

<a id="parsedroute"></a>

### ParsedRoute

#### Properties

<a id="params-3"></a>

##### params

```ts
readonly params: readonly string[];
```

<a id="route-3"></a>

##### route

```ts
readonly route: string;
```

<a id="segments"></a>

##### segments

```ts
readonly segments: readonly RouteSegment[];
```

***

<a id="parsedshortcut"></a>

### ParsedShortcut

#### Properties

<a id="alt"></a>

##### alt

```ts
readonly alt: boolean;
```

<a id="key-3"></a>

##### key

```ts
readonly key: string;
```

<a id="mod"></a>

##### mod

```ts
readonly mod: boolean;
```

<a id="shift"></a>

##### shift

```ts
readonly shift: boolean;
```

***

<a id="policyconfig"></a>

### PolicyConfig

#### Type Parameters

##### P

`P` *extends* `string`

#### Properties

<a id="permissions-3"></a>

##### permissions

```ts
readonly permissions: readonly P[];
```

<a id="resolve"></a>

##### resolve

```ts
readonly resolve: (actor) => Iterable<P>;
```

###### Parameters

###### actor

[`Actor`](#actor-1)

###### Returns

`Iterable`\<`P`\>

***

<a id="policydeclaration"></a>

### PolicyDeclaration

#### Type Parameters

##### N

`N` *extends* `string` = `string`

##### P

`P` *extends* `string` = `string`

#### Properties

<a id="id-18"></a>

##### id

```ts
readonly id: N;
```

<a id="kind-8"></a>

##### kind

```ts
readonly kind: "policy";
```

<a id="name-8"></a>

##### name

```ts
readonly name: N;
```

<a id="permissions-4"></a>

##### permissions

```ts
readonly permissions: readonly P[];
```

#### Methods

<a id="can"></a>

##### can()

```ts
can(permission): Predicate;
```

###### Parameters

###### permission

`P`

###### Returns

[`Predicate`](#predicate)

<a id="granted"></a>

##### granted()

```ts
granted(actor): ReadonlySet<P>;
```

###### Parameters

###### actor

[`Actor`](#actor-1)

###### Returns

`ReadonlySet`\<`P`\>

<a id="requires"></a>

##### requires()

```ts
requires(clause): Predicate;
```

###### Parameters

###### clause

[`RequiresClause`](#requiresclause)\<`P`\>

###### Returns

[`Predicate`](#predicate)

***

<a id="registry"></a>

### Registry

#### Methods

<a id="freeze"></a>

##### freeze()

```ts
freeze(): RegistrySnapshot;
```

###### Returns

[`RegistrySnapshot`](#registrysnapshot)

<a id="has"></a>

##### has()

```ts
has(kind, id): boolean;
```

###### Parameters

###### kind

keyof [`RegistryKinds`](#registrykinds)

###### id

`string`

###### Returns

`boolean`

<a id="register"></a>

##### register()

```ts
register<D>(...declarations): Registry;
```

###### Type Parameters

###### D

`D` *extends* readonly [`AnyDeclaration`](#anydeclaration)[]

###### Parameters

###### declarations

...`D`

###### Returns

[`Registry`](#registry)

***

<a id="registrykinds"></a>

### RegistryKinds

#### Properties

<a id="action-7"></a>

##### action

```ts
action: AnyAction;
```

<a id="entity-1"></a>

##### entity

```ts
entity: AnyEntity;
```

<a id="flow-4"></a>

##### flow

```ts
flow: AnyFlow;
```

<a id="page-3"></a>

##### page

```ts
page: AnyPage;
```

<a id="policy-6"></a>

##### policy

```ts
policy: AnyPolicy;
```

***

<a id="requiresclause"></a>

### RequiresClause

#### Type Parameters

##### P

`P` *extends* `string` = `string`

#### Properties

<a id="account-1"></a>

##### account?

```ts
readonly optional account?: boolean;
```

<a id="custody-1"></a>

##### custody?

```ts
readonly optional custody?: string | readonly string[];
```

<a id="permissions-5"></a>

##### permissions?

```ts
readonly optional permissions?: readonly P[];
```

<a id="unlocked-1"></a>

##### unlocked?

```ts
readonly optional unlocked?: boolean;
```

***

<a id="rexdeclarationerrordetails"></a>

### RexDeclarationErrorDetails

#### Properties

<a id="declaration-2"></a>

##### declaration

```ts
readonly declaration: string;
```

<a id="field-2"></a>

##### field

```ts
readonly field: string;
```

<a id="id-19"></a>

##### id

```ts
readonly id: string;
```

<a id="problem"></a>

##### problem

```ts
readonly problem: string;
```

***

<a id="rexerrorlocation"></a>

### RexErrorLocation

#### Extended by

- [`RexErrorOptions`](#rexerroroptions)

#### Properties

<a id="column-5"></a>

##### column?

```ts
readonly optional column?: number;
```

<a id="file-5"></a>

##### file?

```ts
readonly optional file?: string;
```

<a id="line-5"></a>

##### line?

```ts
readonly optional line?: number;
```

***

<a id="rexerroroptions"></a>

### RexErrorOptions

#### Extends

- [`RexErrorLocation`](#rexerrorlocation)

#### Properties

<a id="cause"></a>

##### cause?

```ts
readonly optional cause?: unknown;
```

<a id="column-6"></a>

##### column?

```ts
readonly optional column?: number;
```

###### Inherited from

[`RexErrorLocation`](#rexerrorlocation).[`column`](#column-5)

<a id="file-6"></a>

##### file?

```ts
readonly optional file?: string;
```

###### Inherited from

[`RexErrorLocation`](#rexerrorlocation).[`file`](#file-5)

<a id="hint-5"></a>

##### hint?

```ts
readonly optional hint?: string;
```

<a id="line-6"></a>

##### line?

```ts
readonly optional line?: number;
```

###### Inherited from

[`RexErrorLocation`](#rexerrorlocation).[`line`](#line-5)

***

<a id="rexstackframe"></a>

### RexStackFrame

#### Properties

<a id="column-7"></a>

##### column

```ts
readonly column: number;
```

<a id="file-7"></a>

##### file

```ts
readonly file: string;
```

<a id="line-7"></a>

##### line

```ts
readonly line: number;
```

***

<a id="standardschemav1"></a>

### StandardSchemaV1

#### Type Parameters

##### Input

`Input` = `unknown`

##### Output

`Output` = `Input`

#### Properties

<a id="standard"></a>

##### ~standard

```ts
readonly ~standard: StandardProps<Input, Output>;
```

***

<a id="stateprops"></a>

### StateProps

#### Type Parameters

##### P

`P` = `Record`\<`string`, `unknown`\>

#### Properties

<a id="error"></a>

##### error

```ts
readonly error: Error | null;
```

<a id="params-4"></a>

##### params

```ts
readonly params: P;
```

<a id="retry"></a>

##### retry

```ts
readonly retry: () => void;
```

###### Returns

`void`

***

<a id="store"></a>

### Store

#### Extended by

- [`EntityStore`](#entitystore)

#### Type Parameters

##### T

`T`

#### Methods

<a id="delete-1"></a>

##### delete()

```ts
delete(id): Promise<boolean>;
```

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`boolean`\>

<a id="get-1"></a>

##### get()

```ts
get(id): Promise<T | undefined>;
```

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`T` \| `undefined`\>

<a id="list-2"></a>

##### list()

```ts
list(query?): Promise<ListResult<T>>;
```

###### Parameters

###### query?

[`ListQuery`](#listquery)\<`T`\>

###### Returns

`Promise`\<[`ListResult`](#listresult)\<`T`\>\>

<a id="put-1"></a>

##### put()

```ts
put(record): Promise<T>;
```

###### Parameters

###### record

`T`

###### Returns

`Promise`\<`T`\>

## Type Aliases

<a id="actionaddress"></a>

### ActionAddress

```ts
type ActionAddress<P, A> = `${P}/${A}`;
```

#### Type Parameters

##### P

`P` *extends* `string`

##### A

`A` *extends* `string`

***

<a id="actioneffect"></a>

### ActionEffect

```ts
type ActionEffect = "reversible" | "irreversible" | "read";
```

***

<a id="actioninput"></a>

### ActionInput

```ts
type ActionInput<A> = A extends ActionDeclaration<string, infer I, StandardSchemaV1> ? StandardInferInput<I> : never;
```

#### Type Parameters

##### A

`A`

***

<a id="actionoutput"></a>

### ActionOutput

```ts
type ActionOutput<A> = A extends ActionDeclaration<string, StandardSchemaV1, infer O> ? StandardInferOutput<O> : never;
```

#### Type Parameters

##### A

`A`

***

<a id="actionparsedinput"></a>

### ActionParsedInput

```ts
type ActionParsedInput<A> = A extends ActionDeclaration<string, infer I, StandardSchemaV1> ? StandardInferOutput<I> : never;
```

#### Type Parameters

##### A

`A`

***

<a id="anyaction"></a>

### AnyAction

```ts
type AnyAction = ActionDeclaration<string, StandardSchemaV1, StandardSchemaV1>;
```

***

<a id="anydeclaration"></a>

### AnyDeclaration

```ts
type AnyDeclaration = RegistryKinds[DeclarationKind];
```

***

<a id="anyentity"></a>

### AnyEntity

```ts
type AnyEntity = EntityDeclaration<string, EntityFields, string>;
```

***

<a id="anyflow"></a>

### AnyFlow

```ts
type AnyFlow = FlowDeclaration<string>;
```

***

<a id="anypage"></a>

### AnyPage

```ts
type AnyPage = PageDeclaration<string, PageParamsSchema, RexDataState, string, string, AnyAction, PageLoadMap>;
```

***

<a id="anypolicy"></a>

### AnyPolicy

```ts
type AnyPolicy = PolicyDeclaration<string, string>;
```

***

<a id="declarationkind"></a>

### DeclarationKind

```ts
type DeclarationKind = keyof RegistryKinds;
```

***

<a id="declarationname"></a>

### DeclarationName

```ts
type DeclarationName = "entity" | "action" | "page" | "policy" | "predicate" | "flow";
```

***

<a id="deprecationwarn"></a>

### DeprecationWarn

```ts
type DeprecationWarn = (message) => void;
```

#### Parameters

##### message

`string`

#### Returns

`void`

***

<a id="emptypageparams"></a>

### EmptyPageParams

```ts
type EmptyPageParams = StandardSchemaV1<{
}, {
}>;
```

***

<a id="entityfields"></a>

### EntityFields

```ts
type EntityFields = object;
```

#### Index Signature

```ts
[field: string]: StandardSchemaV1<unknown, unknown>
```

***

<a id="entityinput"></a>

### EntityInput

```ts
type EntityInput<F> = Flatten<{ -readonly [P in Exclude<keyof F, OptionalInputKeys<F>>]: StandardInferInput<F[P]> } & { -readonly [P in OptionalInputKeys<F>]?: StandardInferInput<F[P]> }>;
```

#### Type Parameters

##### F

`F` *extends* [`EntityFields`](#entityfields)

***

<a id="entityrecord"></a>

### EntityRecord

```ts
type EntityRecord<F> = Flatten<{ -readonly [P in Exclude<keyof F, OptionalOutputKeys<F>>]: StandardInferOutput<F[P]> } & { -readonly [P in OptionalOutputKeys<F>]?: StandardInferOutput<F[P]> }>;
```

#### Type Parameters

##### F

`F` *extends* [`EntityFields`](#entityfields)

***

<a id="entityschema"></a>

### EntitySchema

```ts
type EntitySchema<F> = ObjectSchema<F, EntityInput<F>, EntityRecord<F>>;
```

#### Type Parameters

##### F

`F` *extends* [`EntityFields`](#entityfields)

***

<a id="flowdecision"></a>

### FlowDecision

```ts
type FlowDecision = "approve" | "reject";
```

***

<a id="flowdecisionerrorcode-1"></a>

### FlowDecisionErrorCode

```ts
type FlowDecisionErrorCode = 
  | typeof FLOW_NO_PENDING_APPROVAL
  | typeof FLOW_DECISION_FORBIDDEN;
```

***

<a id="flowstatestatus-1"></a>

### FlowStateStatus

```ts
type FlowStateStatus = FlowStatus | "idle";
```

***

<a id="flowstatus"></a>

### FlowStatus

```ts
type FlowStatus = "running" | "paused" | "completed" | "rejected" | "failed";
```

***

<a id="flowstep"></a>

### FlowStep

```ts
type FlowStep = ActionStep | ApprovalStep;
```

***

<a id="flowstepconfig"></a>

### FlowStepConfig

```ts
type FlowStepConfig = 
  | ActionStepConfig
  | ApprovalStepConfig;
```

***

<a id="flowstepsource"></a>

### FlowStepSource

```ts
type FlowStepSource = 
  | {
  action: {
     id: string;
  };
  kind: "action";
}
  | {
  approvers: Predicate;
  id: string;
  kind: "approval";
  label: string;
};
```

***

<a id="inferentity"></a>

### InferEntity

```ts
type InferEntity<E> = E extends EntityDeclaration<string, infer F, infer _K> ? EntityRecord<F> : never;
```

#### Type Parameters

##### E

`E`

***

<a id="invocationroute"></a>

### InvocationRoute

```ts
type InvocationRoute = typeof INVOCATION_ROUTES[number];
```

***

<a id="journalentry"></a>

### JournalEntry

```ts
type JournalEntry = 
  | {
  action: string;
  at: string;
  index: number;
  output: unknown;
  type: "step";
}
  | {
  at: string;
  gate: string;
  index: number;
  type: "paused";
}
  | {
  actor: string;
  at: string;
  decision: FlowDecision;
  gate: string;
  index: number;
  type: "decision";
}
  | {
  at: string;
  error: string;
  index: number;
  type: "failed";
}
  | {
  at: string;
  type: "completed";
};
```

***

<a id="manifestflowstep"></a>

### ManifestFlowStep

```ts
type ManifestFlowStep = 
  | {
  action: string;
  kind: "action";
}
  | {
  approvers: PredicateJson;
  id: string;
  kind: "approval";
  label: string;
};
```

***

<a id="nonreadystate"></a>

### NonReadyState

```ts
type NonReadyState = Exclude<RexDataState, "ready">;
```

***

<a id="overlayaddress"></a>

### OverlayAddress

```ts
type OverlayAddress<P, O> = `${P}/${O}`;
```

#### Type Parameters

##### P

`P` *extends* `string`

##### O

`O` *extends* `string`

***

<a id="overlaybinding"></a>

### OverlayBinding

```ts
type OverlayBinding = "region" | "url";
```

***

<a id="overlaydismiss"></a>

### OverlayDismiss

```ts
type OverlayDismiss = "escape" | "button" | "both";
```

***

<a id="pageaddress"></a>

### PageAddress

```ts
type PageAddress<P> = P;
```

#### Type Parameters

##### P

`P` *extends* `string`

***

<a id="pagedraft"></a>

### PageDraft

```ts
type PageDraft = "route" | "session" | "none";
```

***

<a id="pageloaderspec"></a>

### PageLoaderSpec

```ts
type PageLoaderSpec = AnyAction | PageLoaderInput;
```

***

<a id="pageloadmap"></a>

### PageLoadMap

```ts
type PageLoadMap = Readonly<Record<string, PageLoaderSpec>>;
```

***

<a id="pageparams"></a>

### PageParams

```ts
type PageParams<Pg> = Pg extends PageDeclaration<string, infer P, RexDataState, string, string, AnyAction> ? StandardInferOutput<P> : never;
```

#### Type Parameters

##### Pg

`Pg`

***

<a id="pageparamsinput"></a>

### PageParamsInput

```ts
type PageParamsInput<Pg> = Pg extends PageDeclaration<string, infer P, RexDataState, string, string, AnyAction> ? StandardInferInput<P> : never;
```

#### Type Parameters

##### Pg

`Pg`

***

<a id="pageparamsschema"></a>

### PageParamsSchema

```ts
type PageParamsSchema = StandardSchemaV1;
```

***

<a id="pagepaths"></a>

### PagePaths

```ts
type PagePaths<Params> = () => readonly Params[] | Promise<readonly Params[]>;
```

#### Type Parameters

##### Params

`Params` = `Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Returns

readonly `Params`[] \| `Promise`\<readonly `Params`[]\>

***

<a id="pagerender"></a>

### PageRender

```ts
type PageRender = typeof PAGE_RENDER_MODES[number];
```

***

<a id="pagestates"></a>

### PageStates

```ts
type PageStates<Pg> = Pg extends PageDeclaration<string, PageParamsSchema, infer S, string, string, AnyAction> ? S : never;
```

#### Type Parameters

##### Pg

`Pg`

***

<a id="pagestatesmodule"></a>

### PageStatesModule

```ts
type PageStatesModule<Pg> = StatesModule<PageStates<Pg>, PageParams<Pg>>;
```

#### Type Parameters

##### Pg

`Pg`

***

<a id="pagetransition"></a>

### PageTransition

```ts
type PageTransition = typeof PAGE_TRANSITIONS[number];
```

***

<a id="policyresult"></a>

### PolicyResult

```ts
type PolicyResult = 
  | {
  allowed: true;
  reason: null;
}
  | {
  allowed: false;
  reason: ReasonCode;
};
```

***

<a id="predicate"></a>

### Predicate

```ts
type Predicate = 
  | {
  kind: "always";
}
  | {
  kind: "never";
}
  | {
  kind: "can";
  permission: string;
  policy: AnyPolicy | null;
}
  | {
  account: boolean;
  custody: readonly string[] | null;
  kind: "requires";
  permissions: readonly string[];
  policy: AnyPolicy | null;
  unlocked: boolean;
}
  | {
  kind: "allOf";
  predicates: readonly Predicate[];
}
  | {
  kind: "anyOf";
  predicates: readonly Predicate[];
};
```

***

<a id="predicatejson"></a>

### PredicateJson

```ts
type PredicateJson = 
  | {
  kind: "always";
}
  | {
  kind: "never";
}
  | {
  kind: "can";
  permission: string;
  policy: string | null;
}
  | {
  account: boolean;
  custody: readonly string[] | null;
  kind: "requires";
  permissions: readonly string[];
  policy: string | null;
  unlocked: boolean;
}
  | {
  kind: "allOf";
  predicates: readonly PredicateJson[];
}
  | {
  kind: "anyOf";
  predicates: readonly PredicateJson[];
};
```

***

<a id="protocolschema"></a>

### ProtocolSchema

```ts
type ProtocolSchema<T> = StandardSchemaV1<T, T>;
```

#### Type Parameters

##### T

`T`

***

<a id="reasoncode"></a>

### ReasonCode

```ts
type ReasonCode = 
  | typeof REASON_NEVER
  | typeof REASON_LOCKED
  | typeof REASON_NO_ACCOUNT
  | typeof REASON_CUSTODY
  | `${typeof MISSING_PERMISSION_PREFIX}${string}`;
```

***

<a id="regionaddress"></a>

### RegionAddress

```ts
type RegionAddress<P, R> = `${P}/${R}`;
```

#### Type Parameters

##### P

`P` *extends* `string`

##### R

`R` *extends* `string`

***

<a id="registrylists"></a>

### RegistryLists

```ts
type RegistryLists = { readonly [K in DeclarationKind as Plural<K>]: readonly RegistryKinds[K][] };
```

***

<a id="registrysnapshot"></a>

### RegistrySnapshot

```ts
type RegistrySnapshot = RegistryLists & object;
```

#### Type Declaration

##### find()

```ts
find<K>(kind, id): RegistryKinds[K] | undefined;
```

###### Type Parameters

###### K

`K` *extends* keyof [`RegistryKinds`](#registrykinds)

###### Parameters

###### kind

`K`

###### id

`string`

###### Returns

[`RegistryKinds`](#registrykinds)\[`K`\] \| `undefined`

##### get()

```ts
get<K>(kind, id): RegistryKinds[K];
```

###### Type Parameters

###### K

`K` *extends* keyof [`RegistryKinds`](#registrykinds)

###### Parameters

###### kind

`K`

###### id

`string`

###### Returns

[`RegistryKinds`](#registrykinds)\[`K`\]

***

<a id="reservedquerykey"></a>

### ReservedQueryKey

```ts
type ReservedQueryKey = typeof RESERVED_QUERY_KEYS[number];
```

***

<a id="rexdatastate"></a>

### RexDataState

```ts
type RexDataState = typeof REX_DATA_STATES[number];
```

***

<a id="rexdensity"></a>

### RexDensity

```ts
type RexDensity = typeof REX_DENSITIES[number];
```

***

<a id="rexerrorcode-1"></a>

### RexErrorCode

```ts
type RexErrorCode = keyof typeof REX_ERROR_CATALOG;
```

***

<a id="rexpointer"></a>

### RexPointer

```ts
type RexPointer = typeof REX_POINTERS[number];
```

***

<a id="rexscreen"></a>

### RexScreen

```ts
type RexScreen = typeof REX_SCREENS[number];
```

***

<a id="rexscreendensity"></a>

### RexScreenDensity

```ts
type RexScreenDensity = typeof REX_SCREEN_DENSITIES[number];
```

***

<a id="routesegment"></a>

### RouteSegment

```ts
type RouteSegment = 
  | {
  kind: "static";
  value: string;
}
  | {
  kind: "param";
  name: string;
};
```

***

<a id="shortcutmodifier"></a>

### ShortcutModifier

```ts
type ShortcutModifier = typeof SHORTCUT_MODIFIERS[number];
```

***

<a id="standardinferinput"></a>

### StandardInferInput

```ts
type StandardInferInput<S> = NonNullable<S["~standard"]["types"]>["input"];
```

#### Type Parameters

##### S

`S` *extends* [`StandardSchemaV1`](#standardschemav1)

***

<a id="standardinferoutput"></a>

### StandardInferOutput

```ts
type StandardInferOutput<S> = NonNullable<S["~standard"]["types"]>["output"];
```

#### Type Parameters

##### S

`S` *extends* [`StandardSchemaV1`](#standardschemav1)

***

<a id="statecomponent"></a>

### StateComponent

```ts
type StateComponent<P> = (props) => unknown;
```

#### Type Parameters

##### P

`P` = `Record`\<`string`, `unknown`\>

#### Parameters

##### props

[`StateProps`](#stateprops)\<`P`\>

#### Returns

`unknown`

***

<a id="stateexportname"></a>

### StateExportName

```ts
type StateExportName<S> = PascalSegments<S>;
```

#### Type Parameters

##### S

`S` *extends* [`RexDataState`](#rexdatastate)

***

<a id="statesmodule"></a>

### StatesModule

```ts
type StatesModule<S, P> = { readonly [K in Exclude<S, "ready"> as StateExportName<K>]: StateComponent<P> };
```

#### Type Parameters

##### S

`S` *extends* [`RexDataState`](#rexdatastate) = [`RexDataState`](#rexdatastate)

##### P

`P` = `Record`\<`string`, `unknown`\>

***

<a id="storefilter"></a>

### StoreFilter

```ts
type StoreFilter<T> = { readonly [P in keyof T]?: T[P] };
```

#### Type Parameters

##### T

`T`

***

<a id="storerecord"></a>

### StoreRecord

```ts
type StoreRecord = object;
```

#### Index Signature

```ts
[field: string]: unknown
```

***

<a id="stringfieldof"></a>

### StringFieldOf

```ts
type StringFieldOf<F> = { [P in keyof F]: StandardInferOutput<F[P]> extends string ? P : never }[keyof F] & string;
```

#### Type Parameters

##### F

`F` *extends* [`EntityFields`](#entityfields)

## Variables

<a id="action_effects"></a>

### ACTION\_EFFECTS

```ts
const ACTION_EFFECTS: readonly ActionEffect[];
```

***

<a id="anonymous_actor_id"></a>

### ANONYMOUS\_ACTOR\_ID

```ts
const ANONYMOUS_ACTOR_ID: "anonymous" = "anonymous";
```

***

<a id="anonymousactor"></a>

### anonymousActor

```ts
const anonymousActor: Actor;
```

***

<a id="confirm_procedure"></a>

### CONFIRM\_PROCEDURE

```ts
const CONFIRM_PROCEDURE: "_confirm" = "_confirm";
```

***

<a id="confirmgrantschema"></a>

### confirmGrantSchema

```ts
const confirmGrantSchema: ProtocolSchema<ConfirmGrant>;
```

***

<a id="confirminputschema"></a>

### confirmInputSchema

```ts
const confirmInputSchema: ProtocolSchema<ConfirmInput>;
```

***

<a id="confirmoutputschema"></a>

### confirmOutputSchema

```ts
const confirmOutputSchema: ProtocolSchema<ConfirmOutput>;
```

***

<a id="declaration_error_codes"></a>

### DECLARATION\_ERROR\_CODES

```ts
const DECLARATION_ERROR_CODES: object;
```

#### Type Declaration

<a id="action-8"></a>

##### action

```ts
readonly action: "REX212" = "REX212";
```

<a id="entity-2"></a>

##### entity

```ts
readonly entity: "REX211" = "REX211";
```

<a id="flow-5"></a>

##### flow

```ts
readonly flow: "REX216" = "REX216";
```

<a id="page-4"></a>

##### page

```ts
readonly page: "REX213" = "REX213";
```

<a id="policy-7"></a>

##### policy

```ts
readonly policy: "REX214" = "REX214";
```

<a id="predicate-1"></a>

##### predicate

```ts
readonly predicate: "REX215" = "REX215";
```

***

<a id="declaration_kinds"></a>

### DECLARATION\_KINDS

```ts
const DECLARATION_KINDS: readonly ["entity", "action", "page", "policy", "flow"];
```

***

<a id="default_density"></a>

### DEFAULT\_DENSITY

```ts
const DEFAULT_DENSITY: RexDensity = "default";
```

***

<a id="default_page_size"></a>

### DEFAULT\_PAGE\_SIZE

```ts
const DEFAULT_PAGE_SIZE: 50 = 50;
```

***

<a id="field_name_pattern"></a>

### FIELD\_NAME\_PATTERN

```ts
const FIELD_NAME_PATTERN: RegExp;
```

***

<a id="flow_decision_forbidden"></a>

### FLOW\_DECISION\_FORBIDDEN

```ts
const FLOW_DECISION_FORBIDDEN: "REX334" = "REX334";
```

***

<a id="flow_decisions"></a>

### FLOW\_DECISIONS

```ts
const FLOW_DECISIONS: readonly FlowDecision[];
```

***

<a id="flow_no_pending_approval"></a>

### FLOW\_NO\_PENDING\_APPROVAL

```ts
const FLOW_NO_PENDING_APPROVAL: "REX333" = "REX333";
```

***

<a id="flow_rpc_prefix"></a>

### FLOW\_RPC\_PREFIX

```ts
const FLOW_RPC_PREFIX: "/rex/flow" = "/rex/flow";
```

***

<a id="flow_state_statuses"></a>

### FLOW\_STATE\_STATUSES

```ts
const FLOW_STATE_STATUSES: readonly FlowStateStatus[];
```

***

<a id="flow_statuses"></a>

### FLOW\_STATUSES

```ts
const FLOW_STATUSES: readonly FlowStatus[];
```

***

<a id="flowdecideinputschema"></a>

### flowDecideInputSchema

```ts
const flowDecideInputSchema: ProtocolSchema<FlowDecideInput>;
```

***

<a id="flowinstanceinputschema"></a>

### flowInstanceInputSchema

```ts
const flowInstanceInputSchema: ProtocolSchema<FlowInstanceInput>;
```

***

<a id="flowstartinputschema"></a>

### flowStartInputSchema

```ts
const flowStartInputSchema: ProtocolSchema<FlowStartInput>;
```

***

<a id="flowstateschema"></a>

### flowStateSchema

```ts
const flowStateSchema: ProtocolSchema<FlowState>;
```

***

<a id="invocation_routes"></a>

### INVOCATION\_ROUTES

```ts
const INVOCATION_ROUTES: readonly ["click", "key", "palette", "url"];
```

***

<a id="loader_name"></a>

### LOADER\_NAME

```ts
const LOADER_NAME: RegExp;
```

***

<a id="manifest_version"></a>

### MANIFEST\_VERSION

```ts
const MANIFEST_VERSION: 1 = 1;
```

***

<a id="max_page_size"></a>

### MAX\_PAGE\_SIZE

```ts
const MAX_PAGE_SIZE: 500 = 500;
```

***

<a id="missing_permission_prefix"></a>

### MISSING\_PERMISSION\_PREFIX

```ts
const MISSING_PERMISSION_PREFIX: "missing-permission:" = "missing-permission:";
```

***

<a id="overlay_bindings"></a>

### OVERLAY\_BINDINGS

```ts
const OVERLAY_BINDINGS: readonly OverlayBinding[];
```

***

<a id="overlay_dismiss"></a>

### OVERLAY\_DISMISS

```ts
const OVERLAY_DISMISS: readonly OverlayDismiss[];
```

***

<a id="page_drafts"></a>

### PAGE\_DRAFTS

```ts
const PAGE_DRAFTS: readonly PageDraft[];
```

***

<a id="page_render_modes"></a>

### PAGE\_RENDER\_MODES

```ts
const PAGE_RENDER_MODES: readonly ["ssr", "csr", "ssg", "static"];
```

***

<a id="page_transitions"></a>

### PAGE\_TRANSITIONS

```ts
const PAGE_TRANSITIONS: readonly ["view", "none"];
```

***

<a id="reason_custody"></a>

### REASON\_CUSTODY

```ts
const REASON_CUSTODY: "custody-mismatch" = "custody-mismatch";
```

***

<a id="reason_locked"></a>

### REASON\_LOCKED

```ts
const REASON_LOCKED: "locked" = "locked";
```

***

<a id="reason_never"></a>

### REASON\_NEVER

```ts
const REASON_NEVER: "never" = "never";
```

***

<a id="reason_no_account"></a>

### REASON\_NO\_ACCOUNT

```ts
const REASON_NO_ACCOUNT: "no-account" = "no-account";
```

***

<a id="reserved_query_keys"></a>

### RESERVED\_QUERY\_KEYS

```ts
const RESERVED_QUERY_KEYS: readonly ["act", "input", "draft", "density"];
```

***

<a id="reserved_shortcuts"></a>

### RESERVED\_SHORTCUTS

```ts
const RESERVED_SHORTCUTS: readonly string[];
```

***

<a id="rex_actor_header"></a>

### REX\_ACTOR\_HEADER

```ts
const REX_ACTOR_HEADER: "x-rex-actor" = "x-rex-actor";
```

***

<a id="rex_confirm_header"></a>

### REX\_CONFIRM\_HEADER

```ts
const REX_CONFIRM_HEADER: "x-rex-confirm" = "x-rex-confirm";
```

***

<a id="rex_data_states"></a>

### REX\_DATA\_STATES

```ts
const REX_DATA_STATES: readonly ["loading", "empty", "stale", "partial", "offline", "permission-denied", "recoverable-error", "terminal-error", "ready"];
```

***

<a id="rex_densities"></a>

### REX\_DENSITIES

```ts
const REX_DENSITIES: readonly ["default", "agent"];
```

***

<a id="rex_density_header"></a>

### REX\_DENSITY\_HEADER

```ts
const REX_DENSITY_HEADER: "x-rex-density" = "x-rex-density";
```

***

<a id="rex_error_catalog"></a>

### REX\_ERROR\_CATALOG

```ts
const REX_ERROR_CATALOG: object;
```

#### Type Declaration

<a id="rex100"></a>

##### REX100

```ts
readonly REX100: "rex.config.ts is missing" = "rex.config.ts is missing";
```

<a id="rex101"></a>

##### REX101

```ts
readonly REX101: "rex.config.ts default-exports a bare Hono app" = "rex.config.ts default-exports a bare Hono app";
```

<a id="rex102"></a>

##### REX102

```ts
readonly REX102: "rex.config.ts default export is not a Rex config" = "rex.config.ts default export is not a Rex config";
```

<a id="rex110"></a>

##### REX110

```ts
readonly REX110: "Unknown config field" = "Unknown config field";
```

<a id="rex111"></a>

##### REX111

```ts
readonly REX111: "Invalid config app" = "Invalid config app";
```

<a id="rex112"></a>

##### REX112

```ts
readonly REX112: "Invalid config server" = "Invalid config server";
```

<a id="rex113"></a>

##### REX113

```ts
readonly REX113: "Invalid config render" = "Invalid config render";
```

<a id="rex114"></a>

##### REX114

```ts
readonly REX114: "Invalid config budgets" = "Invalid config budgets";
```

<a id="rex115"></a>

##### REX115

```ts
readonly REX115: "Invalid config security" = "Invalid config security";
```

<a id="rex116"></a>

##### REX116

```ts
readonly REX116: "Invalid config i18n" = "Invalid config i18n";
```

<a id="rex117"></a>

##### REX117

```ts
readonly REX117: "Invalid config images" = "Invalid config images";
```

<a id="rex118"></a>

##### REX118

```ts
readonly REX118: "Invalid config fonts" = "Invalid config fonts";
```

<a id="rex119"></a>

##### REX119

```ts
readonly REX119: "Invalid config telemetry" = "Invalid config telemetry";
```

<a id="rex120"></a>

##### REX120

```ts
readonly REX120: "Invalid config ui" = "Invalid config ui";
```

<a id="rex121"></a>

##### REX121

```ts
readonly REX121: "Invalid config client" = "Invalid config client";
```

<a id="rex122"></a>

##### REX122

```ts
readonly REX122: "Invalid config flag" = "Invalid config flag";
```

<a id="rex123"></a>

##### REX123

```ts
readonly REX123: "Invalid config check" = "Invalid config check";
```

<a id="rex200"></a>

##### REX200

```ts
readonly REX200: "Invalid page render mode" = "Invalid page render mode";
```

<a id="rex201"></a>

##### REX201

```ts
readonly REX201: "Invalid page revalidate" = "Invalid page revalidate";
```

<a id="rex202"></a>

##### REX202

```ts
readonly REX202: "Invalid page paths" = "Invalid page paths";
```

<a id="rex203"></a>

##### REX203

```ts
readonly REX203: "Invalid page loader" = "Invalid page loader";
```

<a id="rex204"></a>

##### REX204

```ts
readonly REX204: "Invalid page cache" = "Invalid page cache";
```

<a id="rex205"></a>

##### REX205

```ts
readonly REX205: "Invalid page transition" = "Invalid page transition";
```

<a id="rex206"></a>

##### REX206

```ts
readonly REX206: "Invalid page chrome components" = "Invalid page chrome components";
```

<a id="rex207"></a>

##### REX207

```ts
readonly REX207: "Invalid action form options" = "Invalid action form options";
```

<a id="rex208"></a>

##### REX208

```ts
readonly REX208: "Invalid action JSON Schema override" = "Invalid action JSON Schema override";
```

<a id="rex209"></a>

##### REX209

```ts
readonly REX209: "Page loader names an unregistered action" = "Page loader names an unregistered action";
```

<a id="rex210"></a>

##### REX210

```ts
readonly REX210: "Schema cannot be represented as JSON Schema" = "Schema cannot be represented as JSON Schema";
```

<a id="rex211"></a>

##### REX211

```ts
readonly REX211: "Invalid entity declaration" = "Invalid entity declaration";
```

<a id="rex212"></a>

##### REX212

```ts
readonly REX212: "Invalid action declaration" = "Invalid action declaration";
```

<a id="rex213"></a>

##### REX213

```ts
readonly REX213: "Invalid page declaration" = "Invalid page declaration";
```

<a id="rex214"></a>

##### REX214

```ts
readonly REX214: "Invalid policy declaration" = "Invalid policy declaration";
```

<a id="rex215"></a>

##### REX215

```ts
readonly REX215: "Invalid policy predicate" = "Invalid policy predicate";
```

<a id="rex216"></a>

##### REX216

```ts
readonly REX216: "Invalid flow declaration" = "Invalid flow declaration";
```

<a id="rex217"></a>

##### REX217

```ts
readonly REX217: "Duplicate declaration id" = "Duplicate declaration id";
```

<a id="rex218"></a>

##### REX218

```ts
readonly REX218: "Invalid name" = "Invalid name";
```

<a id="rex219"></a>

##### REX219

```ts
readonly REX219: "Invalid action shortcut" = "Invalid action shortcut";
```

<a id="rex220"></a>

##### REX220

```ts
readonly REX220: "Invalid page route" = "Invalid page route";
```

<a id="rex221"></a>

##### REX221

```ts
readonly REX221: "Duplicate enum value" = "Duplicate enum value";
```

<a id="rex222"></a>

##### REX222

```ts
readonly REX222: "Page names an unregistered action" = "Page names an unregistered action";
```

<a id="rex223"></a>

##### REX223

```ts
readonly REX223: "Page names an unknown page" = "Page names an unknown page";
```

<a id="rex224"></a>

##### REX224

```ts
readonly REX224: "Registered value is not a complete declaration" = "Registered value is not a complete declaration";
```

<a id="rex300"></a>

##### REX300

```ts
readonly REX300: "Schema validates asynchronously" = "Schema validates asynchronously";
```

<a id="rex301"></a>

##### REX301

```ts
readonly REX301: "Unknown declaration" = "Unknown declaration";
```

<a id="rex302"></a>

##### REX302

```ts
readonly REX302: "Invalid journal id" = "Invalid journal id";
```

<a id="rex303"></a>

##### REX303

```ts
readonly REX303: "Unknown flow instance" = "Unknown flow instance";
```

<a id="rex304"></a>

##### REX304

```ts
readonly REX304: "Flow instance belongs to another flow" = "Flow instance belongs to another flow";
```

<a id="rex305"></a>

##### REX305

```ts
readonly REX305: "Unknown store filter field" = "Unknown store filter field";
```

<a id="rex306"></a>

##### REX306

```ts
readonly REX306: "Rendered outside its Rex provider" = "Rendered outside its Rex provider";
```

<a id="rex307"></a>

##### REX307

```ts
readonly REX307: "Not declared by the page" = "Not declared by the page";
```

<a id="rex308"></a>

##### REX308

```ts
readonly REX308: "Declaration missing from the manifest or router" = "Declaration missing from the manifest or router";
```

<a id="rex309"></a>

##### REX309

```ts
readonly REX309: "Unexpected server response" = "Unexpected server response";
```

<a id="rex310"></a>

##### REX310

```ts
readonly REX310: "Hydration mismatch" = "Hydration mismatch";
```

<a id="rex311"></a>

##### REX311

```ts
readonly REX311: "Invalid startup data" = "Invalid startup data";
```

<a id="rex312"></a>

##### REX312

```ts
readonly REX312: "Invalid rex data script" = "Invalid rex data script";
```

<a id="rex313"></a>

##### REX313

```ts
readonly REX313: "Invalid page modules" = "Invalid page modules";
```

<a id="rex314"></a>

##### REX314

```ts
readonly REX314: "Invalid component props" = "Invalid component props";
```

<a id="rex315"></a>

##### REX315

```ts
readonly REX315: "Invalid store" = "Invalid store";
```

<a id="rex316"></a>

##### REX316

```ts
readonly REX316: "Invalid i18n setup" = "Invalid i18n setup";
```

<a id="rex317"></a>

##### REX317

```ts
readonly REX317: "Invalid message pattern" = "Invalid message pattern";
```

<a id="rex318"></a>

##### REX318

```ts
readonly REX318: "Sidecar conflict" = "Sidecar conflict";
```

<a id="rex319"></a>

##### REX319

```ts
readonly REX319: "Invalid custom element" = "Invalid custom element";
```

<a id="rex320"></a>

##### REX320

```ts
readonly REX320: "Page declaration changed" = "Page declaration changed";
```

<a id="rex321"></a>

##### REX321

```ts
readonly REX321: "Invalid density" = "Invalid density";
```

<a id="rex322"></a>

##### REX322

```ts
readonly REX322: "Invalid outcome" = "Invalid outcome";
```

<a id="rex323"></a>

##### REX323

```ts
readonly REX323: "No http(s) base URL" = "No http(s) base URL";
```

<a id="rex324"></a>

##### REX324

```ts
readonly REX324: "Loader produced no result" = "Loader produced no result";
```

<a id="rex325"></a>

##### REX325

```ts
readonly REX325: "Invalid page draft" = "Invalid page draft";
```

<a id="rex326"></a>

##### REX326

```ts
readonly REX326: "Script failed to load" = "Script failed to load";
```

<a id="rex327"></a>

##### REX327

```ts
readonly REX327: "Browser API unavailable" = "Browser API unavailable";
```

<a id="rex328"></a>

##### REX328

```ts
readonly REX328: "Invalid devtools input" = "Invalid devtools input";
```

<a id="rex329"></a>

##### REX329

```ts
readonly REX329: "Invalid Rex API argument" = "Invalid Rex API argument";
```

<a id="rex330"></a>

##### REX330

```ts
readonly REX330: "Region failed to render" = "Region failed to render";
```

<a id="rex331"></a>

##### REX331

```ts
readonly REX331: "Invalid page params" = "Invalid page params";
```

<a id="rex332"></a>

##### REX332

```ts
readonly REX332: "Value rejected by its schema" = "Value rejected by its schema";
```

<a id="rex333"></a>

##### REX333

```ts
readonly REX333: "Flow has no pending approval" = "Flow has no pending approval";
```

<a id="rex334"></a>

##### REX334

```ts
readonly REX334: "Actor may not decide the approval gate" = "Actor may not decide the approval gate";
```

<a id="rex400"></a>

##### REX400

```ts
readonly REX400: "Invalid server option" = "Invalid server option";
```

<a id="rex401"></a>

##### REX401

```ts
readonly REX401: "Duplicate or reserved procedure id" = "Duplicate or reserved procedure id";
```

<a id="rex402"></a>

##### REX402

```ts
readonly REX402: "Invalid audit entry" = "Invalid audit entry";
```

<a id="rex403"></a>

##### REX403

```ts
readonly REX403: "Invalid audit filter" = "Invalid audit filter";
```

<a id="rex404"></a>

##### REX404

```ts
readonly REX404: "Invalid prerender list or page path" = "Invalid prerender list or page path";
```

<a id="rex405"></a>

##### REX405

```ts
readonly REX405: "Static page cannot be generated" = "Static page cannot be generated";
```

<a id="rex406"></a>

##### REX406

```ts
readonly REX406: "Client directory missing" = "Client directory missing";
```

<a id="rex407"></a>

##### REX407

```ts
readonly REX407: "Invalid port" = "Invalid port";
```

<a id="rex408"></a>

##### REX408

```ts
readonly REX408: "Page loaders need createRexServer" = "Page loaders need createRexServer";
```

<a id="rex440"></a>

##### REX440

```ts
readonly REX440: "Server-only module imported by client code" = "Server-only module imported by client code";
```

<a id="rex441"></a>

##### REX441

```ts
readonly REX441: "Secret referenced by client code" = "Secret referenced by client code";
```

<a id="rex442"></a>

##### REX442

```ts
readonly REX442: "Action handler called in the browser" = "Action handler called in the browser";
```

<a id="rex450"></a>

##### REX450

```ts
readonly REX450: "Runtime not available for the adapter" = "Runtime not available for the adapter";
```

<a id="rex460"></a>

##### REX460

```ts
readonly REX460: "App folder layout is invalid" = "App folder layout is invalid";
```

<a id="rex461"></a>

##### REX461

```ts
readonly REX461: "Invalid Vite client manifest" = "Invalid Vite client manifest";
```

<a id="rex462"></a>

##### REX462

```ts
readonly REX462: "Invalid rex:app module" = "Invalid rex:app module";
```

<a id="rex463"></a>

##### REX463

```ts
readonly REX463: "Root element missing" = "Root element missing";
```

<a id="rex500"></a>

##### REX500

```ts
readonly REX500: "Manifest scan failed" = "Manifest scan failed";
```

<a id="rex501"></a>

##### REX501

```ts
readonly REX501: "Invalid manifest build option" = "Invalid manifest build option";
```

<a id="rex502"></a>

##### REX502

```ts
readonly REX502: "Manifest value cannot be serialised" = "Manifest value cannot be serialised";
```

<a id="rex503"></a>

##### REX503

```ts
readonly REX503: "Invalid checker rule" = "Invalid checker rule";
```

<a id="rex504"></a>

##### REX504

```ts
readonly REX504: "Invalid finding" = "Invalid finding";
```

<a id="rex505"></a>

##### REX505

```ts
readonly REX505: "Checker rule failed" = "Checker rule failed";
```

<a id="rex506"></a>

##### REX506

```ts
readonly REX506: "Unknown report format" = "Unknown report format";
```

<a id="rex507"></a>

##### REX507

```ts
readonly REX507: "Runtime check failed" = "Runtime check failed";
```

<a id="rex508"></a>

##### REX508

```ts
readonly REX508: "Config value is not static" = "Config value is not static";
```

<a id="rex509"></a>

##### REX509

```ts
readonly REX509: "Raw element where the DesignX kit has a primitive" = "Raw element where the DesignX kit has a primitive";
```

<a id="rex510"></a>

##### REX510

```ts
readonly REX510: "Pixel size on a part" = "Pixel size on a part";
```

<a id="rex511"></a>

##### REX511

```ts
readonly REX511: "Control under the 44 px touch target" = "Control under the 44 px touch target";
```

<a id="rex600"></a>

##### REX600

```ts
readonly REX600: "Invalid CLI command definition" = "Invalid CLI command definition";
```

<a id="rex601"></a>

##### REX601

```ts
readonly REX601: "Invalid generator argument" = "Invalid generator argument";
```

<a id="rex602"></a>

##### REX602

```ts
readonly REX602: "Generator refused to write" = "Generator refused to write";
```

<a id="rex603"></a>

##### REX603

```ts
readonly REX603: "Template dependency not pinned" = "Template dependency not pinned";
```

<a id="rex604"></a>

##### REX604

```ts
readonly REX604: "Invalid command line" = "Invalid command line";
```

<a id="rex605"></a>

##### REX605

```ts
readonly REX605: "Command refused" = "Command refused";
```

<a id="rex610"></a>

##### REX610

```ts
readonly REX610: "Codemod left a placeholder" = "Codemod left a placeholder";
```

<a id="rex611"></a>

##### REX611

```ts
readonly REX611: "Unknown migration source" = "Unknown migration source";
```

<a id="rex612"></a>

##### REX612

```ts
readonly REX612: "Invalid codemod module" = "Invalid codemod module";
```

***

<a id="rex_error_code_pattern"></a>

### REX\_ERROR\_CODE\_PATTERN

```ts
const REX_ERROR_CODE_PATTERN: RegExp;
```

***

<a id="rex_errors_docs_base"></a>

### REX\_ERRORS\_DOCS\_BASE

```ts
const REX_ERRORS_DOCS_BASE: "https://rex.sidioralabs.com/errors" = "https://rex.sidioralabs.com/errors";
```

***

<a id="rex_manifest_path"></a>

### REX\_MANIFEST\_PATH

```ts
const REX_MANIFEST_PATH: "/rex/manifest" = "/rex/manifest";
```

***

<a id="rex_pointers"></a>

### REX\_POINTERS

```ts
const REX_POINTERS: readonly ["coarse", "fine"];
```

***

<a id="rex_rpc_prefix"></a>

### REX\_RPC\_PREFIX

```ts
const REX_RPC_PREFIX: "/rex/rpc" = "/rex/rpc";
```

***

<a id="rex_screen_densities"></a>

### REX\_SCREEN\_DENSITIES

```ts
const REX_SCREEN_DENSITIES: readonly ["comfortable", "compact", "agent"];
```

***

<a id="rex_screens"></a>

### REX\_SCREENS

```ts
const REX_SCREENS: readonly ["phone", "tablet", "desktop", "wide"];
```

***

<a id="rex_version"></a>

### REX\_VERSION

```ts
const REX_VERSION: "0.2.0" = "0.2.0";
```

***

<a id="shortcut_modifiers"></a>

### SHORTCUT\_MODIFIERS

```ts
const SHORTCUT_MODIFIERS: readonly ["mod", "shift", "alt"];
```

***

<a id="sidecar_element_id"></a>

### SIDECAR\_ELEMENT\_ID

```ts
const SIDECAR_ELEMENT_ID: "rex-page" = "rex-page";
```

***

<a id="sidecar_mime_type"></a>

### SIDECAR\_MIME\_TYPE

```ts
const SIDECAR_MIME_TYPE: "application/rex+json" = "application/rex+json";
```

***

<a id="sidecar_version"></a>

### SIDECAR\_VERSION

```ts
const SIDECAR_VERSION: 1 = 1;
```

***

<a id="state_export_names"></a>

### STATE\_EXPORT\_NAMES

```ts
const STATE_EXPORT_NAMES: { readonly [S in RexDataState]: StateExportName<S> };
```

## Functions

<a id="action-9"></a>

### action()

```ts
function action<N, I, O>(name, config): ActionDeclaration<N, I, O>;
```

#### Type Parameters

##### N

`N` *extends* `string`

##### I

`I` *extends* [`StandardSchemaV1`](#standardschemav1)\<`unknown`, `unknown`\>

##### O

`O` *extends* [`StandardSchemaV1`](#standardschemav1)\<`unknown`, `unknown`\>

#### Parameters

##### name

`N`

##### config

[`ActionConfig`](#actionconfig)\<`I`, `O`\>

#### Returns

[`ActionDeclaration`](#actiondeclaration)\<`N`, `I`, `O`\>

***

<a id="actionaddress-1"></a>

### actionAddress()

```ts
function actionAddress<P, A>(page, action): `${P}/${A}`;
```

#### Type Parameters

##### P

`P` *extends* `string`

##### A

`A` *extends* `string`

#### Parameters

##### page

`P`

##### action

`A`

#### Returns

`` `${P}/${A}` ``

***

<a id="actionid"></a>

### actionId()

```ts
function actionId<N>(name): N;
```

#### Type Parameters

##### N

`N` *extends* `string`

#### Parameters

##### name

`N`

#### Returns

`N`

***

<a id="actor-4"></a>

### actor()

```ts
function actor(input): Actor;
```

#### Parameters

##### input

[`ActorInput`](#actorinput)

#### Returns

[`Actor`](#actor-1)

***

<a id="allof"></a>

### allOf()

```ts
function allOf(...predicates): Predicate;
```

#### Parameters

##### predicates

...[`Predicate`](#predicate)[]

#### Returns

[`Predicate`](#predicate)

***

<a id="always"></a>

### always()

```ts
function always(): Predicate;
```

#### Returns

[`Predicate`](#predicate)

***

<a id="anyof"></a>

### anyOf()

```ts
function anyOf(...predicates): Predicate;
```

#### Parameters

##### predicates

...[`Predicate`](#predicate)[]

#### Returns

[`Predicate`](#predicate)

***

<a id="bind"></a>

### bind()

```ts
function bind<E>(entity, store): EntityStore<E>;
```

#### Type Parameters

##### E

`E` *extends* [`AnyEntity`](#anyentity)

#### Parameters

##### entity

`E`

##### store

[`Store`](#store)\<[`InferEntity`](#inferentity)\<`E`\>\>

#### Returns

[`EntityStore`](#entitystore)\<`E`\>

***

<a id="can-1"></a>

### can()

```ts
function can(permission): Predicate;
```

#### Parameters

##### permission

`string`

#### Returns

[`Predicate`](#predicate)

***

<a id="compareids"></a>

### compareIds()

```ts
function compareIds(a, b): number;
```

#### Parameters

##### a

###### id

`string`

##### b

###### id

`string`

#### Returns

`number`

***

<a id="completedsteps"></a>

### completedSteps()

```ts
function completedSteps(entries): ReadonlySet<number>;
```

#### Parameters

##### entries

readonly [`JournalEntry`](#journalentry)[]

#### Returns

`ReadonlySet`\<`number`\>

***

<a id="createregistry"></a>

### createRegistry()

```ts
function createRegistry(): Registry;
```

#### Returns

[`Registry`](#registry)

***

<a id="decide"></a>

### decide()

```ts
function decide(
   declared, 
   instanceId, 
   decision, 
   actor
): Promise<FlowRunResult>;
```

#### Parameters

##### declared

[`AnyFlow`](#anyflow)

##### instanceId

`string`

##### decision

[`FlowDecision`](#flowdecision)

##### actor

[`Actor`](#actor-1)

#### Returns

`Promise`\<[`FlowRunResult`](#flowrunresult)\>

***

<a id="declarationname-1"></a>

### declarationName()

```ts
function declarationName<N>(declaration, name): N;
```

#### Type Parameters

##### N

`N` *extends* `string`

#### Parameters

##### declaration

[`DeclarationName`](#declarationname)

##### name

`N`

#### Returns

`N`

***

<a id="deprecated"></a>

### deprecated()

```ts
function deprecated(
   code, 
   message, 
   warn?
): boolean;
```

#### Parameters

##### code

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

##### message

`string`

##### warn?

[`DeprecationWarn`](#deprecationwarn) = `consoleWarn`

#### Returns

`boolean`

***

<a id="deprecationmessage"></a>

### deprecationMessage()

```ts
function deprecationMessage(code, message): string;
```

#### Parameters

##### code

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

##### message

`string`

#### Returns

`string`

***

<a id="entity-3"></a>

### entity()

```ts
function entity<N, F, K>(name, config): EntityDeclaration<N, F, K>;
```

#### Type Parameters

##### N

`N` *extends* `string`

##### F

`F` *extends* [`EntityFields`](#entityfields)

##### K

`K` *extends* `string` = `"id"` & \{ \[P in string \| number \| symbol\]: StandardInferOutput\<F\[P\]\> extends string ? P : never \}\[keyof `F`\]

#### Parameters

##### name

`N`

##### config

[`EntityConfig`](#entityconfig)\<`F`, `K`\>

#### Returns

[`EntityDeclaration`](#entitydeclaration)\<`N`, `F`, `K`\>

***

<a id="errordetail"></a>

### errorDetail()

```ts
function errorDetail(error): string;
```

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

<a id="errordocs"></a>

### errorDocs()

```ts
function errorDocs(code): string;
```

#### Parameters

##### code

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

#### Returns

`string`

***

<a id="escapeinlinejson"></a>

### escapeInlineJson()

```ts
function escapeInlineJson(value): string;
```

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

<a id="evaluate"></a>

### evaluate()

```ts
function evaluate(predicate, actor): PolicyResult;
```

#### Parameters

##### predicate

[`Predicate`](#predicate)

##### actor

[`Actor`](#actor-1)

#### Returns

[`PolicyResult`](#policyresult)

***

<a id="flow-6"></a>

### flow()

```ts
function flow<N>(name, config): FlowDeclaration<N>;
```

#### Type Parameters

##### N

`N` *extends* `string`

#### Parameters

##### name

`N`

##### config

[`FlowConfig`](#flowconfig)

#### Returns

[`FlowDeclaration`](#flowdeclaration)\<`N`\>

***

<a id="formatrexerror"></a>

### formatRexError()

```ts
function formatRexError(error, hint?): string;
```

#### Parameters

##### error

[`RexError`](#rexerror)

##### hint?

`string` \| `null`

#### Returns

`string`

***

<a id="haswarned"></a>

### hasWarned()

```ts
function hasWarned(code): boolean;
```

#### Parameters

##### code

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

#### Returns

`boolean`

***

<a id="isanonymous"></a>

### isAnonymous()

```ts
function isAnonymous(subject): boolean;
```

#### Parameters

##### subject

[`Actor`](#actor-1)

#### Returns

`boolean`

***

<a id="isjournal"></a>

### isJournal()

```ts
function isJournal(value): value is Journal;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is Journal`

***

<a id="isplainobject"></a>

### isPlainObject()

```ts
function isPlainObject(value): value is Record<string, unknown>;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is Record<string, unknown>`

***

<a id="ispredicate"></a>

### isPredicate()

```ts
function isPredicate(value): value is Predicate;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is Predicate`

***

<a id="isreservedquerykey"></a>

### isReservedQueryKey()

```ts
function isReservedQueryKey(key): key is "input" | "density" | "act" | "draft";
```

#### Parameters

##### key

`string`

#### Returns

key is "input" \| "density" \| "act" \| "draft"

***

<a id="isrexdatastate"></a>

### isRexDataState()

```ts
function isRexDataState(value): value is "loading" | "empty" | "stale" | "partial" | "offline" | "permission-denied" | "recoverable-error" | "terminal-error" | "ready";
```

#### Parameters

##### value

`unknown`

#### Returns

value is "loading" \| "empty" \| "stale" \| "partial" \| "offline" \| "permission-denied" \| "recoverable-error" \| "terminal-error" \| "ready"

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

<a id="isrexerror"></a>

### isRexError()

```ts
function isRexError(value): value is RexError;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is RexError`

***

<a id="isrexerrorcode"></a>

### isRexErrorCode()

```ts
function isRexErrorCode(value): value is "REX100" | "REX101" | "REX102" | "REX110" | "REX111" | "REX112" | "REX113" | "REX114" | "REX115" | "REX116" | "REX117" | "REX118" | "REX119" | "REX120" | "REX121" | "REX122" | "REX123" | "REX200" | "REX201" | "REX202" | "REX203" | "REX204" | "REX205" | "REX206" | "REX207" | "REX208" | "REX209" | "REX210" | "REX211" | "REX212" | "REX213" | "REX214" | "REX215" | "REX216" | "REX217" | "REX218" | "REX219" | "REX220" | "REX221" | "REX222" | "REX223" | "REX224" | "REX300" | "REX301" | "REX302" | "REX303" | "REX304" | "REX305" | "REX306" | "REX307" | "REX308" | "REX309" | "REX310" | "REX311" | "REX312" | "REX313" | "REX314" | "REX315" | "REX316" | "REX317" | "REX318" | "REX319" | "REX320" | "REX321" | "REX322" | "REX323" | "REX324" | "REX325" | "REX326" | "REX327" | "REX328" | "REX329" | "REX330" | "REX331" | "REX332" | "REX333" | "REX334" | "REX400" | "REX401" | "REX402" | "REX403" | "REX404" | "REX405" | "REX406" | "REX407" | "REX408" | "REX440" | "REX441" | "REX442" | "REX450" | "REX460" | "REX461" | "REX462" | "REX463" | "REX500" | "REX501" | "REX502" | "REX503" | "REX504" | "REX505" | "REX506" | "REX507" | "REX508" | "REX509" | "REX510" | "REX511" | "REX600" | "REX601" | "REX602" | "REX603" | "REX604" | "REX605" | "REX610" | "REX611" | "REX612";
```

#### Parameters

##### value

`unknown`

#### Returns

value is "REX100" \| "REX101" \| "REX102" \| "REX110" \| "REX111" \| "REX112" \| "REX113" \| "REX114" \| "REX115" \| "REX116" \| "REX117" \| "REX118" \| "REX119" \| "REX120" \| "REX121" \| "REX122" \| "REX123" \| "REX200" \| "REX201" \| "REX202" \| "REX203" \| "REX204" \| "REX205" \| "REX206" \| "REX207" \| "REX208" \| "REX209" \| "REX210" \| "REX211" \| "REX212" \| "REX213" \| "REX214" \| "REX215" \| "REX216" \| "REX217" \| "REX218" \| "REX219" \| "REX220" \| "REX221" \| "REX222" \| "REX223" \| "REX224" \| "REX300" \| "REX301" \| "REX302" \| "REX303" \| "REX304" \| "REX305" \| "REX306" \| "REX307" \| "REX308" \| "REX309" \| "REX310" \| "REX311" \| "REX312" \| "REX313" \| "REX314" \| "REX315" \| "REX316" \| "REX317" \| "REX318" \| "REX319" \| "REX320" \| "REX321" \| "REX322" \| "REX323" \| "REX324" \| "REX325" \| "REX326" \| "REX327" \| "REX328" \| "REX329" \| "REX330" \| "REX331" \| "REX332" \| "REX333" \| "REX334" \| "REX400" \| "REX401" \| "REX402" \| "REX403" \| "REX404" \| "REX405" \| "REX406" \| "REX407" \| "REX408" \| "REX440" \| "REX441" \| "REX442" \| "REX450" \| "REX460" \| "REX461" \| "REX462" \| "REX463" \| "REX500" \| "REX501" \| "REX502" \| "REX503" \| "REX504" \| "REX505" \| "REX506" \| "REX507" \| "REX508" \| "REX509" \| "REX510" \| "REX511" \| "REX600" \| "REX601" \| "REX602" \| "REX603" \| "REX604" \| "REX605" \| "REX610" \| "REX611" \| "REX612"

***

<a id="isstandardschema"></a>

### isStandardSchema()

```ts
function isStandardSchema(value): value is StandardSchemaV1<unknown, unknown>;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is StandardSchemaV1<unknown, unknown>`

***

<a id="isvalidname"></a>

### isValidName()

```ts
function isValidName(name): name is string;
```

#### Parameters

##### name

`unknown`

#### Returns

`name is string`

***

<a id="locaterexerror"></a>

### locateRexError()

```ts
function locateRexError(error, location): RexError;
```

#### Parameters

##### error

[`RexError`](#rexerror)

##### location

[`RexErrorLocation`](#rexerrorlocation)

#### Returns

[`RexError`](#rexerror)

***

<a id="matchesfilter"></a>

### matchesFilter()

```ts
function matchesFilter<T>(record, filter): boolean;
```

#### Type Parameters

##### T

`T`

#### Parameters

##### record

`T`

##### filter

[`StoreFilter`](#storefilter)\<`T`\>

#### Returns

`boolean`

***

<a id="memoryjournal"></a>

### memoryJournal()

```ts
function memoryJournal(): Journal;
```

#### Returns

[`Journal`](#journal-2)

***

<a id="memorystore"></a>

### memoryStore()

```ts
function memoryStore<E>(entity, seed?): Store<InferEntity<E>>;
```

#### Type Parameters

##### E

`E` *extends* [`AnyEntity`](#anyentity)

#### Parameters

##### entity

`E`

##### seed?

readonly [`InferEntity`](#inferentity)\<`E`\>[] = `[]`

#### Returns

[`Store`](#store)\<[`InferEntity`](#inferentity)\<`E`\>\>

***

<a id="never"></a>

### never()

```ts
function never(): Predicate;
```

#### Returns

[`Predicate`](#predicate)

***

<a id="normalizelistquery"></a>

### normalizeListQuery()

```ts
function normalizeListQuery<T>(query?): NormalizedListQuery<T>;
```

#### Type Parameters

##### T

`T`

#### Parameters

##### query?

[`ListQuery`](#listquery)\<`T`\> = `{}`

#### Returns

[`NormalizedListQuery`](#normalizedlistquery)\<`T`\>

***

<a id="overlayaddress-1"></a>

### overlayAddress()

```ts
function overlayAddress<P, O>(page, overlay): `${P}/${O}`;
```

#### Type Parameters

##### P

`P` *extends* `string`

##### O

`O` *extends* `string`

#### Parameters

##### page

`P`

##### overlay

`O`

#### Returns

`` `${P}/${O}` ``

***

<a id="overlaydeclaration-1"></a>

### overlayDeclaration()

```ts
function overlayDeclaration<N>(input, owner?): OverlayDeclaration<N>;
```

#### Type Parameters

##### N

`N` *extends* `string`

#### Parameters

##### input

[`OverlayDeclaration`](#overlaydeclaration)\<`N`\>

##### owner?

`string` = `"overlay"`

#### Returns

[`OverlayDeclaration`](#overlaydeclaration)\<`N`\>

***

<a id="overlayname"></a>

### overlayName()

```ts
function overlayName<N>(name): N;
```

#### Type Parameters

##### N

`N` *extends* `string`

#### Parameters

##### name

`N`

#### Returns

`N`

***

<a id="page-5"></a>

### page()

```ts
function page<N, P, S, R, O, A, L>(name, config): PageDeclaration<N, P, S[number], R, O, A, L>;
```

#### Type Parameters

##### N

`N` *extends* `string`

##### P

`P` *extends* [`StandardSchemaV1`](#standardschemav1)\<`unknown`, `unknown`\> = [`EmptyPageParams`](#emptypageparams)

##### S

`S` *extends* readonly (
  \| `"loading"`
  \| `"empty"`
  \| `"stale"`
  \| `"partial"`
  \| `"offline"`
  \| `"permission-denied"`
  \| `"recoverable-error"`
  \| `"terminal-error"`
  \| `"ready"`)[] = readonly \[`"loading"`, `"empty"`, `"stale"`, `"partial"`, `"offline"`, `"permission-denied"`, `"recoverable-error"`, `"terminal-error"`, `"ready"`\]

##### R

`R` *extends* `string` = `never`

##### O

`O` *extends* `string` = `never`

##### A

`A` *extends* [`AnyAction`](#anyaction) = `never`

##### L

`L` *extends* `Readonly`\<`Record`\<`string`, [`PageLoaderSpec`](#pageloaderspec)\>\> = \{
\}

#### Parameters

##### name

`N`

##### config

[`PageConfig`](#pageconfig)\<`P`, `S`, `R`, `O`, `A`, `L`\>

#### Returns

[`PageDeclaration`](#pagedeclaration)\<`N`, `P`, `S`\[`number`\], `R`, `O`, `A`, `L`\>

***

<a id="pageaddress-1"></a>

### pageAddress()

```ts
function pageAddress<P>(page): P;
```

#### Type Parameters

##### P

`P` *extends* `string`

#### Parameters

##### page

`P`

#### Returns

`P`

***

<a id="pageid"></a>

### pageId()

```ts
function pageId<N>(name): N;
```

#### Type Parameters

##### N

`N` *extends* `string`

#### Parameters

##### name

`N`

#### Returns

`N`

***

<a id="parseroute"></a>

### parseRoute()

```ts
function parseRoute(route): ParsedRoute;
```

#### Parameters

##### route

`string`

#### Returns

[`ParsedRoute`](#parsedroute)

***

<a id="parseshortcut"></a>

### parseShortcut()

```ts
function parseShortcut(shortcut): ParsedShortcut;
```

#### Parameters

##### shortcut

`string`

#### Returns

[`ParsedShortcut`](#parsedshortcut)

***

<a id="policy-8"></a>

### policy()

```ts
function policy<N, P>(name, config): PolicyDeclaration<N, P>;
```

#### Type Parameters

##### N

`N` *extends* `string`

##### P

`P` *extends* `string`

#### Parameters

##### name

`N`

##### config

[`PolicyConfig`](#policyconfig)\<`P`\>

#### Returns

[`PolicyDeclaration`](#policydeclaration)\<`N`, `P`\>

***

<a id="predicatetojson"></a>

### predicateToJson()

```ts
function predicateToJson(predicate): PredicateJson;
```

#### Parameters

##### predicate

[`Predicate`](#predicate)

#### Returns

[`PredicateJson`](#predicatejson)

***

<a id="regionaddress-1"></a>

### regionAddress()

```ts
function regionAddress<P, R>(page, region): `${P}/${R}`;
```

#### Type Parameters

##### P

`P` *extends* `string`

##### R

`R` *extends* `string`

#### Parameters

##### page

`P`

##### region

`R`

#### Returns

`` `${P}/${R}` ``

***

<a id="regionname"></a>

### regionName()

```ts
function regionName<N>(name): N;
```

#### Type Parameters

##### N

`N` *extends* `string`

#### Parameters

##### name

`N`

#### Returns

`N`

***

<a id="requiredstateexports"></a>

### requiredStateExports()

```ts
function requiredStateExports(states): readonly string[];
```

#### Parameters

##### states

readonly (
  \| `"loading"`
  \| `"empty"`
  \| `"stale"`
  \| `"partial"`
  \| `"offline"`
  \| `"permission-denied"`
  \| `"recoverable-error"`
  \| `"terminal-error"`
  \| `"ready"`)[]

#### Returns

readonly `string`[]

***

<a id="requires-1"></a>

### requires()

```ts
function requires(clause): Predicate;
```

#### Parameters

##### clause

[`RequiresClause`](#requiresclause)

#### Returns

[`Predicate`](#predicate)

***

<a id="resetdeprecations"></a>

### resetDeprecations()

```ts
function resetDeprecations(): void;
```

#### Returns

`void`

***

<a id="runflow"></a>

### runFlow()

```ts
function runFlow(
   declared, 
   instanceId, 
   ctx
): Promise<FlowRunResult>;
```

#### Parameters

##### declared

[`AnyFlow`](#anyflow)

##### instanceId

`string`

##### ctx

[`FlowRunContext`](#flowruncontext)

#### Returns

`Promise`\<[`FlowRunResult`](#flowrunresult)\>

***

<a id="stackframes"></a>

### stackFrames()

```ts
function stackFrames(stack): RexStackFrame[];
```

#### Parameters

##### stack

`string` \| `undefined`

#### Returns

[`RexStackFrame`](#rexstackframe)[]

***

<a id="stateexportname-1"></a>

### stateExportName()

```ts
function stateExportName<S>(state): PascalSegments<S>;
```

#### Type Parameters

##### S

`S` *extends* 
  \| `"loading"`
  \| `"empty"`
  \| `"stale"`
  \| `"partial"`
  \| `"offline"`
  \| `"permission-denied"`
  \| `"recoverable-error"`
  \| `"terminal-error"`
  \| `"ready"`

#### Parameters

##### state

`S`

#### Returns

`PascalSegments`\<`S`\>

***

<a id="statusof"></a>

### statusOf()

```ts
function statusOf(entries): FlowStatus;
```

#### Parameters

##### entries

readonly [`JournalEntry`](#journalentry)[]

#### Returns

[`FlowStatus`](#flowstatus)

***

<a id="titlefromid"></a>

### titleFromId()

```ts
function titleFromId(id): string;
```

#### Parameters

##### id

`string`

#### Returns

`string`

***

<a id="validatecomponentname"></a>

### validateComponentName()

```ts
function validateComponentName<N>(name, kind?): N;
```

#### Type Parameters

##### N

`N` *extends* `string`

#### Parameters

##### name

`N`

##### kind?

`string` = `"component name"`

#### Returns

`N`

***

<a id="validatename"></a>

### validateName()

```ts
function validateName<N>(name, kind?): N;
```

#### Type Parameters

##### N

`N` *extends* `string`

#### Parameters

##### name

`N`

##### kind?

`string` = `"name"`

#### Returns

`N`

***

<a id="validateshortcut"></a>

### validateShortcut()

```ts
function validateShortcut(shortcut): string;
```

#### Parameters

##### shortcut

`string`

#### Returns

`string`

***

<a id="validatestandard"></a>

### validateStandard()

```ts
function validateStandard<S>(schema, value): Promise<StandardResult<StandardInferOutput<S>>>;
```

#### Type Parameters

##### S

`S` *extends* [`StandardSchemaV1`](#standardschemav1)\<`unknown`, `unknown`\>

#### Parameters

##### schema

`S`

##### value

`unknown`

#### Returns

`Promise`\<`StandardResult`\<[`StandardInferOutput`](#standardinferoutput)\<`S`\>\>\>

***

<a id="validatestandardsync"></a>

### validateStandardSync()

```ts
function validateStandardSync<S>(schema, value): StandardResult<StandardInferOutput<S>>;
```

#### Type Parameters

##### S

`S` *extends* [`StandardSchemaV1`](#standardschemav1)\<`unknown`, `unknown`\>

#### Parameters

##### schema

`S`

##### value

`unknown`

#### Returns

`StandardResult`\<[`StandardInferOutput`](#standardinferoutput)\<`S`\>\>

***

<a id="validatestoreid"></a>

### validateStoreId()

```ts
function validateStoreId(id): string;
```

#### Parameters

##### id

`unknown`

#### Returns

`string`
