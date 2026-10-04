# Source reference

An index of the package entries and of the named types, classes, interfaces and test helpers in the repository, with the declaration of each one. It is generated from the source files by `node tools/freshness.mjs --write-reference` (long declarations are shortened with `...`), and `node tools/freshness.mjs --check` fails when a package entry has no section here. Exported functions and constants are documented in the topic pages linked from the [README](../README.md#documentation).

## Package entries

Every key of `exports` in `packages/rex/package.json`, with the source file it resolves to in the workspace and its page in the [API reference](api/README.md).

### `@sidioralabs/rex`

Export `.`, source [`packages/rex/src/index.ts`](../packages/rex/src/index.ts), API page [@sidioralabs/rex](api/@sidioralabs/rex.md).

### `@sidioralabs/rex/config`

Export `./config`, source [`packages/rex/src/config.ts`](../packages/rex/src/config.ts), API page [@sidioralabs/rex/config](api/@sidioralabs/rex/config.md).

### `@sidioralabs/rex/schema`

Export `./schema`, source [`packages/rex/src/schema/index.ts`](../packages/rex/src/schema/index.ts), API page [@sidioralabs/rex/schema](api/@sidioralabs/rex/schema.md).

### `@sidioralabs/rex/manifest`

Export `./manifest`, source [`packages/rex/src/manifest/index.ts`](../packages/rex/src/manifest/index.ts), API page [@sidioralabs/rex/manifest](api/@sidioralabs/rex/manifest-1.md).

### `@sidioralabs/rex/client`

Export `./client`, source [`packages/rex/src/client/index.ts`](../packages/rex/src/client/index.ts), API page [@sidioralabs/rex/client](api/@sidioralabs/rex/client.md).

### `@sidioralabs/rex/client/interop`

Export `./client/interop`, source [`packages/rex/src/client/interop/index.ts`](../packages/rex/src/client/interop/index.ts), API page [@sidioralabs/rex/client/interop](api/@sidioralabs/rex/client/interop.md).

### `@sidioralabs/rex/client/media`

Export `./client/media`, source [`packages/rex/src/client/media/index.ts`](../packages/rex/src/client/media/index.ts), API page [@sidioralabs/rex/client/media](api/@sidioralabs/rex/client/media.md).

### `@sidioralabs/rex/client/i18n`

Export `./client/i18n`, source [`packages/rex/src/client/i18n/index.ts`](../packages/rex/src/client/i18n/index.ts), API page [@sidioralabs/rex/client/i18n](api/@sidioralabs/rex/client/i18n.md).

### `@sidioralabs/rex/server`

Export `./server`, source [`packages/rex/src/server/index.ts`](../packages/rex/src/server/index.ts), API page [@sidioralabs/rex/server](api/@sidioralabs/rex/server.md).

### `@sidioralabs/rex/server/node`

Export `./server/node`, source [`packages/rex/src/server/node.ts`](../packages/rex/src/server/node.ts), API page [@sidioralabs/rex/server/node](api/@sidioralabs/rex/server/node.md).

### `@sidioralabs/rex/server/bun`

Export `./server/bun`, source [`packages/rex/src/server/adapters/bun.ts`](../packages/rex/src/server/adapters/bun.ts), API page [@sidioralabs/rex/server/bun](api/@sidioralabs/rex/server/bun.md).

### `@sidioralabs/rex/server/deno`

Export `./server/deno`, source [`packages/rex/src/server/adapters/deno.ts`](../packages/rex/src/server/adapters/deno.ts), API page [@sidioralabs/rex/server/deno](api/@sidioralabs/rex/server/deno.md).

### `@sidioralabs/rex/server/edge`

Export `./server/edge`, source [`packages/rex/src/server/adapters/edge.ts`](../packages/rex/src/server/adapters/edge.ts), API page [@sidioralabs/rex/server/edge](api/@sidioralabs/rex/server/edge.md).

### `@sidioralabs/rex/server-only`

Export `./server-only`, source [`packages/rex/src/server-only.ts`](../packages/rex/src/server-only.ts), API page [@sidioralabs/rex/server-only](api/@sidioralabs/rex/server-only.md).

### `@sidioralabs/rex/store/drizzle`

Export `./store/drizzle`, source [`packages/rex/src/store/index.ts`](../packages/rex/src/store/index.ts), API page [@sidioralabs/rex/store/drizzle](api/@sidioralabs/rex/store/drizzle.md).

### `@sidioralabs/rex/vite`

Export `./vite`, source [`packages/rex/src/vite/index.ts`](../packages/rex/src/vite/index.ts), API page [@sidioralabs/rex/vite](api/@sidioralabs/rex/vite.md).

### `@sidioralabs/rex/check`

Export `./check`, source [`packages/rex/src/check/index.ts`](../packages/rex/src/check/index.ts), API page [@sidioralabs/rex/check](api/@sidioralabs/rex/check.md).

### `@sidioralabs/rex/testing`

Export `./testing`, source [`packages/rex/src/testing/index.ts`](../packages/rex/src/testing/index.ts), API page [@sidioralabs/rex/testing](api/@sidioralabs/rex/testing.md).

### `@sidioralabs/rex/devtools`

Export `./devtools`, source [`packages/rex/src/client/devtools/index.ts`](../packages/rex/src/client/devtools/index.ts), API page [@sidioralabs/rex/devtools](api/@sidioralabs/rex/devtools.md).

### `@sidioralabs/rex/eslint`

Export `./eslint`, source [`packages/rex/src/eslint/index.ts`](../packages/rex/src/eslint/index.ts), API page [@sidioralabs/rex/eslint](api/@sidioralabs/rex/eslint.md).

### `@sidioralabs/rex/prettier`

Export `./prettier`, source [`packages/rex/src/prettier.ts`](../packages/rex/src/prettier.ts), API page [@sidioralabs/rex/prettier](api/@sidioralabs/rex/prettier.md).

### `@sidioralabs/rex/designx`

Export `./designx`, source [`packages/rex/src/designx/index.ts`](../packages/rex/src/designx/index.ts), API page [@sidioralabs/rex/designx](api/@sidioralabs/rex/designx.md).

## Package source

Public and module-internal types, classes and interfaces of `packages/rex/src`. The prose documentation explains how they fit together: see [primitives.md](primitives.md), [architecture.md](architecture.md), [agent-contract.md](agent-contract.md), [cli.md](cli.md) and [convention.md](convention.md).

### `packages/rex/src/check/engine.ts`

| Symbol            | Kind      | Declaration                                           |
| ----------------- | --------- | ----------------------------------------------------- |
| `FileRole`        | type      | `export type FileRole = (typeof FILE_ROLES)[number];` |
| `AppFile`         | interface | `export interface AppFile`                            |
| `AppRegion`       | interface | `export interface AppRegion`                          |
| `AppPage`         | interface | `export interface AppPage`                            |
| `RexApp`          | interface | `export interface RexApp`                             |
| `CheckResult`     | interface | `export interface CheckResult`                        |
| `RunRulesOptions` | interface | `export interface RunRulesOptions`                    |
| `Classification`  | interface | `interface Classification`                            |

### `packages/rex/src/check/report.ts`

| Symbol         | Kind | Declaration                                                   |
| -------------- | ---- | ------------------------------------------------------------- |
| `ReportFormat` | type | `export type ReportFormat = (typeof REPORT_FORMATS)[number];` |

### `packages/rex/src/check/rule.ts`

| Symbol                  | Kind      | Declaration                                                                 |
| ----------------------- | --------- | --------------------------------------------------------------------------- |
| `Severity`              | type      | `export type Severity = (typeof SEVERITIES)[number];`                       |
| `Location`              | interface | `export interface Location`                                                 |
| `Finding`               | interface | `export interface Finding`                                                  |
| `FindingInput`          | interface | `export interface FindingInput`                                             |
| `RuleContext`           | interface | `export interface RuleContext`                                              |
| `Rule`                  | interface | `export interface Rule`                                                     |
| `ImportKind`            | type      | `export type ImportKind = "import" \| "export" \| "dynamic" \| "require";`  |
| `ImportRef`             | interface | `export interface ImportRef extends Location`                               |
| `ExportRef`             | interface | `export interface ExportRef extends Location`                               |
| `DeclarationFunction`   | type      | `export type DeclarationFunction = (typeof DECLARATION_FUNCTIONS)[number];` |
| `StaticDeclaration`     | interface | `export interface StaticDeclaration extends Location`                       |
| `StaticName`            | interface | `export interface StaticName extends Location`                              |
| `StaticOverlay`         | interface | `export interface StaticOverlay extends Location`                           |
| `StaticActionRef`       | interface | `export interface StaticActionRef extends Location`                         |
| `StaticPageDeclaration` | interface | `export interface StaticPageDeclaration extends Location`                   |
| `SourceLoader`          | interface | `export interface SourceLoader`                                             |

### `packages/rex/src/check/rules/a11y.ts`

| Symbol         | Kind | Declaration                                               |
| -------------- | ---- | --------------------------------------------------------- |
| `A11yRuleCode` | type | `export type A11yRuleCode = (typeof A11Y_RULES)[number];` |
| `Attributes`   | type | `type Attributes = Map<string, ts.JsxAttribute>;`         |

### `packages/rex/src/check/rules/boundaries.ts`

| Symbol         | Kind      | Declaration              |
| -------------- | --------- | ------------------------ |
| `TargetRule`   | interface | `interface TargetRule`   |
| `PackageRule`  | interface | `interface PackageRule`  |
| `RoleBoundary` | interface | `interface RoleBoundary` |

### `packages/rex/src/check/rules/format.ts`

| Symbol     | Kind | Declaration                                  |
| ---------- | ---- | -------------------------------------------- |
| `Prettier` | type | `type Prettier = typeof import("prettier");` |

### `packages/rex/src/check/rules/i18n.ts`

| Symbol              | Kind      | Declaration                                                 |
| ------------------- | --------- | ----------------------------------------------------------- |
| `I18nCheckSettings` | interface | `export interface I18nCheckSettings`                        |
| `I18nConfigRead`    | interface | `export interface I18nConfigRead extends I18nCheckSettings` |
| `I18nTextProblem`   | type      | `export type I18nTextProblem = "literal" \| "invalid-key";` |
| `TextSite`          | interface | `interface TextSite`                                        |

### `packages/rex/src/check/rules/index.ts`

| Symbol            | Kind      | Declaration                                           |
| ----------------- | --------- | ----------------------------------------------------- |
| `RunCheckOptions` | interface | `export interface RunCheckOptions`                    |
| `RunCheckResult`  | interface | `export interface RunCheckResult extends CheckResult` |

### `packages/rex/src/check/rules/layout.ts`

| Symbol            | Kind      | Declaration                                                    |
| ----------------- | --------- | -------------------------------------------------------------- |
| `SizeProperty`    | type      | `export type SizeProperty = (typeof SIZE_PROPERTIES)[number];` |
| `SizeSource`      | type      | `export type SizeSource = "style" \| "class" \| "css";`        |
| `SizeDeclaration` | interface | `export interface SizeDeclaration`                             |
| `ParsedLength`    | interface | `export interface ParsedLength`                                |

### `packages/rex/src/check/rules/media.ts`

| Symbol       | Kind      | Declaration                   |
| ------------ | --------- | ----------------------------- |
| `RawImgSite` | interface | `export interface RawImgSite` |

### `packages/rex/src/check/rules/parity.ts`

| Symbol            | Kind      | Declaration                                         |
| ----------------- | --------- | --------------------------------------------------- |
| `ActionReference` | interface | `export interface ActionReference extends Location` |

### `packages/rex/src/check/rules/security.ts`

| Symbol           | Kind      | Declaration                       |
| ---------------- | --------- | --------------------------------- |
| `UnsafeHtmlSite` | interface | `export interface UnsafeHtmlSite` |

### `packages/rex/src/check/rules/tokens.ts`

| Symbol               | Kind      | Declaration                                                            |
| -------------------- | --------- | ---------------------------------------------------------------------- |
| `TokenAllowLists`    | type      | `export type TokenAllowLists = ResolvedRexOptions["check"]["tokens"];` |
| `TokenTheme`         | interface | `export interface TokenTheme`                                          |
| `TokenSettings`      | interface | `export interface TokenSettings`                                       |
| `TokenConfigRead`    | interface | `export interface TokenConfigRead`                                     |
| `ClassTokenProblem`  | type      | `export type ClassTokenProblem =`                                      |
| `ClassToken`         | interface | `export interface ClassToken`                                          |
| `StringPartFilter`   | type      | `export type StringPartFilter = (node: ts.Node) => boolean;`           |
| `DynamicConfigValue` | class     | `class DynamicConfigValue extends RexError`                            |

### `packages/rex/src/check/rules/traps.ts`

| Symbol          | Kind      | Declaration               |
| --------------- | --------- | ------------------------- |
| `ScrollTrigger` | interface | `interface ScrollTrigger` |

### `packages/rex/src/check/rules/typecheck.ts`

| Symbol         | Kind      | Declaration              |
| -------------- | --------- | ------------------------ |
| `ProgramInput` | interface | `interface ProgramInput` |

### `packages/rex/src/check/rules/ui.ts`

| Symbol             | Kind      | Declaration                                                          |
| ------------------ | --------- | -------------------------------------------------------------------- |
| `RawPrimitiveTag`  | type      | `export type RawPrimitiveTag = (typeof RAW_PRIMITIVE_TAGS)[number];` |
| `UiConfigRead`     | interface | `export interface UiConfigRead`                                      |
| `RawPrimitiveSite` | interface | `export interface RawPrimitiveSite`                                  |
| `DesignxPrimitive` | interface | `export interface DesignxPrimitive`                                  |

### `packages/rex/src/check/runtime.ts`

| Symbol                 | Kind      | Declaration                                                      |
| ---------------------- | --------- | ---------------------------------------------------------------- |
| `ClientModule`         | type      | `type ClientModule = typeof import("../client/index.ts");`       |
| `ServerModule`         | type      | `type ServerModule = typeof import("../server/index.ts");`       |
| `ReactModule`          | type      | `type ReactModule = typeof import("react");`                     |
| `ReactDomClientModule` | type      | `type ReactDomClientModule = typeof import("react-dom/client");` |
| `HappyWindow`          | type      | `type HappyWindow = import("happy-dom").Window;`                 |
| `RuntimeCheckOptions`  | interface | `export interface RuntimeCheckOptions`                           |
| `RuntimeMount`         | interface | `export interface RuntimeMount`                                  |
| `RuntimeCheckResult`   | interface | `export interface RuntimeCheckResult extends CheckResult`        |
| `ControlRead`          | interface | `interface ControlRead`                                          |
| `ParityGap`            | interface | `export interface ParityGap`                                     |
| `InstalledDom`         | interface | `interface InstalledDom`                                         |
| `Traffic`              | interface | `interface Traffic`                                              |
| `Runtime`              | interface | `interface Runtime`                                              |
| `PageTarget`           | interface | `interface PageTarget`                                           |
| `MountRead`            | interface | `interface MountRead`                                            |
| `Gathered`             | interface | `interface Gathered`                                             |

### `packages/rex/src/cli/args.ts`

| Symbol                 | Kind      | Declaration                                                                 |
| ---------------------- | --------- | --------------------------------------------------------------------------- |
| `RexArgsError`         | class     | `export class RexArgsError extends RexError`                                |
| `InvalidArgumentError` | class     | `export class InvalidArgumentError extends RexError`                        |
| `OptionParser`         | type      | `export type OptionParser = (value: string, previous: unknown) => unknown;` |
| `OptionValues`         | type      | `export type OptionValues = Record<string, unknown>;`                       |
| `CommandAction`        | type      | `export type CommandAction = (...args: never[]) => unknown;`                |
| `ArgsOutput`           | interface | `export interface ArgsOutput`                                               |
| `OptionSpec`           | interface | `interface OptionSpec`                                                      |
| `ArgumentSpec`         | interface | `interface ArgumentSpec`                                                    |
| `OptionListing`        | interface | `export interface OptionListing`                                            |
| `ArgumentListing`      | interface | `export interface ArgumentListing`                                          |
| `CommandListing`       | interface | `export interface CommandListing`                                           |
| `RexCommand`           | class     | `export class RexCommand`                                                   |

### `packages/rex/src/cli/codemods/0.1-schema-entry.ts`

| Symbol         | Kind | Declaration                                                                |
| -------------- | ---- | -------------------------------------------------------------------------- |
| `EntryTargets` | type | `type EntryTargets = readonly (readonly [string, ReadonlySet<string>])[];` |

### `packages/rex/src/cli/codemods/codemod.ts`

| Symbol          | Kind      | Declaration                      |
| --------------- | --------- | -------------------------------- |
| `CodemodChange` | interface | `export interface CodemodChange` |
| `CodemodFlag`   | interface | `export interface CodemodFlag`   |
| `CodemodResult` | interface | `export interface CodemodResult` |
| `Codemod`       | interface | `export interface Codemod`       |
| `TextEdit`      | interface | `export interface TextEdit`      |

### `packages/rex/src/cli/commands/build.ts`

| Symbol                     | Kind      | Declaration                                                                             |
| -------------------------- | --------- | --------------------------------------------------------------------------------------- |
| `BuildTarget`              | type      | `export type BuildTarget = (typeof BUILD_TARGETS)[number];`                             |
| `ServerTarget`             | type      | `export type ServerTarget = Exclude<BuildTarget, "static">;`                            |
| `ServerRuntimePaths`       | interface | `export interface ServerRuntimePaths`                                                   |
| `ServerEntryOptions`       | interface | `export interface ServerEntryOptions`                                                   |
| `ServerEntryPluginOptions` | interface | `export interface ServerEntryPluginOptions extends Omit<ServerEntryOptions, "runtime">` |
| `BuildOptions`             | interface | `export interface BuildOptions`                                                         |
| `BuildResult`              | interface | `export interface BuildResult`                                                          |
| `ServerBuildOptions`       | interface | `export interface ServerBuildOptions`                                                   |
| `PrerenderBuildOptions`    | interface | `export interface PrerenderBuildOptions`                                                |
| `PrerenderBuildResult`     | interface | `export interface PrerenderBuildResult`                                                 |
| `BuildOutput`              | type      | `type BuildOutput = Awaited<ReturnType<typeof build>>;`                                 |

### `packages/rex/src/cli/commands/dev.ts`

| Symbol       | Kind      | Declaration                   |
| ------------ | --------- | ----------------------------- |
| `DevOptions` | interface | `export interface DevOptions` |

### `packages/rex/src/cli/commands/make.ts`

| Symbol            | Kind      | Declaration                                                         |
| ----------------- | --------- | ------------------------------------------------------------------- |
| `DeclarationKind` | type      | `export type DeclarationKind = (typeof DECLARATION_KINDS)[number];` |
| `PlannedFile`     | interface | `export interface PlannedFile`                                      |
| `PlannedDir`      | interface | `export interface PlannedDir`                                       |
| `PlannedEntry`    | type      | `export type PlannedEntry = PlannedFile \| PlannedDir;`             |
| `MakeError`       | class     | `export class MakeError extends RexError`                           |
| `MakePageOptions` | interface | `export interface MakePageOptions`                                  |

### `packages/rex/src/cli/commands/migrate.ts`

| Symbol          | Kind      | Declaration                                  |
| --------------- | --------- | -------------------------------------------- |
| `CodemodReport` | interface | `export interface CodemodReport`             |
| `MigrateReport` | interface | `export interface MigrateReport`             |
| `MigrateError`  | class     | `export class MigrateError extends RexError` |

### `packages/rex/src/cli/commands/new.ts`

| Symbol            | Kind      | Declaration                                             |
| ----------------- | --------- | ------------------------------------------------------- |
| `PackageManifest` | interface | `interface PackageManifest`                             |
| `NewAppOptions`   | interface | `export interface NewAppOptions extends DesignxOptions` |

### `packages/rex/src/cli/commands/promote.ts`

| Symbol          | Kind      | Declaration                      |
| --------------- | --------- | -------------------------------- |
| `PartLocation`  | interface | `export interface PartLocation`  |
| `PromoteResult` | interface | `export interface PromoteResult` |
| `SpecifierEdit` | interface | `interface SpecifierEdit`        |

### `packages/rex/src/cli/config.ts`

| Symbol                 | Kind      | Declaration                             |
| ---------------------- | --------- | --------------------------------------- |
| `LoadedRexConfig`      | interface | `export interface LoadedRexConfig`      |
| `LoadRexConfigOptions` | interface | `export interface LoadRexConfigOptions` |

### `packages/rex/src/cli/designx.ts`

| Symbol              | Kind      | Declaration                                                      |
| ------------------- | --------- | ---------------------------------------------------------------- |
| `DesignxItemType`   | type      | `export type DesignxItemType = (typeof ITEM_TYPES)[number];`     |
| `DesignxFile`       | interface | `export interface DesignxFile`                                   |
| `DesignxItem`       | interface | `export interface DesignxItem`                                   |
| `DesignxInstall`    | interface | `export interface DesignxInstall`                                |
| `DesignxFetch`      | type      | `export type DesignxFetch = (url: string) => Promise<Response>;` |
| `DesignxOptions`    | interface | `export interface DesignxOptions`                                |
| `DesignxError`      | class     | `export class DesignxError extends Error`                        |
| `Prettier`          | type      | `type Prettier = typeof import("prettier");`                     |
| `PackageJson`       | interface | `interface PackageJson`                                          |
| `AddDesignxOptions` | interface | `export interface AddDesignxOptions extends DesignxOptions`      |

### `packages/rex/src/cli/frame.ts`

| Symbol               | Kind      | Declaration                           |
| -------------------- | --------- | ------------------------------------- |
| `SourceFrameOptions` | interface | `export interface SourceFrameOptions` |

### `packages/rex/src/cli/gen/designx.ts`

| Symbol              | Kind      | Declaration                                                |
| ------------------- | --------- | ---------------------------------------------------------- |
| `DesignxHome`       | interface | `export interface DesignxHome`                             |
| `DesignxNewContext` | interface | `export interface DesignxNewContext extends RexNewContext` |

### `packages/rex/src/cli/gen/lint.ts`

| Symbol        | Kind      | Declaration             |
| ------------- | --------- | ----------------------- |
| `PackageJson` | interface | `interface PackageJson` |

### `packages/rex/src/cli/generators.ts`

| Symbol            | Kind      | Declaration                        |
| ----------------- | --------- | ---------------------------------- |
| `RexNewContext`   | interface | `export interface RexNewContext`   |
| `RexNewGenerator` | interface | `export interface RexNewGenerator` |

### `packages/rex/src/cli/index.ts`

| Symbol             | Kind      | Declaration                             |
| ------------------ | --------- | --------------------------------------- |
| `RexCliIO`         | interface | `export interface RexCliIO`             |
| `RexCommandModule` | interface | `export interface RexCommandModule`     |
| `RexCliExit`       | class     | `export class RexCliExit extends Error` |

### `packages/rex/src/cli/load.ts`

| Symbol                | Kind      | Declaration                            |
| --------------------- | --------- | -------------------------------------- |
| `ModuleLoaderOptions` | interface | `export interface ModuleLoaderOptions` |
| `ModuleLoader`        | interface | `export interface ModuleLoader`        |

### `packages/rex/src/cli/templates.ts`

| Symbol                       | Kind      | Declaration                                                   |
| ---------------------------- | --------- | ------------------------------------------------------------- |
| `TemplateKind`               | type      | `export type TemplateKind = (typeof TEMPLATE_KINDS)[number];` |
| `PageTemplateOptions`        | interface | `export interface PageTemplateOptions`                        |
| `ViewTemplateOptions`        | interface | `export interface ViewTemplateOptions`                        |
| `StatesTemplateOptions`      | interface | `export interface StatesTemplateOptions`                      |
| `RegionTemplateOptions`      | interface | `export interface RegionTemplateOptions`                      |
| `PartTemplateOptions`        | interface | `export interface PartTemplateOptions`                        |
| `OverlayTemplateOptions`     | interface | `export interface OverlayTemplateOptions`                     |
| `HookTemplateOptions`        | interface | `export interface HookTemplateOptions`                        |
| `DeclarationTemplateOptions` | interface | `export interface DeclarationTemplateOptions`                 |

### `packages/rex/src/client/act.ts`

| Symbol              | Kind      | Declaration                                       |
| ------------------- | --------- | ------------------------------------------------- |
| `ActResult`         | type      | `export type ActResult<A extends AnyAction> =`    |
| `RunOptions`        | interface | `export interface RunOptions`                     |
| `ActControlProps`   | interface | `export interface ActControlProps`                |
| `MutationVariables` | interface | `interface MutationVariables`                     |
| `ActHandle`         | interface | `export interface ActHandle<A extends AnyAction>` |

### `packages/rex/src/client/agent/address.tsx`

| Symbol              | Kind      | Declaration                                                  |
| ------------------- | --------- | ------------------------------------------------------------ |
| `AddressKind`       | type      | `export type AddressKind = keyof typeof ADDRESS_ATTRIBUTES;` |
| `AddressScopeValue` | interface | `interface AddressScopeValue`                                |
| `AddressScopeProps` | interface | `export interface AddressScopeProps`                         |
| `RexAddress`        | interface | `export interface RexAddress`                                |
| `FoundAddress`      | interface | `export interface FoundAddress`                              |

### `packages/rex/src/client/agent/confirm-dialog.tsx`

| Symbol               | Kind      | Declaration                           |
| -------------------- | --------- | ------------------------------------- |
| `ConfirmDialogProps` | interface | `export interface ConfirmDialogProps` |

### `packages/rex/src/client/agent/confirm.tsx`

| Symbol                 | Kind      | Declaration                                                                  |
| ---------------------- | --------- | ---------------------------------------------------------------------------- |
| `ConfirmSubject`       | type      | `export type ConfirmSubject = Pick<AnyAction, "id" \| "label" \| "effect">;` |
| `ConfirmRequest`       | interface | `export interface ConfirmRequest`                                            |
| `ConfirmFn`            | type      | `export type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;`     |
| `ConfirmPending`       | interface | `export interface ConfirmPending`                                            |
| `ConfirmProviderProps` | interface | `export interface ConfirmProviderProps`                                      |
| `InvokeHandle`         | interface | `export interface InvokeHandle<A extends AnyAction> extends ActHandle<A>`    |
| `Invoke`               | type      | `type Invoke = (input: unknown) => Promise<ActResult<AnyAction>>;`           |
| `PageInvokerSet`       | interface | `export interface PageInvokerSet`                                            |
| `PageInvokersProps`    | interface | `export interface PageInvokersProps`                                         |

### `packages/rex/src/client/agent/density.ts`

| Symbol                 | Kind      | Declaration                                                                          |
| ---------------------- | --------- | ------------------------------------------------------------------------------------ |
| `DensityPreference`    | type      | `export type DensityPreference = RexDensity \| RexScreenDensity;`                    |
| `DensitySource`        | type      | `export type DensitySource = "query" \| "header" \| "stored" \| "default" \| "set";` |
| `DensityInputs`        | interface | `export interface DensityInputs`                                                     |
| `ResolvedDensity`      | interface | `export interface ResolvedDensity`                                                   |
| `DensityValue`         | interface | `export interface DensityValue extends ResolvedDensity`                              |
| `DensityProviderProps` | interface | `export interface DensityProviderProps`                                              |

### `packages/rex/src/client/agent/flow-gate.ts`

| Symbol            | Kind      | Declaration                        |
| ----------------- | --------- | ---------------------------------- |
| `FlowGateNames`   | interface | `export interface FlowGateNames`   |
| `FlowGateContext` | interface | `export interface FlowGateContext` |

### `packages/rex/src/client/agent/flow.tsx`

| Symbol                    | Kind      | Declaration                                              |
| ------------------------- | --------- | -------------------------------------------------------- |
| `FlowClient`              | type      | `export type FlowClient = RouterClient<FlowRouter>;`     |
| `FlowClientOptions`       | interface | `export interface FlowClientOptions`                     |
| `FlowClientProviderProps` | interface | `export interface FlowClientProviderProps`               |
| `FlowDecisionResult`      | type      | `export type FlowDecisionResult =`                       |
| `GateControlProps`        | interface | `export interface GateControlProps`                      |
| `FlowHandle`              | interface | `export interface FlowHandle`                            |
| `FlowGateModule`          | type      | `type FlowGateModule = typeof import("./flow-gate.ts");` |

### `packages/rex/src/client/agent/outcome.tsx`

| Symbol               | Kind      | Declaration                                                              |
| -------------------- | --------- | ------------------------------------------------------------------------ |
| `OutcomeRegionProps` | interface | `export interface OutcomeRegionProps`                                    |
| `FieldErrors`        | type      | `export type FieldErrors = Readonly<Record<string, readonly string[]>>;` |
| `FormOutcome`        | interface | `export interface FormOutcome extends Outcome`                           |

### `packages/rex/src/client/agent/palette.tsx`

| Symbol               | Kind      | Declaration                           |
| -------------------- | --------- | ------------------------------------- |
| `PaletteActionEntry` | interface | `export interface PaletteActionEntry` |
| `PalettePageEntry`   | interface | `export interface PalettePageEntry`   |
| `PaletteMenuProps`   | interface | `export interface PaletteMenuProps`   |
| `RexPaletteProps`    | interface | `export interface RexPaletteProps`    |

### `packages/rex/src/client/agent/shortcuts.ts`

| Symbol              | Kind      | Declaration                          |
| ------------------- | --------- | ------------------------------------ |
| `ShortcutEventLike` | interface | `export interface ShortcutEventLike` |

### `packages/rex/src/client/agent/sidecar.tsx`

| Symbol                            | Kind      | Declaration                                        |
| --------------------------------- | --------- | -------------------------------------------------- |
| `Listener`                        | type      | `type Listener = () => void;`                      |
| `OverlayRegistry`                 | interface | `export interface OverlayRegistry`                 |
| `OverlayRegistryProviderProps`    | interface | `export interface OverlayRegistryProviderProps`    |
| `RegionFailure`                   | interface | `export interface RegionFailure`                   |
| `RegionFailureRegistry`           | interface | `export interface RegionFailureRegistry`           |
| `Affordance`                      | interface | `export interface Affordance`                      |
| `AffordanceRegistry`              | interface | `export interface AffordanceRegistry`              |
| `AffordanceRegistryProviderProps` | interface | `export interface AffordanceRegistryProviderProps` |
| `SidecarSource`                   | interface | `export interface SidecarSource`                   |

### `packages/rex/src/client/agent/url-invoke.ts`

| Symbol          | Kind | Declaration                   |
| --------------- | ---- | ----------------------------- |
| `UrlInvocation` | type | `export type UrlInvocation =` |

### `packages/rex/src/client/app.tsx`

| Symbol                    | Kind      | Declaration                                                                                          |
| ------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `RexFetch`                | type      | `export type RexFetch = (input: Request \| string \| URL, init?: RequestInit) => Promise<Response>;` |
| `DensitySlotProps`        | interface | `export interface DensitySlotProps`                                                                  |
| `RexOutcomeEvent`         | interface | `export interface RexOutcomeEvent extends Outcome`                                                   |
| `RexNavigateEvent`        | interface | `export interface RexNavigateEvent`                                                                  |
| `RexOutcomeHook`          | type      | `export type RexOutcomeHook = (event: RexOutcomeEvent) => void;`                                     |
| `RexNavigateHook`         | type      | `export type RexNavigateHook = (event: RexNavigateEvent) => void;`                                   |
| `CreateRexAppOptions`     | interface | `export interface CreateRexAppOptions`                                                               |
| `RexAppProps`             | interface | `export interface RexAppProps`                                                                       |
| `RexAppComponent`         | type      | `export type RexAppComponent = ComponentType<RexAppProps>;`                                          |
| `StartupValue`            | interface | `interface StartupValue`                                                                             |
| `Startup`                 | type      | `type Startup =`                                                                                     |
| `RexStartupError`         | class     | `export class RexStartupError extends RexError`                                                      |
| `NavigationObserverProps` | interface | `interface NavigationObserverProps`                                                                  |

### `packages/rex/src/client/boundary.tsx`

| Symbol                  | Kind      | Declaration                                                                 |
| ----------------------- | --------- | --------------------------------------------------------------------------- |
| `BoundaryFallbackProps` | interface | `interface BoundaryFallbackProps`                                           |
| `StateExport`           | type      | `type StateExport = ComponentType<StateProps<PageParamsValue>>;`            |
| `BoundaryProps`         | interface | `interface BoundaryProps`                                                   |
| `BoundaryState`         | interface | `interface BoundaryState`                                                   |
| `RegionErrorBoundary`   | class     | `class RegionErrorBoundary extends Component<BoundaryProps, BoundaryState>` |
| `RegionBoundaryProps`   | interface | `export interface RegionBoundaryProps`                                      |

### `packages/rex/src/client/context.ts`

| Symbol               | Kind      | Declaration                                                                                          |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `ApiFetch`           | type      | `export type ApiFetch = (input: Request \| string \| URL, init?: RequestInit) => Promise<Response>;` |
| `RexClientContext`   | interface | `export interface RexClientContext`                                                                  |
| `RexProcedureClient` | type      | `export type RexProcedureClient = Client<RexClientContext, unknown, unknown, Error>;`                |
| `RexClient`          | type      | `export type RexClient = { readonly [procedure: string]: RexProcedureClient };`                      |
| `ConfirmRequest`     | interface | `export interface ConfirmRequest`                                                                    |
| `RexRuntime`         | interface | `export interface RexRuntime`                                                                        |

### `packages/rex/src/client/devtools/devtools.tsx`

| Symbol             | Kind      | Declaration                         |
| ------------------ | --------- | ----------------------------------- |
| `RexDevtoolsProps` | interface | `export interface RexDevtoolsProps` |

### `packages/rex/src/client/devtools/panels.tsx`

| Symbol      | Kind | Declaration        |
| ----------- | ---- | ------------------ |
| `AuditTail` | type | `type AuditTail =` |

### `packages/rex/src/client/devtools/profiler.ts`

| Symbol          | Kind      | Declaration               |
| --------------- | --------- | ------------------------- |
| `ProfiledFiber` | interface | `interface ProfiledFiber` |

### `packages/rex/src/client/devtools/provider.tsx`

| Symbol                  | Kind      | Declaration                              |
| ----------------------- | --------- | ---------------------------------------- |
| `DevtoolsProviderProps` | interface | `export interface DevtoolsProviderProps` |

### `packages/rex/src/client/devtools/store.ts`

| Symbol               | Kind      | Declaration                                                     |
| -------------------- | --------- | --------------------------------------------------------------- |
| `DevtoolsPanel`      | type      | `export type DevtoolsPanel = (typeof DEVTOOLS_PANELS)[number];` |
| `OutcomeLogEntry`    | interface | `export interface OutcomeLogEntry`                              |
| `RegionRenderStats`  | interface | `export interface RegionRenderStats`                            |
| `RegionRenderSample` | interface | `export interface RegionRenderSample`                           |
| `DevtoolsSnapshot`   | interface | `export interface DevtoolsSnapshot`                             |
| `DevtoolsStore`      | interface | `export interface DevtoolsStore`                                |

### `packages/rex/src/client/entry.tsx`

| Symbol            | Kind      | Declaration                                                                                       |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `RexEntryBundle`  | interface | `export interface RexEntryBundle`                                                                 |
| `RexEntryOptions` | type      | `export type RexEntryOptions = Omit<CreateRexAppOptions, "registry" \| "manifest" \| "density">;` |
| `StartRexOptions` | interface | `export interface StartRexOptions extends RexEntryOptions`                                        |
| `StartedRex`      | interface | `export interface StartedRex`                                                                     |

### `packages/rex/src/client/fallback-host.ts`

| Symbol           | Kind | Declaration                                               |
| ---------------- | ---- | --------------------------------------------------------- |
| `FallbackModule` | type | `type FallbackModule = typeof import("./fallbacks.tsx");` |

### `packages/rex/src/client/fallbacks.tsx`

| Symbol                     | Kind      | Declaration                                 |
| -------------------------- | --------- | ------------------------------------------- |
| `RegionErrorFallbackProps` | interface | `export interface RegionErrorFallbackProps` |

### `packages/rex/src/client/form-view.tsx`

| Symbol              | Kind      | Declaration                   |
| ------------------- | --------- | ----------------------------- |
| `FieldControlProps` | interface | `interface FieldControlProps` |

### `packages/rex/src/client/form.tsx`

| Symbol                | Kind      | Declaration                                                                                     |
| --------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `FormFieldControl`    | type      | `export type FormFieldControl = "text" \| "number" \| "checkbox" \| "select" \| "multiselect";` |
| `FormField`           | interface | `export interface FormField`                                                                    |
| `ActionFormViewProps` | interface | `export interface ActionFormViewProps`                                                          |
| `ActionFormProps`     | interface | `export interface ActionFormProps<A extends AnyAction>`                                         |

### `packages/rex/src/client/hydrate.ts`

| Symbol                    | Kind      | Declaration                                                              |
| ------------------------- | --------- | ------------------------------------------------------------------------ |
| `RexDataPayload`          | interface | `export interface RexDataPayload`                                        |
| `RexDataError`            | class     | `export class RexDataError extends RexError`                             |
| `HydrationMismatch`       | interface | `export interface HydrationMismatch`                                     |
| `HydrationReporter`       | type      | `export type HydrationReporter = (mismatch: HydrationMismatch) => void;` |
| `RecoverableErrorOptions` | interface | `export interface RecoverableErrorOptions`                               |

### `packages/rex/src/client/i18n/context.ts`

| Symbol         | Kind      | Declaration                                                                    |
| -------------- | --------- | ------------------------------------------------------------------------------ |
| `I18nInput`    | interface | `export interface I18nInput`                                                   |
| `I18nSource`   | interface | `export interface I18nSource extends MessageLookup`                            |
| `I18nState`    | interface | `export interface I18nState`                                                   |
| `LocaleInfo`   | interface | `export interface LocaleInfo`                                                  |
| `Translate`    | type      | `export type Translate = (key: string, values?: MessageValues) => string;`     |
| `TextResolver` | type      | `export type TextResolver = (text: string, values?: MessageValues) => string;` |

### `packages/rex/src/client/i18n/format.ts`

| Symbol               | Kind  | Declaration                                                           |
| -------------------- | ----- | --------------------------------------------------------------------- |
| `MessageValue`       | type  | `export type MessageValue = string \| number \| boolean;`             |
| `MessageValues`      | type  | `export type MessageValues = Readonly<Record<string, MessageValue>>;` |
| `MessageNode`        | type  | `export type MessageNode =`                                           |
| `MessageFormatError` | class | `export class MessageFormatError extends RexError`                    |
| `MessageParser`      | class | `class MessageParser`                                                 |

### `packages/rex/src/client/i18n/locale.ts`

| Symbol             | Kind      | Declaration                                                   |
| ------------------ | --------- | ------------------------------------------------------------- |
| `LocaleSource`     | type      | `export type LocaleSource = (typeof LOCALE_SOURCES)[number];` |
| `LocaleSettings`   | interface | `export interface LocaleSettings`                             |
| `LocaleResolution` | interface | `export interface LocaleResolution`                           |
| `LocaleInputs`     | interface | `export interface LocaleInputs`                               |

### `packages/rex/src/client/i18n/lookup.ts`

| Symbol             | Kind      | Declaration                                                                                          |
| ------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `MessageFormatter` | type      | `export type MessageFormatter = (pattern: string, values: MessageValues, locale: string) => string;` |
| `Messages`         | type      | `export type Messages = Readonly<Record<string, string>>;`                                           |
| `LocaleMessages`   | type      | `export type LocaleMessages = Readonly<Record<string, Messages>>;`                                   |
| `MessageRef`       | interface | `export interface MessageRef`                                                                        |
| `MessageLookup`    | interface | `export interface MessageLookup`                                                                     |

### `packages/rex/src/client/interop/define-element.tsx`

| Symbol                  | Kind      | Declaration                                                                               |
| ----------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `ElementPropKind`       | type      | `export type ElementPropKind = "string" \| "number" \| "boolean" \| "json";`              |
| `ElementPropMap`        | type      | `export type ElementPropMap<P> = { readonly [K in keyof P & string]?: ElementPropKind };` |
| `DefineElementOptions`  | interface | `export interface DefineElementOptions<P>`                                                |
| `RexElementConstructor` | interface | `export interface RexElementConstructor extends CustomElementConstructor`                 |

### `packages/rex/src/client/interop/mount.tsx`

| Symbol                | Kind      | Declaration                                                    |
| --------------------- | --------- | -------------------------------------------------------------- |
| `MountRexPageOptions` | interface | `export interface MountRexPageOptions extends RexEntryOptions` |
| `UnmountRexPage`      | type      | `export type UnmountRexPage = () => void;`                     |

### `packages/rex/src/client/interop/native.tsx`

| Symbol        | Kind      | Declaration                                                                      |
| ------------- | --------- | -------------------------------------------------------------------------------- |
| `NativeTag`   | type      | `export type NativeTag = "div" \| "span" \| "section" \| "article" \| "figure";` |
| `NativeMount` | type      | `export type NativeMount = (node: HTMLElement) => void \| (() => void);`         |
| `NativeProps` | interface | `export interface NativeProps`                                                   |

### `packages/rex/src/client/layout.tsx`

| Symbol         | Kind      | Declaration                                       |
| -------------- | --------- | ------------------------------------------------- |
| `Space`        | type      | `export type Space = (typeof SPACES)[number];`    |
| `Columns`      | type      | `export type Columns = (typeof COLUMNS)[number];` |
| `StackProps`   | interface | `export interface StackProps`                     |
| `GridProps`    | interface | `export interface GridProps`                      |
| `SectionProps` | interface | `export interface SectionProps`                   |
| `OutcomeProps` | interface | `export interface OutcomeProps`                   |

### `packages/rex/src/client/lazy.ts`

| Symbol              | Kind      | Declaration                          |
| ------------------- | --------- | ------------------------------------ |
| `LazyResult`        | type      | `export type LazyResult<T> =`        |
| `LazyModule`        | interface | `export interface LazyModule<T>`     |
| `LazyModuleOptions` | interface | `export interface LazyModuleOptions` |

### `packages/rex/src/client/list.tsx`

| Symbol           | Kind      | Declaration                         |
| ---------------- | --------- | ----------------------------------- |
| `ListParamNames` | interface | `export interface ListParamNames`   |
| `ListParams`     | interface | `export interface ListParams`       |
| `ListWindow`     | interface | `export interface ListWindow`       |
| `ListProps`      | interface | `export interface ListProps<T>`     |
| `ListViewProps`  | interface | `export interface ListViewProps<T>` |

### `packages/rex/src/client/loaders.ts`

| Symbol                    | Kind      | Declaration                                                                                           |
| ------------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| `LoaderQueryKey`          | type      | `export type LoaderQueryKey = readonly [typeof LOADER_QUERY_SCOPE, string, string, string];`          |
| `LoaderParams`            | type      | `export type LoaderParams = Readonly<Record<string, unknown>>;`                                       |
| `LoaderAction`            | type      | `export type LoaderAction<S> = S extends AnyAction`                                                   |
| `LoaderOutput`            | type      | `export type LoaderOutput<S> = ActionOutput<LoaderAction<S>>;`                                        |
| `PageLoad`                | type      | `export type PageLoad<Pg> =`                                                                          |
| `LoaderName`              | type      | `export type LoaderName<Pg> = keyof PageLoad<Pg> & string;`                                           |
| `LoaderResult`            | type      | `export type LoaderResult<Pg, N extends LoaderName<Pg>> = UseQueryResult<`                            |
| `LoaderResults`           | type      | `export type LoaderResults<Pg> = { readonly [N in LoaderName<Pg>]: LoaderResult<Pg, N> };`            |
| `LoaderErrorJson`         | interface | `export interface LoaderErrorJson`                                                                    |
| `LoaderErrorInit`         | interface | `export interface LoaderErrorInit`                                                                    |
| `RexLoaderError`          | class     | `export class RexLoaderError extends Error`                                                           |
| `SeededCandidate`         | interface | `export interface SeededCandidate`                                                                    |
| `LoaderQueryOptionsInput` | interface | `export interface LoaderQueryOptionsInput`                                                            |
| `LoaderQueryOptions`      | type      | `export type LoaderQueryOptions = UseQueryOptions<unknown, RexLoaderError, unknown, LoaderQueryKey>;` |

### `packages/rex/src/client/media.tsx`

| Symbol               | Kind      | Declaration                                                        |
| -------------------- | --------- | ------------------------------------------------------------------ |
| `ScriptStrategy`     | type      | `export type ScriptStrategy = (typeof SCRIPT_STRATEGIES)[number];` |
| `PriorityImage`      | interface | `export interface PriorityImage`                                   |
| `RexMediaCollector`  | interface | `export interface RexMediaCollector`                               |
| `RexMediaRequest`    | interface | `export interface RexMediaRequest`                                 |
| `MediaProviderProps` | interface | `export interface MediaProviderProps`                              |
| `NativeImgProps`     | type      | `type NativeImgProps = ComponentPropsWithRef<"img">;`              |
| `ImgProps`           | interface | `export interface ImgProps`                                        |
| `LoadScriptOptions`  | interface | `export interface LoadScriptOptions`                               |
| `ScriptProps`        | interface | `export interface ScriptProps`                                     |

### `packages/rex/src/client/nav.ts`

| Symbol         | Kind      | Declaration                                                                     |
| -------------- | --------- | ------------------------------------------------------------------------------- |
| `NavParamsArg` | type      | `export type NavParamsArg<Pg extends AnyPage> = {} extends PageParamsInput<Pg>` |
| `NavOutcome`   | type      | `export type NavOutcome =`                                                      |
| `Nav`          | interface | `export interface Nav`                                                          |
| `Draft`        | interface | `export interface Draft<T>`                                                     |

### `packages/rex/src/client/outcome.ts`

| Symbol                 | Kind      | Declaration                             |
| ---------------------- | --------- | --------------------------------------- |
| `Outcome`              | interface | `export interface Outcome`              |
| `OutcomeStore`         | interface | `export interface OutcomeStore`         |
| `OutcomeProviderProps` | interface | `export interface OutcomeProviderProps` |

### `packages/rex/src/client/overlay.tsx`

| Symbol                    | Kind      | Declaration                                      |
| ------------------------- | --------- | ------------------------------------------------ |
| `OverlayOptions`          | interface | `export interface OverlayOptions`                |
| `OverlayRenderContext`    | interface | `export interface OverlayRenderContext`          |
| `OverlayComponent`        | type      | `export type OverlayComponent = ComponentType &` |
| `OverlayHandle`           | interface | `export interface OverlayHandle`                 |
| `OverlaySurfaceProps`     | interface | `export interface OverlaySurfaceProps`           |
| `LazyOverlaySurfaceProps` | interface | `interface LazyOverlaySurfaceProps`              |

### `packages/rex/src/client/page.tsx`

| Symbol                 | Kind      | Declaration                                                                      |
| ---------------------- | --------- | -------------------------------------------------------------------------------- |
| `PageParamsValue`      | type      | `export type PageParamsValue = Readonly<Record<string, unknown>>;`               |
| `PageRuntime`          | interface | `export interface PageRuntime`                                                   |
| `ViewContext`          | interface | `export interface ViewContext<P = PageParamsValue>`                              |
| `ViewComponent`        | type      | `export type ViewComponent = ComponentType & { readonly rexKind: "view" };`      |
| `RegionContext`        | interface | `export interface RegionContext<P = PageParamsValue>`                            |
| `RegionComponent`      | type      | `export type RegionComponent = ComponentType &`                                  |
| `RegionProps`          | interface | `export interface RegionProps`                                                   |
| `StateExportComponent` | type      | `export type StateExportComponent = ComponentType<StateProps<PageParamsValue>>;` |
| `EagerPageModuleSet`   | interface | `export interface EagerPageModuleSet<Pg extends AnyPage = AnyPage>`              |
| `LoadedPageModules`    | interface | `export interface LoadedPageModules`                                             |
| `LazyPageModuleSet`    | interface | `export interface LazyPageModuleSet<Pg extends AnyPage = AnyPage>`               |
| `PageModuleSet`        | type      | `export type PageModuleSet<Pg extends AnyPage = AnyPage> =`                      |
| `RexPageModuleError`   | class     | `export class RexPageModuleError extends RexError`                               |
| `PageHostProps`        | interface | `export interface PageHostProps`                                                 |

### `packages/rex/src/client/providers.ts`

| Symbol             | Kind      | Declaration                         |
| ------------------ | --------- | ----------------------------------- |
| `RexProviderProps` | interface | `export interface RexProviderProps` |
| `RexProvider`      | interface | `export interface RexProvider`      |

### `packages/rex/src/client/reset.ts`

| Symbol     | Kind | Declaration                          |
| ---------- | ---- | ------------------------------------ |
| `RexReset` | type | `export type RexReset = () => void;` |

### `packages/rex/src/client/router.tsx`

| Symbol                       | Kind      | Declaration                                                                                            |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `ParamIssue`                 | interface | `export interface ParamIssue`                                                                          |
| `PageResolution`             | interface | `export interface PageResolution`                                                                      |
| `NotFoundResolution`         | interface | `export interface NotFoundResolution`                                                                  |
| `RouteResolution`            | type      | `export type RouteResolution = PageResolution \| NotFoundResolution;`                                  |
| `ParamsResult`               | type      | `export type ParamsResult =`                                                                           |
| `HrefResult`                 | type      | `export type HrefResult =`                                                                             |
| `JsonSchemaMap`              | type      | `type JsonSchemaMap = Readonly<Record<string, JsonSchema>>;`                                           |
| `RouteRender`                | type      | `export type RouteRender = (resolution: RouteResolution) => ReactNode;`                                |
| `PageRouteProps`             | interface | `interface PageRouteProps`                                                                             |
| `ViewTransitionHost`         | type      | `export type ViewTransitionHost = Partial<Pick<Document, "startViewTransition">>;`                     |
| `RouteChange`                | type      | `export type RouteChange = (target: AnyPage, href: string, options: { readonly replace: boolean })...` |
| `NavigationType`             | type      | `export type NavigationType = "push" \| "replace" \| "reload" \| "traverse";`                          |
| `NavigationDestinationLike`  | interface | `export interface NavigationDestinationLike`                                                           |
| `NavigationInterceptOptions` | interface | `export interface NavigationInterceptOptions`                                                          |
| `NavigateEventLike`          | interface | `export interface NavigateEventLike extends Event`                                                     |
| `NavigationLike`             | type      | `export type NavigationLike = EventTarget;`                                                            |
| `RoutableDestination`        | interface | `export interface RoutableDestination`                                                                 |
| `DestinationScope`           | interface | `export interface DestinationScope`                                                                    |
| `RexRoutesProps`             | interface | `export interface RexRoutesProps`                                                                      |
| `LocaleRedirectProps`        | interface | `interface LocaleRedirectProps`                                                                        |

### `packages/rex/src/client/screen.ts`

| Symbol                      | Kind      | Declaration                                                                                         |
| --------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| `ScreenSnapshot`            | interface | `export interface ScreenSnapshot`                                                                   |
| `ScreenState`               | interface | `export interface ScreenState extends ScreenSnapshot`                                               |
| `MatchMedia`                | type      | `export type MatchMedia = (query: string) => MediaQueryList;`                                       |
| `ResizeObserverConstructor` | type      | `export type ResizeObserverConstructor = new (callback: ResizeObserverCallback) => ResizeObserver;` |
| `ScreenSource`              | interface | `export interface ScreenSource`                                                                     |
| `ScreenSourceOptions`       | interface | `export interface ScreenSourceOptions`                                                              |
| `ScreenQueries`             | interface | `interface ScreenQueries`                                                                           |
| `ScreenProviderProps`       | interface | `export interface ScreenProviderProps`                                                              |

### `packages/rex/src/client/shell/components.ts`

| Symbol                         | Kind      | Declaration                                                                |
| ------------------------------ | --------- | -------------------------------------------------------------------------- |
| `ShellComponentName`           | type      | `export type ShellComponentName = (typeof SHELL_COMPONENT_NAMES)[number];` |
| `ShellButtonProps`             | type      | `export type ShellButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;`  |
| `ShellSheetForm`               | type      | `export type ShellSheetForm = (typeof SHELL_SHEET_FORMS)[number];`         |
| `ShellSheetProps`              | interface | `export interface ShellSheetProps`                                         |
| `ShellPaletteItemProps`        | interface | `export interface ShellPaletteItemProps`                                   |
| `ShellOutcomeProps`            | type      | `export type ShellOutcomeProps = OutcomeSlotProps;`                        |
| `ShellNavForm`                 | type      | `export type ShellNavForm = (typeof SHELL_NAV_FORMS)[number];`             |
| `ShellNavLink`                 | interface | `export interface ShellNavLink`                                            |
| `ShellNavProps`                | interface | `export interface ShellNavProps`                                           |
| `ShellPaletteTriggerProps`     | interface | `export interface ShellPaletteTriggerProps`                                |
| `ShellFrameProps`              | interface | `export interface ShellFrameProps`                                         |
| `ShellComponents`              | interface | `export interface ShellComponents`                                         |
| `ShellComponentsModule`        | type      | `export type ShellComponentsModule = Readonly<Partial<ShellComponents>>;`  |
| `ShellComponentsProviderProps` | interface | `export interface ShellComponentsProviderProps`                            |

### `packages/rex/src/client/shell/outcome-slot.tsx`

| Symbol             | Kind      | Declaration                         |
| ------------------ | --------- | ----------------------------------- |
| `OutcomeSlotProps` | interface | `export interface OutcomeSlotProps` |

### `packages/rex/src/client/shell/slots.ts`

| Symbol           | Kind      | Declaration                       |
| ---------------- | --------- | --------------------------------- |
| `ShellSlotProps` | interface | `export interface ShellSlotProps` |
| `ShellSlot`      | interface | `export interface ShellSlot`      |

### `packages/rex/src/client/shell.tsx`

| Symbol            | Kind      | Declaration                        |
| ----------------- | --------- | ---------------------------------- |
| `ShellProps`      | interface | `export interface ShellProps`      |
| `FrameProps`      | interface | `interface FrameProps`             |
| `AgentShellProps` | interface | `export interface AgentShellProps` |

### `packages/rex/src/client/states.ts`

| Symbol                | Kind      | Declaration                                                    |
| --------------------- | --------- | -------------------------------------------------------------- |
| `QueryStatus`         | type      | `export type QueryStatus = "pending" \| "error" \| "success";` |
| `FetchStatus`         | type      | `export type FetchStatus = "fetching" \| "paused" \| "idle";`  |
| `DataStateQuery`      | interface | `export interface DataStateQuery`                              |
| `DataStateInput`      | interface | `export interface DataStateInput`                              |
| `QueryLike`           | interface | `export interface QueryLike`                                   |
| `UseDataStateOptions` | interface | `export interface UseDataStateOptions`                         |

### `packages/rex/src/client/store.ts`

| Symbol          | Kind      | Declaration                                                            |
| --------------- | --------- | ---------------------------------------------------------------------- |
| `Listener`      | type      | `type Listener = () => void;`                                          |
| `StoreOptions`  | interface | `export interface StoreOptions<T>`                                     |
| `RexStore`      | interface | `export interface RexStore<T>`                                         |
| `StoreValue`    | type      | `export type StoreValue<S> = S extends RexStore<infer T> ? T : never;` |
| `StoreRegistry` | interface | `export interface StoreRegistry`                                       |

### `packages/rex/src/client/unsafe-html.tsx`

| Symbol              | Kind      | Declaration                                                      |
| ------------------- | --------- | ---------------------------------------------------------------- |
| `UnsafeHtmlTag`     | type      | `export type UnsafeHtmlTag = (typeof UNSAFE_HTML_TAGS)[number];` |
| `UnsafeHtmlOptions` | interface | `export interface UnsafeHtmlOptions`                             |

### `packages/rex/src/core/action.ts`

| Symbol                   | Kind      | Declaration                                                                              |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------- |
| `ActionEffect`           | type      | `export type ActionEffect = "reversible" \| "irreversible" \| "read";`                   |
| `ShortcutModifier`       | type      | `export type ShortcutModifier = (typeof SHORTCUT_MODIFIERS)[number];`                    |
| `ParsedShortcut`         | interface | `export interface ParsedShortcut`                                                        |
| `ActionFormConfig`       | interface | `export interface ActionFormConfig`                                                      |
| `ActionForm`             | interface | `export interface ActionForm`                                                            |
| `ActionJsonSchemaConfig` | interface | `export interface ActionJsonSchemaConfig`                                                |
| `ActionJsonSchema`       | interface | `export interface ActionJsonSchema`                                                      |
| `ActionContext`          | interface | `export interface ActionContext`                                                         |
| `ActionConfig`           | interface | `export interface ActionConfig<I extends StandardSchemaV1, O extends StandardSchemaV1>`  |
| `ActionDeclaration`      | interface | `export interface ActionDeclaration<`                                                    |
| `AnyAction`              | type      | `export type AnyAction = ActionDeclaration<string, StandardSchemaV1, StandardSchemaV1>;` |
| `ActionInput`            | type      | `export type ActionInput<A> =`                                                           |
| `ActionParsedInput`      | type      | `export type ActionParsedInput<A> =`                                                     |
| `ActionOutput`           | type      | `export type ActionOutput<A> =`                                                          |

### `packages/rex/src/core/actor.ts`

| Symbol            | Kind      | Declaration                        |
| ----------------- | --------- | ---------------------------------- |
| `ActorAttributes` | interface | `export interface ActorAttributes` |
| `Actor`           | interface | `export interface Actor`           |
| `ActorInput`      | interface | `export interface ActorInput`      |

### `packages/rex/src/core/config.ts`

| Symbol                 | Kind      | Declaration                                                                                  |
| ---------------------- | --------- | -------------------------------------------------------------------------------------------- |
| `RexFetchHandler`      | interface | `export interface RexFetchHandler`                                                           |
| `RexConfigApp`         | interface | `export interface RexConfigApp`                                                              |
| `CspMode`              | type      | `export type CspMode = (typeof CSP_MODES)[number];`                                          |
| `I18nRouting`          | type      | `export type I18nRouting = (typeof I18N_ROUTING)[number];`                                   |
| `ImageFormat`          | type      | `export type ImageFormat = (typeof IMAGE_FORMATS)[number];`                                  |
| `UiKit`                | type      | `export type UiKit = (typeof UI_KITS)[number];`                                              |
| `FontStyle`            | type      | `export type FontStyle = (typeof FONT_STYLES)[number];`                                      |
| `RenderConfig`         | interface | `export interface RenderConfig`                                                              |
| `BudgetsConfig`        | interface | `export interface BudgetsConfig`                                                             |
| `SecurityConfig`       | interface | `export interface SecurityConfig`                                                            |
| `I18nConfig`           | interface | `export interface I18nConfig`                                                                |
| `ImagesConfig`         | interface | `export interface ImagesConfig`                                                              |
| `FontSpec`             | interface | `export interface FontSpec`                                                                  |
| `RexLogger`            | interface | `export interface RexLogger`                                                                 |
| `RexTracer`            | interface | `export interface RexTracer`                                                                 |
| `TelemetryConfig`      | interface | `export interface TelemetryConfig`                                                           |
| `ClientConfig`         | interface | `export interface ClientConfig`                                                              |
| `TokenAllowLists`      | interface | `export interface TokenAllowLists`                                                           |
| `UiConfig`             | interface | `export interface UiConfig`                                                                  |
| `I18nCheckConfig`      | interface | `export interface I18nCheckConfig`                                                           |
| `CheckConfig`          | interface | `export interface CheckConfig`                                                               |
| `RexOptionsConfig`     | interface | `export interface RexOptionsConfig`                                                          |
| `RexConfig`            | interface | `export interface RexConfig<A extends RexConfigApp = RexConfigApp> extends RexOptionsConfig` |
| `ResolvedBudgets`      | interface | `export interface ResolvedBudgets`                                                           |
| `ResolvedSecurity`     | interface | `export interface ResolvedSecurity`                                                          |
| `ResolvedI18n`         | interface | `export interface ResolvedI18n`                                                              |
| `ResolvedFont`         | interface | `export interface ResolvedFont`                                                              |
| `ResolvedRexOptions`   | interface | `export interface ResolvedRexOptions`                                                        |
| `ResolvedRexConfig`    | interface | `export interface ResolvedRexConfig<A extends RexConfigApp = RexConfigApp>`                  |
| `RexConfigError`       | class     | `export class RexConfigError extends RexError`                                               |
| `Fail`                 | type      | `type Fail = (field: string, problem: string) => never;`                                     |
| `RexConfigExport`      | type      | `export type RexConfigExport =`                                                              |
| `DefaultServerFactory` | type      | `export type DefaultServerFactory = (app: RexConfigApp) => RexFetchHandler;`                 |
| `ConfigServerOptions`  | interface | `export interface ConfigServerOptions`                                                       |

### `packages/rex/src/core/deprecated.ts`

| Symbol            | Kind | Declaration                                                |
| ----------------- | ---- | ---------------------------------------------------------- |
| `DeprecationWarn` | type | `export type DeprecationWarn = (message: string) => void;` |

### `packages/rex/src/core/entity.ts`

| Symbol                | Kind      | Declaration                                                                                            |
| --------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `DeclarationName`     | type      | `export type DeclarationName = "entity" \| "action" \| "page" \| "policy" \| "predicate" \| "flow";`   |
| `RexDeclarationError` | class     | `export class RexDeclarationError extends RexError`                                                    |
| `EntityFields`        | type      | `export type EntityFields = { readonly [field: string]: StandardSchemaV1 };`                           |
| `Flatten`             | type      | `type Flatten<T> = { [P in keyof T]: T[P] };`                                                          |
| `OptionalOutputKeys`  | type      | `type OptionalOutputKeys<F extends EntityFields> =`                                                    |
| `OptionalInputKeys`   | type      | `type OptionalInputKeys<F extends EntityFields> =`                                                     |
| `EntityRecord`        | type      | `export type EntityRecord<F extends EntityFields> = Flatten<`                                          |
| `EntityInput`         | type      | `export type EntityInput<F extends EntityFields> = Flatten<`                                           |
| `EntitySchema`        | type      | `export type EntitySchema<F extends EntityFields> = ObjectSchema<F, EntityInput<F>, EntityRecord<F>>;` |
| `StringFieldOf`       | type      | `export type StringFieldOf<F extends EntityFields> =`                                                  |
| `EntityConfig`        | interface | `export interface EntityConfig<F extends EntityFields, K extends StringFieldOf<F>>`                    |
| `EntityDeclaration`   | interface | `export interface EntityDeclaration<`                                                                  |
| `AnyEntity`           | type      | `export type AnyEntity = EntityDeclaration<string, EntityFields, string>;`                             |
| `InferEntity`         | type      | `export type InferEntity<E> =`                                                                         |

### `packages/rex/src/core/errors.docs.ts`

| Symbol              | Kind      | Declaration                                                                                            |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `RexErrorArea`      | type      | `export type RexErrorArea = "config" \| "declaration" \| "runtime" \| "server" \| "checker" \| "cli";` |
| `RexErrorAreaInfo`  | interface | `export interface RexErrorAreaInfo`                                                                    |
| `RexErrorDocsEntry` | interface | `export interface RexErrorDocsEntry`                                                                   |

### `packages/rex/src/core/errors.ts`

| Symbol                       | Kind      | Declaration                                                  |
| ---------------------------- | --------- | ------------------------------------------------------------ |
| `RexErrorCode`               | type      | `export type RexErrorCode = keyof typeof REX_ERROR_CATALOG;` |
| `RexErrorLocation`           | interface | `export interface RexErrorLocation`                          |
| `RexErrorOptions`            | interface | `export interface RexErrorOptions extends RexErrorLocation`  |
| `RexError`                   | class     | `export class RexError extends Error`                        |
| `RexDeclarationErrorDetails` | interface | `export interface RexDeclarationErrorDetails`                |
| `RexDeclarationOptionError`  | class     | `export class RexDeclarationOptionError extends RexError`    |
| `RexStackFrame`              | interface | `export interface RexStackFrame`                             |

### `packages/rex/src/core/flow.ts`

| Symbol                  | Kind      | Declaration                                                                                             |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `FlowStepContext`       | interface | `export interface FlowStepContext`                                                                      |
| `ActionStepConfig`      | interface | `export interface ActionStepConfig<A extends AnyAction = AnyAction>`                                    |
| `ApprovalStepConfig`    | interface | `export interface ApprovalStepConfig`                                                                   |
| `FlowStepConfig`        | type      | `export type FlowStepConfig = ActionStepConfig \| ApprovalStepConfig;`                                  |
| `ActionStep`            | interface | `export interface ActionStep`                                                                           |
| `ApprovalStep`          | interface | `export interface ApprovalStep`                                                                         |
| `FlowStep`              | type      | `export type FlowStep = ActionStep \| ApprovalStep;`                                                    |
| `FlowConfig`            | interface | `export interface FlowConfig`                                                                           |
| `FlowDeclaration`       | interface | `export interface FlowDeclaration<N extends string = string>`                                           |
| `AnyFlow`               | type      | `export type AnyFlow = FlowDeclaration<string>;`                                                        |
| `FlowRunContext`        | interface | `export interface FlowRunContext`                                                                       |
| `FlowRunResult`         | interface | `export interface FlowRunResult`                                                                        |
| `FlowDecisionErrorCode` | type      | `export type FlowDecisionErrorCode = typeof FLOW_NO_PENDING_APPROVAL \| typeof FLOW_DECISION_FORBID...` |
| `FlowDecisionError`     | class     | `export class FlowDecisionError extends RexError`                                                       |

### `packages/rex/src/core/ids.ts`

| Symbol           | Kind  | Declaration                                                                       |
| ---------------- | ----- | --------------------------------------------------------------------------------- |
| `RexNameError`   | class | `export class RexNameError extends RexError`                                      |
| `PageAddress`    | type  | `export type PageAddress<P extends string> = P;`                                  |
| `ActionAddress`  | type  | ``export type ActionAddress<P extends string, A extends string> = `${P}/${A}`;``  |
| `RegionAddress`  | type  | ``export type RegionAddress<P extends string, R extends string> = `${P}/${R}`;``  |
| `OverlayAddress` | type  | ``export type OverlayAddress<P extends string, O extends string> = `${P}/${O}`;`` |

### `packages/rex/src/core/journal.ts`

| Symbol              | Kind      | Declaration                                                                                |
| ------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `FlowStatus`        | type      | `export type FlowStatus = "running" \| "paused" \| "completed" \| "rejected" \| "failed";` |
| `FlowDecision`      | type      | `export type FlowDecision = "approve" \| "reject";`                                        |
| `JournalEntry`      | type      | `export type JournalEntry =`                                                               |
| `FlowInstance`      | interface | `export interface FlowInstance`                                                            |
| `JournalListFilter` | interface | `export interface JournalListFilter`                                                       |
| `Journal`           | interface | `export interface Journal`                                                                 |

### `packages/rex/src/core/overlay.ts`

| Symbol               | Kind      | Declaration                                                      |
| -------------------- | --------- | ---------------------------------------------------------------- |
| `OverlayDismiss`     | type      | `export type OverlayDismiss = "escape" \| "button" \| "both";`   |
| `OverlayBinding`     | type      | `export type OverlayBinding = "region" \| "url";`                |
| `OverlayDeclaration` | interface | `export interface OverlayDeclaration<N extends string = string>` |

### `packages/rex/src/core/page.ts`

| Symbol             | Kind      | Declaration                                                                        |
| ------------------ | --------- | ---------------------------------------------------------------------------------- |
| `PageDraft`        | type      | `export type PageDraft = "route" \| "session" \| "none";`                          |
| `PageRender`       | type      | `export type PageRender = (typeof PAGE_RENDER_MODES)[number];`                     |
| `PageTransition`   | type      | `export type PageTransition = (typeof PAGE_TRANSITIONS)[number];`                  |
| `PageChromeConfig` | interface | `export interface PageChromeConfig`                                                |
| `PageChrome`       | interface | `export interface PageChrome`                                                      |
| `PageLoaderInput`  | interface | `export interface PageLoaderInput<Act extends AnyAction = AnyAction>`              |
| `PageLoaderSpec`   | type      | `export type PageLoaderSpec = AnyAction \| PageLoaderInput;`                       |
| `PageLoadMap`      | type      | `export type PageLoadMap = Readonly<Record<string, PageLoaderSpec>>;`              |
| `PageLoader`       | interface | `export interface PageLoader`                                                      |
| `PageCacheConfig`  | interface | `export interface PageCacheConfig`                                                 |
| `PagePaths`        | type      | `export type PagePaths<Params = Readonly<Record<string, unknown>>> = () =>`        |
| `RouteSegment`     | type      | `export type RouteSegment =`                                                       |
| `ParsedRoute`      | interface | `export interface ParsedRoute`                                                     |
| `PageParamsSchema` | type      | `export type PageParamsSchema = StandardSchemaV1;`                                 |
| `EmptyPageParams`  | type      | `export type EmptyPageParams = StandardSchemaV1<{}, {}>;`                          |
| `PageConfig`       | interface | `export interface PageConfig<`                                                     |
| `PageDeclaration`  | interface | `export interface PageDeclaration<`                                                |
| `AnyPage`          | type      | `export type AnyPage = PageDeclaration<`                                           |
| `PageParams`       | type      | `export type PageParams<Pg> =`                                                     |
| `PageParamsInput`  | type      | `export type PageParamsInput<Pg> =`                                                |
| `PageStates`       | type      | `export type PageStates<Pg> =`                                                     |
| `PageStatesModule` | type      | `export type PageStatesModule<Pg> = StatesModule<PageStates<Pg>, PageParams<Pg>>;` |

### `packages/rex/src/core/policy.ts`

| Symbol              | Kind      | Declaration                                                                                |
| ------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `ReasonCode`        | type      | `export type ReasonCode =`                                                                 |
| `PolicyResult`      | type      | `export type PolicyResult =`                                                               |
| `RequiresClause`    | interface | `export interface RequiresClause<P extends string = string>`                               |
| `Predicate`         | type      | `export type Predicate =`                                                                  |
| `PredicateJson`     | type      | `export type PredicateJson =`                                                              |
| `PolicyConfig`      | interface | `export interface PolicyConfig<P extends string>`                                          |
| `PolicyDeclaration` | interface | `export interface PolicyDeclaration<N extends string = string, P extends string = string>` |
| `AnyPolicy`         | type      | `export type AnyPolicy = PolicyDeclaration<string, string>;`                               |

### `packages/rex/src/core/protocol.ts`

| Symbol              | Kind      | Declaration                                                            |
| ------------------- | --------- | ---------------------------------------------------------------------- |
| `ReservedQueryKey`  | type      | `export type ReservedQueryKey = (typeof RESERVED_QUERY_KEYS)[number];` |
| `RexDensity`        | type      | `export type RexDensity = (typeof REX_DENSITIES)[number];`             |
| `InvocationRoute`   | type      | `export type InvocationRoute = (typeof INVOCATION_ROUTES)[number];`    |
| `FieldRule`         | type      | `type FieldRule = (value: unknown) => string \| null;`                 |
| `FieldRules`        | type      | `type FieldRules = Readonly<Record<string, FieldRule>>;`               |
| `ProtocolSchema`    | type      | `export type ProtocolSchema<T> = StandardSchemaV1<T, T>;`              |
| `ConfirmInput`      | interface | `export interface ConfirmInput`                                        |
| `ConfirmOutput`     | interface | `export interface ConfirmOutput`                                       |
| `ConfirmGrant`      | interface | `export interface ConfirmGrant`                                        |
| `FlowStateStatus`   | type      | `export type FlowStateStatus = FlowStatus \| "idle";`                  |
| `FlowInstanceInput` | interface | `export interface FlowInstanceInput`                                   |
| `FlowStartInput`    | interface | `export interface FlowStartInput extends FlowInstanceInput`            |
| `FlowDecideInput`   | interface | `export interface FlowDecideInput extends FlowInstanceInput`           |
| `FlowGateState`     | interface | `export interface FlowGateState`                                       |
| `FlowState`         | interface | `export interface FlowState`                                           |

### `packages/rex/src/core/registry.ts`

| Symbol             | Kind      | Declaration                                                    |
| ------------------ | --------- | -------------------------------------------------------------- |
| `RegistryKinds`    | interface | `export interface RegistryKinds`                               |
| `DeclarationKind`  | type      | `export type DeclarationKind = keyof RegistryKinds;`           |
| `AnyDeclaration`   | type      | `export type AnyDeclaration = RegistryKinds[DeclarationKind];` |
| `Plural`           | type      | `type Plural<K extends string> = K extends "entity"`           |
| `RegistryLists`    | type      | `export type RegistryLists =`                                  |
| `RegistrySnapshot` | type      | `export type RegistrySnapshot = RegistryLists &`               |
| `Registry`         | interface | `export interface Registry`                                    |

### `packages/rex/src/core/schema.ts`

| Symbol                   | Kind      | Declaration                                                                                         |
| ------------------------ | --------- | --------------------------------------------------------------------------------------------------- |
| `FieldKind`              | type      | `export type FieldKind =`                                                                           |
| `JsonSchema`             | type      | `export type JsonSchema = { [key: string]: unknown };`                                              |
| `SchemaDefinition`       | interface | `export interface SchemaDefinition`                                                                 |
| `SchemaInternals`        | interface | `interface SchemaInternals`                                                                         |
| `SchemaMetadataRegistry` | interface | `interface SchemaMetadataRegistry`                                                                  |
| `ObjectShape`            | type      | `export type ObjectShape = { readonly [field: string]: StandardSchemaV1 };`                         |
| `ObjectSchema`           | interface | `export interface ObjectSchema<Shape extends ObjectShape, Input, Output> extends StandardSchemaV1<` |
| `FieldResult`            | type      | `type FieldResult = readonly [string, StandardResult<unknown>];`                                    |

### `packages/rex/src/core/standard.ts`

| Symbol                    | Kind      | Declaration                                                                        |
| ------------------------- | --------- | ---------------------------------------------------------------------------------- |
| `StandardPathSegment`     | interface | `export interface StandardPathSegment`                                             |
| `StandardIssue`           | interface | `export interface StandardIssue`                                                   |
| `StandardSuccess`         | interface | `export interface StandardSuccess<Output>`                                         |
| `StandardFailure`         | interface | `export interface StandardFailure`                                                 |
| `StandardResult`          | type      | `export type StandardResult<Output> = StandardSuccess<Output> \| StandardFailure;` |
| `StandardTypes`           | interface | `export interface StandardTypes<Input = unknown, Output = Input>`                  |
| `StandardProps`           | interface | `export interface StandardProps<Input = unknown, Output = Input>`                  |
| `StandardSchemaV1`        | interface | `export interface StandardSchemaV1<Input = unknown, Output = Input>`               |
| `StandardInferInput`      | type      | `export type StandardInferInput<S extends StandardSchemaV1> = NonNullable<`        |
| `StandardInferOutput`     | type      | `export type StandardInferOutput<S extends StandardSchemaV1> = NonNullable<`       |
| `ZodSchemaLike`           | type      | `export type ZodSchemaLike = z.ZodType \| zm.ZodMiniType;`                         |
| `AsZodSchema`             | type      | `export type AsZodSchema<S extends StandardSchemaV1> = S extends ZodSchemaLike`    |
| `StandardValidationError` | class     | `export class StandardValidationError extends RexError`                            |

### `packages/rex/src/core/states.ts`

| Symbol            | Kind      | Declaration                                                                                      |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `RexDataState`    | type      | `export type RexDataState = (typeof REX_DATA_STATES)[number];`                                   |
| `NonReadyState`   | type      | `export type NonReadyState = Exclude<RexDataState, "ready">;`                                    |
| `PascalSegments`  | type      | `` type PascalSegments<S extends string> = S extends `${infer Head}-${infer Tail}` ``            |
| `StateExportName` | type      | `export type StateExportName<S extends RexDataState> = PascalSegments<S>;`                       |
| `StateProps`      | interface | `export interface StateProps<P = Record<string, unknown>>`                                       |
| `StateComponent`  | type      | `export type StateComponent<P = Record<string, unknown>> = (props: StateProps<P>) => unknown;`   |
| `StatesModule`    | type      | `export type StatesModule<S extends RexDataState = RexDataState, P = Record<string, unknown>> =` |

### `packages/rex/src/core/store.ts`

| Symbol                | Kind      | Declaration                                                                       |
| --------------------- | --------- | --------------------------------------------------------------------------------- |
| `StoreRecord`         | type      | `export type StoreRecord = { readonly [field: string]: unknown };`                |
| `StoreFilter`         | type      | `export type StoreFilter<T> = { readonly [P in keyof T]?: T[P] };`                |
| `ListQuery`           | interface | `export interface ListQuery<T>`                                                   |
| `ListResult`          | interface | `export interface ListResult<T>`                                                  |
| `Store`               | interface | `export interface Store<T>`                                                       |
| `NormalizedListQuery` | interface | `export interface NormalizedListQuery<T>`                                         |
| `EntityStore`         | interface | `export interface EntityStore<E extends AnyEntity> extends Store<InferEntity<E>>` |

### `packages/rex/src/designx/index.ts`

| Symbol                | Kind      | Declaration                                                                          |
| --------------------- | --------- | ------------------------------------------------------------------------------------ |
| `DesignxItemKind`     | type      | `export type DesignxItemKind = (typeof DESIGNX_ITEM_KINDS)[number];`                 |
| `DesignxItemName`     | type      | `export type DesignxItemName = keyof typeof DESIGNX_ITEMS;`                          |
| `DesignxProvidedItem` | interface | `export interface DesignxProvidedItem`                                               |
| `DesignxProvidedName` | type      | `export type DesignxProvidedName = keyof typeof DESIGNX_PROVIDED;`                   |
| `DesignxSingleForm`   | type      | `export type DesignxSingleForm = typeof DESIGNX_SINGLE_FORM;`                        |
| `DesignxForms`        | type      | `export type DesignxForms<F extends string> = Readonly<Record<F, DesignxItemName>>;` |
| `DesignxStateForm`    | type      | `export type DesignxStateForm = NonReadyState;`                                      |
| `DesignxSurfaces`     | interface | `export interface DesignxSurfaces`                                                   |
| `DesignxSurface`      | type      | `export type DesignxSurface = keyof DesignxSurfaces;`                                |

### `packages/rex/src/eslint/index.ts`

| Symbol       | Kind      | Declaration                                                |
| ------------ | --------- | ---------------------------------------------------------- |
| `LintRuleId` | type      | `export type LintRuleId = (typeof LINT_RULE_IDS)[number];` |
| `Snapshot`   | interface | `interface Snapshot`                                       |

### `packages/rex/src/manifest/build.ts`

| Symbol                 | Kind      | Declaration                             |
| ---------------------- | --------- | --------------------------------------- |
| `ManifestSource`       | interface | `export interface ManifestSource`       |
| `BuildManifestOptions` | interface | `export interface BuildManifestOptions` |

### `packages/rex/src/manifest/scan.ts`

| Symbol                | Kind      | Declaration                                                             |
| --------------------- | --------- | ----------------------------------------------------------------------- |
| `ManifestScanError`   | class     | `export class ManifestScanError extends RexError`                       |
| `ManifestFiles`       | interface | `export interface ManifestFiles`                                        |
| `WriteManifestResult` | interface | `export interface WriteManifestResult`                                  |
| `AppCore`             | type      | `type AppCore = Pick<typeof import("../index.ts"), "createRegistry"> &` |

### `packages/rex/src/manifest/sidecar.schema.ts`

| Symbol              | Kind      | Declaration                                                            |
| ------------------- | --------- | ---------------------------------------------------------------------- |
| `SidecarAction`     | type      | `export type SidecarAction = zm.output<typeof sidecarActionSchema>;`   |
| `SidecarOverlay`    | type      | `export type SidecarOverlay = zm.output<typeof sidecarOverlaySchema>;` |
| `SidecarOutcome`    | type      | `export type SidecarOutcome = zm.output<typeof sidecarOutcomeSchema>;` |
| `SidecarRegion`     | type      | `export type SidecarRegion = zm.output<typeof sidecarRegionSchema>;`   |
| `SidecarStores`     | type      | `export type SidecarStores = zm.output<typeof sidecarStoresSchema>;`   |
| `SidecarLoader`     | type      | `export type SidecarLoader = zm.output<typeof sidecarLoaderSchema>;`   |
| `SidecarPayload`    | type      | `export type SidecarPayload = zm.output<typeof sidecarSchema>;`        |
| `SidecarIssue`      | interface | `export interface SidecarIssue`                                        |
| `SidecarValidation` | type      | `export type SidecarValidation =`                                      |

### `packages/rex/src/manifest/types.ts`

| Symbol             | Kind      | Declaration                                                             |
| ------------------ | --------- | ----------------------------------------------------------------------- |
| `RexScreen`        | type      | `export type RexScreen = (typeof REX_SCREENS)[number];`                 |
| `RexPointer`       | type      | `export type RexPointer = (typeof REX_POINTERS)[number];`               |
| `RexScreenDensity` | type      | `export type RexScreenDensity = (typeof REX_SCREEN_DENSITIES)[number];` |
| `ManifestApp`      | interface | `export interface ManifestApp`                                          |
| `ManifestField`    | interface | `export interface ManifestField`                                        |
| `ManifestEntity`   | interface | `export interface ManifestEntity`                                       |
| `ManifestAction`   | interface | `export interface ManifestAction`                                       |
| `ManifestOverlay`  | interface | `export interface ManifestOverlay`                                      |
| `ManifestChrome`   | interface | `export interface ManifestChrome`                                       |
| `ManifestLoader`   | interface | `export interface ManifestLoader`                                       |
| `ManifestPage`     | interface | `export interface ManifestPage`                                         |
| `ManifestPolicy`   | interface | `export interface ManifestPolicy`                                       |
| `ManifestFlowStep` | type      | `export type ManifestFlowStep =`                                        |
| `ManifestFlow`     | interface | `export interface ManifestFlow`                                         |
| `Manifest`         | interface | `export interface Manifest`                                             |
| `FlowStepSource`   | type      | `export type FlowStepSource =`                                          |
| `FlowSource`       | interface | `export interface FlowSource`                                           |

### `packages/rex/src/schema/fields.ts`

| Symbol            | Kind      | Declaration                                                                |
| ----------------- | --------- | -------------------------------------------------------------------------- |
| `TextOptions`     | interface | `export interface TextOptions`                                             |
| `IntegerOptions`  | interface | `export interface IntegerOptions`                                          |
| `RealOptions`     | interface | `export interface RealOptions`                                             |
| `RefTarget`       | type      | `export type RefTarget = string \| { readonly id: string };`               |
| `FieldMeta`       | type      | `type FieldMeta = Readonly<Record<string, unknown>>;`                      |
| `RexFieldMethods` | interface | `export interface RexFieldMethods<T extends zm.ZodMiniType>`               |
| `RexField`        | type      | `export type RexField<T extends zm.ZodMiniType> = T & RexFieldMethods<T>;` |

### `packages/rex/src/server/adapters/bun.ts`

| Symbol             | Kind      | Declaration                                                                                             |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------------- |
| `BunServer`        | interface | `export interface BunServer`                                                                            |
| `BunFetchHandler`  | type      | `export type BunFetchHandler = (request: Request, server: BunServer) => Response \| Promise<Response>;` |
| `BunServeOptions`  | interface | `export interface BunServeOptions`                                                                      |
| `BunRuntime`       | interface | `export interface BunRuntime`                                                                           |
| `BunServerOptions` | interface | `export interface BunServerOptions`                                                                     |
| `RunningBunServer` | interface | `export interface RunningBunServer`                                                                     |

### `packages/rex/src/server/adapters/deno.ts`

| Symbol                 | Kind      | Declaration                             |
| ---------------------- | --------- | --------------------------------------- |
| `DenoNetAddr`          | interface | `export interface DenoNetAddr`          |
| `DenoServeHandlerInfo` | interface | `export interface DenoServeHandlerInfo` |
| `DenoServeHandler`     | type      | `export type DenoServeHandler = (`      |
| `DenoServeOptions`     | interface | `export interface DenoServeOptions`     |
| `DenoHttpServer`       | interface | `export interface DenoHttpServer`       |
| `DenoRuntime`          | interface | `export interface DenoRuntime`          |
| `DenoServerOptions`    | interface | `export interface DenoServerOptions`    |
| `RunningDenoServer`    | interface | `export interface RunningDenoServer`    |

### `packages/rex/src/server/adapters/edge.ts`

| Symbol              | Kind      | Declaration                                                                         |
| ------------------- | --------- | ----------------------------------------------------------------------------------- |
| `EdgeFetchApp`      | interface | `export interface EdgeFetchApp`                                                     |
| `EdgeFetchHandler`  | type      | `export type EdgeFetchHandler = (`                                                  |
| `EdgeHandler`       | interface | `export interface EdgeHandler`                                                      |
| `EdgeServerOptions` | type      | `export type EdgeServerOptions<A extends AnyAction> = PrebuiltRexServerOptions<A>;` |

### `packages/rex/src/server/adapters/node.ts`

| Symbol              | Kind      | Declaration                            |
| ------------------- | --------- | -------------------------------------- |
| `NodeFetchApp`      | type      | `export type NodeFetchApp = FetchApp;` |
| `NodeServerOptions` | interface | `export interface NodeServerOptions`   |
| `RunningNodeServer` | interface | `export interface RunningNodeServer`   |

### `packages/rex/src/server/adapters/runtime.ts`

| Symbol                | Kind      | Declaration                                         |
| --------------------- | --------- | --------------------------------------------------- |
| `AdapterRuntime`      | type      | `export type AdapterRuntime = "Bun" \| "Deno";`     |
| `FetchApp`            | interface | `export interface FetchApp`                         |
| `RuntimeMissingError` | class     | `export class RuntimeMissingError extends RexError` |

### `packages/rex/src/server/adapters/static-cache.ts`

| Symbol                    | Kind      | Declaration                                                                                           |
| ------------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| `PrerenderMode`           | type      | `export type PrerenderMode = (typeof PRERENDER_MODES)[number];`                                       |
| `StaticScreenClassifier`  | type      | `export type StaticScreenClassifier = (request: Request, context: RexRequestContext) => ScreenState;` |
| `StaticPageEntry`         | interface | `export interface StaticPageEntry`                                                                    |
| `PrerenderList`           | interface | `export interface PrerenderList`                                                                      |
| `RexStaticPageError`      | class     | `export class RexStaticPageError extends RexError`                                                    |
| `RenderedStaticPage`      | interface | `export interface RenderedStaticPage`                                                                 |
| `StaticPageStore`         | interface | `export interface StaticPageStore`                                                                    |
| `StaticServeStatus`       | type      | `export type StaticServeStatus = "hit" \| "stale" \| "generated";`                                    |
| `StaticHit`               | interface | `export interface StaticHit`                                                                          |
| `StaticCacheErrorHandler` | type      | `export type StaticCacheErrorHandler = (error: unknown, entry: StaticPageEntry) => void;`             |
| `StaticCacheOptions`      | interface | `export interface StaticCacheOptions`                                                                 |
| `StaticCache`             | interface | `export interface StaticCache`                                                                        |

### `packages/rex/src/server/app.ts`

| Symbol                     | Kind      | Declaration                                                                              |
| -------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `RexServerRegistry`        | type      | `export type RexServerRegistry<A extends AnyAction> = ManifestSource &`                  |
| `RexServerOptions`         | interface | `export interface RexServerOptions<A extends AnyAction>`                                 |
| `PrebuiltRexServerOptions` | type      | `export type PrebuiltRexServerOptions<A extends AnyAction> = RexServerOptions<A> &`      |
| `RexRouter`                | type      | `export type RexRouter<A extends AnyAction> = ActionRouter<A>;`                          |
| `RexRouterClient`          | type      | `export type RexRouterClient<`                                                           |
| `RegistryRouterClient`     | type      | `export type RegistryRouterClient<`                                                      |
| `RexServerSetup`           | interface | `export interface RexServerSetup`                                                        |
| `RexServerInstaller`       | type      | `export type RexServerInstaller = (app: Hono, setup: RexServerSetup) => void;`           |
| `RexServerComposition`     | interface | `export interface RexServerComposition`                                                  |
| `ResolvedServerConfig`     | type      | `type ResolvedServerConfig = Pick<RexServerOptions<AnyAction>, "security" \| "client">;` |

### `packages/rex/src/server/audit.ts`

| Symbol            | Kind      | Declaration                                                    |
| ----------------- | --------- | -------------------------------------------------------------- |
| `AuditOutcome`    | type      | `export type AuditOutcome = typeof AUDIT_OK \| (string & {});` |
| `AuditRecord`     | interface | `export interface AuditRecord`                                 |
| `AuditEntry`      | type      | `export type AuditEntry = Omit<AuditRecord, "id">;`            |
| `AuditFilter`     | interface | `export interface AuditFilter`                                 |
| `Ledger`          | interface | `export interface Ledger`                                      |
| `AuditEntryInput` | interface | `export interface AuditEntryInput`                             |

### `packages/rex/src/server/context.ts`

| Symbol              | Kind      | Declaration                                                                  |
| ------------------- | --------- | ---------------------------------------------------------------------------- |
| `RexContext`        | interface | `export interface RexContext`                                                |
| `RexRequestContext` | interface | `export interface RexRequestContext extends RexContext`                      |
| `RequestContext`    | class     | `class RequestContext implements RexRequestContext`                          |
| `ActorResolver`     | type      | `export type ActorResolver = (request: Request) => Actor \| Promise<Actor>;` |
| `RexDensityError`   | class     | `export class RexDensityError extends RexError`                              |

### `packages/rex/src/server/flow.ts`

| Symbol                   | Kind      | Declaration                                                    |
| ------------------------ | --------- | -------------------------------------------------------------- |
| `FlowDecisionAuditInput` | interface | `export interface FlowDecisionAuditInput`                      |
| `FlowRouter`             | type      | `export type FlowRouter = ReturnType<typeof buildFlowRouter>;` |
| `MountFlowsOptions`      | interface | `export interface MountFlowsOptions`                           |

### `packages/rex/src/server/form.ts`

| Symbol                 | Kind      | Declaration                               |
| ---------------------- | --------- | ----------------------------------------- |
| `FormValue`            | type      | `export type FormValue = string \| File;` |
| `FormOutcome`          | interface | `export interface FormOutcome`            |
| `FormNode`             | interface | `interface FormNode`                      |
| `CsrfGrant`            | interface | `export interface CsrfGrant`              |
| `ConfirmPageOptions`   | interface | `export interface ConfirmPageOptions`     |
| `FormErrorPageOptions` | interface | `export interface FormErrorPageOptions`   |

### `packages/rex/src/server/loaders.ts`

| Symbol                  | Kind      | Declaration                              |
| ----------------------- | --------- | ---------------------------------------- |
| `LoaderRunner`          | interface | `export interface LoaderRunner`          |
| `PageLoaderOutcome`     | interface | `export interface PageLoaderOutcome`     |
| `RunPageLoadersOptions` | interface | `export interface RunPageLoadersOptions` |

### `packages/rex/src/server/locale.ts`

| Symbol             | Kind      | Declaration                  |
| ------------------ | --------- | ---------------------------- |
| `WeightedLanguage` | interface | `interface WeightedLanguage` |

### `packages/rex/src/server/middleware/security.ts`

| Symbol                | Kind      | Declaration                            |
| --------------------- | --------- | -------------------------------------- |
| `SecurityPolicy`      | interface | `export interface SecurityPolicy`      |
| `SecurityPolicyInput` | interface | `export interface SecurityPolicyInput` |

### `packages/rex/src/server/middleware/telemetry.ts`

| Symbol                 | Kind      | Declaration                                                                              |
| ---------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `RexSpanName`          | type      | `export type RexSpanName =`                                                              |
| `RexSpanAttributes`    | type      | `export type RexSpanAttributes = Readonly<Record<string, string \| number \| boolean>>;` |
| `TelemetrySpanContext` | interface | `export interface TelemetrySpanContext`                                                  |
| `TelemetrySpan`        | interface | `export interface TelemetrySpan`                                                         |
| `TelemetryTracer`      | interface | `export interface TelemetryTracer`                                                       |
| `RexSpan`              | interface | `export interface RexSpan`                                                               |
| `RexTelemetry`         | interface | `export interface RexTelemetry`                                                          |
| `ConsoleTarget`        | interface | `export interface ConsoleTarget`                                                         |
| `RouteMatcher`         | interface | `interface RouteMatcher`                                                                 |

### `packages/rex/src/server/node.ts`

| Symbol                         | Kind      | Declaration                                                               |
| ------------------------------ | --------- | ------------------------------------------------------------------------- |
| `NodeStaticPagesOptions`       | interface | `export interface NodeStaticPagesOptions`                                 |
| `PrerenderedNodeServerOptions` | interface | `export interface PrerenderedNodeServerOptions extends NodeServerOptions` |

### `packages/rex/src/server/router.ts`

| Symbol                | Kind      | Declaration                                                                                        |
| --------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| `NoErrors`            | type      | `type NoErrors = Record<never, never>;`                                                            |
| `NoMeta`              | type      | `type NoMeta = Record<never, never>;`                                                              |
| `LowerLetter`         | type      | `type LowerLetter =`                                                                               |
| `ActionKey`           | type      | ``export type ActionKey<Id extends string> = string extends Id ? `${LowerLetter}${string}` : Id;`` |
| `ActionProcedure`     | type      | `export type ActionProcedure<A extends AnyAction> = Procedure<`                                    |
| `ConfirmProcedure`    | type      | `export type ConfirmProcedure = Procedure<`                                                        |
| `ActionRouter`        | type      | `export type ActionRouter<A extends AnyAction> =`                                                  |
| `ActionRouterSource`  | interface | `export interface ActionRouterSource<A extends AnyAction>`                                         |
| `ActionRouterOptions` | interface | `export interface ActionRouterOptions`                                                             |
| `PendingConfirmation` | interface | `interface PendingConfirmation`                                                                    |
| `Confirmations`       | type      | `type Confirmations = ReturnType<typeof createConfirmations>;`                                     |

### `packages/rex/src/server/routes/dev.ts`

| Symbol        | Kind      | Declaration             |
| ------------- | --------- | ----------------------- |
| `ProcessLike` | interface | `interface ProcessLike` |

### `packages/rex/src/server/routes/form.ts`

| Symbol       | Kind      | Declaration            |
| ------------ | --------- | ---------------------- |
| `FormTarget` | interface | `interface FormTarget` |

### `packages/rex/src/server/routes/pages-text.ts`

| Symbol           | Kind      | Declaration                       |
| ---------------- | --------- | --------------------------------- |
| `PageTextSource` | interface | `export interface PageTextSource` |
| `PageText`       | interface | `export interface PageText`       |

### `packages/rex/src/server/routes/render.ts`

| Symbol            | Kind      | Declaration                                            |
| ----------------- | --------- | ------------------------------------------------------ |
| `RenderKind`      | type      | `export type RenderKind = keyof typeof RENDER_STATUS;` |
| `RexRenderResult` | interface | `export interface RexRenderResult`                     |
| `RexPageRenderer` | interface | `export interface RexPageRenderer`                     |

### `packages/rex/src/server/ssr.ts`

| Symbol                    | Kind      | Declaration                                                                                            |
| ------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `RexPageAssets`           | interface | `export interface RexPageAssets`                                                                       |
| `RexDocumentAssets`       | interface | `export interface RexDocumentAssets extends RexPageAssets`                                             |
| `RexRendererOptions`      | interface | `export interface RexRendererOptions`                                                                  |
| `ResolvedRendererOptions` | type      | `type ResolvedRendererOptions = Required<Omit<RexRendererOptions, "bundle" \| "fonts" \| "ledger">> &` |
| `PageMatch`               | interface | `export interface PageMatch`                                                                           |
| `RexClientRenderSignal`   | class     | `export class RexClientRenderSignal extends Error`                                                     |
| `DocumentParts`           | interface | `interface DocumentParts`                                                                              |

### `packages/rex/src/store/drizzle.ts`

| Symbol                | Kind      | Declaration                                                                                        |
| --------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| `ColumnType`          | type      | `export type ColumnType = "text" \| "integer" \| "real" \| "boolean" \| "json";`                   |
| `ColumnSpec`          | interface | `export interface ColumnSpec`                                                                      |
| `DrizzleStoreOptions` | interface | `export interface DrizzleStoreOptions`                                                             |
| `AsyncSQLiteDatabase` | type      | `export type AsyncSQLiteDatabase = BaseSQLiteDatabase<"async", unknown, Record<string, unknown>>;` |

### `packages/rex/src/testing/index.ts`

| Symbol              | Kind      | Declaration                                                                                           |
| ------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| `TestAppSource`     | interface | `export interface TestAppSource`                                                                      |
| `TestServerOptions` | interface | `export interface TestServerOptions`                                                                  |
| `TestAppOptions`    | interface | `export interface TestAppOptions`                                                                     |
| `TestApp`           | interface | `export interface TestApp`                                                                            |
| `TestFetch`         | type      | `export type TestFetch = (input: string \| URL \| Request, init?: RequestInit) => Promise<Response>;` |
| `TestServer`        | interface | `export interface TestServer`                                                                         |
| `RenderPageOptions` | interface | `export interface RenderPageOptions`                                                                  |
| `RexRenderResult`   | interface | `export interface RexRenderResult extends RenderResult`                                               |
| `RexTestHooks`      | interface | `export interface RexTestHooks`                                                                       |
| `RexTestingError`   | class     | `export class RexTestingError extends Error`                                                          |
| `MemoryHistory`     | type      | `type MemoryHistory = ReturnType<typeof recordedLocation>;`                                           |
| `RenderSetup`       | interface | `interface RenderSetup`                                                                               |

### `packages/rex/src/vite/app-module.ts`

| Symbol                 | Kind      | Declaration                             |
| ---------------------- | --------- | --------------------------------------- |
| `RexLoadedPageModules` | interface | `export interface RexLoadedPageModules` |
| `RexPageModule`        | interface | `export interface RexPageModule`        |
| `RexAppBundle`         | interface | `export interface RexAppBundle`         |
| `RexAppConfig`         | interface | `export interface RexAppConfig`         |
| `LocaleModule`         | interface | `export interface LocaleModule`         |
| `AppModuleOptions`     | interface | `export interface AppModuleOptions`     |

### `packages/rex/src/vite/boundary.ts`

| Symbol              | Kind      | Declaration                                                                               |
| ------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `BoundaryErrorCode` | type      | `export type BoundaryErrorCode = typeof BOUNDARY_IMPORT_CODE \| typeof SECRET_LEAK_CODE;` |
| `BoundaryViolation` | type      | `export type BoundaryViolation = "rex/server" \| "app/server" \| "server-only";`          |
| `AstNode`           | interface | `interface AstNode`                                                                       |
| `Edit`              | interface | `interface Edit`                                                                          |
| `BoundaryLog`       | interface | `export interface BoundaryLog`                                                            |
| `BundleChunk`       | interface | `interface BundleChunk`                                                                   |
| `BundleAsset`       | interface | `interface BundleAsset`                                                                   |

### `packages/rex/src/vite/budgets.ts`

| Symbol              | Kind      | Declaration                          |
| ------------------- | --------- | ------------------------------------ |
| `EntryBudget`       | interface | `export interface EntryBudget`       |
| `BundledChunk`      | interface | `export interface BundledChunk`      |
| `ChunkSize`         | interface | `export interface ChunkSize`         |
| `BudgetMeasurement` | interface | `export interface BudgetMeasurement` |

### `packages/rex/src/vite/compiler.ts`

| Symbol        | Kind      | Declaration             |
| ------------- | --------- | ----------------------- |
| `BabelResult` | interface | `interface BabelResult` |
| `BabelCore`   | interface | `interface BabelCore`   |

### `packages/rex/src/vite/dev-server.ts`

| Symbol            | Kind      | Declaration                     |
| ----------------- | --------- | ------------------------------- |
| `RexFetchApp`     | interface | `export interface RexFetchApp`  |
| `RexServerSource` | type      | `export type RexServerSource =` |

### `packages/rex/src/vite/entry-module.ts`

| Symbol               | Kind      | Declaration                           |
| -------------------- | --------- | ------------------------------------- |
| `EntryModuleOptions` | interface | `export interface EntryModuleOptions` |

### `packages/rex/src/vite/hmr.ts`

| Symbol         | Kind      | Declaration                     |
| -------------- | --------- | ------------------------------- |
| `RexHmrNotice` | interface | `export interface RexHmrNotice` |

### `packages/rex/src/vite/hooks.ts`

| Symbol           | Kind      | Declaration                                                                       |
| ---------------- | --------- | --------------------------------------------------------------------------------- |
| `RexHookState`   | interface | `export interface RexHookState`                                                   |
| `RexHookContext` | interface | `export interface RexHookContext`                                                 |
| `RexHook`        | type      | `export type RexHook = (context: RexHookContext) => Plugin \| readonly Plugin[];` |

### `packages/rex/src/vite/overlay.ts`

| Symbol          | Kind | Declaration                                           |
| --------------- | ---- | ----------------------------------------------------- |
| `OverlayError`  | type | `export type OverlayError = ErrorPayload["err"];`     |
| `FixStacktrace` | type | `export type FixStacktrace = (error: Error) => void;` |

### `packages/rex/src/vite/plugin.ts`

| Symbol             | Kind      | Declaration                         |
| ------------------ | --------- | ----------------------------------- |
| `RexPluginOptions` | interface | `export interface RexPluginOptions` |

### `packages/rex/src/vite/prerender.ts`

| Symbol             | Kind      | Declaration                         |
| ------------------ | --------- | ----------------------------------- |
| `PrerenderRuntime` | interface | `export interface PrerenderRuntime` |
| `PrerenderSource`  | interface | `export interface PrerenderSource`  |
| `PrerenderOptions` | interface | `export interface PrerenderOptions` |

### `packages/rex/src/vite/resolve.ts`

| Symbol           | Kind      | Declaration                       |
| ---------------- | --------- | --------------------------------- |
| `RuntimePaths`   | interface | `export interface RuntimePaths`   |
| `ResolveContext` | interface | `export interface ResolveContext` |

### `packages/rex/src/vite/scan.ts`

| Symbol             | Kind      | Declaration                                     |
| ------------------ | --------- | ----------------------------------------------- |
| `ScannedNamedFile` | interface | `export interface ScannedNamedFile`             |
| `ScannedPage`      | interface | `export interface ScannedPage`                  |
| `AppScan`          | interface | `export interface AppScan`                      |
| `RexAppScanError`  | class     | `export class RexAppScanError extends RexError` |

### `packages/rex/src/vite/shell-components.ts`

| Symbol                 | Kind      | Declaration                             |
| ---------------------- | --------- | --------------------------------------- |
| `ShellComponentsLines` | interface | `export interface ShellComponentsLines` |

### `packages/rex/src/vite/split.ts`

| Symbol            | Kind      | Declaration                        |
| ----------------- | --------- | ---------------------------------- |
| `PageChunkGroup`  | interface | `export interface PageChunkGroup`  |
| `OutputChunkLike` | interface | `export interface OutputChunkLike` |
| `OutputAssetLike` | interface | `export interface OutputAssetLike` |
| `ChunkRow`        | interface | `export interface ChunkRow`        |
| `ChunkBudgets`    | interface | `export interface ChunkBudgets`    |

### `packages/rex/src/vite/ssr-css.ts`

| Symbol                   | Kind      | Declaration                                                               |
| ------------------------ | --------- | ------------------------------------------------------------------------- |
| `ViteManifestChunk`      | interface | `export interface ViteManifestChunk`                                      |
| `ViteManifest`           | type      | `export type ViteManifest = Readonly<Record<string, ViteManifestChunk>>;` |
| `SsrAssetsOptions`       | interface | `export interface SsrAssetsOptions`                                       |
| `RexClientManifestError` | class     | `export class RexClientManifestError extends RexError`                    |
| `Collected`              | interface | `interface Collected`                                                     |

### `packages/rex/src/vite/ssr.ts`

| Symbol                | Kind      | Declaration                                                                               |
| --------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `RenderModuleOptions` | interface | `export interface RenderModuleOptions`                                                    |
| `RenderAssetsSource`  | type      | `export type RenderAssetsSource = () => RexDocumentAssets \| Promise<RexDocumentAssets>;` |
| `DocumentRequestLike` | interface | `export interface DocumentRequestLike`                                                    |

### `packages/rex/src/vite/styles.ts`

| Symbol            | Kind | Declaration                                                 |
| ----------------- | ---- | ----------------------------------------------------------- |
| `TailwindFactory` | type | `type TailwindFactory = () => Plugin \| readonly Plugin[];` |

## Demo application

Prop types and data types of the wallet demo in `examples/demo`, including the server's `DemoApp` type. The demo is described in the [README](../README.md#the-demo-and-the-operability-walk).

### `examples/demo/app/components/AnimatedNumber.tsx`

| Symbol                | Kind      | Declaration                            |
| --------------------- | --------- | -------------------------------------- |
| `AnimatedNumberProps` | interface | `export interface AnimatedNumberProps` |

### `examples/demo/app/components/BalanceCard.tsx`

| Symbol             | Kind      | Declaration                         |
| ------------------ | --------- | ----------------------------------- |
| `BalanceCardProps` | interface | `export interface BalanceCardProps` |

### `examples/demo/app/components/Button.tsx`

| Symbol        | Kind      | Declaration                                                                    |
| ------------- | --------- | ------------------------------------------------------------------------------ |
| `ButtonProps` | interface | `export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>` |

### `examples/demo/app/components/Card.tsx`

| Symbol      | Kind      | Declaration                  |
| ----------- | --------- | ---------------------------- |
| `CardProps` | interface | `export interface CardProps` |

### `examples/demo/app/components/ChangeBadge.tsx`

| Symbol             | Kind      | Declaration                         |
| ------------------ | --------- | ----------------------------------- |
| `ChangeBadgeProps` | interface | `export interface ChangeBadgeProps` |

### `examples/demo/app/components/Field.tsx`

| Symbol       | Kind      | Declaration                                                                             |
| ------------ | --------- | --------------------------------------------------------------------------------------- |
| `FieldProps` | interface | `export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id">` |

### `examples/demo/app/components/HoldingsTable.tsx`

| Symbol               | Kind      | Declaration                           |
| -------------------- | --------- | ------------------------------------- |
| `Holding`            | interface | `export interface Holding`            |
| `HoldingsTableProps` | interface | `export interface HoldingsTableProps` |

### `examples/demo/app/components/Sheet.tsx`

| Symbol       | Kind      | Declaration                   |
| ------------ | --------- | ----------------------------- |
| `SheetProps` | interface | `export interface SheetProps` |

### `examples/demo/app/components/Shell.tsx`

| Symbol               | Kind      | Declaration                    |
| -------------------- | --------- | ------------------------------ |
| `WalletIdentityData` | interface | `interface WalletIdentityData` |

### `examples/demo/app/components/TokenAvatar.tsx`

| Symbol             | Kind      | Declaration                         |
| ------------------ | --------- | ----------------------------------- |
| `TokenAvatarProps` | interface | `export interface TokenAvatarProps` |

### `examples/demo/app/components/TokenChip.tsx`

| Symbol           | Kind      | Declaration                       |
| ---------------- | --------- | --------------------------------- |
| `TokenChipProps` | interface | `export interface TokenChipProps` |

### `examples/demo/app/components/token-chip-element.ts`

| Symbol                | Kind      | Declaration                                                         |
| --------------------- | --------- | ------------------------------------------------------------------- |
| `TokenChipAttributes` | interface | `interface TokenChipAttributes extends HTMLAttributes<HTMLElement>` |

### `examples/demo/app/components/ui/badge.tsx`

| Symbol       | Kind | Declaration                                                                                |
| ------------ | ---- | ------------------------------------------------------------------------------------------ |
| `BadgeProps` | type | `type BadgeProps = useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;` |

### `examples/demo/app/components/ui/button.tsx`

| Symbol        | Kind | Declaration                                                                       |
| ------------- | ---- | --------------------------------------------------------------------------------- |
| `ButtonProps` | type | `type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;` |

### `examples/demo/app/components/ui/card.tsx`

| Symbol      | Kind | Declaration                                      |
| ----------- | ---- | ------------------------------------------------ |
| `CardProps` | type | `type CardProps = React.ComponentProps<"div"> &` |

### `examples/demo/app/components/ui/data-table.tsx`

| Symbol           | Kind | Declaration                            |
| ---------------- | ---- | -------------------------------------- |
| `DataTableProps` | type | `type DataTableProps<TData, TValue> =` |

### `examples/demo/app/components/ui/sidebar.tsx`

| Symbol                | Kind | Declaration                  |
| --------------------- | ---- | ---------------------------- |
| `SidebarContextProps` | type | `type SidebarContextProps =` |

### `examples/demo/app/components/ui/theme-provider.tsx`

| Symbol              | Kind | Declaration                                   |
| ------------------- | ---- | --------------------------------------------- |
| `Theme`             | type | `type Theme = "light" \| "dark" \| "system";` |
| `Accent`            | type | `type Accent = "ink" \| "dx-gradient";`       |
| `ThemeContextValue` | type | `type ThemeContextValue =`                    |

### `examples/demo/app/components/ui/tooltip.tsx`

| Symbol                | Kind | Declaration                                                                      |
| --------------------- | ---- | -------------------------------------------------------------------------------- |
| `TooltipContentProps` | type | `export type TooltipContentProps = React.ComponentProps<typeof TooltipContent>;` |

### `examples/demo/app/components/ui/typography.tsx`

| Symbol            | Kind | Declaration                                                  |
| ----------------- | ---- | ------------------------------------------------------------ |
| `TypographyProps` | type | `type TypographyProps = React.HTMLAttributes<HTMLElement> &` |

### `examples/demo/app/data/feedback.ts`

| Symbol          | Kind      | Declaration                      |
| --------------- | --------- | -------------------------------- |
| `FeedbackEntry` | interface | `export interface FeedbackEntry` |

### `examples/demo/app/data/wallet.ts`

| Symbol    | Kind | Declaration                                          |
| --------- | ---- | ---------------------------------------------------- |
| `Account` | type | `export type Account = InferEntity<typeof account>;` |
| `Token`   | type | `export type Token = InferEntity<typeof token>;`     |
| `Contact` | type | `export type Contact = InferEntity<typeof contact>;` |

### `examples/demo/app/pages/about/regions/intro/parts/AboutIntro.tsx`

| Symbol            | Kind      | Declaration                        |
| ----------------- | --------- | ---------------------------------- |
| `AboutIntroProps` | interface | `export interface AboutIntroProps` |

### `examples/demo/app/pages/embed/hooks/useTokens.ts`

| Symbol        | Kind | Declaration                                           |
| ------------- | ---- | ----------------------------------------------------- |
| `TokenPrices` | type | `type TokenPrices = ActionOutput<typeof listTokens>;` |

### `examples/demo/app/pages/embed/regions/locale/parts/LocaleSwitch.tsx`

| Symbol              | Kind      | Declaration                          |
| ------------------- | --------- | ------------------------------------ |
| `LocaleOption`      | interface | `export interface LocaleOption`      |
| `LocaleSwitchProps` | interface | `export interface LocaleSwitchProps` |

### `examples/demo/app/pages/embed/regions/widget/parts/WatchedChips.tsx`

| Symbol              | Kind      | Declaration                          |
| ------------------- | --------- | ------------------------------------ |
| `WatchedChip`       | interface | `export interface WatchedChip`       |
| `WatchedChipsProps` | interface | `export interface WatchedChipsProps` |

### `examples/demo/app/pages/portfolio/hooks/useWallet.ts`

| Symbol           | Kind | Declaration                                              |
| ---------------- | ---- | -------------------------------------------------------- |
| `WalletOverview` | type | `type WalletOverview = ActionOutput<typeof loadWallet>;` |

### `examples/demo/app/pages/portfolio/regions/actions/parts/FilterForm.tsx`

| Symbol            | Kind      | Declaration                        |
| ----------------- | --------- | ---------------------------------- |
| `FilterFormProps` | interface | `export interface FilterFormProps` |

### `examples/demo/app/pages/portfolio/regions/actions/parts/QuickActions.tsx`

| Symbol              | Kind      | Declaration                          |
| ------------------- | --------- | ------------------------------------ |
| `QuickActionsProps` | interface | `export interface QuickActionsProps` |

### `examples/demo/app/pages/portfolio/regions/hero/parts/BalanceHero.tsx`

| Symbol             | Kind | Declaration                                        |
| ------------------ | ---- | -------------------------------------------------- |
| `BalanceHeroProps` | type | `export type BalanceHeroProps = BalanceCardProps;` |

### `examples/demo/app/pages/portfolio/regions/holdings/parts/DustToggle.tsx`

| Symbol            | Kind      | Declaration                        |
| ----------------- | --------- | ---------------------------------- |
| `DustToggleProps` | interface | `export interface DustToggleProps` |

### `examples/demo/app/pages/portfolio/regions/holdings/parts/HoldingsList.tsx`

| Symbol              | Kind      | Declaration                          |
| ------------------- | --------- | ------------------------------------ |
| `HoldingsListProps` | interface | `export interface HoldingsListProps` |

### `examples/demo/app/pages/send/hooks/useWallet.ts`

| Symbol           | Kind | Declaration                                              |
| ---------------- | ---- | -------------------------------------------------------- |
| `WalletOverview` | type | `type WalletOverview = ActionOutput<typeof loadWallet>;` |

### `examples/demo/app/pages/send/regions/confirm/parts/SendSummary.tsx`

| Symbol             | Kind      | Declaration                         |
| ------------------ | --------- | ----------------------------------- |
| `SendSummaryProps` | interface | `export interface SendSummaryProps` |

### `examples/demo/app/pages/send/regions/form/parts/AmountField.tsx`

| Symbol             | Kind      | Declaration                         |
| ------------------ | --------- | ----------------------------------- |
| `AmountFieldProps` | interface | `export interface AmountFieldProps` |

### `examples/demo/app/pages/send/regions/form/parts/ContactField.tsx`

| Symbol              | Kind      | Declaration                          |
| ------------------- | --------- | ------------------------------------ |
| `ContactFieldProps` | interface | `export interface ContactFieldProps` |

### `examples/demo/app/pages/send/regions/form/parts/ContactOptions.tsx`

| Symbol                | Kind      | Declaration                            |
| --------------------- | --------- | -------------------------------------- |
| `ContactChoice`       | interface | `export interface ContactChoice`       |
| `ContactOptionsProps` | interface | `export interface ContactOptionsProps` |

### `examples/demo/app/pages/send/regions/form/parts/TokenField.tsx`

| Symbol            | Kind      | Declaration                        |
| ----------------- | --------- | ---------------------------------- |
| `TokenFieldProps` | interface | `export interface TokenFieldProps` |

### `examples/demo/app/pages/send/regions/form/parts/TokenOptions.tsx`

| Symbol              | Kind      | Declaration                          |
| ------------------- | --------- | ------------------------------------ |
| `TokenChoice`       | interface | `export interface TokenChoice`       |
| `TokenOptionsProps` | interface | `export interface TokenOptionsProps` |

### `examples/demo/app/pages/send/regions/success/parts/TransferReceipt.tsx`

| Symbol                 | Kind      | Declaration                             |
| ---------------------- | --------- | --------------------------------------- |
| `TransferReceiptProps` | interface | `export interface TransferReceiptProps` |

### `examples/demo/app/pages/tokens/regions/prices/parts/PriceTable.tsx`

| Symbol            | Kind      | Declaration                        |
| ----------------- | --------- | ---------------------------------- |
| `PricedToken`     | interface | `export interface PricedToken`     |
| `PriceTableProps` | interface | `export interface PriceTableProps` |

### `examples/demo/server.ts`

| Symbol    | Kind      | Declaration                |
| --------- | --------- | -------------------------- |
| `DemoApp` | interface | `export interface DemoApp` |

## Test helpers

Top-level helper functions, components and types declared inside test files, the store conformance module and the Playwright specs. They exist only to exercise the code; see [development.md](development.md#tests).

### `examples/demo/app/pages/portfolio/test/actions.test.tsx`

| Symbol      | Kind     | Declaration                                                       |
| ----------- | -------- | ----------------------------------------------------------------- |
| `trigger`   | function | `function trigger(view: RexRenderResult): HTMLElement`            |
| `sheet`     | function | `function sheet(view: RexRenderResult): HTMLElement \| null`      |
| `search`    | function | `function search(view: RexRenderResult): URLSearchParams`         |
| `sheetOpen` | function | `function sheetOpen(view: RexRenderResult): boolean \| undefined` |
| `click`     | function | `async function click(element: Element): Promise<void>`           |

### `examples/demo/app/pages/portfolio/test/hero.test.tsx`

| Symbol  | Kind     | Declaration                                             |
| ------- | -------- | ------------------------------------------------------- |
| `total` | function | `function total(view: RexRenderResult): string \| null` |

### `examples/demo/app/pages/portfolio/test/holdings-menu.test.tsx`

| Symbol  | Kind     | Declaration                                             |
| ------- | -------- | ------------------------------------------------------- |
| `click` | function | `async function click(element: Element): Promise<void>` |

### `examples/demo/app/pages/portfolio/test/holdings.test.tsx`

| Symbol      | Kind     | Declaration                                             |
| ----------- | -------- | ------------------------------------------------------- |
| `holdings`  | function | `function holdings(view: RexRenderResult): string[]`    |
| `dust`      | function | `function dust(view: RexRenderResult): string \| null`  |
| `draftHref` | function | `function draftHref(query: string): string`             |
| `click`     | function | `async function click(element: Element): Promise<void>` |

### `examples/demo/app/pages/portfolio/test/portfolio.test.tsx`

| Symbol     | Kind     | Declaration                                                   |
| ---------- | -------- | ------------------------------------------------------------- |
| `holdings` | function | `function holdings(view: RexRenderResult): string[]`          |
| `regions`  | function | `function regions(view: RexRenderResult): string[]`           |
| `heading`  | function | `function heading(view: RexRenderResult): string`             |
| `loaded`   | function | `async function loaded(view: RexRenderResult): Promise<void>` |

### `examples/demo/app/pages/portfolio/test/wallet.ts`

| Symbol             | Kind     | Declaration                                                                    |
| ------------------ | -------- | ------------------------------------------------------------------------------ |
| `restoreWallet`    | function | `export async function restoreWallet(): Promise<void>`                         |
| `setupWalletTests` | function | `export function setupWalletTests(): void`                                     |
| `walletApp`        | function | `export function walletApp(actor: Actor \| ActorInput): TestApp`               |
| `tokenBalance`     | function | `export async function tokenBalance(id: string): Promise<string \| undefined>` |
| `mainAccount`      | function | `export async function mainAccount()`                                          |

### `examples/demo/app/pages/send/test/confirm.test.tsx`

| Symbol          | Kind     | Declaration                                                                 |
| --------------- | -------- | --------------------------------------------------------------------------- |
| `summary`       | function | `function summary(view: RexRenderResult): string \| null`                   |
| `sendButton`    | function | `function sendButton(view: RexRenderResult): HTMLButtonElement`             |
| `draftHref`     | function | `function draftHref(amount: string): string`                                |
| `click`         | function | `async function click(element: Element): Promise<void>`                     |
| `confirmDialog` | function | `async function confirmDialog(view: RexRenderResult): Promise<HTMLElement>` |

### `examples/demo/app/pages/send/test/form.test.tsx`

| Symbol      | Kind     | Declaration                                                                              |
| ----------- | -------- | ---------------------------------------------------------------------------------------- |
| `selected`  | function | `function selected(view: RexRenderResult, kind: "token" \| "contact"): string \| null`   |
| `sheet`     | function | `function sheet(view: RexRenderResult, address: string): HTMLElement \| null`            |
| `sheetOpen` | function | `function sheetOpen(view: RexRenderResult, id: string): boolean \| undefined`            |
| `draftOf`   | function | `function draftOf(view: RexRenderResult): unknown`                                       |
| `draftHref` | function | `function draftHref(amount: string): string`                                             |
| `click`     | function | `async function click(element: Element): Promise<void>`                                  |
| `openSheet` | function | `async function openSheet(view: RexRenderResult, address: string): Promise<HTMLElement>` |

### `examples/demo/app/pages/send/test/send.test.tsx`

| Symbol          | Kind     | Declaration                                                     |
| --------------- | -------- | --------------------------------------------------------------- |
| `regions`       | function | `function regions(view: RexRenderResult): string[]`             |
| `selectedToken` | function | `function selectedToken(view: RexRenderResult): string \| null` |
| `sendButton`    | function | `function sendButton(view: RexRenderResult): HTMLButtonElement` |
| `transfer`      | function | `function transfer(view: RexRenderResult): Element \| null`     |
| `click`         | function | `async function click(element: Element): Promise<void>`         |

### `examples/demo/app/pages/send/test/success.test.tsx`

| Symbol    | Kind     | Declaration                                                |
| --------- | -------- | ---------------------------------------------------------- |
| `receipt` | function | `function receipt(view: RexRenderResult): Element \| null` |

### `examples/demo/app/pages/send/test/wallet.ts`

| Symbol             | Kind     | Declaration                                                                    |
| ------------------ | -------- | ------------------------------------------------------------------------------ |
| `restoreWallet`    | function | `export async function restoreWallet(): Promise<void>`                         |
| `setupWalletTests` | function | `export function setupWalletTests(): void`                                     |
| `walletApp`        | function | `export function walletApp(actor: Actor \| ActorInput): TestApp`               |
| `tokenBalance`     | function | `export async function tokenBalance(id: string): Promise<string \| undefined>` |
| `mainAccount`      | function | `export async function mainAccount()`                                          |

### `examples/demo/e2e/axe.spec.ts`

| Symbol               | Kind     | Declaration                                                                       |
| -------------------- | -------- | --------------------------------------------------------------------------------- |
| `running`            | function | `function running(): { readonly base: string; readonly manifest: WalkManifest }`  |
| `blockingViolations` | function | `async function blockingViolations(page: Page, scope: string): Promise<string[]>` |
| `auditDensity`       | function | `async function auditDensity(`                                                    |

### `examples/demo/e2e/lighthouse.ts`

| Symbol                  | Kind      | Declaration                                                                                     |
| ----------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `CategoryName`          | type      | `type CategoryName = keyof typeof THRESHOLDS;`                                                  |
| `LighthousePageReport`  | interface | `interface LighthousePageReport`                                                                |
| `freePort`              | function  | `function freePort(): Promise<number>`                                                          |
| `running`               | function  | `function running(): { readonly base: string; readonly manifest: WalkManifest }`                |
| `writeLighthouse`       | function  | `function writeLighthouse(): void`                                                              |
| `categoryScore`         | function  | `function categoryScore(lhr: Result, name: CategoryName): number \| null`                       |
| `accessibilityFindings` | function  | `function accessibilityFindings(lhr: Result): string[]`                                         |
| `judge`                 | function  | `function judge(lhr: Result, scores: Record<CategoryName, number \| null>): string[]`           |
| `auditPage`             | function  | `async function auditPage(base: string, pageInfo: ManifestPage): Promise<LighthousePageReport>` |

### `examples/demo/e2e/nojs.spec.ts`

| Symbol              | Kind      | Declaration                                                                                          |
| ------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `AuditRecord`       | interface | `interface AuditRecord`                                                                              |
| `listedPage`        | function  | `function listedPage(id: string): ManifestPage`                                                      |
| `base`              | function  | `function base(): string`                                                                            |
| `withoutJavaScript` | function  | `async function withoutJavaScript<T>(browser: Browser, run: (page: Page) => Promise<T>): Promise<T>` |
| `auditRecords`      | function  | `async function auditRecords(page: Page, actionId: string): Promise<AuditRecord[]>`                  |
| `expectForm`        | function  | `async function expectForm(page: Page, pageInfo: ManifestPage, actionId: string): Promise<void>`     |

### `examples/demo/e2e/operability.spec.ts`

| Symbol              | Kind     | Declaration                                                                      |
| ------------------- | -------- | -------------------------------------------------------------------------------- |
| `running`           | function | `function running(): { readonly base: string; readonly manifest: WalkManifest }` |
| `walkDensity`       | function | `async function walkDensity(`                                                    |
| `walkStaticDensity` | function | `async function walkStaticDensity(`                                              |

### `examples/demo/e2e/vitals.spec.ts`

| Symbol                 | Kind      | Declaration                                                                      |
| ---------------------- | --------- | -------------------------------------------------------------------------------- |
| `VitalName`            | type      | `type VitalName = keyof typeof THRESHOLDS;`                                      |
| `VitalReading`         | interface | `interface VitalReading`                                                         |
| `VitalStore`           | type      | `type VitalStore = Partial<Record<VitalName, VitalReading>>;`                    |
| `VitalsPageReport`     | interface | `interface VitalsPageReport`                                                     |
| `WebVitalsGlobal`      | interface | `interface WebVitalsGlobal`                                                      |
| `registerVitals`       | function  | `function registerVitals(durationThreshold: number): void`                       |
| `StaticVitalsStore`    | interface | `interface StaticVitalsStore`                                                    |
| `NavigationReading`    | interface | `interface NavigationReading`                                                    |
| `registerStaticVitals` | function  | `function registerStaticVitals(durationThreshold: number): void`                 |
| `largestShiftSession`  | function  | `function largestShiftSession(shifts: StaticVitalsStore["shifts"]): number`      |
| `rated`                | function  | `function rated(value: number, good: number, poor: number): string`              |
| `staticVitals`         | function  | `async function staticVitals(page: Page): Promise<VitalStore>`                   |
| `running`              | function  | `function running(): { readonly base: string; readonly manifest: WalkManifest }` |
| `writeVitals`          | function  | `function writeVitals(): void`                                                   |
| `openAndClosePalette`  | function  | `async function openAndClosePalette(page: Page): Promise<string>`                |
| `typeIntoForm`         | function  | `async function typeIntoForm(page: Page): Promise<string>`                       |
| `invokeReversible`     | function  | `async function invokeReversible(`                                               |
| `settleFrames`         | function  | `async function settleFrames(page: Page): Promise<void>`                         |
| `finalizeVitals`       | function  | `async function finalizeVitals(page: Page): Promise<VitalStore>`                 |
| `judge`                | function  | `function judge(metrics: VitalStore): string[]`                                  |
| `measurePage`          | function  | `async function measurePage(`                                                    |

### `examples/demo/e2e/walk.ts`

| Symbol                 | Kind      | Declaration                                                                                       |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `Density`              | type      | `export type Density = (typeof DENSITIES)[number];`                                               |
| `rootDensity`          | function  | `export function rootDensity(density: Density): string`                                           |
| `checkRootDensity`     | function  | `export async function checkRootDensity(page: Page, density: Density): Promise<string>`           |
| `Route`                | type      | `export type Route = "click" \| "key" \| "url" \| "palette";`                                     |
| `ManifestAction`       | interface | `export interface ManifestAction`                                                                 |
| `ManifestOverlay`      | interface | `export interface ManifestOverlay`                                                                |
| `RenderMode`           | type      | `export type RenderMode = "ssr" \| "csr" \| "ssg" \| "static";`                                   |
| `ManifestLoader`       | interface | `export interface ManifestLoader`                                                                 |
| `ManifestPage`         | interface | `export interface ManifestPage`                                                                   |
| `WalkManifest`         | interface | `export interface WalkManifest`                                                                   |
| `SidecarAction`        | interface | `export interface SidecarAction`                                                                  |
| `SidecarPayload`       | interface | `export interface SidecarPayload`                                                                 |
| `Check`                | interface | `export interface Check`                                                                          |
| `PageReport`           | interface | `export interface PageReport`                                                                     |
| `committedManifest`    | function  | `export function committedManifest(): WalkManifest`                                               |
| `RunningDemo`          | interface | `export interface RunningDemo`                                                                    |
| `buildDemo`            | function  | `export function buildDemo(): void`                                                               |
| `startDemo`            | function  | `export function startDemo(env: Readonly<Record<string, string>> = {}): Promise<RunningDemo>`     |
| `writeReport`          | function  | `export function writeReport(name: string, report: PageReport): void`                             |
| `shortcutKeys`         | function  | `export function shortcutKeys(shortcut: string): string`                                          |
| `pageUrl`              | function  | `export function pageUrl(base: string, route: string, query: Record<string, string>): string`     |
| `Recorder`             | class     | `export class Recorder`                                                                           |
| `fail`                 | function  | `function fail(message: string): never`                                                           |
| `SidecarReadOptions`   | interface | `export interface SidecarReadOptions`                                                             |
| `isStaticPage`         | function  | `export function isStaticPage(pageInfo: ManifestPage): boolean`                                   |
| `waitForSidecar`       | function  | `export async function waitForSidecar(`                                                           |
| `readSidecar`          | function  | `export async function readSidecar(`                                                              |
| `presentControls`      | function  | `export async function presentControls(page: Page, pageId: string): Promise<string[]>`            |
| `checkParity`          | function  | `export async function checkParity(`                                                              |
| `OutcomeMark`          | interface | `interface OutcomeMark`                                                                           |
| `outcomeMark`          | function  | `export async function outcomeMark(page: Page): Promise<OutcomeMark>`                             |
| `waitForOutcome`       | function  | `export async function waitForOutcome(`                                                           |
| `acceptConfirmation`   | function  | `export async function acceptConfirmation(page: Page, address: string): Promise<void>`            |
| `blurActive`           | function  | `export async function blurActive(page: Page): Promise<void>`                                     |
| `InvokeContext`        | interface | `export interface InvokeContext`                                                                  |
| `invokeBy`             | function  | `export async function invokeBy(`                                                                 |
| `overlayOpen`          | function  | `export async function overlayOpen(page: Page, overlayId: string): Promise<boolean>`              |
| `waitOverlayState`     | function  | `async function waitOverlayState(page: Page, overlayId: string, open: boolean): Promise<void>`    |
| `openOverlay`          | function  | `export async function openOverlay(page: Page, pageId: string, overlayId: string): Promise<void>` |
| `closedWithFocusBack`  | function  | `export async function closedWithFocusBack(`                                                      |
| `walkOverlay`          | function  | `export async function walkOverlay(`                                                              |
| `checkHitTargets`      | function  | `export async function checkHitTargets(page: Page, pageId: string): Promise<string>`              |
| `CspWatch`             | interface | `export interface CspWatch`                                                                       |
| `watchCsp`             | function  | `export function watchCsp(page: Page): CspWatch`                                                  |
| `fetchDocument`        | function  | `export async function fetchDocument(page: Page, base: string, route: string): Promise<string>`   |
| `checkStylesheetOrder` | function  | `export function checkStylesheetOrder(html: string): string`                                      |
| `checkZeroJs`          | function  | `export async function checkZeroJs(page: Page): Promise<string>`                                  |
| `checkForms`           | function  | `export async function checkForms(`                                                               |
| `checkTextRenderer`    | function  | `export async function checkTextRenderer(`                                                        |
| `LoaderRequests`       | interface | `export interface LoaderRequests`                                                                 |
| `watchLoaderRequests`  | function  | `export function watchLoaderRequests(page: Page, pageInfo: ManifestPage): LoaderRequests`         |

### `packages/rex/src/check/check.test.ts`

| Symbol                  | Kind     | Declaration                                                       |
| ----------------------- | -------- | ----------------------------------------------------------------- |
| `link`                  | function | `function link(root: string, name: string, target: string): void` |
| `tempRoot`              | function | `function tempRoot(): string`                                     |
| `copyAllFail`           | function | `function copyAllFail(): string`                                  |
| `addStaticPageAndImage` | function | `function addStaticPageAndImage(root: string): void`              |
| `ruleOf`                | constant | `const ruleOf = (entry: Finding) => entry.rule.split("/")[0];`    |

### `packages/rex/src/check/engine.test.ts`

| Symbol     | Kind     | Declaration                                                |
| ---------- | -------- | ---------------------------------------------------------- |
| `writeApp` | function | `function writeApp(files: Record<string, string>): string` |

### `packages/rex/src/check/rules/i18n.test.ts`

| Symbol    | Kind     | Declaration                                                         |
| --------- | -------- | ------------------------------------------------------------------- |
| `fixture` | function | `function fixture(files: Readonly<Record<string, string>>): string` |
| `failing` | constant | `const failing = () =>`                                             |

### `packages/rex/src/check/rules/layout.test.ts`

| Symbol      | Kind     | Declaration                                   |
| ----------- | -------- | --------------------------------------------- |
| `parse`     | function | `function parse(text: string): ts.SourceFile` |
| `shortfall` | function | `function shortfall(classes: string)`         |

### `packages/rex/src/check/rules/media.test.ts`

| Symbol  | Kind     | Declaration                                   |
| ------- | -------- | --------------------------------------------- |
| `parse` | function | `function parse(text: string): ts.SourceFile` |

### `packages/rex/src/check/rules/render.test.ts`

| Symbol    | Kind     | Declaration                                                         |
| --------- | -------- | ------------------------------------------------------------------- |
| `tempApp` | function | `function tempApp(files: Readonly<Record<string, string>>): string` |

### `packages/rex/src/check/rules/security.test.ts`

| Symbol           | Kind     | Declaration                                                            |
| ---------------- | -------- | ---------------------------------------------------------------------- |
| `packageSources` | function | `function packageSources(dir: string, found: string[] = []): string[]` |

### `packages/rex/src/check/rules/ui.test.ts`

| Symbol               | Kind     | Declaration                                           |
| -------------------- | -------- | ----------------------------------------------------- |
| `parse`              | function | `function parse(text: string): ts.SourceFile`         |
| `failCopyWithConfig` | function | `function failCopyWithConfig(config: string): string` |
| `configWith`         | constant | `const configWith = (ui: string) =>`                  |

### `packages/rex/src/check/runtime.test.ts`

| Symbol      | Kind     | Declaration                                                                        |
| ----------- | -------- | ---------------------------------------------------------------------------------- |
| `writeApp`  | function | `function writeApp(name: string, files: Readonly<Record<string, string>>): string` |
| `captureIO` | function | `function captureIO(cwd: string)`                                                  |

### `packages/rex/src/cli/args.test.ts`

| Symbol     | Kind      | Declaration                                                            |
| ---------- | --------- | ---------------------------------------------------------------------- |
| `Captured` | interface | `interface Captured`                                                   |
| `program`  | function  | `function program(): Captured`                                         |
| `failure`  | function  | `async function failure(run: Promise<unknown>): Promise<RexArgsError>` |

### `packages/rex/src/cli/cli.test.ts`

| Symbol              | Kind     | Declaration                                                                  |
| ------------------- | -------- | ---------------------------------------------------------------------------- |
| `tempDir`           | function | `function tempDir(prefix: string): string`                                   |
| `buildCli`          | function | `function buildCli(): string`                                                |
| `rex`               | function | `function rex(...args: string[])`                                            |
| `captureIO`         | function | `function captureIO(cwd = packageRoot)`                                      |
| `diagnostics`       | function | `function diagnostics(code: string, fileName: string): string[]`             |
| `exportsOf`         | function | `function exportsOf(code: string, fileName: string)`                         |
| `expectValid`       | function | `function expectValid(code: string, fileName: string)`                       |
| `importDeclaration` | function | `async function importDeclaration(root: string, path: string, code: string)` |

### `packages/rex/src/cli/commands.test.ts`

| Symbol                | Kind      | Declaration                                                                             |
| --------------------- | --------- | --------------------------------------------------------------------------------------- |
| `captureIO`           | function  | `function captureIO(cwd: string)`                                                       |
| `installDependencies` | function  | `function installDependencies(root: string): void`                                      |
| `cli`                 | function  | `async function cli(root: string, ...args: string[])`                                   |
| `waitForServing`      | function  | `function waitForServing(child: ChildProcess): Promise<string>`                         |
| `NodeRun`             | interface | `interface NodeRun`                                                                     |
| `runNode`             | function  | `function runNode(`                                                                     |
| `serverModules`       | function  | `function serverModules(outDir: string): string[]`                                      |
| `serverLayout`        | function  | `function serverLayout(outDir: string): string[]`                                       |
| `entryScript`         | function  | `function entryScript(clientDir: string): string`                                       |
| `emitDistCli`         | function  | `function emitDistCli(): string`                                                        |
| `declareRender`       | function  | `function declareRender(root: string, pageId: string, render: "ssg" \| "static"): void` |

### `packages/rex/src/cli/designx.test.ts`

| Symbol             | Kind      | Declaration                                             |
| ------------------ | --------- | ------------------------------------------------------- |
| `tempDir`          | function  | `function tempDir(): string`                            |
| `captureIO`        | function  | `function captureIO(cwd: string)`                       |
| `GeneratedPackage` | interface | `interface GeneratedPackage`                            |
| `readJson`         | function  | `function readJson<T>(file: string): T`                 |
| `sourceOf`         | function  | `function sourceOf(name: string): string`               |
| `linkDependencies` | function  | `function linkDependencies(root: string): void`         |
| `installedFile`    | function  | `function installedFile(name: DesignxItemName): string` |

### `packages/rex/src/cli/make.test.ts`

| Symbol | Kind     | Declaration                                                          |
| ------ | -------- | -------------------------------------------------------------------- |
| `tree` | function | `function tree(dir: string, prefix = ""): string[]`                  |
| `io`   | function | `function io(): RexCliIO &`                                          |
| `read` | constant | `const read = (path: string) => readFile(join(root, path), "utf8");` |

### `packages/rex/src/cli/migrate.test.ts`

| Symbol        | Kind     | Declaration                                               |
| ------------- | -------- | --------------------------------------------------------- |
| `copyFixture` | function | `function copyFixture(): string`                          |
| `captureIO`   | function | `function captureIO(cwd: string)`                         |
| `migrate`     | function | `async function migrate(root: string, ...args: string[])` |
| `snapshot`    | function | `function snapshot(root: string): Record<string, string>` |
| `fixtureText` | function | `function fixtureText(file: string): string`              |

### `packages/rex/src/cli/new.test.ts`

| Symbol                | Kind      | Declaration                                                                                  |
| --------------------- | --------- | -------------------------------------------------------------------------------------------- |
| `tempDir`             | function  | `function tempDir(): string`                                                                 |
| `captureIO`           | function  | `function captureIO(cwd: string)`                                                            |
| `listFiles`           | function  | `function listFiles(root: string, dir = root, found: string[] = []): string[]`               |
| `GeneratedPackage`    | interface | `interface GeneratedPackage`                                                                 |
| `readJson`            | function  | `function readJson<T>(file: string): T`                                                      |
| `installDependencies` | function  | `function installDependencies(root: string): void`                                           |
| `linkFromWorkspace`   | function  | `function linkFromWorkspace(root: string): void`                                             |
| `stateSlot`           | function  | `function stateSlot(state: string): string`                                                  |
| `generate`            | function  | `async function generate(name: string): Promise<{ cwd: string; root: string; out: string }>` |

### `packages/rex/src/cli/pack.test.ts`

| Symbol            | Kind      | Declaration                                                                            |
| ----------------- | --------- | -------------------------------------------------------------------------------------- |
| `ExportTarget`    | type      | `type ExportTarget = string \| { readonly types?: string; readonly import?: string };` |
| `PackageManifest` | interface | `interface PackageManifest`                                                            |
| `PackResult`      | interface | `interface PackResult`                                                                 |
| `relativePath`    | function  | `function relativePath(target: string): string`                                        |

### `packages/rex/src/client/act.test.tsx`

| Symbol      | Kind      | Declaration                                                                               |
| ----------- | --------- | ----------------------------------------------------------------------------------------- |
| `grantKey`  | function  | `function grantKey(actionId: string, input: unknown): string`                             |
| `implement` | function  | `function implement(declared: AnyAction)`                                                 |
| `Harness`   | interface | `interface Harness`                                                                       |
| `Probe`     | function  | `function Probe({ handles }: { readonly handles: Record<string, ActHandle<AnyAction>> })` |
| `Balance`   | function  | `function Balance({ counter }: { readonly counter: { count: number } })`                  |
| `mount`     | function  | `function mount(): Harness`                                                               |
| `handle`    | function  | `function handle(harness: Harness, id: string): ActHandle<AnyAction>`                     |

### `packages/rex/src/client/agent/address.test.tsx`

| Symbol        | Kind     | Declaration                                               |
| ------------- | -------- | --------------------------------------------------------- |
| `Where`       | function | `function Where({ testId }: { readonly testId: string })` |
| `FilterSheet` | function | `function FilterSheet()`                                  |
| `mount`       | function | `function mount(path: string)`                            |

### `packages/rex/src/client/agent/density.test.tsx`

| Symbol        | Kind     | Declaration                              |
| ------------- | -------- | ---------------------------------------- |
| `rootDensity` | function | `function rootDensity(): string \| null` |
| `Probe`       | function | `function Probe()`                       |
| `shown`       | function | `function shown(): string \| null`       |

### `packages/rex/src/client/agent/flow.test.tsx`

| Symbol                | Kind      | Declaration                                                 |
| --------------------- | --------- | ----------------------------------------------------------- |
| `payoutFlow`          | function  | `function payoutFlow()`                                     |
| `Mounted`             | interface | `interface Mounted`                                         |
| `mount`               | function  | `function mount(subject: Actor, instance: string): Mounted` |
| `sidecar`             | function  | `function sidecar(): SidecarPayload`                        |
| `status`              | function  | `async function status(text: string)`                       |
| `click`               | function  | `async function click(element: HTMLElement)`                |
| `expectDecisionAudit` | function  | `async function expectDecisionAudit(`                       |
| `pause`               | function  | `async function pause()`                                    |

### `packages/rex/src/client/agent/invoke.test.tsx`

| Symbol          | Kind      | Declaration                                                                      |
| --------------- | --------- | -------------------------------------------------------------------------------- |
| `Controls`      | function  | `function Controls()`                                                            |
| `AgentSlot`     | function  | `function AgentSlot({ page: pageId }: OutcomeSlotProps)`                         |
| `Mounted`       | interface | `interface Mounted`                                                              |
| `mount`         | function  | `function mount(path: string): Mounted`                                          |
| `audited`       | function  | `async function audited(ledger: Ledger): Promise<string[]>`                      |
| `press`         | function  | `async function press(init: KeyboardEventInit & { key: string })`                |
| `openPalette`   | function  | `async function openPalette(): Promise<HTMLElement>`                             |
| `search`        | function  | `async function search(palette: HTMLElement, value: string)`                     |
| `enter`         | function  | `async function enter(palette: HTMLElement)`                                     |
| `waitOutcome`   | function  | `async function waitOutcome(store: OutcomeStore, actionId: string, ok: boolean)` |
| `confirmDialog` | function  | `async function confirmDialog(): Promise<HTMLElement>`                           |
| `click`         | function  | `async function click(element: HTMLElement)`                                     |

### `packages/rex/src/client/agent/outcome.test.tsx`

| Symbol      | Kind     | Declaration                                                |
| ----------- | -------- | ---------------------------------------------------------- |
| `Controls`  | function | `function Controls()`                                      |
| `mount`     | function | `function mount(path: string)`                             |
| `region`    | function | `function region(): HTMLElement`                           |
| `click`     | function | `async function click(name: string)`                       |
| `runAction` | function | `async function runAction(name: string, actionId: string)` |

### `packages/rex/src/client/agent/sidecar.test.tsx`

| Symbol             | Kind      | Declaration                                               |
| ------------------ | --------- | --------------------------------------------------------- |
| `Loading`          | function  | `function Loading()`                                      |
| `RecoverableError` | function  | `function RecoverableError()`                             |
| `Slot`             | function  | `function Slot({ page: pageId }: OutcomeSlotProps)`       |
| `DoubleSlot`       | function  | `function DoubleSlot({ page: pageId }: OutcomeSlotProps)` |
| `Mounted`          | interface | `interface Mounted`                                       |
| `mount`            | function  | `function mount(path: string, slot = Slot): Mounted`      |
| `sidecar`          | function  | `function sidecar(): SidecarPayload`                      |
| `sidecarElements`  | function  | `function sidecarElements(): NodeListOf<Element>`         |

### `packages/rex/src/client/app.test.tsx`

| Symbol   | Kind      | Declaration                                                                               |
| -------- | --------- | ----------------------------------------------------------------------------------------- |
| `Server` | interface | `interface Server`                                                                        |
| `server` | function  | `function server(body: unknown = manifest, headers: Record<string, string> = {}): Server` |
| `Probe`  | function  | `function Probe()`                                                                        |

### `packages/rex/src/client/boundary.test.tsx`

| Symbol             | Kind     | Declaration                                                                                  |
| ------------------ | -------- | -------------------------------------------------------------------------------------------- |
| `Loading`          | function | `function Loading()`                                                                         |
| `RecoverableError` | function | `function RecoverableError({ error, retry }: StateProps<Readonly<Record<string, unknown>>>)` |
| `mount`            | function | `function mount(path: string)`                                                               |
| `sidecar`          | function | `function sidecar(): SidecarPayload`                                                         |

### `packages/rex/src/client/compiler.test.tsx`

| Symbol               | Kind      | Declaration                                                                                      |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `BoardModule`        | interface | `interface BoardModule`                                                                          |
| `compileBoard`       | function  | `async function compileBoard(compiler: boolean): Promise<{ code: string; module: BoardModule }>` |
| `commitsAfterUpdate` | function  | `function commitsAfterUpdate(module: BoardModule): Record<string, number>`                       |

### `packages/rex/src/client/devtools/devtools.test.tsx`

| Symbol         | Kind      | Declaration                                                            |
| -------------- | --------- | ---------------------------------------------------------------------- |
| `LabParams`    | interface | `interface LabParams`                                                  |
| `Mounted`      | interface | `interface Mounted`                                                    |
| `mount`        | function  | `function mount(path: string): Mounted`                                |
| `ready`        | function  | `async function ready(): Promise<void>`                                |
| `devtools`     | function  | `function devtools(): HTMLElement \| null`                             |
| `press`        | function  | `async function press(init: KeyboardEventInit): Promise<void>`         |
| `openDevtools` | function  | `async function openDevtools(): Promise<HTMLElement>`                  |
| `showPanel`    | function  | `async function showPanel(panel: DevtoolsPanel): Promise<HTMLElement>` |
| `click`        | function  | `async function click(name: string): Promise<void>`                    |

### `packages/rex/src/client/form.test.tsx`

| Symbol        | Kind      | Declaration                                                                       |
| ------------- | --------- | --------------------------------------------------------------------------------- |
| `Mounted`     | interface | `interface Mounted`                                                               |
| `mount`       | function  | `async function mount(csrf: string \| null = null): Promise<Mounted>`             |
| `form`        | function  | `function form(name: string): HTMLFormElement`                                    |
| `named`       | function  | `function named(owner: HTMLFormElement, name: string): HTMLInputElement`          |
| `outcomeText` | function  | `function outcomeText(): string`                                                  |
| `fill`        | function  | `function fill(owner: HTMLFormElement, values: Readonly<Record<string, string>>)` |
| `submit`      | function  | `async function submit(owner: HTMLFormElement)`                                   |

### `packages/rex/src/client/i18n/i18n.test.tsx`

| Symbol              | Kind     | Declaration                                                                                    |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `HomeView`          | function | `function HomeView()`                                                                          |
| `DetailView`        | function | `function DetailView({ params }: { readonly params: { readonly id: string } })`                |
| `appRegistry`       | function | `function appRegistry(config: I18nConfig): RegistrySnapshot`                                   |
| `mount`             | function | `function mount(registry: RegistrySnapshot, path: string)`                                     |
| `heading`           | function | `function heading(): string`                                                                   |
| `click`             | function | `async function click(name: string)`                                                           |
| `serverRequest`     | function | `function serverRequest(url: string, headers: Readonly<Record<string, string>> = {}): Request` |
| `clearLocaleCookie` | function | `function clearLocaleCookie()`                                                                 |

### `packages/rex/src/client/interop/interop.test.tsx`

| Symbol             | Kind      | Declaration                                                                                      |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------ |
| `HoldingChipProps` | interface | `interface HoldingChipProps`                                                                     |
| `HoldingChip`      | function  | `function HoldingChip({ symbol = "?", amount = 0, muted = false, tags = [] }: HoldingChipProps)` |
| `Controls`         | function  | `function Controls()`                                                                            |
| `Host`             | interface | `interface Host`                                                                                 |
| `plainDocument`    | function  | `function plainDocument(): Host`                                                                 |
| `testApp`          | function  | `function testApp(ledger: Ledger): TestApp`                                                      |
| `mountPage`        | function  | `async function mountPage(`                                                                      |
| `audited`          | function  | `async function audited(ledger: Ledger): Promise<string[]>`                                      |

### `packages/rex/src/client/layout.test.tsx`

| Symbol     | Kind     | Declaration                                                |
| ---------- | -------- | ---------------------------------------------------------- |
| `block`    | function | `function block(source: string, selector: string): string` |
| `flat`     | function | `function flat(text: string): string`                      |
| `token`    | function | `function token(rule: string, name: string): string`       |
| `silenced` | function | `function silenced(run: () => void)`                       |

### `packages/rex/src/client/list.test.tsx`

| Symbol           | Kind      | Declaration                                                     |
| ---------------- | --------- | --------------------------------------------------------------- |
| `Token`          | interface | `interface Token`                                               |
| `mount`          | function  | `function mount(location: string, children: ReactNode)`         |
| `mounted`        | function  | `async function mounted(location: string, children: ReactNode)` |
| `TokenListProps` | interface | `interface TokenListProps`                                      |
| `TokenList`      | function  | `function TokenList({ size, params }: TokenListProps)`          |
| `listRoot`       | function  | `function listRoot(address: string): HTMLElement`               |
| `shownSymbols`   | function  | `function shownSymbols(address: string): string[]`              |
| `moreLink`       | function  | `function moreLink(address: string): HTMLAnchorElement \| null` |
| `silenced`       | function  | `function silenced(run: () => void)`                            |

### `packages/rex/src/client/loaders.test.tsx`

| Symbol             | Kind      | Declaration                                                                                    |
| ------------------ | --------- | ---------------------------------------------------------------------------------------------- |
| `Note`             | interface | `interface Note`                                                                               |
| `resetData`        | function  | `function resetData(): void`                                                                   |
| `statesFor`        | function  | `function statesFor(label: string): Readonly<Record<string, unknown>>`                         |
| `NoteList`         | function  | `function NoteList({ testId }: { readonly testId: string })`                                   |
| `FreshCount`       | function  | `function FreshCount()`                                                                        |
| `NoteTitle`        | function  | `function NoteTitle()`                                                                         |
| `BrokenFeedLength` | function  | `function BrokenFeedLength()`                                                                  |
| `GoneFeedLength`   | function  | `function GoneFeedLength()`                                                                    |
| `BoardLists`       | function  | `function BoardLists()`                                                                        |
| `eager`            | function  | `function eager(`                                                                              |
| `serverFetch`      | function  | `function serverFetch(input: Request \| string \| URL, init?: RequestInit): Promise<Response>` |
| `quietClient`      | function  | `function quietClient(): QueryClient`                                                          |
| `mount`            | function  | `async function mount(path: string, queryClient: QueryClient): Promise<HTMLElement>`           |
| `unmountAll`       | function  | `async function unmountAll(): Promise<void>`                                                   |
| `settle`           | function  | `async function settle(): Promise<void>`                                                       |
| `request`          | function  | `function request(path: string): Request`                                                      |
| `mountDocument`    | function  | `function mountDocument(html: string, path: string): HTMLElement`                              |
| `hydrateDocument`  | function  | `async function hydrateDocument(`                                                              |
| `hydrationErrors`  | function  | `function hydrationErrors(calls: readonly unknown[][]): string[]`                              |

### `packages/rex/src/client/media.test.tsx`

| Symbol         | Kind     | Declaration                                              |
| -------------- | -------- | -------------------------------------------------------- |
| `installNonce` | function | `function installNonce(nonce: string = NONCE): void`     |
| `headScripts`  | function | `function headScripts(src: string): HTMLScriptElement[]` |

### `packages/rex/src/client/nav.test.tsx`

| Symbol       | Kind     | Declaration                                                                                     |
| ------------ | -------- | ----------------------------------------------------------------------------------------------- |
| `DraftProbe` | function | `function DraftProbe()`                                                                         |
| `Screen`     | function | `function Screen({ resolution }: { readonly resolution: RouteResolution })`                     |
| `mount`      | function | `function mount(path: string, subject: Actor = owner)`                                          |
| `text_`      | function | `function text_(id: string): string \| null`                                                    |
| `click`      | function | `async function click(name: string)`                                                            |
| `paramsOf`   | constant | `const paramsOf = (declared: { readonly params: Parameters<typeof standardJsonSchema>[0] }) =>` |

### `packages/rex/src/client/navigation.test.tsx`

| Symbol                  | Kind      | Declaration                                                          |
| ----------------------- | --------- | -------------------------------------------------------------------- |
| `HomeView`              | function  | `function HomeView()`                                                |
| `mount`                 | function  | `function mount(path: string)`                                       |
| `announcer`             | function  | `function announcer(): HTMLElement`                                  |
| `activePage`            | function  | `function activePage(): string \| null`                              |
| `click`                 | function  | `async function click(element: HTMLElement)`                         |
| `navLink`               | function  | `function navLink(name: string): HTMLElement`                        |
| `RecordedTransition`    | interface | `interface RecordedTransition`                                       |
| `injectViewTransitions` | function  | `function injectViewTransitions(): RecordedTransition[]`             |
| `NavigateInit`          | interface | `interface NavigateInit`                                             |
| `TestNavigateEvent`     | class     | `class TestNavigateEvent extends Event implements NavigateEventLike` |
| `TestNavigation`        | class     | `class TestNavigation extends EventTarget`                           |
| `injectNavigation`      | function  | `function injectNavigation(): TestNavigation`                        |

### `packages/rex/src/client/overlay.test.tsx`

| Symbol            | Kind      | Declaration                                                                                          |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `stubMatchMedia`  | function  | `function stubMatchMedia(width: number, coarse: boolean): MatchMedia`                                |
| `screenSource`    | function  | `function screenSource(width: number, coarse: boolean): ScreenSource`                                |
| `Trigger`         | function  | `function Trigger({ target, label }: { readonly target: OverlayComponent; readonly label: string })` |
| `Slot`            | function  | `function Slot({ page: pageId }: OutcomeSlotProps)`                                                  |
| `MountOptions`    | interface | `interface MountOptions`                                                                             |
| `mount`           | function  | `function mount(path: string, options: MountOptions = {})`                                           |
| `sidecarPayload`  | function  | `function sidecarPayload(): SidecarPayload`                                                          |
| `sidecarOverlays` | function  | `function sidecarOverlays(): SidecarPayload["overlays"]`                                             |
| `dialog`          | function  | `function dialog(id: string): HTMLElement \| null`                                                   |
| `openWith`        | function  | `async function openWith(label: string): Promise<HTMLElement>`                                       |
| `key`             | function  | `async function key(target: Element, init: KeyboardEventInit & { key: string })`                     |

### `packages/rex/src/client/page.test.tsx`

| Symbol         | Kind      | Declaration                                                |
| -------------- | --------- | ---------------------------------------------------------- |
| `Deferred`     | interface | `interface Deferred`                                       |
| `deferred`     | function  | `function deferred(): Deferred`                            |
| `StatusError`  | class     | `class StatusError extends Error`                          |
| `Responder`    | type      | `type Responder = () => unknown;`                          |
| `MountOptions` | interface | `interface MountOptions`                                   |
| `mount`        | function  | `function mount(path: string, options: MountOptions = {})` |
| `silenced`     | function  | `function silenced(run: () => void)`                       |

### `packages/rex/src/client/runtime.test.tsx`

| Symbol           | Kind      | Declaration                                           |
| ---------------- | --------- | ----------------------------------------------------- |
| `Mounted`        | interface | `interface Mounted`                                   |
| `mount`          | function  | `function mount(path: string): Mounted`               |
| `sidecars`       | function  | `function sidecars(): Element[]`                      |
| `sidecarPayload` | function  | `function sidecarPayload(): SidecarPayload`           |
| `ready`          | function  | `async function ready(pageId: string): Promise<void>` |
| `click`          | function  | `async function click(element: Element)`              |

### `packages/rex/src/client/screen.test.tsx`

| Symbol               | Kind     | Declaration                                              |
| -------------------- | -------- | -------------------------------------------------------- |
| `StubMediaQueryList` | class    | `class StubMediaQueryList extends EventTarget`           |
| `StubViewport`       | class    | `class StubViewport`                                     |
| `Probe`              | function | `function Probe()`                                       |
| `shown`              | function | `function shown(): string \| null`                       |
| `rootAttributes`     | function | `function rootAttributes()`                              |
| `SidecarSlot`        | function | `function SidecarSlot(_props: OutcomeSlotProps)`         |
| `mountApp`           | function | `function mountApp(viewport: StubViewport, search = "")` |
| `sidecar`            | function | `function sidecar(): SidecarPayload`                     |
| `clearRoot`          | function | `function clearRoot()`                                   |

### `packages/rex/src/client/shell.test.tsx`

| Symbol           | Kind      | Declaration                                                                     |
| ---------------- | --------- | ------------------------------------------------------------------------------- |
| `MountOptions`   | interface | `interface MountOptions`                                                        |
| `stubMatchMedia` | function  | `function stubMatchMedia(width: number, coarse: boolean): MatchMedia`           |
| `screenSource`   | function  | `function screenSource(width: number, coarse = false): ScreenSource`            |
| `mount`          | function  | `function mount(`                                                               |
| `heading`        | function  | `function heading(): string \| null`                                            |
| `navLinks`       | function  | `function navLinks()`                                                           |
| `SidebarFrame`   | function  | `function SidebarFrame({ appName, links, palette, children }: ShellFrameProps)` |
| `SidebarNav`     | function  | `function SidebarNav({ links, form }: ShellNavProps)`                           |
| `click`          | function  | `async function click(element: HTMLElement)`                                    |

### `packages/rex/src/client/shell/components.test.tsx`

| Symbol              | Kind     | Declaration                                                            |
| ------------------- | -------- | ---------------------------------------------------------------------- |
| `preventNavigation` | function | `function preventNavigation(event: MouseEvent<HTMLAnchorElement>)`     |
| `SidebarFrame`      | function | `function SidebarFrame({ appName, links, children }: ShellFrameProps)` |
| `ListNav`           | function | `function ListNav({ links, form }: ShellNavProps)`                     |
| `resolvedNav`       | function | `function resolvedNav()`                                               |

### `packages/rex/src/client/states.test.ts`

| Symbol     | Kind      | Declaration                                                                                       |
| ---------- | --------- | ------------------------------------------------------------------------------------------------- |
| `withData` | constant  | `const withData = (status: DataStateQuery["status"], error: unknown = null): DataStateQuery => (` |
| `failed`   | constant  | `const failed = (error: unknown): DataStateQuery => (`                                            |
| `Fragment` | interface | `interface Fragment`                                                                              |
| `inputOf`  | function  | `function inputOf(...fragments: Fragment[]): DataStateInput`                                      |

### `packages/rex/src/client/store.test.tsx`

| Symbol             | Kind      | Declaration                          |
| ------------------ | --------- | ------------------------------------ |
| `Cart`             | interface | `interface Cart`                     |
| `RecoverableError` | function  | `function RecoverableError()`        |
| `mount`            | function  | `function mount(path: string)`       |
| `sidecar`          | function  | `function sidecar(): SidecarPayload` |

### `packages/rex/src/core/action.test.ts`

| Symbol           | Kind     | Declaration                                                                                          |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `manifestAction` | function | `function manifestAction(declared: Parameters<typeof buildManifest>[0]["actions"][number])`          |
| `manifestError`  | function | `function manifestError(declared: Parameters<typeof buildManifest>[0]["actions"][number]): RexError` |
| `fieldOf`        | function | `function fieldOf(run: () => unknown): string`                                                       |

### `packages/rex/src/core/config.test.ts`

| Symbol      | Kind     | Declaration                                                                                      |
| ----------- | -------- | ------------------------------------------------------------------------------------------------ |
| `serverFor` | function | `function serverFor(bundle: RexConfigApp): RexFetchHandler`                                      |
| `rejection` | function | `function rejection(run: () => unknown): { code: RexErrorCode; field: string; message: string }` |

### `packages/rex/src/core/entity.test.ts`

| Symbol             | Kind     | Declaration                                                                                    |
| ------------------ | -------- | ---------------------------------------------------------------------------------------------- |
| `entityJsonSchema` | function | `function entityJsonSchema(declared: Parameters<typeof buildManifest>[0]["entities"][number])` |
| `declarationError` | function | `function declarationError(run: () => unknown): RexDeclarationError`                           |

### `packages/rex/src/core/errors.test.ts`

| Symbol           | Kind     | Declaration                                                               |
| ---------------- | -------- | ------------------------------------------------------------------------- |
| `caught`         | function | `function caught(run: () => unknown): RexError`                           |
| `rejected`       | function | `async function rejected(run: () => Promise<unknown>): Promise<RexError>` |
| `noop`           | constant | `const noop = () =>`                                                      |
| `sourceFiles`    | function | `function sourceFiles(dir: string): string[]`                             |
| `runtimeImports` | function | `function runtimeImports(file: string): string[]`                         |

### `packages/rex/src/core/flow.test.ts`

| Symbol       | Kind     | Declaration                             |
| ------------ | -------- | --------------------------------------- |
| `makePayout` | function | `function makePayout(journal: Journal)` |
| `makeDirect` | function | `function makeDirect(journal: Journal)` |

### `packages/rex/src/core/page.test.ts`

| Symbol        | Kind     | Declaration                                                                       |
| ------------- | -------- | --------------------------------------------------------------------------------- |
| `fieldOf`     | function | `function fieldOf(run: () => unknown): string`                                    |
| `optionError` | function | `function optionError(run: () => unknown): { code: RexErrorCode; field: string }` |
| `ShellButton` | function | `function ShellButton()`                                                          |

### `packages/rex/src/core/policy.test.ts`

| Symbol | Kind     | Declaration                                                    |
| ------ | -------- | -------------------------------------------------------------- |
| `no`   | constant | `const no = (reason: string) => ({ allowed: false, reason });` |

### `packages/rex/src/core/protocol.test.ts`

| Symbol      | Kind      | Declaration                                                                                    |
| ----------- | --------- | ---------------------------------------------------------------------------------------------- |
| `Mounted`   | interface | `interface Mounted`                                                                            |
| `Probe`     | function  | `function Probe({ handle }: { readonly handle: { current: ActHandle<typeof send> \| null } })` |
| `mount`     | function  | `function mount(fetch: RexFetch, provided: Actor \| null): Mounted`                            |
| `current`   | function  | `function current(mounted: Mounted): ActHandle<typeof send>`                                   |
| `toRequest` | function  | `function toRequest(input: Request \| string \| URL, init?: RequestInit): Request`             |

### `packages/rex/src/core/registry.test.ts`

| Symbol       | Kind     | Declaration                            |
| ------------ | -------- | -------------------------------------- |
| `makeAction` | constant | `const makeAction = (name: string) =>` |

### `packages/rex/src/core/standard.test.ts`

| Symbol         | Kind     | Declaration                                                                 |
| -------------- | -------- | --------------------------------------------------------------------------- |
| `amountResult` | function | `function amountResult(value: unknown): StandardResult<{ amount: number }>` |

### `packages/rex/src/core/store.conformance.ts`

| Symbol                | Kind     | Declaration                                                                     |
| --------------------- | -------- | ------------------------------------------------------------------------------- |
| `ConformanceEntity`   | type     | `export type ConformanceEntity = typeof conformanceEntity;`                     |
| `ConformanceRecord`   | type     | `export type ConformanceRecord = InferEntity<ConformanceEntity>;`               |
| `MakeStore`           | type     | `export type MakeStore = (`                                                     |
| `conformanceRecord`   | function | `export function conformanceRecord(`                                            |
| `runStoreConformance` | function | `export function runStoreConformance(name: string, makeStore: MakeStore): void` |

### `packages/rex/src/eslint/eslint.test.ts`

| Symbol        | Kind     | Declaration                                                                                   |
| ------------- | -------- | --------------------------------------------------------------------------------------------- |
| `eslint`      | function | `function eslint(cwd: string = root): ESLint`                                                 |
| `lintFixture` | function | `async function lintFixture(): Promise<Map<string, ESLint.LintResult>>`                       |
| `resultOf`    | function | `function resultOf(results: Map<string, ESLint.LintResult>, file: string): ESLint.LintResult` |

### `packages/rex/src/manifest/build.test.ts`

| Symbol       | Kind     | Declaration                                                            |
| ------------ | -------- | ---------------------------------------------------------------------- |
| `snapshotOf` | function | `function snapshotOf(order: readonly (typeof declarations)[number][])` |

### `packages/rex/src/manifest/scan.test.ts`

| Symbol    | Kind     | Declaration                                                                                 |
| --------- | -------- | ------------------------------------------------------------------------------------------- |
| `copyApp` | function | `function copyApp(): string`                                                                |
| `read`    | constant | `const read = (root: string, file: string) => readFileSync(path.join(root, file), "utf8");` |

### `packages/rex/src/server/adapters/adapters.test.ts`

| Symbol                | Kind      | Declaration                                                                            |
| --------------------- | --------- | -------------------------------------------------------------------------------------- |
| `rexApp`              | function  | `function rexApp(app: string)`                                                         |
| `rpcClient`           | function  | `function rpcClient(url: string, fetchImpl?: (request: Request) => Promise<Response>)` |
| `expectRexAnswers`    | function  | `async function expectRexAnswers(url: string, app: string): Promise<void>`             |
| `freePort`            | function  | `function freePort(): Promise<number>`                                                 |
| `remoteAddrOf`        | function  | `function remoteAddrOf(incoming:`                                                      |
| `BunGlobalRecord`     | interface | `interface BunGlobalRecord`                                                            |
| `bunGlobal`           | function  | `function bunGlobal(): BunGlobalRecord`                                                |
| `DenoGlobalRecord`    | interface | `interface DenoGlobalRecord`                                                           |
| `denoGlobal`          | function  | `function denoGlobal(): DenoGlobalRecord`                                              |
| `bundleEdgeWorker`    | function  | `async function bundleEdgeWorker(): Promise<string>`                                   |
| `hintedApp`           | function  | `function hintedApp()`                                                                 |
| `expectPhoneDocument` | function  | `async function expectPhoneDocument(response: Response): Promise<void>`                |

### `packages/rex/src/server/audit.test.ts`

| Symbol   | Kind     | Declaration                                                                      |
| -------- | -------- | -------------------------------------------------------------------------------- |
| `sha256` | function | `function sha256(text: string): string`                                          |
| `entry`  | function | `async function entry(overrides: Partial<AuditEntry> = {}): Promise<AuditEntry>` |

### `packages/rex/src/server/cors.test.ts`

| Symbol         | Kind     | Declaration                                                                                   |
| -------------- | -------- | --------------------------------------------------------------------------------------------- |
| `resolveActor` | function | `function resolveActor(request: Request): Actor`                                              |
| `serverWith`   | function | `function serverWith(security?: SecurityConfig)`                                              |
| `decodedActor` | function | `function decodedActor(response: { headers: { get(name: string): string \| null } }): string` |

### `packages/rex/src/server/fetch-only.test.ts`

| Symbol             | Kind      | Declaration                                                                                          |
| ------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `isNodeBuiltin`    | function  | `function isNodeBuiltin(specifier: string): boolean`                                                 |
| `BrowserBundle`    | interface | `interface BrowserBundle`                                                                            |
| `builtinProbe`     | function  | `function builtinProbe(seen: string[]): Plugin`                                                      |
| `bundleForBrowser` | function  | `async function bundleForBrowser(entries: Readonly<Record<string, string>>): Promise<BrowserBundle>` |

### `packages/rex/src/server/flow.test.ts`

| Symbol           | Kind      | Declaration                                                                                      |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `resolveActor`   | function  | `function resolveActor(request: Request): Actor`                                                 |
| `payoutFlow`     | function  | `function payoutFlow(): AnyFlow`                                                                 |
| `Served`         | interface | `interface Served`                                                                               |
| `client`         | function  | `function client(app: Hono, name: string): RouterClient<FlowRouter>`                             |
| `serve`          | function  | `function serve(): Served`                                                                       |
| `rejection`      | function  | `async function rejection(promise: Promise<unknown>): Promise<ORPCError<string, unknown>>`       |
| `decisionDigest` | function  | `async function decisionDigest(instance: string, gate: string, decision: "approve" \| "reject")` |

### `packages/rex/src/server/form.test.tsx`

| Symbol         | Kind      | Declaration                                                    |
| -------------- | --------- | -------------------------------------------------------------- |
| `resolveActor` | function  | `function resolveActor(request: Request): Actor`               |
| `PostOptions`  | interface | `interface PostOptions`                                        |
| `post`         | function  | `function post(`                                               |
| `setCookies`   | function  | `function setCookies(response: Response): Map<string, string>` |
| `outcomeOf`    | function  | `function outcomeOf(response: Response): FormOutcome`          |
| `fields`       | function  | `function fields(`                                             |

### `packages/rex/src/server/loaders.test.ts`

| Symbol            | Kind      | Declaration                                                                         |
| ----------------- | --------- | ----------------------------------------------------------------------------------- |
| `statesFor`       | function  | `function statesFor(label: string): Readonly<Record<string, unknown>>`              |
| `lazySet`         | function  | `function lazySet(declared: AnyPage, loaded: LoadedPageModules): LazyPageModuleSet` |
| `LogLine`         | interface | `interface LogLine`                                                                 |
| `recordingLogger` | function  | `function recordingLogger(lines: LogLine[]): RexLogger`                             |
| `spansNamed`      | function  | `function spansNamed(exporter: InMemorySpanExporter, name: string): ReadableSpan[]` |

### `packages/rex/src/server/node.test.ts`

| Symbol                | Kind     | Declaration                                                                         |
| --------------------- | -------- | ----------------------------------------------------------------------------------- |
| `statesFor`           | function | `function statesFor(label: string): Readonly<Record<string, unknown>>`              |
| `lazySet`             | function | `function lazySet(declared: AnyPage, loaded: LoadedPageModules): LazyPageModuleSet` |
| `silentIO`            | function | `function silentIO(cwd: string): RexCliIO`                                          |
| `linkPackage`         | function | `function linkPackage(root: string, name: string, source: string): void`            |
| `installRuntimeCopy`  | function | `function installRuntimeCopy(cwd: string, root: string): void`                      |
| `installDependencies` | function | `function installDependencies(root: string): void`                                  |
| `waitForServing`      | function | `function waitForServing(child: ChildProcess): Promise<string>`                     |

### `packages/rex/src/server/pages-text.test.ts`

| Symbol         | Kind     | Declaration                                                             |
| -------------- | -------- | ----------------------------------------------------------------------- |
| `resolveActor` | function | `function resolveActor(request: Request): Actor`                        |
| `makeRegistry` | function | `function makeRegistry(): RexServerRegistry<AnyAction>`                 |
| `sidecarOf`    | function | `function sidecarOf(markdown: string): SidecarPayload`                  |
| `section`      | function | `function section(markdown: string, heading: string): string`           |
| `rowOf`        | function | `function rowOf(markdown: string, heading: string, id: string): string` |

### `packages/rex/src/server/router.test.ts`

| Symbol      | Kind     | Declaration                                                                                |
| ----------- | -------- | ------------------------------------------------------------------------------------------ |
| `context`   | function | `function context(subject: Actor, confirm?: string): RexContext`                           |
| `rejection` | function | `async function rejection(promise: Promise<unknown>): Promise<ORPCError<string, unknown>>` |
| `build`     | function | `function build(ledger: Ledger, confirmTtlMs?: number)`                                    |

### `packages/rex/src/server/security.test.ts`

| Symbol            | Kind      | Declaration                                                                                 |
| ----------------- | --------- | ------------------------------------------------------------------------------------------- |
| `resolveActor`    | function  | `function resolveActor(request: Request): Actor`                                            |
| `SecurityOptions` | type      | `type SecurityOptions = Pick<RexServerOptions<typeof toggleDust>, "security" \| "client">;` |
| `serverWith`      | function  | `function serverWith(ledger: Ledger, options: SecurityOptions = {})`                        |
| `post`            | function  | `function post(path: string, origin?: string): Request`                                     |
| `cspNonce`        | function  | `function cspNonce(policy: string \| null): string`                                         |
| `strictPolicy`    | function  | `function strictPolicy(nonce: string, connect = "'self'"): string`                          |
| `ScriptTag`       | interface | `interface ScriptTag`                                                                       |
| `scriptTags`      | function  | `function scriptTags(html: string): ScriptTag[]`                                            |
| `delayed`         | function  | `function delayed<T>(value: T, ms: number): Promise<T>`                                     |
| `Balance`         | function  | `function Balance({ amount }: { readonly amount: Promise<string> }): ReactNode`             |
| `documentFor`     | function  | `function documentFor(nonce: string, body: ReactNode): ReactNode`                           |

### `packages/rex/src/server/server.test.ts`

| Symbol              | Kind      | Declaration                                                                                |
| ------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `resolveActor`      | function  | `function resolveActor(request: Request): Actor`                                           |
| `TestClientContext` | interface | `interface TestClientContext`                                                              |
| `clientFor`         | function  | `function clientFor(`                                                                      |
| `rejection`         | function  | `async function rejection(promise: Promise<unknown>): Promise<ORPCError<string, unknown>>` |

### `packages/rex/src/server/ssr.node.test.ts`

| Symbol        | Kind     | Declaration                                                                         |
| ------------- | -------- | ----------------------------------------------------------------------------------- |
| `statesFor`   | function | `function statesFor(label: string): Readonly<Record<string, unknown>>`              |
| `lazySet`     | function | `function lazySet(declared: AnyPage, loaded: LoadedPageModules): LazyPageModuleSet` |
| `csrfFieldOf` | function | `function csrfFieldOf(html: string): string \| null`                                |

### `packages/rex/src/server/ssr.test.tsx`

| Symbol                    | Kind     | Declaration                                                                                            |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `statesFor`               | function | `function statesFor(label: string): Readonly<Record<string, unknown>>`                                 |
| `lazySet`                 | function | `function lazySet(declared: AnyPage, loaded: LoadedPageModules): LazyPageModuleSet`                    |
| `buildFixtureAssets`      | function | `async function buildFixtureAssets(): Promise<RexDocumentAssets>`                                      |
| `request`                 | function | `function request(path: string): Request`                                                              |
| `readChunks`              | function | `async function readChunks(response: Response): Promise<string[]>`                                     |
| `mountDocument`           | function | `function mountDocument(html: string, path: string): HTMLElement`                                      |
| `serverFetch`             | function | `function serverFetch(input: Request \| string \| URL, init?: RequestInit): Promise<Response>`         |
| `hydrate`                 | function | `async function hydrate(container: HTMLElement, mismatches: HydrationMismatch[]): Promise<StartedRex>` |
| `textOf`                  | function | `function textOf(html: string): string`                                                                |
| `hydrationErrors`         | function | `function hydrationErrors(calls: readonly unknown[][]): string[]`                                      |
| `executableInlineScripts` | function | `function executableInlineScripts(html: string): string[]`                                             |
| `signupRequest`           | function | `function signupRequest(): Request`                                                                    |
| `renderSignup`            | function | `async function renderSignup(request: Request): Promise<string>`                                       |
| `csrfFieldOf`             | function | `function csrfFieldOf(html: string): string \| null`                                                   |

### `packages/rex/src/server/static-cache.test.ts`

| Symbol              | Kind     | Declaration                                                                                     |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `statesFor`         | function | `function statesFor(label: string): Readonly<Record<string, unknown>>`                          |
| `lazySet`           | function | `function lazySet(declared: AnyPage, loaded: LoadedPageModules): LazyPageModuleSet`             |
| `get`               | function | `function get(path: string, headers: Readonly<Record<string, string>> = {}): Promise<Response>` |
| `executableScripts` | function | `function executableScripts(html: string): string[]`                                            |
| `rootTag`           | function | `function rootTag(html: string): string`                                                        |
| `rootAttributes`    | function | `function rootAttributes(html: string): Record<string, string>`                                 |
| `sidecarOf`         | function | `function sidecarOf(html: string): Record<string, unknown>`                                     |
| `csrfCookieOf`      | function | `function csrfCookieOf(response: Response): string \| null`                                     |
| `csrfFieldOf`       | function | `function csrfFieldOf(html: string): string \| null`                                            |
| `waitPastWindow`    | function | `async function waitPastWindow(path: string): Promise<void>`                                    |

### `packages/rex/src/server/telemetry.test.ts`

| Symbol            | Kind      | Declaration                                                                         |
| ----------------- | --------- | ----------------------------------------------------------------------------------- |
| `resolveActor`    | function  | `function resolveActor(request: Request): Actor`                                    |
| `LogLine`         | interface | `interface LogLine`                                                                 |
| `recordingLogger` | function  | `function recordingLogger(lines: LogLine[]): RexLogger`                             |
| `spansNamed`      | function  | `function spansNamed(exporter: InMemorySpanExporter, name: string): ReadableSpan[]` |

### `packages/rex/src/size.test.ts`

| Symbol         | Kind     | Declaration                                                                                  |
| -------------- | -------- | -------------------------------------------------------------------------------------------- |
| `measuredSize` | function | `async function measuredSize(target: EntryBudget): Promise<BudgetMeasurement>`               |
| `kb`           | function | `function kb(bytes: number): string`                                                         |
| `report`       | function | `function report(target: EntryBudget, label: string, size: ChunkSize, budget: number): void` |

### `packages/rex/src/store/drizzle.test.ts`

| Symbol     | Kind     | Declaration           |
| ---------- | -------- | --------------------- |
| `memoryDb` | function | `function memoryDb()` |

### `packages/rex/src/testing/testing.test.tsx`

| Symbol         | Kind     | Declaration                                                                        |
| -------------- | -------- | ---------------------------------------------------------------------------------- |
| `slowNoteApp`  | function | `function slowNoteApp(): typeof notesApp`                                          |
| `noteTitles`   | function | `function noteTitles(view: RexRenderResult): string[]`                             |
| `addThroughUi` | function | `async function addThroughUi(view: RexRenderResult, title: string): Promise<void>` |

### `packages/rex/src/vite/boundary.test.ts`

| Symbol         | Kind      | Declaration                                                                                  |
| -------------- | --------- | -------------------------------------------------------------------------------------------- |
| `FixtureBuild` | interface | `interface FixtureBuild`                                                                     |
| `root`         | function  | `function root(name: string): string`                                                        |
| `buildClient`  | function  | `async function buildClient(name: string, options: FixtureBuild = {})`                       |
| `buildFailure` | function  | `async function buildFailure(name: string, options: FixtureBuild = {}): Promise<Error>`      |
| `pluginCodes`  | function  | `function pluginCodes(error: Error): unknown[]`                                              |
| `fixtureFile`  | constant  | `const fixtureFile = (name: string, path: string) => normalizePath(join(root(name), path));` |

### `packages/rex/src/vite/budgets.test.ts`

| Symbol  | Kind     | Declaration                                                   |
| ------- | -------- | ------------------------------------------------------------- |
| `chunk` | function | `function chunk(name: string, code: string): OutputChunkLike` |

### `packages/rex/src/vite/compiler.test.ts`

| Symbol         | Kind     | Declaration                                                                          |
| -------------- | -------- | ------------------------------------------------------------------------------------ |
| `buildFixture` | function | `async function buildFixture(compiler: boolean \| undefined)`                        |
| `pageChunk`    | function | `function pageChunk(chunks: Awaited<ReturnType<typeof buildFixture>>, name: string)` |

### `packages/rex/src/vite/prerender.test.ts`

| Symbol              | Kind      | Declaration                                                            |
| ------------------- | --------- | ---------------------------------------------------------------------- |
| `read`              | function  | `function read(file: string): string`                                  |
| `executableScripts` | function  | `function executableScripts(html: string): string[]`                   |
| `DehydratedQuery`   | interface | `interface DehydratedQuery`                                            |
| `dehydratedQueries` | function  | `function dehydratedQueries(html: string): readonly DehydratedQuery[]` |

### `packages/rex/src/vite/shell-components.test.ts`

| Symbol              | Kind      | Declaration                                                                 |
| ------------------- | --------- | --------------------------------------------------------------------------- |
| `link`              | function  | `function link(root: string, name: string, target: string): void`           |
| `writeFixture`      | function  | `function writeFixture(): string`                                           |
| `waitForServing`    | function  | `function waitForServing(child: ChildProcess): Promise<string>`             |
| `NodeRun`           | interface | `interface NodeRun`                                                         |
| `runNode`           | function  | `function runNode(args: readonly string[], cwd: string): Promise<NodeRun>`  |
| `fetchPage`         | function  | `async function fetchPage(base: string, language: string): Promise<string>` |
| `expectRenderedApp` | function  | `function expectRenderedApp(german: string, english: string): void`         |
| `clientAssets`      | function  | `function clientAssets(clientDir: string): string`                          |

### `packages/rex/src/vite/styles.test.ts`

| Symbol               | Kind     | Declaration                                                  |
| -------------------- | -------- | ------------------------------------------------------------ |
| `tailwindStylesheet` | function | `function tailwindStylesheet(): string`                      |
| `pluginNames`        | function | `function pluginNames(plugins: readonly Plugin[]): string[]` |
| `buildFixture`       | function | `async function buildFixture()`                              |
| `caught`             | function | `function caught(run: () => unknown): unknown`               |

### `packages/rex/src/vite/vite.test.ts`

| Symbol    | Kind     | Declaration                                                                 |
| --------- | -------- | --------------------------------------------------------------------------- |
| `fixture` | constant | `const fixture = (path: string) => normalizePath(join(fixtureRoot, path));` |

### `packages/rex/src/zod-boundary.test.ts`

| Symbol       | Kind     | Declaration                                                             |
| ------------ | -------- | ----------------------------------------------------------------------- |
| `zodModules` | function | `function zodModules(paths: readonly string[]): readonly string[]`      |
| `zodImports` | function | `function zodImports(specifiers: readonly string[]): readonly string[]` |

## Test fixtures

Types declared in the fixture apps that the checker and client tests load.

### `packages/rex/src/check/fixtures/boundaries/fail/app/entities/token.ts`

| Symbol  | Kind | Declaration                                      |
| ------- | ---- | ------------------------------------------------ |
| `Token` | type | `export type Token = InferEntity<typeof token>;` |

### `packages/rex/src/check/fixtures/boundaries/fail/app/pages/portfolio/regions/holdings/parts/HoldingRow.tsx`

| Symbol            | Kind      | Declaration                 |
| ----------------- | --------- | --------------------------- |
| `HoldingRowProps` | interface | `interface HoldingRowProps` |

### `packages/rex/src/check/fixtures/boundaries/pass/app/entities/token.ts`

| Symbol  | Kind | Declaration                                      |
| ------- | ---- | ------------------------------------------------ |
| `Token` | type | `export type Token = InferEntity<typeof token>;` |

### `packages/rex/src/check/fixtures/boundaries/pass/app/pages/send/overlays/TokenSheet.tsx`

| Symbol            | Kind      | Declaration                 |
| ----------------- | --------- | --------------------------- |
| `TokenSheetProps` | interface | `interface TokenSheetProps` |

### `packages/rex/src/check/fixtures/boundaries/pass/app/pages/send/regions/form/parts/AmountField.tsx`

| Symbol             | Kind      | Declaration                  |
| ------------------ | --------- | ---------------------------- |
| `AmountFieldProps` | interface | `interface AmountFieldProps` |

### `packages/rex/src/check/fixtures/boundaries/pass/app/pages/send/regions/form/parts/TokenChip.tsx`

| Symbol           | Kind      | Declaration                |
| ---------------- | --------- | -------------------------- |
| `TokenChipProps` | interface | `interface TokenChipProps` |

### `packages/rex/src/check/fixtures/lists/fail/app/pages/feed/regions/items/parts/Activity.tsx`

| Symbol          | Kind      | Declaration                      |
| --------------- | --------- | -------------------------------- |
| `ActivityProps` | interface | `export interface ActivityProps` |

### `packages/rex/src/check/fixtures/lists/fail/app/pages/feed/regions/items/parts/Feed.tsx`

| Symbol      | Kind      | Declaration                  |
| ----------- | --------- | ---------------------------- |
| `FeedProps` | interface | `export interface FeedProps` |

### `packages/rex/src/check/fixtures/lists/fail/app/pages/feed/regions/items/parts/Timeline.tsx`

| Symbol          | Kind      | Declaration                      |
| --------------- | --------- | -------------------------------- |
| `TimelineProps` | interface | `export interface TimelineProps` |

### `packages/rex/src/check/fixtures/lists/pass/app/pages/feed/regions/items/parts/Feed.tsx`

| Symbol      | Kind      | Declaration                  |
| ----------- | --------- | ---------------------------- |
| `FeedProps` | interface | `export interface FeedProps` |

### `packages/rex/src/check/fixtures/lists/pass/app/pages/feed/regions/items/parts/Rows.tsx`

| Symbol      | Kind      | Declaration                  |
| ----------- | --------- | ---------------------------- |
| `RowsProps` | interface | `export interface RowsProps` |

### `packages/rex/src/check/fixtures/parity/pass/app/pages/send/regions/form/parts/TokenField.tsx`

| Symbol            | Kind      | Declaration                 |
| ----------------- | --------- | --------------------------- |
| `TokenFieldProps` | interface | `interface TokenFieldProps` |

### `packages/rex/src/check/fixtures/quality/pass/app/pages/home/regions/list/parts/HoldingRow.tsx`

| Symbol            | Kind      | Declaration                        |
| ----------------- | --------- | ---------------------------------- |
| `HoldingRowProps` | interface | `export interface HoldingRowProps` |

### `packages/rex/src/check/fixtures/styling/pass/app/pages/home/regions/cards/parts/Card.tsx`

| Symbol      | Kind      | Declaration                  |
| ----------- | --------- | ---------------------------- |
| `CardProps` | interface | `export interface CardProps` |

### `packages/rex/src/client/fixtures/compiler/board.tsx`

| Symbol       | Kind      | Declaration                   |
| ------------ | --------- | ----------------------------- |
| `PriceStore` | interface | `export interface PriceStore` |
| `BoardProps` | interface | `export interface BoardProps` |

### `packages/rex/src/client/fixtures/page-basic/regions/main/parts/Hello.tsx`

| Symbol       | Kind      | Declaration                   |
| ------------ | --------- | ----------------------------- |
| `HelloProps` | interface | `export interface HelloProps` |

### `packages/rex/src/client/fixtures/page-basic/regions/main/region.tsx`

| Symbol        | Kind      | Declaration             |
| ------------- | --------- | ----------------------- |
| `BasicParams` | interface | `interface BasicParams` |

### `packages/rex/src/client/fixtures/page-basic/states.tsx`

| Symbol  | Kind | Declaration                                                   |
| ------- | ---- | ------------------------------------------------------------- |
| `Props` | type | `type Props = StateProps<Readonly<Record<string, unknown>>>;` |

### `packages/rex/src/client/fixtures/page-second/states.tsx`

| Symbol  | Kind | Declaration                                                   |
| ------- | ---- | ------------------------------------------------------------- |
| `Props` | type | `type Props = StateProps<Readonly<Record<string, unknown>>>;` |

### `packages/rex/src/eslint/fixtures/lint/app/pages/profile/regions/card/parts/Avatar.tsx`

| Symbol        | Kind      | Declaration             |
| ------------- | --------- | ----------------------- |
| `AvatarProps` | interface | `interface AvatarProps` |

### `packages/rex/src/testing/fixtures/data.ts`

| Symbol       | Kind      | Declaration                   |
| ------------ | --------- | ----------------------------- |
| `NoteRecord` | interface | `export interface NoteRecord` |

### `packages/rex/src/testing/fixtures/note/regions/detail/region.tsx`

| Symbol       | Kind      | Declaration            |
| ------------ | --------- | ---------------------- |
| `NoteParams` | interface | `interface NoteParams` |

### `packages/rex/src/testing/fixtures/note/states.tsx`

| Symbol  | Kind | Declaration                                                   |
| ------- | ---- | ------------------------------------------------------------- |
| `Props` | type | `type Props = StateProps<Readonly<Record<string, unknown>>>;` |

### `packages/rex/src/testing/fixtures/notes/regions/composer/parts/Composer.tsx`

| Symbol          | Kind      | Declaration                      |
| --------------- | --------- | -------------------------------- |
| `ComposerProps` | interface | `export interface ComposerProps` |

### `packages/rex/src/testing/fixtures/notes/regions/list/parts/NoteList.tsx`

| Symbol          | Kind      | Declaration                      |
| --------------- | --------- | -------------------------------- |
| `NoteListProps` | interface | `export interface NoteListProps` |

### `packages/rex/src/testing/fixtures/notes/regions/list/region.tsx`

| Symbol        | Kind      | Declaration             |
| ------------- | --------- | ----------------------- |
| `NotesParams` | interface | `interface NotesParams` |

### `packages/rex/src/testing/fixtures/notes/states.tsx`

| Symbol  | Kind | Declaration                                                   |
| ------- | ---- | ------------------------------------------------------------- |
| `Props` | type | `type Props = StateProps<Readonly<Record<string, unknown>>>;` |
