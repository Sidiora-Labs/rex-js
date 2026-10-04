# Source reference

An index of the named types, classes, interfaces and test helpers in the repository, with the line that declares each one. It is derived from the source files at this revision; the declaration column is the source line itself (long lines are shortened with `...`). Exported functions and constants are documented in the topic pages linked from the [README](../README.md#documentation).

## Package source

Public and module-internal types, classes and interfaces of `packages/rex/src`. The prose documentation explains how they fit together: see [primitives.md](primitives.md), [architecture.md](architecture.md), [agent-contract.md](agent-contract.md), [cli.md](cli.md) and [convention.md](convention.md).

### `packages/rex/src/check/engine.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `FileRole` | type | 22 | `export type FileRole = (typeof FILE_ROLES)[number];` |
| `AppFile` | interface | 33 | `export interface AppFile` |
| `AppRegion` | interface | 42 | `export interface AppRegion` |
| `AppPage` | interface | 49 | `export interface AppPage` |
| `RexApp` | interface | 61 | `export interface RexApp` |
| `CheckResult` | interface | 73 | `export interface CheckResult` |
| `RunRulesOptions` | interface | 80 | `export interface RunRulesOptions` |
| `Classification` | interface | 127 | `interface Classification` |

### `packages/rex/src/check/report.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ReportFormat` | type | 6 | `export type ReportFormat = (typeof REPORT_FORMATS)[number];` |

### `packages/rex/src/check/rule.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Severity` | type | 8 | `export type Severity = (typeof SEVERITIES)[number];` |
| `Location` | interface | 10 | `export interface Location` |
| `Finding` | interface | 15 | `export interface Finding` |
| `FindingInput` | interface | 25 | `export interface FindingInput` |
| `RuleContext` | interface | 77 | `export interface RuleContext` |
| `Rule` | interface | 82 | `export interface Rule` |
| `ImportKind` | type | 101 | `export type ImportKind = "import" \| "export" \| "dynamic" \| "require";` |
| `ImportRef` | interface | 103 | `export interface ImportRef extends Location` |
| `ExportRef` | interface | 111 | `export interface ExportRef extends Location` |
| `DeclarationFunction` | type | 119 | `export type DeclarationFunction = (typeof DECLARATION_FUNCTIONS)[number];` |
| `StaticDeclaration` | interface | 121 | `export interface StaticDeclaration extends Location` |
| `StaticName` | interface | 128 | `export interface StaticName extends Location` |
| `StaticOverlay` | interface | 132 | `export interface StaticOverlay extends Location` |
| `StaticActionRef` | interface | 138 | `export interface StaticActionRef extends Location` |
| `StaticPageDeclaration` | interface | 145 | `export interface StaticPageDeclaration extends Location` |
| `SourceLoader` | interface | 155 | `export interface SourceLoader` |

### `packages/rex/src/check/rules/boundaries.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `TargetRule` | interface | 21 | `interface TargetRule` |
| `PackageRule` | interface | 28 | `interface PackageRule` |
| `RoleBoundary` | interface | 34 | `interface RoleBoundary` |

### `packages/rex/src/check/rules/index.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RunCheckOptions` | interface | 24 | `export interface RunCheckOptions` |
| `RunCheckResult` | interface | 29 | `export interface RunCheckResult extends CheckResult` |

### `packages/rex/src/check/rules/parity.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ActionReference` | interface | 12 | `export interface ActionReference extends Location` |

### `packages/rex/src/check/rules/tokens.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ClassToken` | interface | 42 | `export interface ClassToken` |

### `packages/rex/src/check/rules/typecheck.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ProgramInput` | interface | 34 | `interface ProgramInput` |

### `packages/rex/src/cli/commands/build.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ServerEntryOptions` | interface | 27 | `export interface ServerEntryOptions` |
| `BuildOptions` | interface | 63 | `export interface BuildOptions` |
| `BuildResult` | interface | 67 | `export interface BuildResult` |

### `packages/rex/src/cli/commands/dev.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `DevOptions` | interface | 12 | `export interface DevOptions` |

### `packages/rex/src/cli/commands/make.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `DeclarationKind` | type | 22 | `export type DeclarationKind = (typeof DECLARATION_KINDS)[number];` |
| `PlannedFile` | interface | 27 | `export interface PlannedFile` |
| `PlannedDir` | interface | 33 | `export interface PlannedDir` |
| `PlannedEntry` | type | 38 | `export type PlannedEntry = PlannedFile \| PlannedDir;` |
| `MakeError` | class | 40 | `export class MakeError extends Error` |
| `MakePageOptions` | interface | 112 | `export interface MakePageOptions` |

### `packages/rex/src/cli/commands/new.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `PackageManifest` | interface | 41 | `interface PackageManifest` |

### `packages/rex/src/cli/commands/promote.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `PartLocation` | interface | 22 | `export interface PartLocation` |
| `PromoteResult` | interface | 28 | `export interface PromoteResult` |
| `SpecifierEdit` | interface | 34 | `interface SpecifierEdit` |

### `packages/rex/src/cli/index.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RexCliIO` | interface | 23 | `export interface RexCliIO` |
| `RexCommandModule` | interface | 29 | `export interface RexCommandModule` |
| `RexCliExit` | class | 33 | `export class RexCliExit extends Error` |

### `packages/rex/src/cli/templates.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `TemplateKind` | type | 27 | `export type TemplateKind = (typeof TEMPLATE_KINDS)[number];` |
| `PageTemplateOptions` | interface | 96 | `export interface PageTemplateOptions` |
| `ViewTemplateOptions` | interface | 150 | `export interface ViewTemplateOptions` |
| `StatesTemplateOptions` | interface | 197 | `export interface StatesTemplateOptions` |
| `RegionTemplateOptions` | interface | 287 | `export interface RegionTemplateOptions` |
| `PartTemplateOptions` | interface | 302 | `export interface PartTemplateOptions` |
| `OverlayTemplateOptions` | interface | 315 | `export interface OverlayTemplateOptions` |
| `HookTemplateOptions` | interface | 332 | `export interface HookTemplateOptions` |
| `DeclarationTemplateOptions` | interface | 348 | `export interface DeclarationTemplateOptions` |

### `packages/rex/src/client/act.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RunOptions` | interface | 24 | `export interface RunOptions` |
| `ActControlProps` | interface | 28 | `export interface ActControlProps` |
| `MutationVariables` | interface | 37 | `interface MutationVariables` |
| `ActHandle` | interface | 42 | `export interface ActHandle<A extends AnyAction>` |

### `packages/rex/src/client/agent/address.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `AddressKind` | type | 20 | `export type AddressKind = keyof typeof ADDRESS_ATTRIBUTES;` |
| `AddressScopeValue` | interface | 51 | `interface AddressScopeValue` |
| `AddressScopeProps` | interface | 61 | `export interface AddressScopeProps` |
| `RexAddress` | interface | 93 | `export interface RexAddress` |
| `FoundAddress` | interface | 123 | `export interface FoundAddress` |

### `packages/rex/src/client/agent/confirm.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ConfirmSubject` | type | 23 | `export type ConfirmSubject = Pick<AnyAction, "id" \| "label" \| "effect">;` |
| `ConfirmRequest` | interface | 25 | `export interface ConfirmRequest` |
| `ConfirmFn` | type | 31 | `export type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;` |
| `Pending` | interface | 44 | `interface Pending` |
| `ConfirmProviderProps` | interface | 128 | `export interface ConfirmProviderProps` |
| `InvokeHandle` | interface | 176 | `export interface InvokeHandle<A extends AnyAction> extends ActHandle<A>` |
| `Invoke` | type | 227 | `type Invoke = (input: unknown) => Promise<ActResult<AnyAction>>;` |
| `PageInvokerSet` | interface | 229 | `export interface PageInvokerSet` |
| `PageInvokersProps` | interface | 264 | `export interface PageInvokersProps` |

### `packages/rex/src/client/agent/density.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `DensitySource` | type | 22 | `export type DensitySource = "query" \| "header" \| "stored" \| "default" \| "set";` |
| `DensityInputs` | interface | 24 | `export interface DensityInputs` |
| `ResolvedDensity` | interface | 31 | `export interface ResolvedDensity` |
| `DensityValue` | interface | 72 | `export interface DensityValue extends ResolvedDensity` |
| `DensityProviderProps` | interface | 79 | `export interface DensityProviderProps` |

### `packages/rex/src/client/agent/flow.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `FlowClient` | type | 28 | `export type FlowClient = RouterClient<FlowRouter>;` |
| `FlowClientOptions` | interface | 30 | `export interface FlowClientOptions` |
| `FlowClientProviderProps` | interface | 52 | `export interface FlowClientProviderProps` |
| `FlowDecisionResult` | type | 74 | `export type FlowDecisionResult =` |
| `GateControlProps` | interface | 78 | `export interface GateControlProps` |
| `FlowHandle` | interface | 87 | `export interface FlowHandle` |

### `packages/rex/src/client/agent/outcome.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `OutcomeRegionProps` | interface | 6 | `export interface OutcomeRegionProps` |

### `packages/rex/src/client/agent/palette.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `PaletteActionEntry` | interface | 19 | `export interface PaletteActionEntry` |
| `PalettePageEntry` | interface | 30 | `export interface PalettePageEntry` |
| `RexPaletteProps` | interface | 96 | `export interface RexPaletteProps` |

### `packages/rex/src/client/agent/shortcuts.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ShortcutEventLike` | interface | 6 | `export interface ShortcutEventLike` |

### `packages/rex/src/client/agent/sidecar.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Window` | interface | 36 | `interface Window` |
| `Listener` | type | 41 | `type Listener = () => void;` |
| `OverlayRegistry` | interface | 58 | `export interface OverlayRegistry` |
| `OverlayRegistryProviderProps` | interface | 98 | `export interface OverlayRegistryProviderProps` |
| `Affordance` | interface | 120 | `export interface Affordance` |
| `AffordanceRegistry` | interface | 131 | `export interface AffordanceRegistry` |
| `AffordanceRegistryProviderProps` | interface | 193 | `export interface AffordanceRegistryProviderProps` |
| `SidecarSource` | interface | 248 | `export interface SidecarSource` |

### `packages/rex/src/client/agent/url-invoke.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `UrlInvocation` | type | 11 | `export type UrlInvocation =` |

### `packages/rex/src/client/app.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RexFetch` | type | 31 | `export type RexFetch = (input: Request \| string \| URL, init?: RequestInit) => Promise<Response>;` |
| `DensitySlotProps` | interface | 33 | `export interface DensitySlotProps` |
| `CreateRexAppOptions` | interface | 37 | `export interface CreateRexAppOptions` |
| `RexAppProps` | interface | 48 | `export interface RexAppProps` |
| `RexAppComponent` | type | 52 | `export type RexAppComponent = ComponentType<RexAppProps>;` |
| `StartupValue` | interface | 54 | `interface StartupValue` |
| `Startup` | type | 60 | `type Startup =` |
| `RexStartupError` | class | 65 | `export class RexStartupError extends Error` |
| `RexEntryBundle` | interface | 271 | `export interface RexEntryBundle` |
| `RexEntryOptions` | type | 277 | `export type RexEntryOptions = Omit<CreateRexAppOptions, "registry" \| "manifest" \| "density">;` |

### `packages/rex/src/client/context.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RexClientContext` | interface | 22 | `export interface RexClientContext` |
| `RexProcedureClient` | type | 26 | `export type RexProcedureClient = Client<RexClientContext, unknown, unknown, Error>;` |
| `RexClient` | type | 28 | `export type RexClient = { readonly [procedure: string]: RexProcedureClient };` |
| `ConfirmRequest` | interface | 38 | `export interface ConfirmRequest` |
| `ConfirmGrant` | interface | 43 | `export interface ConfirmGrant` |
| `RexRuntime` | interface | 48 | `export interface RexRuntime` |

### `packages/rex/src/client/layout.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Space` | type | 6 | `export type Space = (typeof SPACES)[number];` |
| `Columns` | type | 7 | `export type Columns = (typeof COLUMNS)[number];` |
| `StackProps` | interface | 35 | `export interface StackProps` |
| `GridProps` | interface | 40 | `export interface GridProps` |
| `SectionProps` | interface | 46 | `export interface SectionProps` |
| `OutcomeProps` | interface | 52 | `export interface OutcomeProps` |

### `packages/rex/src/client/nav.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `NavOutcome` | type | 12 | `export type NavOutcome =` |
| `Nav` | interface | 21 | `export interface Nav` |
| `Draft` | interface | 88 | `export interface Draft<T>` |

### `packages/rex/src/client/outcome.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Outcome` | interface | 11 | `export interface Outcome` |
| `OutcomeStore` | interface | 18 | `export interface OutcomeStore` |
| `OutcomeProviderProps` | interface | 60 | `export interface OutcomeProviderProps` |

### `packages/rex/src/client/overlay.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `OverlayOptions` | interface | 27 | `export interface OverlayOptions` |
| `OverlayRenderContext` | interface | 32 | `export interface OverlayRenderContext` |
| `OverlayComponent` | type | 38 | `export type OverlayComponent = ComponentType &` |
| `OverlayHandle` | interface | 85 | `export interface OverlayHandle` |
| `OverlaySurfaceProps` | interface | 156 | `interface OverlaySurfaceProps` |

### `packages/rex/src/client/page.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `PageParamsValue` | type | 30 | `export type PageParamsValue = Readonly<Record<string, unknown>>;` |
| `PageRuntime` | interface | 32 | `export interface PageRuntime` |
| `ViewContext` | interface | 48 | `export interface ViewContext<P = PageParamsValue>` |
| `ViewComponent` | type | 53 | `export type ViewComponent = ComponentType & { readonly rexKind: "view" };` |
| `RegionContext` | interface | 75 | `export interface RegionContext<P = PageParamsValue>` |
| `RegionComponent` | type | 84 | `export type RegionComponent = ComponentType &` |
| `RegionProps` | interface | 89 | `export interface RegionProps` |
| `StateExportComponent` | type | 140 | `export type StateExportComponent = ComponentType<StateProps<PageParamsValue>>;` |
| `PageModuleSet` | interface | 142 | `export interface PageModuleSet<Pg extends AnyPage = AnyPage>` |
| `RexPageModuleError` | class | 150 | `export class RexPageModuleError extends Error` |
| `PageHostProps` | interface | 260 | `export interface PageHostProps` |

### `packages/rex/src/client/router.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ParamIssue` | interface | 14 | `export interface ParamIssue` |
| `PageResolution` | interface | 19 | `export interface PageResolution` |
| `NotFoundResolution` | interface | 29 | `export interface NotFoundResolution` |
| `RouteResolution` | type | 34 | `export type RouteResolution = PageResolution \| NotFoundResolution;` |
| `ParamsResult` | type | 36 | `export type ParamsResult =` |
| `HrefResult` | type | 40 | `export type HrefResult =` |
| `RouteRender` | type | 194 | `export type RouteRender = (resolution: RouteResolution) => ReactNode;` |
| `PageRouteProps` | interface | 196 | `interface PageRouteProps` |
| `RexRoutesProps` | interface | 227 | `export interface RexRoutesProps` |

### `packages/rex/src/client/shell.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `OutcomeSlotProps` | interface | 16 | `export interface OutcomeSlotProps` |
| `ShellProps` | interface | 20 | `export interface ShellProps` |
| `FrameProps` | interface | 36 | `interface FrameProps` |
| `AgentShellProps` | interface | 164 | `export interface AgentShellProps` |

### `packages/rex/src/client/states.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `QueryStatus` | type | 19 | `export type QueryStatus = "pending" \| "error" \| "success";` |
| `FetchStatus` | type | 20 | `export type FetchStatus = "fetching" \| "paused" \| "idle";` |
| `DataStateQuery` | interface | 22 | `export interface DataStateQuery` |
| `DataStateInput` | interface | 29 | `export interface DataStateInput` |
| `QueryLike` | interface | 36 | `export interface QueryLike` |
| `UseDataStateOptions` | interface | 129 | `export interface UseDataStateOptions` |

### `packages/rex/src/core/action.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ActionEffect` | type | 7 | `export type ActionEffect = "reversible" \| "irreversible" \| "read";` |
| `ShortcutModifier` | type | 13 | `export type ShortcutModifier = (typeof SHORTCUT_MODIFIERS)[number];` |
| `ParsedShortcut` | interface | 47 | `export interface ParsedShortcut` |
| `ActionContext` | interface | 95 | `export interface ActionContext` |
| `ActionConfig` | interface | 99 | `export interface ActionConfig<I extends z.ZodType, O extends z.ZodType>` |
| `ActionDeclaration` | interface | 110 | `export interface ActionDeclaration<` |
| `AnyAction` | type | 130 | `export type AnyAction = ActionDeclaration<string, z.ZodType, z.ZodType>;` |

### `packages/rex/src/core/actor.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ActorAttributes` | interface | 1 | `export interface ActorAttributes` |
| `Actor` | interface | 8 | `export interface Actor` |
| `ActorInput` | interface | 15 | `export interface ActorInput` |

### `packages/rex/src/core/entity.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RexDeclarationError` | class | 4 | `export class RexDeclarationError extends Error` |
| `EntityFields` | type | 37 | `export type EntityFields = { readonly [field: string]: z.ZodType };` |
| `EntityConfig` | interface | 48 | `export interface EntityConfig<F extends EntityFields, K extends StringFieldOf<F>>` |
| `EntityDeclaration` | interface | 54 | `export interface EntityDeclaration<` |
| `AnyEntity` | type | 72 | `export type AnyEntity = EntityDeclaration<string, EntityFields, string>;` |

### `packages/rex/src/core/flow.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RegistryKinds` | interface | 16 | `interface RegistryKinds` |
| `FlowStepContext` | interface | 21 | `export interface FlowStepContext` |
| `ActionStepConfig` | interface | 27 | `export interface ActionStepConfig<A extends AnyAction = AnyAction>` |
| `ApprovalStepConfig` | interface | 32 | `export interface ApprovalStepConfig` |
| `FlowStepConfig` | type | 38 | `export type FlowStepConfig = ActionStepConfig \| ApprovalStepConfig;` |
| `ActionStep` | interface | 40 | `export interface ActionStep` |
| `ApprovalStep` | interface | 46 | `export interface ApprovalStep` |
| `FlowStep` | type | 53 | `export type FlowStep = ActionStep \| ApprovalStep;` |
| `FlowConfig` | interface | 55 | `export interface FlowConfig` |
| `FlowDeclaration` | interface | 60 | `export interface FlowDeclaration<N extends string = string>` |
| `AnyFlow` | type | 68 | `export type AnyFlow = FlowDeclaration<string>;` |
| `FlowRunContext` | interface | 70 | `export interface FlowRunContext` |
| `FlowRunResult` | interface | 75 | `export interface FlowRunResult` |
| `FlowDecisionError` | class | 81 | `export class FlowDecisionError extends Error` |

### `packages/rex/src/core/ids.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RexNameError` | class | 4 | `export class RexNameError extends Error` |

### `packages/rex/src/core/journal.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `FlowStatus` | type | 1 | `export type FlowStatus = "running" \| "paused" \| "completed" \| "rejected" \| "failed";` |
| `FlowDecision` | type | 11 | `export type FlowDecision = "approve" \| "reject";` |
| `JournalEntry` | type | 13 | `export type JournalEntry =` |
| `FlowInstance` | interface | 38 | `export interface FlowInstance` |
| `JournalListFilter` | interface | 46 | `export interface JournalListFilter` |
| `Journal` | interface | 51 | `export interface Journal` |

### `packages/rex/src/core/overlay.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `OverlayDismiss` | type | 4 | `export type OverlayDismiss = "escape" \| "button" \| "both";` |
| `OverlayBinding` | type | 5 | `export type OverlayBinding = "region" \| "url";` |
| `OverlayDeclaration` | interface | 10 | `export interface OverlayDeclaration<N extends string = string>` |

### `packages/rex/src/core/page.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RegistryKinds` | interface | 10 | `interface RegistryKinds` |
| `PageDraft` | type | 15 | `export type PageDraft = "route" \| "session" \| "none";` |
| `PageChromeConfig` | interface | 19 | `export interface PageChromeConfig` |
| `PageChrome` | interface | 26 | `export interface PageChrome` |
| `RouteSegment` | type | 33 | `export type RouteSegment =` |
| `ParsedRoute` | interface | 37 | `export interface ParsedRoute` |
| `PageParamsSchema` | type | 73 | `export type PageParamsSchema = z.ZodObject<z.ZodRawShape>;` |
| `PageConfig` | interface | 75 | `export interface PageConfig<` |
| `PageDeclaration` | interface | 94 | `export interface PageDeclaration<` |
| `AnyPage` | type | 119 | `export type AnyPage = PageDeclaration<` |

### `packages/rex/src/core/policy.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ReasonCode` | type | 11 | `export type ReasonCode =` |
| `PolicyResult` | type | 18 | `export type PolicyResult =` |
| `RequiresClause` | interface | 22 | `export interface RequiresClause<P extends string = string>` |
| `Predicate` | type | 29 | `export type Predicate =` |
| `PredicateJson` | type | 44 | `export type PredicateJson =` |
| `PolicyConfig` | interface | 59 | `export interface PolicyConfig<P extends string>` |
| `PolicyDeclaration` | interface | 64 | `export interface PolicyDeclaration<N extends string = string, P extends string = string>` |
| `AnyPolicy` | type | 74 | `export type AnyPolicy = PolicyDeclaration<string, string>;` |

### `packages/rex/src/core/protocol.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ReservedQueryKey` | type | 12 | `export type ReservedQueryKey = (typeof RESERVED_QUERY_KEYS)[number];` |

### `packages/rex/src/core/registry.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RegistryKinds` | interface | 6 | `export interface RegistryKinds` |
| `DeclarationKind` | type | 12 | `export type DeclarationKind = keyof RegistryKinds;` |
| `AnyDeclaration` | type | 14 | `export type AnyDeclaration = RegistryKinds[DeclarationKind];` |
| `RegistryLists` | type | 24 | `export type RegistryLists =` |
| `RegistrySnapshot` | type | 28 | `export type RegistrySnapshot = RegistryLists &` |
| `Registry` | interface | 33 | `export interface Registry` |

### `packages/rex/src/core/schema.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `FieldKind` | type | 9 | `export type FieldKind =` |
| `JsonSchema` | type | 23 | `export type JsonSchema = { [key: string]: unknown };` |
| `TextOptions` | interface | 28 | `export interface TextOptions` |
| `IntegerOptions` | interface | 33 | `export interface IntegerOptions` |
| `RefTarget` | type | 38 | `export type RefTarget = string \| { readonly id: string };` |

### `packages/rex/src/core/states.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RexDataState` | type | 13 | `export type RexDataState = (typeof REX_DATA_STATES)[number];` |
| `NonReadyState` | type | 15 | `export type NonReadyState = Exclude<RexDataState, "ready">;` |
| `StateProps` | interface | 44 | `export interface StateProps<P = Record<string, unknown>>` |

### `packages/rex/src/core/store.memory.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `T` | type | 15 | `type T = InferEntity<E>;` |

### `packages/rex/src/core/store.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `StoreRecord` | type | 6 | `export type StoreRecord = { readonly [field: string]: unknown };` |
| `ListQuery` | interface | 10 | `export interface ListQuery<T>` |
| `ListResult` | interface | 16 | `export interface ListResult<T>` |
| `Store` | interface | 23 | `export interface Store<T>` |
| `NormalizedListQuery` | interface | 30 | `export interface NormalizedListQuery<T>` |
| `EntityStore` | interface | 67 | `export interface EntityStore<E extends AnyEntity> extends Store<InferEntity<E>>` |

### `packages/rex/src/manifest/build.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ManifestSource` | interface | 19 | `export interface ManifestSource` |
| `BuildManifestOptions` | interface | 27 | `export interface BuildManifestOptions` |

### `packages/rex/src/manifest/scan.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ManifestScanError` | class | 26 | `export class ManifestScanError extends Error` |
| `ManifestFiles` | interface | 36 | `export interface ManifestFiles` |
| `WriteManifestResult` | interface | 41 | `export interface WriteManifestResult` |
| `ChildMessage` | type | 157 | `type ChildMessage =` |

### `packages/rex/src/manifest/sidecar.schema.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `InvocationRoute` | type | 12 | `export type InvocationRoute = (typeof INVOCATION_ROUTES)[number];` |
| `SidecarAction` | type | 88 | `export type SidecarAction = z.output<typeof sidecarActionSchema>;` |
| `SidecarOverlay` | type | 89 | `export type SidecarOverlay = z.output<typeof sidecarOverlaySchema>;` |
| `SidecarOutcome` | type | 90 | `export type SidecarOutcome = z.output<typeof sidecarOutcomeSchema>;` |
| `SidecarPayload` | type | 91 | `export type SidecarPayload = z.output<typeof sidecarSchema>;` |
| `SidecarIssue` | interface | 99 | `export interface SidecarIssue` |
| `SidecarValidation` | type | 104 | `export type SidecarValidation =` |

### `packages/rex/src/manifest/types.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ManifestApp` | interface | 10 | `export interface ManifestApp` |
| `ManifestField` | interface | 14 | `export interface ManifestField` |
| `ManifestEntity` | interface | 21 | `export interface ManifestEntity` |
| `ManifestAction` | interface | 28 | `export interface ManifestAction` |
| `ManifestOverlay` | interface | 39 | `export interface ManifestOverlay` |
| `ManifestPage` | interface | 45 | `export interface ManifestPage` |
| `ManifestPolicy` | interface | 60 | `export interface ManifestPolicy` |
| `ManifestFlowStep` | type | 65 | `export type ManifestFlowStep =` |
| `ManifestFlow` | interface | 74 | `export interface ManifestFlow` |
| `Manifest` | interface | 79 | `export interface Manifest` |
| `FlowStepSource` | type | 89 | `export type FlowStepSource =` |
| `FlowSource` | interface | 98 | `export interface FlowSource` |

### `packages/rex/src/server/audit.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `AuditOutcome` | type | 11 | `export type AuditOutcome = typeof AUDIT_OK \| (string & {});` |
| `AuditRecord` | interface | 13 | `export interface AuditRecord` |
| `AuditEntry` | type | 24 | `export type AuditEntry = Omit<AuditRecord, "id">;` |
| `AuditFilter` | interface | 26 | `export interface AuditFilter` |
| `Ledger` | interface | 34 | `export interface Ledger` |
| `AuditEntryInput` | interface | 39 | `export interface AuditEntryInput` |

### `packages/rex/src/server/context.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RexDensity` | type | 6 | `export type RexDensity = (typeof REX_DENSITIES)[number];` |
| `RexContext` | interface | 13 | `export interface RexContext` |

### `packages/rex/src/server/flow.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `FlowStateStatus` | type | 12 | `export type FlowStateStatus = FlowStatus \| "idle";` |
| `FlowGateState` | interface | 14 | `export interface FlowGateState` |
| `FlowState` | interface | 19 | `export interface FlowState` |
| `FlowRouter` | type | 141 | `export type FlowRouter = ReturnType<typeof buildFlowRouter>;` |
| `MountFlowsOptions` | interface | 143 | `export interface MountFlowsOptions` |

### `packages/rex/src/server/index.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ActorResolver` | type | 33 | `export type ActorResolver = (request: Request) => Actor \| Promise<Actor>;` |
| `RexServerOptions` | interface | 40 | `export interface RexServerOptions<A extends AnyAction>` |
| `RexDensityError` | class | 60 | `export class RexDensityError extends Error` |

### `packages/rex/src/server/node.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `NodeServerOptions` | interface | 12 | `export interface NodeServerOptions` |
| `RunningNodeServer` | interface | 18 | `export interface RunningNodeServer` |

### `packages/rex/src/server/router.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `NoErrors` | type | 23 | `type NoErrors = Record<never, never>;` |
| `NoMeta` | type | 24 | `type NoMeta = Record<never, never>;` |
| `LowerLetter` | type | 26 | `type LowerLetter =` |
| `ConfirmInput` | type | 77 | `export type ConfirmInput = z.input<typeof confirmInputSchema>;` |
| `ConfirmOutput` | type | 78 | `export type ConfirmOutput = z.output<typeof confirmOutputSchema>;` |
| `ConfirmProcedure` | type | 80 | `export type ConfirmProcedure = Procedure<` |
| `ActionRouterSource` | interface | 93 | `export interface ActionRouterSource<A extends AnyAction>` |
| `ActionRouterOptions` | interface | 97 | `export interface ActionRouterOptions` |
| `PendingConfirmation` | interface | 102 | `interface PendingConfirmation` |
| `Confirmations` | type | 199 | `type Confirmations = ReturnType<typeof createConfirmations>;` |

### `packages/rex/src/store/drizzle.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ColumnType` | type | 21 | `export type ColumnType = "text" \| "integer" \| "real" \| "boolean" \| "json";` |
| `ColumnSpec` | interface | 23 | `export interface ColumnSpec` |
| `DrizzleStoreOptions` | interface | 31 | `export interface DrizzleStoreOptions` |
| `AsyncSQLiteDatabase` | type | 36 | `export type AsyncSQLiteDatabase = BaseSQLiteDatabase<"async", unknown, Record<string, unknown>>;` |
| `T` | type | 147 | `type T = InferEntity<E>;` |

### `packages/rex/src/vite/index.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RexFetchApp` | interface | 56 | `export interface RexFetchApp` |
| `RexServerSource` | type | 60 | `export type RexServerSource =` |
| `RexPluginOptions` | interface | 63 | `export interface RexPluginOptions` |
| `ResolveContext` | interface | 106 | `interface ResolveContext` |

### `packages/rex/src/vite/virtual.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `RexPageModule` | interface | 33 | `export interface RexPageModule` |
| `RexAppBundle` | interface | 42 | `export interface RexAppBundle` |
| `ScannedNamedFile` | interface | 53 | `export interface ScannedNamedFile` |
| `ScannedPage` | interface | 58 | `export interface ScannedPage` |
| `AppScan` | interface | 68 | `export interface AppScan` |
| `RexAppScanError` | class | 78 | `export class RexAppScanError extends Error` |
| `RuntimePaths` | interface | 166 | `export interface RuntimePaths` |
| `AppModuleOptions` | interface | 180 | `export interface AppModuleOptions` |
| `EntryModuleOptions` | interface | 281 | `export interface EntryModuleOptions` |

## Demo application

Prop types and data types of the wallet demo in `examples/demo`, the server's `DemoApp` type, and the walk helpers' types. The demo is described in the [README](../README.md#the-demo-and-the-operability-walk).

### `examples/demo/app/components/Button.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ButtonProps` | interface | 3 | `export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>` |

### `examples/demo/app/components/Card.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `CardProps` | interface | 3 | `export interface CardProps` |

### `examples/demo/app/components/Field.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `FieldProps` | interface | 3 | `export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id">` |

### `examples/demo/app/components/Sheet.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `SheetProps` | interface | 3 | `export interface SheetProps` |

### `examples/demo/app/data/wallet.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Account` | type | 6 | `export type Account = InferEntity<typeof account>;` |
| `Token` | type | 7 | `export type Token = InferEntity<typeof token>;` |
| `Contact` | type | 8 | `export type Contact = InferEntity<typeof contact>;` |

### `examples/demo/app/pages/portfolio/regions/actions/parts/FilterForm.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `FilterFormProps` | interface | 5 | `export interface FilterFormProps` |

### `examples/demo/app/pages/portfolio/regions/actions/parts/QuickActions.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `QuickActionsProps` | interface | 4 | `export interface QuickActionsProps` |

### `examples/demo/app/pages/portfolio/regions/hero/parts/BalanceHero.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `BalanceHeroProps` | interface | 3 | `export interface BalanceHeroProps` |

### `examples/demo/app/pages/portfolio/regions/holdings/parts/DustToggle.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `DustToggleProps` | interface | 4 | `export interface DustToggleProps` |

### `examples/demo/app/pages/portfolio/regions/holdings/parts/HoldingRow.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Holding` | interface | 1 | `export interface Holding` |

### `examples/demo/app/pages/portfolio/regions/holdings/parts/HoldingsList.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `HoldingsListProps` | interface | 4 | `export interface HoldingsListProps` |

### `examples/demo/app/pages/send/regions/confirm/parts/SendSummary.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `SendSummaryProps` | interface | 5 | `export interface SendSummaryProps` |

### `examples/demo/app/pages/send/regions/form/parts/AmountField.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `AmountFieldProps` | interface | 3 | `export interface AmountFieldProps` |

### `examples/demo/app/pages/send/regions/form/parts/ContactField.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ContactFieldProps` | interface | 5 | `export interface ContactFieldProps` |

### `examples/demo/app/pages/send/regions/form/parts/ContactOptions.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ContactChoice` | interface | 6 | `export interface ContactChoice` |
| `ContactOptionsProps` | interface | 12 | `export interface ContactOptionsProps` |

### `examples/demo/app/pages/send/regions/form/parts/TokenField.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `TokenFieldProps` | interface | 5 | `export interface TokenFieldProps` |

### `examples/demo/app/pages/send/regions/form/parts/TokenOptions.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `TokenChoice` | interface | 6 | `export interface TokenChoice` |
| `TokenOptionsProps` | interface | 13 | `export interface TokenOptionsProps` |

### `examples/demo/app/pages/send/regions/success/parts/TransferReceipt.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `TransferReceiptProps` | interface | 3 | `export interface TransferReceiptProps` |

### `examples/demo/server.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `DemoApp` | interface | 32 | `export interface DemoApp` |

## Test helpers

Helper functions, components and types declared inside test files, the store conformance module and the Playwright walk. They exist only to exercise the code; see [development.md](development.md#tests).

### `examples/demo/e2e/operability.spec.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `running` | function | 48 | `function running(): { readonly base: string; readonly manifest: WalkManifest }` |
| `walkDensity` | function | 61 | `async function walkDensity(` |

### `examples/demo/e2e/walk.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Density` | type | 14 | `export type Density = (typeof DENSITIES)[number];` |
| `Route` | type | 15 | `export type Route = "click" \| "key" \| "url" \| "palette";` |
| `ManifestAction` | interface | 17 | `export interface ManifestAction` |
| `ManifestOverlay` | interface | 24 | `export interface ManifestOverlay` |
| `ManifestPage` | interface | 30 | `export interface ManifestPage` |
| `WalkManifest` | interface | 37 | `export interface WalkManifest` |
| `SidecarAction` | interface | 42 | `export interface SidecarAction` |
| `SidecarPayload` | interface | 51 | `export interface SidecarPayload` |
| `Check` | interface | 60 | `export interface Check` |
| `PageReport` | interface | 66 | `export interface PageReport` |
| `RunningDemo` | interface | 77 | `export interface RunningDemo` |
| `Recorder` | class | 155 | `export class Recorder` |
| `OutcomeMark` | interface | 237 | `interface OutcomeMark` |
| `InvokeContext` | interface | 302 | `export interface InvokeContext` |

### `packages/rex/src/check/check.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `link` | function | 31 | `function link(root: string, name: string, target: string): void` |
| `tempRoot` | function | 37 | `function tempRoot(): string` |
| `copyAllFail` | function | 43 | `function copyAllFail(): string` |
| `ruleOf` | constant | 58 | `const ruleOf = (entry: Finding) => entry.rule.split("/")[0];` |
| `pick` | constant | 95 | `const pick = (rule: string) =>` |

### `packages/rex/src/check/engine.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `writeApp` | function | 32 | `function writeApp(files: Record<string, string>): string` |
| `check` | method | 46 | `check({ app, sources })` |
| `check` | method | 65 | `check({ app })` |

### `packages/rex/src/check/rules/boundaries.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `at` | constant | 54 | `const at = (file: string, line: number) =>` |

### `packages/rex/src/check/rules/parity.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `message` | constant | 60 | `const message = (rule: string, index = 0) =>` |

### `packages/rex/src/check/rules/quality.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `first` | constant | 58 | `const first = (rule: string) =>` |

### `packages/rex/src/cli/cli.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `packageVersion` | constant | 47 | `const packageVersion = (` |
| `tempDir` | function | 52 | `function tempDir(prefix: string): string` |
| `rex` | function | 62 | `function rex(...args: string[])` |
| `captureIO` | function | 71 | `function captureIO(cwd = packageRoot)` |
| `diagnostics` | function | 183 | `function diagnostics(code: string, fileName: string): string[]` |
| `exportsOf` | function | 199 | `function exportsOf(code: string, fileName: string)` |
| `expectValid` | function | 226 | `function expectValid(code: string, fileName: string)` |
| `importDeclaration` | function | 233 | `async function importDeclaration(root: string, path: string, code: string)` |
| `declared` | constant | 342 | `const declared = (await importDeclaration(root, appPaths.page("send"), code))` |
| `plain` | constant | 355 | `const plain = (` |
| `action` | constant | 365 | `const action = (` |
| `entity` | constant | 379 | `const entity = (` |
| `policy` | constant | 386 | `const policy = (` |

### `packages/rex/src/cli/commands.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `captureIO` | function | 37 | `function captureIO(cwd: string)` |
| `installDependencies` | function | 52 | `function installDependencies(root: string): void` |
| `cli` | function | 70 | `async function cli(root: string, ...args: string[])` |
| `waitForServing` | function | 76 | `function waitForServing(child: ChildProcess): Promise<string>` |
| `served` | constant | 175 | `const served = (await manifest.json()) as Manifest;` |
| `base` | constant | 203 | `const base = (url as string).replace(/\/$/, "");` |

### `packages/rex/src/cli/make.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `tree` | function | 32 | `function tree(dir: string, prefix = ""): string[]` |
| `io` | function | 47 | `function io(): RexCliIO & { readonly output: string[]; readonly errors: string[] }` |
| `read` | constant | 63 | `const read = (path: string) => readFile(join(root, path), "utf8");` |

### `packages/rex/src/cli/new.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `tempDir` | function | 50 | `function tempDir(): string` |
| `captureIO` | function | 56 | `function captureIO(cwd: string)` |
| `listFiles` | function | 71 | `function listFiles(root: string, dir = root, found: string[] = []): string[]` |
| `GeneratedPackage` | interface | 81 | `interface GeneratedPackage` |
| `readJson` | function | 89 | `function readJson<T>(file: string): T` |
| `installDependencies` | function | 93 | `function installDependencies(root: string): void` |
| `generate` | function | 108 | `async function generate(name: string): Promise<{ cwd: string; root: string; out: string }>` |

### `packages/rex/src/client/act.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `grantKey` | function | 83 | `function grantKey(actionId: string, input: unknown): string` |
| `implement` | function | 89 | `function implement(declared: AnyAction)` |
| `Harness` | interface | 123 | `interface Harness` |
| `Probe` | function | 130 | `function Probe({ handles }: { readonly handles: Record<string, ActHandle<AnyAction>> })` |
| `Balance` | function | 151 | `function Balance({ counter }: { readonly counter: { count: number } })` |
| `mount` | function | 162 | `function mount(): Harness` |
| `handle` | function | 205 | `function handle(harness: Harness, id: string): ActHandle<AnyAction>` |

### `packages/rex/src/client/agent/address.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Where` | function | 54 | `function Where({ testId }: { readonly testId: string })` |
| `FilterSheet` | function | 84 | `function FilterSheet()` |
| `mount` | function | 127 | `function mount(path: string)` |
| `Probe` | function | 245 | `function Probe()` |

### `packages/rex/src/client/agent/density.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `rootDensity` | function | 24 | `function rootDensity(): string \| null` |
| `Probe` | function | 28 | `function Probe()` |
| `shown` | function | 44 | `function shown(): string \| null` |
| `Density` | function | 160 | `function Density({ children }: { readonly children: React.ReactNode })` |

### `packages/rex/src/client/agent/flow.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `payoutFlow` | function | 57 | `function payoutFlow()` |
| `Mounted` | interface | 74 | `interface Mounted` |
| `mount` | function | 79 | `function mount(subject: Actor, instance: string): Mounted` |
| `Payout` | function | 81 | `function Payout()` |
| `Slot` | function | 124 | `function Slot({ page: pageId }: OutcomeSlotProps)` |
| `sidecar` | function | 152 | `function sidecar(): SidecarPayload` |
| `status` | function | 158 | `async function status(text: string)` |
| `click` | function | 162 | `async function click(element: HTMLElement)` |
| `pause` | function | 168 | `async function pause()` |

### `packages/rex/src/client/agent/invoke.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Controls` | function | 65 | `function Controls()` |
| `AgentSlot` | function | 91 | `function AgentSlot({ page: pageId }: OutcomeSlotProps)` |
| `Mounted` | interface | 102 | `interface Mounted` |
| `mount` | function | 108 | `function mount(path: string): Mounted` |
| `audited` | function | 136 | `async function audited(ledger: Ledger): Promise<string[]>` |
| `press` | function | 140 | `async function press(init: KeyboardEventInit & { key: string })` |
| `openPalette` | function | 146 | `async function openPalette(): Promise<HTMLElement>` |
| `search` | function | 151 | `async function search(palette: HTMLElement, value: string)` |
| `enter` | function | 157 | `async function enter(palette: HTMLElement)` |
| `waitOutcome` | function | 163 | `async function waitOutcome(store: OutcomeStore, actionId: string, ok: boolean)` |
| `confirmDialog` | function | 167 | `async function confirmDialog(): Promise<HTMLElement>` |
| `click` | function | 171 | `async function click(element: HTMLElement)` |

### `packages/rex/src/client/agent/outcome.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Controls` | function | 49 | `function Controls()` |
| `mount` | function | 77 | `function mount(path: string)` |
| `tree` | constant | 90 | `const tree = (` |
| `region` | function | 103 | `function region(): HTMLElement` |
| `click` | function | 107 | `async function click(name: string)` |
| `runAction` | function | 113 | `async function runAction(name: string, actionId: string)` |

### `packages/rex/src/client/agent/sidecar.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Loading` | function | 103 | `function Loading()` |
| `RecoverableError` | function | 107 | `function RecoverableError()` |
| `Slot` | function | 128 | `function Slot({ page: pageId }: OutcomeSlotProps)` |
| `DoubleSlot` | function | 137 | `function DoubleSlot({ page: pageId }: OutcomeSlotProps)` |
| `Mounted` | interface | 147 | `interface Mounted` |
| `mount` | function | 153 | `function mount(path: string, slot = Slot): Mounted` |
| `sidecar` | function | 185 | `function sidecar(): SidecarPayload` |
| `sidecarElements` | function | 193 | `function sidecarElements(): NodeListOf<Element>` |

### `packages/rex/src/client/app.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Server` | interface | 69 | `interface Server` |
| `server` | function | 74 | `function server(body: unknown = manifest, headers: Record<string, string> = {}): Server` |
| `Probe` | function | 97 | `function Probe()` |
| `Outside` | function | 245 | `function Outside()` |

### `packages/rex/src/client/layout.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `silenced` | function | 19 | `function silenced(run: () => void)` |
| `typeOnly` | function | 100 | `function typeOnly()` |

### `packages/rex/src/client/nav.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `DraftProbe` | function | 55 | `function DraftProbe()` |
| `Screen` | function | 69 | `function Screen({ resolution }: { readonly resolution: RouteResolution })` |
| `mount` | function | 111 | `function mount(path: string, subject: Actor = owner)` |
| `text_` | function | 124 | `function text_(id: string): string \| null` |
| `click` | function | 128 | `async function click(name: string)` |
| `account` | constant | 281 | `const account = (path as string).split("/")[2] as string;` |
| `typeOnly` | function | 289 | `function typeOnly(nav: Nav)` |

### `packages/rex/src/client/overlay.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Trigger` | function | 64 | `function Trigger({ target, label }: { readonly target: OverlayComponent; readonly label: string })` |
| `Slot` | function | 99 | `function Slot({ page: pageId }: OutcomeSlotProps)` |
| `mount` | function | 108 | `function mount(path: string)` |
| `sidecarOverlays` | function | 124 | `function sidecarOverlays(): SidecarPayload["overlays"]` |
| `dialog` | function | 130 | `function dialog(id: string): HTMLElement \| null` |
| `openWith` | function | 134 | `async function openWith(label: string): Promise<HTMLElement>` |
| `key` | function | 143 | `async function key(target: Element, init: KeyboardEventInit & { key: string })` |

### `packages/rex/src/client/page.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `StatusError` | class | 60 | `class StatusError extends Error` |
| `constructor` | constructor | 63 | `constructor(message: string, status: number)` |
| `Responder` | type | 69 | `type Responder = () => unknown;` |
| `MountOptions` | interface | 71 | `interface MountOptions` |
| `mount` | function | 79 | `function mount(path: string, options: MountOptions = {})` |
| `silenced` | function | 127 | `function silenced(run: () => void)` |

### `packages/rex/src/client/runtime.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Mounted` | interface | 97 | `interface Mounted` |
| `mount` | function | 102 | `function mount(path: string): Mounted` |
| `sidecars` | function | 132 | `function sidecars(): Element[]` |
| `sidecarPayload` | function | 138 | `function sidecarPayload(): SidecarPayload` |
| `ready` | function | 146 | `async function ready(pageId: string): Promise<void>` |
| `click` | function | 150 | `async function click(element: Element)` |

### `packages/rex/src/client/shell.test.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `mount` | function | 46 | `function mount(path: string, subject: Actor = viewer, modules: readonly PageModuleSet[] = pages)` |
| `heading` | function | 77 | `function heading(): string \| null` |
| `navLinks` | function | 81 | `function navLinks()` |
| `click` | function | 85 | `async function click(element: HTMLElement)` |

### `packages/rex/src/client/states.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `withData` | constant | 21 | `const withData = (status: DataStateQuery["status"], error: unknown = null): DataStateQuery => (` |
| `failed` | constant | 40 | `const failed = (error: unknown): DataStateQuery => (` |
| `Fragment` | interface | 47 | `interface Fragment` |
| `inputOf` | function | 69 | `function inputOf(...fragments: Fragment[]): DataStateInput` |
| `renderState` | function | 173 | `function renderState(data: unknown, options: UseDataStateOptions = {}): string` |
| `Probe` | function | 176 | `function Probe()` |

### `packages/rex/src/core/action.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `fieldOf` | function | 42 | `function fieldOf(run: () => unknown): string` |

### `packages/rex/src/core/entity.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `declarationError` | function | 47 | `function declarationError(run: () => unknown): RexDeclarationError` |
| `Account` | type | 101 | `type Account = InferEntity<typeof account>;` |
| `Token` | type | 110 | `type Token = InferEntity<typeof token>;` |
| `label` | constant | 129 | `const label = () => "x";` |

### `packages/rex/src/core/flow.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `makePayout` | function | 45 | `function makePayout(journal: Journal)` |
| `makeDirect` | function | 62 | `function makeDirect(journal: Journal)` |

### `packages/rex/src/core/page.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `fieldOf` | function | 70 | `function fieldOf(run: () => unknown): string` |
| `Full` | type | 353 | `type Full = StatesModule;` |
| `Minimal` | type | 364 | `type Minimal = PageStatesModule<typeof minimal>;` |
| `SendStates` | type | 376 | `type SendStates = PageStatesModule<typeof sendPage>;` |

### `packages/rex/src/core/policy.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `no` | constant | 40 | `const no = (reason: string) => ({ allowed: false, reason });` |

### `packages/rex/src/core/protocol.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Mounted` | interface | 57 | `interface Mounted` |
| `Probe` | function | 62 | `function Probe({ handle }: { readonly handle: { current: ActHandle<typeof send> \| null } })` |
| `mount` | function | 74 | `function mount(fetch: RexFetch, provided: Actor \| null): Mounted` |
| `current` | function | 100 | `function current(mounted: Mounted): ActHandle<typeof send>` |
| `toRequest` | function | 106 | `function toRequest(input: Request \| string \| URL, init?: RequestInit): Request` |

### `packages/rex/src/core/registry.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `makeAction` | constant | 8 | `const makeAction = (name: string) =>` |

### `packages/rex/src/core/store.conformance.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `ConformanceEntity` | type | 21 | `export type ConformanceEntity = typeof conformanceEntity;` |
| `ConformanceRecord` | type | 22 | `export type ConformanceRecord = InferEntity<ConformanceEntity>;` |
| `MakeStore` | type | 24 | `export type MakeStore = (` |

### `packages/rex/src/manifest/build.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `snapshotOf` | function | 105 | `function snapshotOf(order: readonly (typeof declarations)[number][])` |
| `actionItems` | constant | 364 | `const actionItems = (properties.actions?.items ?? {}) as Record<string, unknown>;` |
| `via` | constant | 365 | `const via = (actionItems.properties as Record<string, Record<string, unknown>>).via;` |

### `packages/rex/src/manifest/scan.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `copyApp` | function | 40 | `function copyApp(): string` |
| `read` | constant | 53 | `const read = (root: string, file: string) => readFileSync(path.join(root, file), "utf8");` |

### `packages/rex/src/server/audit.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `sha256` | function | 15 | `function sha256(text: string): string` |
| `entry` | function | 19 | `async function entry(overrides: Partial<AuditEntry> = {}): Promise<AuditEntry>` |
| `ids` | constant | 173 | `const ids = (records: { id: string }[]) => records.map((record) => record.id);` |

### `packages/rex/src/server/router.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `context` | function | 92 | `function context(subject: Actor, confirm?: string): RexContext` |
| `rejection` | function | 98 | `async function rejection(promise: Promise<unknown>): Promise<ORPCError<string, unknown>>` |
| `build` | function | 110 | `function build(ledger: Ledger, confirmTtlMs?: number)` |
| `toggle` | constant | 143 | `const toggle = () => call(typed["toggle-dust"], { hide: true }, { context: context(alice) });` |
| `transferNow` | constant | 144 | `const transferNow = () => call(typed.send, transfer, { context: context(alice) });` |

### `packages/rex/src/server/server.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `resolveActor` | function | 93 | `function resolveActor(request: Request): Actor` |
| `TestClientContext` | interface | 98 | `interface TestClientContext` |
| `clientFor` | function | 102 | `function clientFor(` |
| `rejection` | function | 119 | `async function rejection(promise: Promise<unknown>): Promise<ORPCError<string, unknown>>` |
| `flows` | constant | 333 | `const flows = (as: string): RouterClient<FlowRouter> =>` |

### `packages/rex/src/store/drizzle.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `memoryDb` | function | 14 | `function memoryDb()` |

### `packages/rex/src/vite/vite.test.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `fixture` | constant | 29 | `const fixture = (path: string) => normalizePath(join(fixtureRoot, path));` |
| `loadBundle` | constant | 226 | `const loadBundle = async () =>` |

## Test fixtures

Types declared in the fixture apps that the checker and client tests load.

### `packages/rex/src/check/fixtures/boundaries/fail/app/entities/token.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Token` | type | 13 | `export type Token = InferEntity<typeof token>;` |

### `packages/rex/src/check/fixtures/boundaries/fail/app/pages/portfolio/regions/holdings/parts/HoldingRow.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `HoldingRowProps` | interface | 1 | `interface HoldingRowProps` |

### `packages/rex/src/check/fixtures/boundaries/pass/app/entities/token.ts`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Token` | type | 13 | `export type Token = InferEntity<typeof token>;` |

### `packages/rex/src/check/fixtures/boundaries/pass/app/pages/send/overlays/TokenSheet.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `TokenSheetProps` | interface | 5 | `interface TokenSheetProps` |

### `packages/rex/src/check/fixtures/boundaries/pass/app/pages/send/regions/form/parts/AmountField.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `AmountFieldProps` | interface | 5 | `interface AmountFieldProps` |

### `packages/rex/src/check/fixtures/boundaries/pass/app/pages/send/regions/form/parts/TokenChip.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `TokenChipProps` | interface | 1 | `interface TokenChipProps` |

### `packages/rex/src/check/fixtures/parity/pass/app/pages/send/regions/form/parts/TokenField.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `TokenFieldProps` | interface | 1 | `interface TokenFieldProps` |

### `packages/rex/src/check/fixtures/quality/pass/app/pages/home/regions/list/parts/HoldingRow.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `HoldingRowProps` | interface | 1 | `export interface HoldingRowProps` |

### `packages/rex/src/client/fixtures/page-basic/regions/main/parts/Hello.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `HelloProps` | interface | 3 | `export interface HelloProps` |

### `packages/rex/src/client/fixtures/page-basic/regions/main/region.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `BasicParams` | interface | 6 | `interface BasicParams` |

### `packages/rex/src/client/fixtures/page-basic/states.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Props` | type | 3 | `type Props = StateProps<Readonly<Record<string, unknown>>>;` |

### `packages/rex/src/client/fixtures/page-second/states.tsx`

| Symbol | Kind | Line | Declaration |
| --- | --- | --- | --- |
| `Props` | type | 3 | `type Props = StateProps<Readonly<Record<string, unknown>>>;` |
