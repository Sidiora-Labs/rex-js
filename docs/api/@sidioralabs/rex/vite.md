[@sidioralabs/rex API](../../README.md) / @sidioralabs/rex/vite

# @sidioralabs/rex/vite

## Classes

<a id="rexappscanerror"></a>

### RexAppScanError

#### Extends

- `Error`

#### Constructors

<a id="constructor"></a>

##### Constructor

```ts
new RexAppScanError(message): RexAppScanError;
```

###### Parameters

###### message

`string`

###### Returns

[`RexAppScanError`](#rexappscanerror)

###### Overrides

```ts
Error.constructor
```

## Interfaces

<a id="appmoduleoptions"></a>

### AppModuleOptions

#### Properties

<a id="core"></a>

##### core

```ts
readonly core: string;
```

<a id="name"></a>

##### name

```ts
readonly name: string;
```

***

<a id="appscan"></a>

### AppScan

#### Properties

<a id="actions"></a>

##### actions

```ts
readonly actions: readonly string[];
```

<a id="appdir"></a>

##### appDir

```ts
readonly appDir: string;
```

<a id="entities"></a>

##### entities

```ts
readonly entities: readonly string[];
```

<a id="flows"></a>

##### flows

```ts
readonly flows: readonly string[];
```

<a id="pages"></a>

##### pages

```ts
readonly pages: readonly ScannedPage[];
```

<a id="policies"></a>

##### policies

```ts
readonly policies: readonly string[];
```

<a id="root"></a>

##### root

```ts
readonly root: string;
```

***

<a id="boundarylog"></a>

### BoundaryLog

#### Properties

<a id="code"></a>

##### code

```ts
readonly code: BoundaryErrorCode;
```

<a id="id"></a>

##### id?

```ts
readonly optional id?: string;
```

<a id="message"></a>

##### message

```ts
readonly message: string;
```

<a id="url"></a>

##### url

```ts
readonly url: string;
```

***

<a id="entrymoduleoptions"></a>

### EntryModuleOptions

#### Properties

<a id="apiorigin"></a>

##### apiOrigin?

```ts
readonly optional apiOrigin?: string | null;
```

<a id="client"></a>

##### client

```ts
readonly client: string;
```

<a id="rootelement"></a>

##### rootElement?

```ts
readonly optional rootElement?: string;
```

***

<a id="resolvecontext"></a>

### ResolveContext

#### Methods

<a id="resolve"></a>

##### resolve()

```ts
resolve(
   source, 
   importer?, 
   options?
): Promise<
  | {
  external?: boolean | "absolute" | "relative";
  id: string;
}
| null>;
```

###### Parameters

###### source

`string`

###### importer?

`string`

###### options?

###### skipSelf?

`boolean`

###### Returns

`Promise`\<
  \| \{
  `external?`: `boolean` \| `"absolute"` \| `"relative"`;
  `id`: `string`;
\}
  \| `null`\>

***

<a id="rexappbundle"></a>

### RexAppBundle

#### Properties

<a id="actions-1"></a>

##### actions

```ts
readonly actions: readonly AnyAction[];
```

<a id="entities-1"></a>

##### entities

```ts
readonly entities: readonly AnyEntity[];
```

<a id="flows-1"></a>

##### flows

```ts
readonly flows: readonly AnyFlow[];
```

<a id="manifest"></a>

##### manifest

```ts
readonly manifest: Manifest;
```

<a id="name-1"></a>

##### name

```ts
readonly name: string;
```

<a id="pages-1"></a>

##### pages

```ts
readonly pages: readonly RexPageModule[];
```

<a id="policies-1"></a>

##### policies

```ts
readonly policies: readonly AnyPolicy[];
```

<a id="registry"></a>

##### registry

```ts
readonly registry: RegistrySnapshot;
```

***

<a id="rexfetchapp"></a>

### RexFetchApp

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

<a id="rexhmrnotice"></a>

### RexHmrNotice

#### Properties

<a id="code-1"></a>

##### code

```ts
readonly code: "REX320";
```

<a id="file"></a>

##### file

```ts
readonly file: string;
```

<a id="message-1"></a>

##### message

```ts
readonly message: string;
```

<a id="page"></a>

##### page

```ts
readonly page: string;
```

***

<a id="rexhookcontext"></a>

### RexHookContext

#### Properties

<a id="appdir-1"></a>

##### appDir

```ts
readonly appDir: string;
```

<a id="options"></a>

##### options

```ts
readonly options: RexPluginOptions;
```

<a id="paths"></a>

##### paths

```ts
readonly paths: RuntimePaths;
```

<a id="state"></a>

##### state

```ts
readonly state: RexHookState;
```

#### Methods

<a id="apppath"></a>

##### appPath()

```ts
appPath(): string;
```

###### Returns

`string`

***

<a id="rexhookstate"></a>

### RexHookState

#### Properties

<a id="name-2"></a>

##### name

```ts
name: string;
```

<a id="root-1"></a>

##### root

```ts
root: string;
```

***

<a id="rexpagemodule"></a>

### RexPageModule

#### Properties

<a id="chunk"></a>

##### chunk

```ts
readonly chunk: string;
```

<a id="id-1"></a>

##### id

```ts
readonly id: string;
```

<a id="page-1"></a>

##### page

```ts
readonly page: AnyPage;
```

#### Methods

<a id="load"></a>

##### load()

```ts
load(): Promise<RexLoadedPageModules>;
```

###### Returns

`Promise`\<`RexLoadedPageModules`\>

***

<a id="rexpluginoptions"></a>

### RexPluginOptions

#### Properties

<a id="apiorigin-1"></a>

##### apiOrigin?

```ts
readonly optional apiOrigin?: string | null;
```

<a id="appdir-2"></a>

##### appDir?

```ts
readonly optional appDir?: string;
```

<a id="compiler"></a>

##### compiler?

```ts
readonly optional compiler?: boolean;
```

<a id="devtools"></a>

##### devtools?

```ts
readonly optional devtools?: boolean;
```

<a id="name-3"></a>

##### name?

```ts
readonly optional name?: string;
```

<a id="secretnames"></a>

##### secretNames?

```ts
readonly optional secretNames?: readonly string[];
```

<a id="server"></a>

##### server?

```ts
readonly optional server?: RexServerSource;
```

<a id="tailwind"></a>

##### tailwind?

```ts
readonly optional tailwind?: boolean;
```

<a id="ui"></a>

##### ui?

```ts
readonly optional ui?: "none" | "designx";
```

***

<a id="runtimepaths"></a>

### RuntimePaths

#### Properties

<a id="client-1"></a>

##### client

```ts
readonly client: string;
```

<a id="core-1"></a>

##### core

```ts
readonly core: string;
```

***

<a id="scannednamedfile"></a>

### ScannedNamedFile

#### Properties

<a id="file-1"></a>

##### file

```ts
readonly file: string;
```

<a id="name-4"></a>

##### name

```ts
readonly name: string;
```

***

<a id="scannedpage"></a>

### ScannedPage

#### Properties

<a id="dir"></a>

##### dir

```ts
readonly dir: string;
```

<a id="id-2"></a>

##### id

```ts
readonly id: string;
```

<a id="overlays"></a>

##### overlays

```ts
readonly overlays: readonly ScannedNamedFile[];
```

<a id="page-2"></a>

##### page

```ts
readonly page: string;
```

<a id="regions"></a>

##### regions

```ts
readonly regions: readonly ScannedNamedFile[];
```

<a id="states"></a>

##### states

```ts
readonly states: string;
```

<a id="view"></a>

##### view

```ts
readonly view: string;
```

## Type Aliases

<a id="boundaryerrorcode"></a>

### BoundaryErrorCode

```ts
type BoundaryErrorCode = 
  | typeof BOUNDARY_IMPORT_CODE
  | typeof SECRET_LEAK_CODE;
```

***

<a id="boundaryviolation"></a>

### BoundaryViolation

```ts
type BoundaryViolation = "rex/server" | "app/server" | "server-only";
```

***

<a id="fixstacktrace"></a>

### FixStacktrace

```ts
type FixStacktrace = (error) => void;
```

#### Parameters

##### error

`Error`

#### Returns

`void`

***

<a id="overlayerror"></a>

### OverlayError

```ts
type OverlayError = ErrorPayload["err"];
```

***

<a id="rexhook"></a>

### RexHook

```ts
type RexHook = (context) => Plugin | readonly Plugin[];
```

#### Parameters

##### context

[`RexHookContext`](#rexhookcontext)

#### Returns

`Plugin` \| readonly `Plugin`[]

***

<a id="rexserversource"></a>

### RexServerSource

```ts
type RexServerSource = 
  | RexFetchApp
  | ((vite) => 
  | RexFetchApp
  | Promise<RexFetchApp>);
```

## Variables

<a id="allowed_env_names"></a>

### ALLOWED\_ENV\_NAMES

```ts
const ALLOWED_ENV_NAMES: readonly ["NODE_ENV"];
```

***

<a id="api_prefix"></a>

### API\_PREFIX

```ts
const API_PREFIX: "/rex" = "/rex";
```

***

<a id="app_module_id"></a>

### APP\_MODULE\_ID

```ts
const APP_MODULE_ID: "rex:app" = "rex:app";
```

***

<a id="app_server_dir"></a>

### APP\_SERVER\_DIR

```ts
const APP_SERVER_DIR: "server" = "server";
```

***

<a id="boundary_import_code"></a>

### BOUNDARY\_IMPORT\_CODE

```ts
const BOUNDARY_IMPORT_CODE: "REX440" = "REX440";
```

***

<a id="client_specifier"></a>

### CLIENT\_SPECIFIER

```ts
const CLIENT_SPECIFIER: "@sidioralabs/rex/client" = "@sidioralabs/rex/client";
```

***

<a id="core_specifier"></a>

### CORE\_SPECIFIER

```ts
const CORE_SPECIFIER: "@sidioralabs/rex" = "@sidioralabs/rex";
```

***

<a id="csp_nonce_meta_property"></a>

### CSP\_NONCE\_META\_PROPERTY

```ts
const CSP_NONCE_META_PROPERTY: "csp-nonce" = "csp-nonce";
```

***

<a id="declaration_folders"></a>

### DECLARATION\_FOLDERS

```ts
const DECLARATION_FOLDERS: object;
```

#### Type Declaration

<a id="action"></a>

##### action

```ts
readonly action: "actions" = "actions";
```

<a id="entity"></a>

##### entity

```ts
readonly entity: "entities" = "entities";
```

<a id="flow"></a>

##### flow

```ts
readonly flow: "flows" = "flows";
```

<a id="policy"></a>

##### policy

```ts
readonly policy: "policies" = "policies";
```

***

<a id="default_app_dir"></a>

### DEFAULT\_APP\_DIR

```ts
const DEFAULT_APP_DIR: "app" = "app";
```

***

<a id="density_header"></a>

### DENSITY\_HEADER

```ts
const DENSITY_HEADER: "x-rex-density" = "x-rex-density";
```

***

<a id="density_query"></a>

### DENSITY\_QUERY

```ts
const DENSITY_QUERY: "density" = "density";
```

***

<a id="density_values"></a>

### DENSITY\_VALUES

```ts
const DENSITY_VALUES: readonly ["default", "agent"];
```

***

<a id="entry_module_id"></a>

### ENTRY\_MODULE\_ID

```ts
const ENTRY_MODULE_ID: "/@rex/entry" = "/@rex/entry";
```

***

<a id="overlay_plugin"></a>

### OVERLAY\_PLUGIN

```ts
const OVERLAY_PLUGIN: "rex" = "rex";
```

***

<a id="page_declaration_file"></a>

### PAGE\_DECLARATION\_FILE

```ts
const PAGE_DECLARATION_FILE: "page.ts" = "page.ts";
```

***

<a id="page_files"></a>

### PAGE\_FILES

```ts
const PAGE_FILES: readonly ["page.ts", "view.tsx", "states.tsx"];
```

***

<a id="page_reload_code"></a>

### PAGE\_RELOAD\_CODE

```ts
const PAGE_RELOAD_CODE: "REX320" = "REX320";
```

***

<a id="public_env_prefix"></a>

### PUBLIC\_ENV\_PREFIX

```ts
const PUBLIC_ENV_PREFIX: "VITE_" = "VITE_";
```

***

<a id="resolved_app_module_id"></a>

### RESOLVED\_APP\_MODULE\_ID

```ts
const RESOLVED_APP_MODULE_ID: "\u0000rex:app" = "\0rex:app";
```

***

<a id="resolved_entry_module_id"></a>

### RESOLVED\_ENTRY\_MODULE\_ID

```ts
const RESOLVED_ENTRY_MODULE_ID: "\u0000rex:entry" = "\0rex:entry";
```

***

<a id="rex_hooks"></a>

### REX\_HOOKS

```ts
const REX_HOOKS: readonly RexHook[];
```

***

<a id="rex_notice_event"></a>

### REX\_NOTICE\_EVENT

```ts
const REX_NOTICE_EVENT: "rex:notice" = "rex:notice";
```

***

<a id="root_element_id"></a>

### ROOT\_ELEMENT\_ID

```ts
const ROOT_ELEMENT_ID: "root" = "root";
```

***

<a id="runtime_stylesheets"></a>

### RUNTIME\_STYLESHEETS

```ts
const RUNTIME_STYLESHEETS: readonly ["tokens.css", "agent/density.css"];
```

***

<a id="secret_leak_code"></a>

### SECRET\_LEAK\_CODE

```ts
const SECRET_LEAK_CODE: "REX441" = "REX441";
```

***

<a id="server_only_handler_message"></a>

### SERVER\_ONLY\_HANDLER\_MESSAGE

```ts
const SERVER_ONLY_HANDLER_MESSAGE: "rex: action handlers run on the server; invoke this action through useAct, ActionForm or the RPC client" = "rex: action handlers run on the server; invoke this action through useAct, ActionForm or the RPC client";
```

***

<a id="server_only_specifier"></a>

### SERVER\_ONLY\_SPECIFIER

```ts
const SERVER_ONLY_SPECIFIER: "@sidioralabs/rex/server-only";
```

***

<a id="server_specifier"></a>

### SERVER\_SPECIFIER

```ts
const SERVER_SPECIFIER: "@sidioralabs/rex/server";
```

## Functions

<a id="applynonce"></a>

### applyNonce()

```ts
function applyNonce(html, nonce): string;
```

#### Parameters

##### html

`string`

##### nonce

`string`

#### Returns

`string`

***

<a id="appmodulehook"></a>

### appModuleHook()

```ts
function appModuleHook(context): Plugin;
```

#### Parameters

##### context

[`RexHookContext`](#rexhookcontext)

#### Returns

`Plugin`

***

<a id="appstackframe"></a>

### appStackFrame()

```ts
function appStackFrame(stack, appPath): RexStackFrame | null;
```

#### Parameters

##### stack

`string` \| `undefined`

##### appPath

`string`

#### Returns

[`RexStackFrame`](../rex.md#rexstackframe) \| `null`

***

<a id="assembleplugins"></a>

### assemblePlugins()

```ts
function assemblePlugins(context, hooks?): Plugin<any>[];
```

#### Parameters

##### context

[`RexHookContext`](#rexhookcontext)

##### hooks?

readonly [`RexHook`](#rexhook)[] = `REX_HOOKS`

#### Returns

`Plugin`\<`any`\>[]

***

<a id="attachoverlayfields"></a>

### attachOverlayFields()

```ts
function attachOverlayFields(error): RexError;
```

#### Parameters

##### error

[`RexError`](../rex.md#rexerror)

#### Returns

[`RexError`](../rex.md#rexerror)

***

<a id="boundaryerror"></a>

### boundaryError()

```ts
function boundaryError(
   code, 
   message, 
   id?
): BoundaryLog;
```

#### Parameters

##### code

[`BoundaryErrorCode`](#boundaryerrorcode)

##### message

`string`

##### id?

`string`

#### Returns

[`BoundaryLog`](#boundarylog)

***

<a id="boundaryhook"></a>

### boundaryHook()

```ts
function boundaryHook(context): Plugin;
```

#### Parameters

##### context

[`RexHookContext`](#rexhookcontext)

#### Returns

`Plugin`

***

<a id="boundaryviolation-1"></a>

### boundaryViolation()

```ts
function boundaryViolation(
   source, 
   importer, 
   appPath, 
   serverOnlyPaths?
): BoundaryViolation | null;
```

#### Parameters

##### source

`string`

##### importer

`string`

##### appPath

`string`

##### serverOnlyPaths?

readonly `string`[] = `[]`

#### Returns

[`BoundaryViolation`](#boundaryviolation) \| `null`

***

<a id="checkappmodules"></a>

### checkAppModules()

```ts
function checkAppModules(
   vite, 
   appPath, 
   specifier?
): Promise<RexError | null>;
```

#### Parameters

##### vite

`ViteDevServer`

##### appPath

`string`

##### specifier?

`string` = `APP_MODULE_ID`

#### Returns

`Promise`\<[`RexError`](../rex.md#rexerror) \| `null`\>

***

<a id="collectenvreferences"></a>

### collectEnvReferences()

```ts
function collectEnvReferences(code, file): string[];
```

#### Parameters

##### code

`string`

##### file

`string`

#### Returns

`string`[]

***

<a id="confighook"></a>

### configHook()

```ts
function configHook(context): Plugin;
```

#### Parameters

##### context

[`RexHookContext`](#rexhookcontext)

#### Returns

`Plugin`

***

<a id="createhookcontext"></a>

### createHookContext()

```ts
function createHookContext(options?): RexHookContext;
```

#### Parameters

##### options?

[`RexPluginOptions`](#rexpluginoptions) = `{}`

#### Returns

[`RexHookContext`](#rexhookcontext)

***

<a id="devserverhook"></a>

### devServerHook()

```ts
function devServerHook(context): Plugin;
```

#### Parameters

##### context

[`RexHookContext`](#rexhookcontext)

#### Returns

`Plugin`

***

<a id="entrymodulehook"></a>

### entryModuleHook()

```ts
function entryModuleHook(context): Plugin;
```

#### Parameters

##### context

[`RexHookContext`](#rexhookcontext)

#### Returns

`Plugin`

***

<a id="findsecretnames"></a>

### findSecretNames()

```ts
function findSecretNames(text, secretNames): string[];
```

#### Parameters

##### text

`string`

##### secretNames

readonly `string`[]

#### Returns

`string`[]

***

<a id="forwarddensity"></a>

### forwardDensity()

```ts
function forwardDensity(request): Request;
```

#### Parameters

##### request

`Request`

#### Returns

`Request`

***

<a id="generateappmodule"></a>

### generateAppModule()

```ts
function generateAppModule(scan, options): string;
```

#### Parameters

##### scan

[`AppScan`](#appscan)

##### options

[`AppModuleOptions`](#appmoduleoptions)

#### Returns

`string`

***

<a id="generateentrymodule"></a>

### generateEntryModule()

```ts
function generateEntryModule(options): string;
```

#### Parameters

##### options

[`EntryModuleOptions`](#entrymoduleoptions)

#### Returns

`string`

***

<a id="hmrhook"></a>

### hmrHook()

```ts
function hmrHook(context): Plugin;
```

#### Parameters

##### context

[`RexHookContext`](#rexhookcontext)

#### Returns

`Plugin`

***

<a id="invalidateappmodule"></a>

### invalidateAppModule()

```ts
function invalidateAppModule(environment, hmrTimestamp?): boolean;
```

#### Parameters

##### environment

`Pick`\<`DevEnvironment`, `"moduleGraph"`\>

##### hmrTimestamp?

`number`

#### Returns

`boolean`

***

<a id="invalidatepage"></a>

### invalidatePage()

```ts
function invalidatePage(
   environment, 
   appPath, 
   pageId, 
   declarations, 
   timestamp
): string[];
```

#### Parameters

##### environment

`Pick`\<`DevEnvironment`, `"moduleGraph"`\>

##### appPath

`string`

##### pageId

`string`

##### declarations

readonly `EnvironmentModuleNode`[]

##### timestamp

`number`

#### Returns

`string`[]

***

<a id="isactionmodule"></a>

### isActionModule()

```ts
function isActionModule(id, appPath): boolean;
```

#### Parameters

##### id

`string`

##### appPath

`string`

#### Returns

`boolean`

***

<a id="isapipath"></a>

### isApiPath()

```ts
function isApiPath(url): boolean;
```

#### Parameters

##### url

`string` \| `undefined`

#### Returns

`boolean`

***

<a id="ispublicenvname"></a>

### isPublicEnvName()

```ts
function isPublicEnvName(name): boolean;
```

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

<a id="locateapperror"></a>

### locateAppError()

```ts
function locateAppError<E>(
   error, 
   appPath, 
   fixStacktrace?
): E;
```

#### Type Parameters

##### E

`E`

#### Parameters

##### error

`E`

##### appPath

`string`

##### fixStacktrace?

[`FixStacktrace`](#fixstacktrace)

#### Returns

`E`

***

<a id="mountserver"></a>

### mountServer()

```ts
function mountServer(vite, source): void;
```

#### Parameters

##### vite

`ViteDevServer`

##### source

[`RexServerSource`](#rexserversource)

#### Returns

`void`

***

<a id="noncehook"></a>

### nonceHook()

```ts
function nonceHook(): Plugin;
```

#### Returns

`Plugin`

***

<a id="noncemetatag"></a>

### nonceMetaTag()

```ts
function nonceMetaTag(nonce): HtmlTagDescriptor;
```

#### Parameters

##### nonce

`string`

#### Returns

`HtmlTagDescriptor`

***

<a id="overlayerror-1"></a>

### overlayError()

```ts
function overlayError(error): object;
```

#### Parameters

##### error

[`RexError`](../rex.md#rexerror)

#### Returns

`object`

***

<a id="overlayhook"></a>

### overlayHook()

```ts
function overlayHook(context): Plugin;
```

#### Parameters

##### context

[`RexHookContext`](#rexhookcontext)

#### Returns

`Plugin`

***

<a id="pageidofdeclaration"></a>

### pageIdOfDeclaration()

```ts
function pageIdOfDeclaration(file, appPath): string | null;
```

#### Parameters

##### file

`string`

##### appPath

`string`

#### Returns

`string` \| `null`

***

<a id="pagereloadnotice"></a>

### pageReloadNotice()

```ts
function pageReloadNotice(pageId, file): RexHmrNotice;
```

#### Parameters

##### pageId

`string`

##### file

`string`

#### Returns

[`RexHmrNotice`](#rexhmrnotice)

***

<a id="reacthook"></a>

### reactHook()

```ts
function reactHook(): readonly Plugin<any>[];
```

#### Returns

readonly `Plugin`\<`any`\>[]

***

<a id="reportapperror"></a>

### reportAppError()

```ts
function reportAppError(
   vite, 
   error, 
   appPath
): boolean;
```

#### Parameters

##### vite

`ViteDevServer`

##### error

`unknown`

##### appPath

`string`

#### Returns

`boolean`

***

<a id="resolveruntimeentry"></a>

### resolveRuntimeEntry()

```ts
function resolveRuntimeEntry(
   context, 
   root, 
   specifier, 
   fallback
): Promise<string>;
```

#### Parameters

##### context

[`ResolveContext`](#resolvecontext)

##### root

`string`

##### specifier

`string`

##### fallback

`string`

#### Returns

`Promise`\<`string`\>

***

<a id="rex"></a>

### rex()

```ts
function rex(options?): Plugin<any>[];
```

#### Parameters

##### options?

[`RexPluginOptions`](#rexpluginoptions) = `{}`

#### Returns

`Plugin`\<`any`\>[]

***

<a id="runtimepaths-1"></a>

### runtimePaths()

```ts
function runtimePaths(from?): RuntimePaths;
```

#### Parameters

##### from?

`string` = `...`

#### Returns

[`RuntimePaths`](#runtimepaths)

***

<a id="runtimestylesheets"></a>

### runtimeStylesheets()

```ts
function runtimeStylesheets(client): readonly string[];
```

#### Parameters

##### client

`string`

#### Returns

readonly `string`[]

***

<a id="scanapp"></a>

### scanApp()

```ts
function scanApp(root, appDir?): AppScan;
```

#### Parameters

##### root

`string`

##### appDir?

`string` = `DEFAULT_APP_DIR`

#### Returns

[`AppScan`](#appscan)

***

<a id="serveronlymodulepaths"></a>

### serverOnlyModulePaths()

```ts
function serverOnlyModulePaths(core): string[];
```

#### Parameters

##### core

`string`

#### Returns

`string`[]

***

<a id="stripactionhandlers"></a>

### stripActionHandlers()

```ts
function stripActionHandlers(code, file): string | null;
```

#### Parameters

##### code

`string`

##### file

`string`

#### Returns

`string` \| `null`

***

<a id="watchapp"></a>

### watchApp()

```ts
function watchApp(vite, appPath): void;
```

#### Parameters

##### vite

`ViteDevServer`

##### appPath

`string`

#### Returns

`void`

## References

<a id="default"></a>

### default

Renames and re-exports [rex](#rex)
