[@sidioralabs/rex API](../../README.md) / @sidioralabs/rex/schema

# @sidioralabs/rex/schema

## Interfaces

<a id="integeroptions"></a>

### IntegerOptions

#### Properties

<a id="max"></a>

##### max?

```ts
readonly optional max?: number;
```

<a id="min"></a>

##### min?

```ts
readonly optional min?: number;
```

***

<a id="realoptions"></a>

### RealOptions

#### Properties

<a id="max-1"></a>

##### max?

```ts
readonly optional max?: number;
```

<a id="min-1"></a>

##### min?

```ts
readonly optional min?: number;
```

***

<a id="rexfieldmethods"></a>

### RexFieldMethods

#### Type Parameters

##### T

`T` *extends* `zm.ZodMiniType`

#### Methods

<a id="default"></a>

##### default()

```ts
default(value): RexField<ZodMiniDefault<T>>;
```

###### Parameters

###### value

`NoUndefined`\<`output`\<`T`\>\>

###### Returns

[`RexField`](#rexfield)\<`ZodMiniDefault`\<`T`\>\>

<a id="meta"></a>

##### meta()

```ts
meta(meta): RexField<T>;
```

###### Parameters

###### meta

`FieldMeta`

###### Returns

[`RexField`](#rexfield)\<`T`\>

<a id="nullable"></a>

##### nullable()

```ts
nullable(): RexField<ZodMiniNullable<T>>;
```

###### Returns

[`RexField`](#rexfield)\<`ZodMiniNullable`\<`T`\>\>

<a id="optional"></a>

##### optional()

```ts
optional(): RexField<ZodMiniOptional<T>>;
```

###### Returns

[`RexField`](#rexfield)\<`ZodMiniOptional`\<`T`\>\>

***

<a id="textoptions"></a>

### TextOptions

#### Properties

<a id="max-2"></a>

##### max?

```ts
readonly optional max?: number;
```

<a id="min-2"></a>

##### min?

```ts
readonly optional min?: number;
```

## Type Aliases

<a id="fieldkind"></a>

### FieldKind

```ts
type FieldKind = 
  | "id"
  | "text"
  | "money"
  | "integer"
  | "real"
  | "boolean"
  | "enum"
  | "ref"
  | "timestamp"
  | "json";
```

***

<a id="jsonschema"></a>

### JsonSchema

```ts
type JsonSchema = object;
```

#### Index Signature

```ts
[key: string]: unknown
```

***

<a id="reftarget"></a>

### RefTarget

```ts
type RefTarget = 
  | string
  | {
  id: string;
};
```

***

<a id="rexfield"></a>

### RexField

```ts
type RexField<T> = T & RexFieldMethods<T>;
```

#### Type Parameters

##### T

`T` *extends* `zm.ZodMiniType`

## Variables

<a id="field_kind_key"></a>

### FIELD\_KIND\_KEY

```ts
const FIELD_KIND_KEY: "x-rex-field" = "x-rex-field";
```

***

<a id="field_kinds"></a>

### FIELD\_KINDS

```ts
const FIELD_KINDS: readonly FieldKind[];
```

***

<a id="field_ref_key"></a>

### FIELD\_REF\_KEY

```ts
const FIELD_REF_KEY: "x-rex-ref" = "x-rex-ref";
```

***

<a id="id_pattern"></a>

### ID\_PATTERN

```ts
const ID_PATTERN: RegExp;
```

***

<a id="money_pattern"></a>

### MONEY\_PATTERN

```ts
const MONEY_PATTERN: RegExp;
```

***

<a id="standard_vendor_key"></a>

### STANDARD\_VENDOR\_KEY

```ts
const STANDARD_VENDOR_KEY: "x-rex-standard" = "x-rex-standard";
```

## Functions

<a id="boolean"></a>

### boolean()

```ts
function boolean(): RexField<ZodMiniBoolean<boolean>>;
```

#### Returns

[`RexField`](#rexfield)\<`ZodMiniBoolean`\<`boolean`\>\>

***

<a id="enumof"></a>

### enumOf()

```ts
function enumOf<T>(values): RexField<ZodMiniEnum<{ [k in string]: { [k in string]: k }[k] }>>;
```

#### Type Parameters

##### T

`T` *extends* readonly \[`string`, `string`\]

#### Parameters

##### values

`T`

#### Returns

[`RexField`](#rexfield)\<`ZodMiniEnum`\<`{ [k in string]: { [k in string]: k }[k] }`\>\>

***

<a id="field"></a>

### field()

```ts
function field<T>(schema, meta?): RexField<T>;
```

#### Type Parameters

##### T

`T` *extends* `ZodMiniType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

#### Parameters

##### schema

`T`

##### meta?

`Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Returns

[`RexField`](#rexfield)\<`T`\>

***

<a id="fieldkind-1"></a>

### fieldKind()

```ts
function fieldKind(schema): FieldKind | undefined;
```

#### Parameters

##### schema

`unknown`

#### Returns

[`FieldKind`](#fieldkind) \| `undefined`

***

<a id="fromstandard"></a>

### fromStandard()

```ts
function fromStandard<S>(schema): AsZodSchema<S>;
```

#### Type Parameters

##### S

`S` *extends* [`StandardSchemaV1`](../rex.md#standardschemav1)\<`unknown`, `unknown`\>

#### Parameters

##### schema

`S`

#### Returns

`AsZodSchema`\<`S`\>

***

<a id="id"></a>

### id()

```ts
function id(): RexField<ZodMiniString<string>>;
```

#### Returns

[`RexField`](#rexfield)\<`ZodMiniString`\<`string`\>\>

***

<a id="integer"></a>

### integer()

```ts
function integer(options?): RexField<ZodMiniInt>;
```

#### Parameters

##### options?

[`IntegerOptions`](#integeroptions) = `{}`

#### Returns

[`RexField`](#rexfield)\<`ZodMiniInt`\>

***

<a id="json"></a>

### json()

```ts
function json(): RexField<ZodMiniJSONSchema>;
```

#### Returns

[`RexField`](#rexfield)\<`ZodMiniJSONSchema`\>

***

<a id="money"></a>

### money()

```ts
function money(): RexField<ZodMiniString<string>>;
```

#### Returns

[`RexField`](#rexfield)\<`ZodMiniString`\<`string`\>\>

***

<a id="real"></a>

### real()

```ts
function real(options?): RexField<ZodMiniNumber<number>>;
```

#### Parameters

##### options?

[`RealOptions`](#realoptions) = `{}`

#### Returns

[`RexField`](#rexfield)\<`ZodMiniNumber`\<`number`\>\>

***

<a id="ref"></a>

### ref()

```ts
function ref(target): RexField<ZodMiniString<string>>;
```

#### Parameters

##### target

[`RefTarget`](#reftarget)

#### Returns

[`RexField`](#rexfield)\<`ZodMiniString`\<`string`\>\>

***

<a id="reftarget-1"></a>

### refTarget()

```ts
function refTarget(schema): string | undefined;
```

#### Parameters

##### schema

`unknown`

#### Returns

`string` \| `undefined`

***

<a id="standardsource"></a>

### standardSource()

```ts
function standardSource(schema): 
  | StandardSchemaV1<unknown, unknown>
  | null;
```

#### Parameters

##### schema

`unknown`

#### Returns

  \| [`StandardSchemaV1`](../rex.md#standardschemav1)\<`unknown`, `unknown`\>
  \| `null`

***

<a id="text"></a>

### text()

```ts
function text(options?): RexField<ZodMiniString<string>>;
```

#### Parameters

##### options?

[`TextOptions`](#textoptions) = `{}`

#### Returns

[`RexField`](#rexfield)\<`ZodMiniString`\<`string`\>\>

***

<a id="timestamp"></a>

### timestamp()

```ts
function timestamp(): RexField<ZodMiniISODateTime>;
```

#### Returns

[`RexField`](#rexfield)\<`ZodMiniISODateTime`\>
