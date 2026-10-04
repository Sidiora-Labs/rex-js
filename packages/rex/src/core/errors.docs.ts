import { formatRexError, type RexError, type RexErrorCode } from "./errors.ts";

export type RexErrorArea = "config" | "declaration" | "runtime" | "server" | "checker" | "cli";

export interface RexErrorAreaInfo {
  readonly prefix: string;
  readonly title: string;
}

export const REX_ERROR_AREAS = {
  config: { prefix: "REX1", title: "Configuration" },
  declaration: { prefix: "REX2", title: "Declarations" },
  runtime: { prefix: "REX3", title: "Runtime" },
  server: { prefix: "REX4", title: "Server and build" },
  checker: { prefix: "REX5", title: "Checker and manifest" },
  cli: { prefix: "REX6", title: "CLI" },
} as const satisfies Readonly<Record<RexErrorArea, RexErrorAreaInfo>>;

export interface RexErrorDocsEntry {
  readonly hint: string;
}

export const REX_ERROR_DOCS = {
  REX100: {
    hint: "Create rex.config.ts at the app root that default-exports defineConfig({ app }) with app imported from rex:app.",
  },
  REX101: {
    hint: "Wrap it: export default defineConfig({ app, server: (app) => createRexServer({ ... }) }); rex migrate applies this change.",
  },
  REX102: { hint: "Default-export defineConfig({ app }) from rex.config.ts." },
  REX110: {
    hint: "Remove the field or correct its spelling; the accepted fields are listed in the config reference.",
  },
  REX111: { hint: 'Set app to the bundle imported from rex:app: import app from "rex:app".' },
  REX112: {
    hint: "Set server to a function from the app bundle to a fetch app, such as (app) => createRexServer({ registry: app.registry, ledger, actor }).",
  },
  REX113: { hint: 'Set render to { default: "ssr" | "csr" | "ssg" | "static" }.' },
  REX114: {
    hint: "Set budgets.core, budgets.client and budgets.page to positive numbers of gzipped kilobytes.",
  },
  REX115: {
    hint: 'Set security to { csp: "strict" | "report" | "off", origins: ["https://example.com"], headers?: { name: value }, secretNames?: ["NAME"], forwarded?: true or false }.',
  },
  REX116: {
    hint: 'Set i18n to { locales: ["en", ...], default: one of the locales, routing: "prefix" | "none", direction?: "ltr" | "rtl" or { locale: "ltr" | "rtl" } }.',
  },
  REX117: {
    hint: "Set images to { sizes: positive integer widths, formats: a list of avif, webp, jpeg and png, remote: a list of http(s) origins or URL prefixes ending with / }.",
  },
  REX118: {
    hint: "Set fonts to a list of { family, src, weight?, style?, preload?, variable?: a CSS custom property such as --font-sans, fallback?: a local font such as Arial } with src a URL or a path starting with /.",
  },
  REX119: {
    hint: "Set telemetry to { tracer?: an OpenTelemetry tracer, logger?: { debug, info, warn, error } }.",
  },
  REX120: { hint: 'Set ui to "designx" or "none".' },
  REX121: {
    hint: "Set client to { apiOrigin?: an http(s) origin such as https://api.example.com }.",
  },
  REX122: {
    hint: 'Set compiler, devtools and tailwind to true or false, and prefetch to "hover", "viewport" or "none".',
  },
  REX123: {
    hint: "Set check to { tokens?: { colors?, spacing?, classes? } } with each allow list a list of strings.",
  },
  REX124: {
    hint: 'Set site to { origin?: an http(s) origin such as https://example.com, name?, description?, image?: a path starting with / or an http(s) URL, titleTemplate?: a string holding {title} once such as "{title} | Docs" }.',
  },
  REX125: {
    hint: "Set env to { client?: { VITE_NAME: schema }, server?: { NAME: schema } } written with the rex/schema field helpers; client keys start with VITE_, server keys never do and no key is in both.",
  },
  REX126: {
    hint: "Set redirects to a list of { source: a route such as /old/:slug, destination: a route using only the source params or an http(s) URL, status?: 301, 302, 307 or 308 } with each source listed once.",
  },
  REX127: {
    hint: 'Set deploy to { host: "node" | "bun" | "deno" | "docker" | "deno-deploy" | "cloudflare" | "vercel" | "netlify" | "github-pages" | "static", runtime?: "node" | "edge" (vercel only) }.',
  },
  REX200: {
    hint: 'Set render to "ssr", "csr", "ssg" or "static", or leave it out to use the app default.',
  },
  REX201: {
    hint: 'Set revalidate to a positive whole number of seconds on a page with render "ssg", or remove it.',
  },
  REX202: {
    hint: 'Set paths to a function returning the params of every page to prerender, or to { action: a read action, map: (output) => params[] }, on a page with render "ssg" or "static" and route params.',
  },
  REX203: {
    hint: "Map each camelCase loader name to a read action or to { action: readAction, input: (params) => input }.",
  },
  REX204: { hint: "Set cache to { staleTime: milliseconds } with a whole number of zero or more." },
  REX205: { hint: 'Set transition to "view" or "none".' },
  REX206: {
    hint: "Set chrome.components to { Button?, Sheet?, PaletteItem?, Outcome? } with each value a component.",
  },
  REX207: {
    hint: "Set form to { redirect?: a path starting with /, confirmTitle?: a non-empty string }.",
  },
  REX208: {
    hint: "Set jsonSchema to { input?: JSON Schema object, output?: JSON Schema object }.",
  },
  REX209: {
    hint: "Register the loader's read action in app/actions so the manifest and the router know it.",
  },
  REX210: {
    hint: "Use a zod schema that JSON Schema can describe, or declare jsonSchema explicitly on the declaration.",
  },
  REX211: {
    hint: "Fix the named field of the entity(name, { fields, key?, label? }) declaration; field names are camelCase and every field is a Standard Schema such as a Rex field helper.",
  },
  REX212: {
    hint: "Fix the named field of the action(name, { label, effect, input, output, policy, handler, ... }) declaration as described in the primitives reference.",
  },
  REX213: {
    hint: "Fix the named field of the page(name, { route, chrome, regions, overlays, actions, ... }) declaration in app/pages/<page>/page.ts.",
  },
  REX214: {
    hint: "Fix the named field of the policy(name, { permissions, grants }) declaration; grants may only name declared permissions.",
  },
  REX215: {
    hint: "Build predicates with can(permission), requires({ unlocked?, account?, custody?, permissions? }), allOf(...) and anyOf(...) with at least one condition each.",
  },
  REX216: {
    hint: "Fix the named field of the flow(name, { journal, input, steps }) declaration; each step is { action, input? } or an approval gate.",
  },
  REX217: {
    hint: "Give each entity, action, page, policy and flow a unique id, or register the same declaration object only once.",
  },
  REX218: {
    hint: "Use a name that starts with a lowercase letter and contains only lowercase letters, digits, dot and dash; component names are PascalCase.",
  },
  REX219: {
    hint: "Write the shortcut as ordered modifiers mod, shift, alt joined by + and one key, such as mod+shift+s; mod+k and escape are reserved by Rex.",
  },
  REX220: {
    hint: "Write the route as / or /segment/:param with lowercase static segments, camelCase params, no repeated param and no trailing slash.",
  },
  REX221: { hint: "List each value once in enumOf([...])." },
  REX222: { hint: "Register the action in app/actions or remove it from the page actions list." },
  REX223: { hint: "Point recovery and chrome.back at the id of a registered page." },
  REX224: {
    hint: "Register only values returned by entity(), action(), page(), policy() and flow().",
  },
  REX225: {
    hint: "Set chrome.description to a non-empty string, chrome.image to a path starting with / or an http(s) URL, chrome.frame to a camelCase export of the frames map, chrome.order to a whole number and chrome.icon to a kebab-case icon name; {param} placeholders in title and description name declared params and chrome.back never forms a cycle.",
  },
  REX226: {
    hint: 'Set islands to { region: "load" | "idle" | "visible" | "never" } naming only regions the page declares, and keep at least one hydrated region on a page whose actions have shortcuts.',
  },
  REX227: {
    hint: 'Set http to { method: "GET" | "POST", path: a path outside /rex such as /tokens.json, contentType?, csrf?: false on POST only }; GET needs a read action and no two endpoints or page routes share a path.',
  },
  REX228: {
    hint: 'Set cache to { maxAge: a positive whole number of seconds, scope?: "shared" | "actor" | "locale" } on a read action only.',
  },
  REX229: {
    hint: "Set optimistic to { name: (current, input) => next } on a mutating action, keying each update by a name its invalidates lists and that names a loader or a read action.",
  },
  REX230: {
    hint: 'Declare the not-found page as page("not-found", { route: "/404", chrome: { nav: false } }), keep /404 for it alone, and set fallback to "render" or "not-found" only on a page with paths.',
  },
  REX300: {
    hint: "Validate the schema with validateStandard (async) or use a schema whose ~standard.validate returns synchronously.",
  },
  REX301: {
    hint: "Look up a declaration that is registered in the app; rex manifest lists every registered id.",
  },
  REX302: { hint: "Pass a non-empty string for the flow id and the instance id." },
  REX303: {
    hint: "Start the flow with runFlow before recording entries or deciding on its gates.",
  },
  REX304: {
    hint: "Use a fresh instance id for each flow; an instance id is bound to the flow that opened it.",
  },
  REX305: { hint: "Filter a store list only by fields declared on its entity." },
  REX306: {
    hint: "Render Rex components and call Rex hooks inside the app returned by createRexApp and, for page hooks, inside the active page; the shell sets up every provider the message names.",
  },
  REX307: {
    hint: "Declare the region, overlay, loader or action in the page's page.ts with the same options, or use a name the page declares.",
  },
  REX308: {
    hint: "Register the declaration in the app and rebuild the manifest (rex manifest, rex build or a rex dev restart) so the client, the manifest and the server router list the same pages and actions.",
  },
  REX309: {
    hint: "Run the client against a createRexServer of the same build; the message names the request and what came back, such as an output the action's output schema rejects.",
  },
  REX310: {
    hint: "Render the same markup on the server and the client: read time, randomness and browser-only values in effects, not during render.",
  },
  REX311: {
    hint: "Serve the app from createRexServer so GET /rex/manifest answers the manifest and the actor header, or pass createRexApp a manifest that matches the registry.",
  },
  REX312: {
    hint: "Render server pages with createRexRenderer, which writes exactly one application/rex+data script, and do not edit or duplicate that script.",
  },
  REX313: {
    hint: "Give each page folder a view.tsx with a default export, a states.tsx with the declared state exports and one region.tsx and overlay module per declaration, and pass the rex:app bundle with every page to the entry.",
  },
  REX314: {
    hint: "Pass the props the component documents; the message names the component, the prop and the accepted values.",
  },
  REX315: {
    hint: "Declare each store once with a unique id, an initial JSON value and a boolean expose, and update it with a function of the current value.",
  },
  REX316: {
    hint: "List the locales in i18n.locales with i18n.default among them, keep app/locales/<locale>.json a flat map of string messages under keys without spaces, and register them with registerI18n.",
  },
  REX317: {
    hint: "Write messages with {name} placeholders and {count, plural, one {...} other {...}} or select arguments, each with an other branch.",
  },
  REX318: {
    hint: "Render one RexSidecar per page, give each affordance an id no page action uses, register it once and give a disallowed affordance its reason.",
  },
  REX319: {
    hint: "Name the element in lowercase with a dash, define it once, pass a part component, declare each prop as string, number, boolean or json and set attributes that parse as their kind.",
  },
  REX320: {
    hint: "No action needed: a page.ts edit invalidates rex:app and the page chunk and reloads the page; component edits keep state through HMR.",
  },
  REX321: {
    hint: 'Use density "default" or "agent", in the x-rex-density header and in setDensity.',
  },
  REX322: { hint: "Record an outcome with a non-empty actionId and an ISO timestamp in at." },
  REX323: {
    hint: "Pass baseUrl as an http(s) origin, such as https://app.example.com, when the page has no http(s) location, for example in tests, workers or embedded webviews.",
  },
  REX324: {
    hint: "Return a value from the read action behind the loader; the server loader run ended without data or an error.",
  },
  REX325: {
    hint: 'Declare draft "route" or "local" on the page and set a draft its draft schema accepts, or null to clear it.',
  },
  REX326: {
    hint: "Check that the Script src is reachable and serves JavaScript; the failure reaches the Script onError handler.",
  },
  REX327: {
    hint: "Call it in a browser or a DOM test environment such as happy-dom; on the server render the component and let it run after hydration.",
  },
  REX328: {
    hint: "Open one of the devtools panels by its id and record render durations as finite non-negative milliseconds.",
  },
  REX329: {
    hint: "Pass the argument the function documents; the message names the function and the expected value.",
  },
  REX330: {
    hint: "Fix the error thrown by the region; the page shows its recoverable-error state and Retry remounts the region.",
  },
  REX331: {
    hint: "Pass params the page's params schema accepts; rex manifest lists the params of every page.",
  },
  REX332: {
    hint: "Pass a value the schema accepts; the message lists each issue with the path of the field it concerns.",
  },
  REX333: {
    hint: "Decide only on a flow instance that is paused at an approval gate; the flow status shows the pending gate, and a gate is decided once.",
  },
  REX334: {
    hint: "Decide the gate as an actor its approvers policy allows; the error reason names the missing permission or condition.",
  },
  REX335: {
    hint: "Fix the throw in the page's view, states or a region outside its RegionBoundary; the page renders its RecoverableError with a retry until then.",
  },
  REX400: {
    hint: "Pass createRexServer and the server helpers the options they document; the message names the function and the option.",
  },
  REX401: {
    hint: "Register each action and flow once and do not name an action after the reserved confirmation procedure.",
  },
  REX402: {
    hint: "Write audit entries with createAuditEntry; an entry holds exactly the actor, actionId, inputDigest, outcome, effect, durationMs, at and optional traceId and spanId fields.",
  },
  REX403: {
    hint: "Filter the ledger by actor, actionId, outcome (ok, error or an error code) and from and to ISO timestamps with from not after to.",
  },
  REX404: {
    hint: "Let rex build write dist/prerender.json, and look prerendered pages up by paths that start with / and hold no empty, . or .. segment.",
  },
  REX405: {
    hint: "Make ssg and static pages render a page for the prerender actor, prerender each path from one page, render static actions with ActionForm and register a page renderer for regeneration.",
  },
  REX406: {
    hint: "Run rex build first and point clientDir at dist/client, which holds index.html.",
  },
  REX407: { hint: "Pass a port that is an integer from 0 to 65535; 0 picks a free port." },
  REX408: {
    hint: "Serve server rendering through createRexServer so page loaders run in process with the action router.",
  },
  REX440: {
    hint: 'Keep server code in action handlers, app/server or modules marked with import "@sidioralabs/rex/server-only", and reach it from the client through an action.',
  },
  REX441: {
    hint: "Read secrets only in action handlers or app/server; expose public values to the client through import.meta.env with the VITE_ prefix.",
  },
  REX442: {
    hint: "Invoke actions through useAct, ActionForm or the RPC client; client builds replace action handlers because handlers run only on the server.",
  },
  REX450: {
    hint: "Run the bun adapter under Bun and the deno adapter under Deno, or pick the matching rex build --target.",
  },
  REX451: {
    hint: "Set the named key in the server environment (process.env, the .env files or the host bindings) to a value the env.server schema in rex.config.ts accepts.",
  },
  REX460: {
    hint: "Keep the app under app/ with one folder per page in app/pages named after its page id (lowercase letters, digits, dot and dash) holding page.ts, view.tsx and states.tsx.",
  },
  REX461: {
    hint: "Build the client with rex build, which writes the Vite manifest with exactly one entry chunk to dist/client/.vite/manifest.json.",
  },
  REX462: {
    hint: "Export exactly one declaration of the folder's kind from each app module, give view, state, region and overlay modules a default export and name each page folder after its page id.",
  },
  REX463: {
    hint: 'Keep the root element <div id="root"></div> in index.html, or pass the id of the element the entry mounts into.',
  },
  REX500: {
    hint: "Fix the declaration error reported with the scan so the app declarations load, then run rex manifest again.",
  },
  REX501: { hint: "Pass buildManifest an app name that is a non-empty string." },
  REX502: {
    hint: "Keep declaration metadata to JSON values: finite numbers, strings, booleans, null, arrays and plain objects.",
  },
  REX503: { hint: "Define a rule with a kebab-case id, a description and a check function." },
  REX504: {
    hint: "Report a finding with a kebab-case rule id, severity error or warning, a file, positive line and column numbers, a message and a hint.",
  },
  REX505: {
    hint: "List each rule once and attribute each finding to the rule that reports it; a rule that throws has a bug, which the cause shows.",
  },
  REX506: { hint: "Format findings as human or json." },
  REX507: {
    hint: "Install happy-dom, pass at least one actor with a unique id, keep the app resolvable from index.html and let every page settle so rex check --runtime can mount it.",
  },
  REX508: {
    hint: "Write the check field of rex.config.ts as a literal object so rex check can read it without running the config.",
  },
  REX509: {
    hint: "In an app whose ui.kit is designx, render buttons, inputs, selects, textareas, tables and dialogs in regions, parts and overlays with the DesignX primitive rex/designx maps the surface to (button, input, select, textarea, checkbox, radio-group, number-field, data-table or card, dialog or sheet), installed under app/components/ui.",
  },
  REX510: {
    hint: "Let a part size to its container: drop pixel width, height, min-width and min-height and lay it out with Page.Stack or Page.Grid, or use a fluid value such as a percentage, a rem or ch range in clamp(), var(--rex-measure) or var(--rex-control-height).",
  },
  REX511: {
    hint: "Give the control min-height: var(--rex-hit-target) (min-h-(--rex-hit-target) or pointer-coarse:min-h-11 in Tailwind), or keep the DesignX primitive's own size, so it reaches 44 px on coarse pointers.",
  },
  REX600: {
    hint: "Declare each command, argument and option once with a --long option name, <required> or [optional] arguments in that order, and no value on a --no- flag.",
  },
  REX601: {
    hint: "Name things as rex make --help describes: page, region and action ids in lowercase with dashes, components and parts in PascalCase, hooks starting with use.",
  },
  REX602: {
    hint: "Remove or rename the existing files, or make the missing page or region first; generators never overwrite.",
  },
  REX603: {
    hint: "Reinstall @sidioralabs/rex; its package.json pins every version rex new writes into a new app.",
  },
  REX604: {
    hint: "Run rex --help, or rex <command> --help, for the commands, arguments and options each command accepts.",
  },
  REX605: {
    hint: "Fix what the message names, such as an existing file or a missing page, and run the command again.",
  },
  REX610: {
    hint: "Replace the placeholder the codemod wrote, such as Img width and height, with the real values and run rex check.",
  },
  REX611: { hint: "Run rex migrate --list and pass one of the listed versions to --from." },
  REX612: {
    hint: "Export codemod = defineCodemod({ id, from, description, run }) from cli/codemods/<id>.ts with the id equal to the file name.",
  },
} as const satisfies Readonly<Record<RexErrorCode, RexErrorDocsEntry>>;

export function errorArea(code: RexErrorCode): RexErrorArea {
  const areas = Object.keys(REX_ERROR_AREAS) as RexErrorArea[];
  return areas.find((area) => code.startsWith(REX_ERROR_AREAS[area].prefix)) as RexErrorArea;
}

export function errorHint(error: RexError): string {
  return error.hint ?? REX_ERROR_DOCS[error.code].hint;
}

export function explainRexError(error: RexError): string {
  return formatRexError(error, errorHint(error));
}
