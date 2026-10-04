[@sidioralabs/rex API](../../../README.md) / @sidioralabs/rex/store/drizzle

# @sidioralabs/rex/store/drizzle

## Interfaces

<a id="columnspec"></a>

### ColumnSpec

#### Properties

<a id="field"></a>

##### field

```ts
readonly field: string;
```

<a id="key"></a>

##### key

```ts
readonly key: boolean;
```

<a id="nullable"></a>

##### nullable

```ts
readonly nullable: boolean;
```

<a id="optional"></a>

##### optional

```ts
readonly optional: boolean;
```

<a id="type"></a>

##### type

```ts
readonly type: ColumnType;
```

***

<a id="drizzlestoreoptions"></a>

### DrizzleStoreOptions

#### Properties

<a id="createtable"></a>

##### createTable?

```ts
readonly optional createTable?: boolean;
```

<a id="table"></a>

##### table?

```ts
readonly optional table?: string;
```

## Type Aliases

<a id="asyncsqlitedatabase"></a>

### AsyncSQLiteDatabase

```ts
type AsyncSQLiteDatabase = BaseSQLiteDatabase<"async", unknown, Record<string, unknown>>;
```

***

<a id="columntype"></a>

### ColumnType

```ts
type ColumnType = "text" | "integer" | "real" | "boolean" | "json";
```

## Functions

<a id="columnspecs"></a>

### columnSpecs()

```ts
function columnSpecs(declared): readonly ColumnSpec[];
```

#### Parameters

##### declared

[`AnyEntity`](../../rex.md#anyentity)

#### Returns

readonly [`ColumnSpec`](#columnspec)[]

***

<a id="createtablestatement"></a>

### createTableStatement()

```ts
function createTableStatement(declared, table?): string;
```

#### Parameters

##### declared

[`AnyEntity`](../../rex.md#anyentity)

##### table?

`string` = `...`

#### Returns

`string`

***

<a id="drizzlestore"></a>

### drizzleStore()

```ts
function drizzleStore<E>(
   declared, 
   db, 
   options?
): Store<InferEntity<E>>;
```

#### Type Parameters

##### E

`E` *extends* [`AnyEntity`](../../rex.md#anyentity)

#### Parameters

##### declared

`E`

##### db

[`AsyncSQLiteDatabase`](#asyncsqlitedatabase)

##### options?

[`DrizzleStoreOptions`](#drizzlestoreoptions) = `{}`

#### Returns

[`Store`](../../rex.md#store)\<[`InferEntity`](../../rex.md#inferentity)\<`E`\>\>

***

<a id="entitytable"></a>

### entityTable()

```ts
function entityTable(declared, table?): SQLiteTableWithColumns<{
}>;
```

#### Parameters

##### declared

[`AnyEntity`](../../rex.md#anyentity)

##### table?

`string` = `...`

#### Returns

`SQLiteTableWithColumns`\<\{
\}\>

***

<a id="tablenamefor"></a>

### tableNameFor()

```ts
function tableNameFor(declared): string;
```

#### Parameters

##### declared

[`AnyEntity`](../../rex.md#anyentity)

#### Returns

`string`
