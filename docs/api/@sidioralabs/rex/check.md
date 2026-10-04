[@sidioralabs/rex API](../../README.md) / @sidioralabs/rex/check

# @sidioralabs/rex/check

## Interfaces

<a id="appfile"></a>

### AppFile

#### Properties

<a id="file"></a>

##### file

```ts
readonly file: string;
```

<a id="name"></a>

##### name

```ts
readonly name: string;
```

<a id="page"></a>

##### page

```ts
readonly page: string | null;
```

<a id="path"></a>

##### path

```ts
readonly path: string;
```

<a id="region"></a>

##### region

```ts
readonly region: string | null;
```

<a id="role"></a>

##### role

```ts
readonly role: 
  | "page"
  | "action"
  | "entity"
  | "policy"
  | "flow"
  | "overlay"
  | "region"
  | "view"
  | "data"
  | "part"
  | "states"
  | "hook"
  | "component"
  | "test";
```

***

<a id="apppage"></a>

### AppPage

#### Properties

<a id="dir"></a>

##### dir

```ts
readonly dir: string;
```

<a id="hooks"></a>

##### hooks

```ts
readonly hooks: readonly AppFile[];
```

<a id="id"></a>

##### id

```ts
readonly id: string;
```

<a id="overlays"></a>

##### overlays

```ts
readonly overlays: readonly AppFile[];
```

<a id="page-1"></a>

##### page

```ts
readonly page: AppFile | null;
```

<a id="regions"></a>

##### regions

```ts
readonly regions: readonly AppRegion[];
```

<a id="states"></a>

##### states

```ts
readonly states: AppFile | null;
```

<a id="tests"></a>

##### tests

```ts
readonly tests: readonly AppFile[];
```

<a id="view"></a>

##### view

```ts
readonly view: AppFile | null;
```

***

<a id="appregion"></a>

### AppRegion

#### Properties

<a id="dir-1"></a>

##### dir

```ts
readonly dir: string;
```

<a id="file-1"></a>

##### file

```ts
readonly file: AppFile | null;
```

<a id="name-1"></a>

##### name

```ts
readonly name: string;
```

<a id="parts"></a>

##### parts

```ts
readonly parts: readonly AppFile[];
```

***

<a id="checkresult"></a>

### CheckResult

#### Extended by

- [`RunCheckResult`](#runcheckresult)

#### Properties

<a id="errors"></a>

##### errors

```ts
readonly errors: number;
```

<a id="exitcode"></a>

##### exitCode

```ts
readonly exitCode: 0 | 1;
```

<a id="findings"></a>

##### findings

```ts
readonly findings: readonly Finding[];
```

<a id="warnings"></a>

##### warnings

```ts
readonly warnings: number;
```

***

<a id="exportref"></a>

### ExportRef

#### Extends

- [`Location`](#location)

#### Properties

<a id="column"></a>

##### column

```ts
readonly column: number;
```

###### Inherited from

[`Location`](#location).[`column`](#column-4)

<a id="from"></a>

##### from

```ts
readonly from: string | null;
```

<a id="line"></a>

##### line

```ts
readonly line: number;
```

###### Inherited from

[`Location`](#location).[`line`](#line-4)

<a id="name-2"></a>

##### name

```ts
readonly name: string;
```

<a id="typeonly"></a>

##### typeOnly

```ts
readonly typeOnly: boolean;
```

***

<a id="finding"></a>

### Finding

#### Properties

<a id="column-1"></a>

##### column

```ts
readonly column: number;
```

<a id="file-2"></a>

##### file

```ts
readonly file: string;
```

<a id="hint"></a>

##### hint

```ts
readonly hint: string;
```

<a id="line-1"></a>

##### line

```ts
readonly line: number;
```

<a id="message"></a>

##### message

```ts
readonly message: string;
```

<a id="rule"></a>

##### rule

```ts
readonly rule: string;
```

<a id="severity"></a>

##### severity

```ts
readonly severity: "error" | "warning";
```

***

<a id="findinginput"></a>

### FindingInput

#### Properties

<a id="column-2"></a>

##### column?

```ts
readonly optional column?: number;
```

<a id="file-3"></a>

##### file

```ts
readonly file: string;
```

<a id="hint-1"></a>

##### hint

```ts
readonly hint: string;
```

<a id="line-2"></a>

##### line?

```ts
readonly optional line?: number;
```

<a id="message-1"></a>

##### message

```ts
readonly message: string;
```

<a id="rule-1"></a>

##### rule

```ts
readonly rule: string;
```

<a id="severity-1"></a>

##### severity?

```ts
readonly optional severity?: "error" | "warning";
```

***

<a id="importref"></a>

### ImportRef

#### Extends

- [`Location`](#location)

#### Properties

<a id="column-3"></a>

##### column

```ts
readonly column: number;
```

###### Inherited from

[`Location`](#location).[`column`](#column-4)

<a id="kind"></a>

##### kind

```ts
readonly kind: ImportKind;
```

<a id="line-3"></a>

##### line

```ts
readonly line: number;
```

###### Inherited from

[`Location`](#location).[`line`](#line-4)

<a id="locals"></a>

##### locals

```ts
readonly locals: readonly string[];
```

<a id="names"></a>

##### names

```ts
readonly names: readonly string[];
```

<a id="specifier"></a>

##### specifier

```ts
readonly specifier: string;
```

<a id="typeonly-1"></a>

##### typeOnly

```ts
readonly typeOnly: boolean;
```

***

<a id="location"></a>

### Location

#### Extended by

- [`ImportRef`](#importref)
- [`ExportRef`](#exportref)
- [`StaticDeclaration`](#staticdeclaration)
- [`StaticName`](#staticname)
- [`StaticOverlay`](#staticoverlay)
- [`StaticActionRef`](#staticactionref)
- [`StaticPageDeclaration`](#staticpagedeclaration)

#### Properties

<a id="column-4"></a>

##### column

```ts
readonly column: number;
```

<a id="line-4"></a>

##### line

```ts
readonly line: number;
```

***

<a id="rexapp"></a>

### RexApp

#### Properties

<a id="appdir"></a>

##### appDir

```ts
readonly appDir: string;
```

<a id="files"></a>

##### files

```ts
readonly files: readonly AppFile[];
```

<a id="pages"></a>

##### pages

```ts
readonly pages: readonly AppPage[];
```

<a id="root"></a>

##### root

```ts
readonly root: string;
```

<a id="unclassified"></a>

##### unclassified

```ts
readonly unclassified: readonly string[];
```

#### Methods

<a id="byrole"></a>

##### byRole()

```ts
byRole(role): readonly AppFile[];
```

###### Parameters

###### role

  \| `"page"`
  \| `"action"`
  \| `"entity"`
  \| `"policy"`
  \| `"flow"`
  \| `"overlay"`
  \| `"region"`
  \| `"view"`
  \| `"data"`
  \| `"part"`
  \| `"states"`
  \| `"hook"`
  \| `"component"`
  \| `"test"`

###### Returns

readonly [`AppFile`](#appfile)[]

<a id="fileat"></a>

##### fileAt()

```ts
fileAt(file): AppFile | undefined;
```

###### Parameters

###### file

`string`

###### Returns

[`AppFile`](#appfile) \| `undefined`

<a id="pageof"></a>

##### pageOf()

```ts
pageOf(id): AppPage | undefined;
```

###### Parameters

###### id

`string`

###### Returns

[`AppPage`](#apppage) \| `undefined`

<a id="relative"></a>

##### relative()

```ts
relative(file): string;
```

###### Parameters

###### file

`string`

###### Returns

`string`

***

<a id="rule-2"></a>

### Rule

#### Properties

<a id="description"></a>

##### description

```ts
readonly description: string;
```

<a id="id-1"></a>

##### id

```ts
readonly id: string;
```

#### Methods

<a id="check"></a>

##### check()

```ts
check(context): 
  | readonly Finding[]
| Promise<readonly Finding[]>;
```

###### Parameters

###### context

[`RuleContext`](#rulecontext)

###### Returns

  \| readonly [`Finding`](#finding)[]
  \| `Promise`\<readonly [`Finding`](#finding)[]\>

***

<a id="rulecontext"></a>

### RuleContext

#### Properties

<a id="app"></a>

##### app

```ts
readonly app: RexApp;
```

<a id="sources"></a>

##### sources

```ts
readonly sources: SourceLoader;
```

***

<a id="runcheckoptions"></a>

### RunCheckOptions

#### Properties

<a id="json"></a>

##### json?

```ts
readonly optional json?: boolean;
```

<a id="rules"></a>

##### rules?

```ts
readonly optional rules?: readonly Rule[];
```

***

<a id="runcheckresult"></a>

### RunCheckResult

#### Extends

- [`CheckResult`](#checkresult)

#### Properties

<a id="errors-1"></a>

##### errors

```ts
readonly errors: number;
```

###### Inherited from

[`CheckResult`](#checkresult).[`errors`](#errors)

<a id="exitcode-1"></a>

##### exitCode

```ts
readonly exitCode: 0 | 1;
```

###### Inherited from

[`CheckResult`](#checkresult).[`exitCode`](#exitcode)

<a id="findings-1"></a>

##### findings

```ts
readonly findings: readonly Finding[];
```

###### Inherited from

[`CheckResult`](#checkresult).[`findings`](#findings)

<a id="output"></a>

##### output

```ts
readonly output: string;
```

<a id="warnings-1"></a>

##### warnings

```ts
readonly warnings: number;
```

###### Inherited from

[`CheckResult`](#checkresult).[`warnings`](#warnings)

***

<a id="runrulesoptions"></a>

### RunRulesOptions

#### Properties

<a id="sources-1"></a>

##### sources?

```ts
readonly optional sources?: SourceLoader;
```

***

<a id="sourceloader"></a>

### SourceLoader

#### Methods

<a id="declarations"></a>

##### declarations()

```ts
declarations(file): readonly StaticDeclaration[];
```

###### Parameters

###### file

`string`

###### Returns

readonly [`StaticDeclaration`](#staticdeclaration)[]

<a id="exports"></a>

##### exports()

```ts
exports(file): readonly ExportRef[];
```

###### Parameters

###### file

`string`

###### Returns

readonly [`ExportRef`](#exportref)[]

<a id="imports"></a>

##### imports()

```ts
imports(file): readonly ImportRef[];
```

###### Parameters

###### file

`string`

###### Returns

readonly [`ImportRef`](#importref)[]

<a id="load"></a>

##### load()

```ts
load(file): SourceFile;
```

###### Parameters

###### file

`string`

###### Returns

`SourceFile`

<a id="location-1"></a>

##### location()

```ts
location(file, at): Location;
```

###### Parameters

###### file

`string`

###### at

`number` \| `Node`

###### Returns

[`Location`](#location)

<a id="pagedeclaration"></a>

##### pageDeclaration()

```ts
pageDeclaration(file): StaticPageDeclaration | null;
```

###### Parameters

###### file

`string`

###### Returns

[`StaticPageDeclaration`](#staticpagedeclaration) \| `null`

<a id="read"></a>

##### read()

```ts
read(file): string;
```

###### Parameters

###### file

`string`

###### Returns

`string`

<a id="resolve"></a>

##### resolve()

```ts
resolve(from, specifier): string | null;
```

###### Parameters

###### from

`string`

###### specifier

`string`

###### Returns

`string` \| `null`

***

<a id="staticactionref"></a>

### StaticActionRef

#### Extends

- [`Location`](#location)

#### Properties

<a id="column-5"></a>

##### column

```ts
readonly column: number;
```

###### Inherited from

[`Location`](#location).[`column`](#column-4)

<a id="imported"></a>

##### imported

```ts
readonly imported: string | null;
```

<a id="line-5"></a>

##### line

```ts
readonly line: number;
```

###### Inherited from

[`Location`](#location).[`line`](#line-4)

<a id="local"></a>

##### local

```ts
readonly local: string;
```

<a id="source"></a>

##### source

```ts
readonly source: string | null;
```

<a id="specifier-1"></a>

##### specifier

```ts
readonly specifier: string | null;
```

***

<a id="staticdeclaration"></a>

### StaticDeclaration

#### Extends

- [`Location`](#location)

#### Properties

<a id="call"></a>

##### call

```ts
readonly call: CallExpression;
```

<a id="column-6"></a>

##### column

```ts
readonly column: number;
```

###### Inherited from

[`Location`](#location).[`column`](#column-4)

<a id="exportname"></a>

##### exportName

```ts
readonly exportName: string;
```

<a id="id-2"></a>

##### id

```ts
readonly id: string;
```

<a id="kind-1"></a>

##### kind

```ts
readonly kind: "page" | "action" | "entity" | "policy" | "flow";
```

<a id="line-6"></a>

##### line

```ts
readonly line: number;
```

###### Inherited from

[`Location`](#location).[`line`](#line-4)

***

<a id="staticname"></a>

### StaticName

#### Extends

- [`Location`](#location)

#### Properties

<a id="column-7"></a>

##### column

```ts
readonly column: number;
```

###### Inherited from

[`Location`](#location).[`column`](#column-4)

<a id="line-7"></a>

##### line

```ts
readonly line: number;
```

###### Inherited from

[`Location`](#location).[`line`](#line-4)

<a id="name-3"></a>

##### name

```ts
readonly name: string;
```

***

<a id="staticoverlay"></a>

### StaticOverlay

#### Extends

- [`Location`](#location)

#### Properties

<a id="binding"></a>

##### binding

```ts
readonly binding: string | null;
```

<a id="column-8"></a>

##### column

```ts
readonly column: number;
```

###### Inherited from

[`Location`](#location).[`column`](#column-4)

<a id="dismiss"></a>

##### dismiss

```ts
readonly dismiss: string | null;
```

<a id="id-3"></a>

##### id

```ts
readonly id: string;
```

<a id="line-8"></a>

##### line

```ts
readonly line: number;
```

###### Inherited from

[`Location`](#location).[`line`](#line-4)

***

<a id="staticpagedeclaration"></a>

### StaticPageDeclaration

#### Extends

- [`Location`](#location)

#### Properties

<a id="actions"></a>

##### actions

```ts
readonly actions: readonly StaticActionRef[];
```

<a id="column-9"></a>

##### column

```ts
readonly column: number;
```

###### Inherited from

[`Location`](#location).[`column`](#column-4)

<a id="id-4"></a>

##### id

```ts
readonly id: string;
```

<a id="line-9"></a>

##### line

```ts
readonly line: number;
```

###### Inherited from

[`Location`](#location).[`line`](#line-4)

<a id="overlays-1"></a>

##### overlays

```ts
readonly overlays: readonly StaticOverlay[];
```

<a id="regions-1"></a>

##### regions

```ts
readonly regions: readonly StaticName[];
```

<a id="route"></a>

##### route

```ts
readonly route: string | null;
```

<a id="states-1"></a>

##### states

```ts
readonly states: readonly StaticName[] | null;
```

<a id="unreadable"></a>

##### unreadable

```ts
readonly unreadable: readonly string[];
```

## Type Aliases

<a id="declarationfunction"></a>

### DeclarationFunction

```ts
type DeclarationFunction = typeof DECLARATION_FUNCTIONS[number];
```

***

<a id="filerole"></a>

### FileRole

```ts
type FileRole = typeof FILE_ROLES[number];
```

***

<a id="importkind"></a>

### ImportKind

```ts
type ImportKind = "import" | "export" | "dynamic" | "require";
```

***

<a id="reportformat"></a>

### ReportFormat

```ts
type ReportFormat = typeof REPORT_FORMATS[number];
```

***

<a id="severity-2"></a>

### Severity

```ts
type Severity = typeof SEVERITIES[number];
```

## Variables

<a id="component_roles"></a>

### COMPONENT\_ROLES

```ts
const COMPONENT_ROLES: readonly FileRole[];
```

***

<a id="declaration_functions"></a>

### DECLARATION\_FUNCTIONS

```ts
const DECLARATION_FUNCTIONS: readonly ["entity", "action", "page", "policy", "flow"];
```

***

<a id="defaultrules"></a>

### defaultRules

```ts
const defaultRules: readonly Rule[];
```

***

<a id="file_roles"></a>

### FILE\_ROLES

```ts
const FILE_ROLES: readonly ["page", "view", "states", "region", "part", "hook", "overlay", "action", "entity", "policy", "flow", "component", "data", "test"];
```

***

<a id="report_formats"></a>

### REPORT\_FORMATS

```ts
const REPORT_FORMATS: readonly ["json", "human"];
```

***

<a id="severities"></a>

### SEVERITIES

```ts
const SEVERITIES: readonly ["error", "warning"];
```

## Functions

<a id="classify"></a>

### classify()

```ts
function classify(relativeToApp): Classification | null;
```

#### Parameters

##### relativeToApp

`string`

#### Returns

`Classification` \| `null`

***

<a id="comparefindings"></a>

### compareFindings()

```ts
function compareFindings(a, b): number;
```

#### Parameters

##### a

[`Finding`](#finding)

##### b

[`Finding`](#finding)

#### Returns

`number`

***

<a id="createsourceloader"></a>

### createSourceLoader()

```ts
function createSourceLoader(): SourceLoader;
```

#### Returns

[`SourceLoader`](#sourceloader)

***

<a id="definerule"></a>

### defineRule()

```ts
function defineRule(rule): Rule;
```

#### Parameters

##### rule

[`Rule`](#rule-2)

#### Returns

[`Rule`](#rule-2)

***

<a id="discoverapp"></a>

### discoverApp()

```ts
function discoverApp(root): RexApp;
```

#### Parameters

##### root

`string`

#### Returns

[`RexApp`](#rexapp)

***

<a id="exitcodefor"></a>

### exitCodeFor()

```ts
function exitCodeFor(findings): 0 | 1;
```

#### Parameters

##### findings

readonly [`Finding`](#finding)[]

#### Returns

`0` \| `1`

***

<a id="finding-1"></a>

### finding()

```ts
function finding(input): Finding;
```

#### Parameters

##### input

[`FindingInput`](#findinginput)

#### Returns

[`Finding`](#finding)

***

<a id="formatfindings"></a>

### formatFindings()

```ts
function formatFindings(findings, format): string;
```

#### Parameters

##### findings

readonly [`Finding`](#finding)[]

##### format

`"json"` \| `"human"`

#### Returns

`string`

***

<a id="formathuman"></a>

### formatHuman()

```ts
function formatHuman(findings): string;
```

#### Parameters

##### findings

readonly [`Finding`](#finding)[]

#### Returns

`string`

***

<a id="formatjson"></a>

### formatJson()

```ts
function formatJson(findings): string;
```

#### Parameters

##### findings

readonly [`Finding`](#finding)[]

#### Returns

`string`

***

<a id="isrelativespecifier"></a>

### isRelativeSpecifier()

```ts
function isRelativeSpecifier(specifier): boolean;
```

#### Parameters

##### specifier

`string`

#### Returns

`boolean`

***

<a id="isruleid"></a>

### isRuleId()

```ts
function isRuleId(value): value is string;
```

#### Parameters

##### value

`unknown`

#### Returns

`value is string`

***

<a id="packagename"></a>

### packageName()

```ts
function packageName(specifier): string | null;
```

#### Parameters

##### specifier

`string`

#### Returns

`string` \| `null`

***

<a id="runcheck"></a>

### runCheck()

```ts
function runCheck(root, options?): Promise<RunCheckResult>;
```

#### Parameters

##### root

`string`

##### options?

[`RunCheckOptions`](#runcheckoptions) = `{}`

#### Returns

`Promise`\<[`RunCheckResult`](#runcheckresult)\>

***

<a id="runrules"></a>

### runRules()

```ts
function runRules(
   app, 
   rules, 
   options?
): Promise<CheckResult>;
```

#### Parameters

##### app

[`RexApp`](#rexapp)

##### rules

readonly [`Rule`](#rule-2)[]

##### options?

[`RunRulesOptions`](#runrulesoptions) = `{}`

#### Returns

`Promise`\<[`CheckResult`](#checkresult)\>

***

<a id="summarize"></a>

### summarize()

```ts
function summarize(findings): CheckResult;
```

#### Parameters

##### findings

readonly [`Finding`](#finding)[]

#### Returns

[`CheckResult`](#checkresult)
