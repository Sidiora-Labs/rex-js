[@sidioralabs/rex API](../../README.md) / @sidioralabs/rex/eslint

# @sidioralabs/rex/eslint

## Type Aliases

<a id="lintruleid"></a>

### LintRuleId

```ts
type LintRuleId = typeof LINT_RULE_IDS[number];
```

## Variables

<a id="config"></a>

### config

```ts
const config: Linter.Config[];
```

***

<a id="lint_files"></a>

### LINT\_FILES

```ts
const LINT_FILES: string[];
```

***

<a id="lint_ignores"></a>

### LINT\_IGNORES

```ts
const LINT_IGNORES: string[];
```

***

<a id="lint_rule_ids"></a>

### LINT\_RULE\_IDS

```ts
const LINT_RULE_IDS: readonly ["boundaries", "naming", "traps", "tokens", "a11y", "media"];
```

***

<a id="plugin"></a>

### plugin

```ts
const plugin: ESLint.Plugin;
```

***

<a id="rexrules"></a>

### rexRules

```ts
const rexRules: Linter.RulesRecord;
```

## Functions

<a id="checkerfindings"></a>

### checkerFindings()

```ts
function checkerFindings(file, rule): readonly Finding[];
```

#### Parameters

##### file

`string`

##### rule

[`Rule`](check.md#rule-2)

#### Returns

readonly [`Finding`](check.md#finding)[]

***

<a id="eslintrule"></a>

### eslintRule()

```ts
function eslintRule(rule): RuleModule;
```

#### Parameters

##### rule

[`Rule`](check.md#rule-2)

#### Returns

`RuleModule`

***

<a id="findapproot"></a>

### findAppRoot()

```ts
function findAppRoot(file): string | null;
```

#### Parameters

##### file

`string`

#### Returns

`string` \| `null`

***

<a id="lintrules"></a>

### lintRules()

```ts
function lintRules(rules?): readonly Rule[];
```

#### Parameters

##### rules?

readonly [`Rule`](check.md#rule-2)[] = `defaultRules`

#### Returns

readonly [`Rule`](check.md#rule-2)[]

## References

<a id="default"></a>

### default

Renames and re-exports [config](#config)
