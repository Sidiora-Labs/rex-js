# Rex error codes

Generated from `packages/rex/src/core/errors.ts` by `pnpm docs:errors` (`node tools/docs-errors.mjs`). Do not edit it by hand: `node tools/docs-errors.mjs --check` fails when this file is stale.

Every error Rex raises is a `RexError` carrying a code, a message naming the file and symbol, a hint, a docs link and, when known, the file, line and column of the source that caused it. The Vite overlay and the CLI show a source frame for errors with a location.

## REX1xx Configuration

| Code | Error | Hint |
| --- | --- | --- |
| [REX100](https://rex.sidioralabs.com/errors/REX100) | rex.config.ts is missing | Create rex.config.ts at the app root that default-exports defineConfig({ app }) with app imported from rex:app. |
| [REX101](https://rex.sidioralabs.com/errors/REX101) | rex.config.ts default-exports a bare Hono app | Wrap it: export default defineConfig({ app, server: (app) => createRexServer({ ... }) }); rex migrate applies this change. |
| [REX102](https://rex.sidioralabs.com/errors/REX102) | rex.config.ts default export is not a Rex config | Default-export defineConfig({ app }) from rex.config.ts. |
| [REX110](https://rex.sidioralabs.com/errors/REX110) | Unknown config field | Remove the field or correct its spelling; the accepted fields are listed in the config reference. |
| [REX111](https://rex.sidioralabs.com/errors/REX111) | Invalid config app | Set app to the bundle imported from rex:app: import app from "rex:app". |
| [REX112](https://rex.sidioralabs.com/errors/REX112) | Invalid config server | Set server to a function from the app bundle to a fetch app, such as (app) => createRexServer({ registry: app.registry, ledger, actor }). |
| [REX113](https://rex.sidioralabs.com/errors/REX113) | Invalid config render | Set render to { default: "ssr" \| "csr" \| "ssg" \| "static" }. |
| [REX114](https://rex.sidioralabs.com/errors/REX114) | Invalid config budgets | Set budgets.core, budgets.client and budgets.page to positive numbers of gzipped kilobytes. |
| [REX115](https://rex.sidioralabs.com/errors/REX115) | Invalid config security | Set security to { csp: "strict" \| "report" \| "off", origins: ["https://example.com"], headers?: { name: value }, secretNames?: ["NAME"] }. |
| [REX116](https://rex.sidioralabs.com/errors/REX116) | Invalid config i18n | Set i18n to { locales: ["en", ...], default: one of the locales, routing: "prefix" \| "none" }. |
| [REX117](https://rex.sidioralabs.com/errors/REX117) | Invalid config images | Set images to { sizes: positive integer widths, formats: a list of avif, webp, jpeg and png }. |
| [REX118](https://rex.sidioralabs.com/errors/REX118) | Invalid config fonts | Set fonts to a list of { family, src, weight?, style?, preload? } with src a URL or a path starting with /. |
| [REX119](https://rex.sidioralabs.com/errors/REX119) | Invalid config telemetry | Set telemetry to { tracer?: an OpenTelemetry tracer, logger?: { debug, info, warn, error } }. |
| [REX120](https://rex.sidioralabs.com/errors/REX120) | Invalid config ui | Set ui to "designx" or "none". |
| [REX121](https://rex.sidioralabs.com/errors/REX121) | Invalid config client | Set client to { apiOrigin?: an http(s) origin such as https://api.example.com }. |
| [REX122](https://rex.sidioralabs.com/errors/REX122) | Invalid config flag | Set compiler, devtools and tailwind to true or false. |
| [REX123](https://rex.sidioralabs.com/errors/REX123) | Invalid config check | Set check to { tokens?: { colors?, spacing?, classes? } } with each allow list a list of strings. |

## REX2xx Declarations

| Code | Error | Hint |
| --- | --- | --- |
| [REX200](https://rex.sidioralabs.com/errors/REX200) | Invalid page render mode | Set render to "ssr", "csr", "ssg" or "static", or leave it out to use the app default. |
| [REX201](https://rex.sidioralabs.com/errors/REX201) | Invalid page revalidate | Set revalidate to a positive whole number of seconds on a page with render "ssg", or remove it. |
| [REX202](https://rex.sidioralabs.com/errors/REX202) | Invalid page paths | Set paths to a function returning the params of every page to prerender, on a page with render "ssg" or "static" and route params. |
| [REX203](https://rex.sidioralabs.com/errors/REX203) | Invalid page loader | Map each camelCase loader name to a read action or to { action: readAction, input: (params) => input }. |
| [REX204](https://rex.sidioralabs.com/errors/REX204) | Invalid page cache | Set cache to { staleTime: milliseconds } with a whole number of zero or more. |
| [REX205](https://rex.sidioralabs.com/errors/REX205) | Invalid page transition | Set transition to "view" or "none". |
| [REX206](https://rex.sidioralabs.com/errors/REX206) | Invalid page chrome components | Set chrome.components to { Button?, Sheet?, PaletteItem?, Outcome? } with each value a component. |
| [REX207](https://rex.sidioralabs.com/errors/REX207) | Invalid action form options | Set form to { redirect?: a path starting with /, confirmTitle?: a non-empty string }. |
| [REX208](https://rex.sidioralabs.com/errors/REX208) | Invalid action JSON Schema override | Set jsonSchema to { input?: JSON Schema object, output?: JSON Schema object }. |
| [REX209](https://rex.sidioralabs.com/errors/REX209) | Page loader names an unregistered action | Register the loader's read action in app/actions so the manifest and the router know it. |
| [REX210](https://rex.sidioralabs.com/errors/REX210) | Schema cannot be represented as JSON Schema | Use a zod schema that JSON Schema can describe, or declare jsonSchema explicitly on the declaration. |
| [REX211](https://rex.sidioralabs.com/errors/REX211) | Invalid entity declaration | Fix the named field of the entity(name, { fields, key?, label? }) declaration; field names are camelCase and every field is a Standard Schema such as a Rex field helper. |
| [REX212](https://rex.sidioralabs.com/errors/REX212) | Invalid action declaration | Fix the named field of the action(name, { label, effect, input, output, policy, handler, ... }) declaration as described in the primitives reference. |
| [REX213](https://rex.sidioralabs.com/errors/REX213) | Invalid page declaration | Fix the named field of the page(name, { route, chrome, regions, overlays, actions, ... }) declaration in app/pages/<page>/page.ts. |
| [REX214](https://rex.sidioralabs.com/errors/REX214) | Invalid policy declaration | Fix the named field of the policy(name, { permissions, grants }) declaration; grants may only name declared permissions. |
| [REX215](https://rex.sidioralabs.com/errors/REX215) | Invalid policy predicate | Build predicates with can(permission), requires({ unlocked?, account?, custody?, permissions? }), allOf(...) and anyOf(...) with at least one condition each. |
| [REX216](https://rex.sidioralabs.com/errors/REX216) | Invalid flow declaration | Fix the named field of the flow(name, { journal, input, steps }) declaration; each step is { action, input? } or an approval gate. |
| [REX217](https://rex.sidioralabs.com/errors/REX217) | Duplicate declaration id | Give each entity, action, page, policy and flow a unique id, or register the same declaration object only once. |
| [REX218](https://rex.sidioralabs.com/errors/REX218) | Invalid name | Use a name that starts with a lowercase letter and contains only lowercase letters, digits, dot and dash; component names are PascalCase. |
| [REX219](https://rex.sidioralabs.com/errors/REX219) | Invalid action shortcut | Write the shortcut as ordered modifiers mod, shift, alt joined by + and one key, such as mod+shift+s; mod+k and escape are reserved by Rex. |
| [REX220](https://rex.sidioralabs.com/errors/REX220) | Invalid page route | Write the route as / or /segment/:param with lowercase static segments, camelCase params, no repeated param and no trailing slash. |
| [REX221](https://rex.sidioralabs.com/errors/REX221) | Duplicate enum value | List each value once in enumOf([...]). |
| [REX222](https://rex.sidioralabs.com/errors/REX222) | Page names an unregistered action | Register the action in app/actions or remove it from the page actions list. |
| [REX223](https://rex.sidioralabs.com/errors/REX223) | Page names an unknown page | Point recovery and chrome.back at the id of a registered page. |
| [REX224](https://rex.sidioralabs.com/errors/REX224) | Registered value is not a complete declaration | Register only values returned by entity(), action(), page(), policy() and flow(). |

## REX3xx Runtime

| Code | Error | Hint |
| --- | --- | --- |
| [REX300](https://rex.sidioralabs.com/errors/REX300) | Schema validates asynchronously | Validate the schema with validateStandard (async) or use a schema whose ~standard.validate returns synchronously. |
| [REX301](https://rex.sidioralabs.com/errors/REX301) | Unknown declaration | Look up a declaration that is registered in the app; rex manifest lists every registered id. |
| [REX302](https://rex.sidioralabs.com/errors/REX302) | Invalid journal id | Pass a non-empty string for the flow id and the instance id. |
| [REX303](https://rex.sidioralabs.com/errors/REX303) | Unknown flow instance | Start the flow with runFlow before recording entries or deciding on its gates. |
| [REX304](https://rex.sidioralabs.com/errors/REX304) | Flow instance belongs to another flow | Use a fresh instance id for each flow; an instance id is bound to the flow that opened it. |
| [REX305](https://rex.sidioralabs.com/errors/REX305) | Unknown store filter field | Filter a store list only by fields declared on its entity. |
| [REX310](https://rex.sidioralabs.com/errors/REX310) | Hydration mismatch | Render the same markup on the server and the client: read time, randomness and browser-only values in effects, not during render. |
| [REX320](https://rex.sidioralabs.com/errors/REX320) | Page declaration changed | No action needed: a page.ts edit invalidates rex:app and the page chunk and reloads the page; component edits keep state through HMR. |
| [REX330](https://rex.sidioralabs.com/errors/REX330) | Region failed to render | Fix the error thrown by the region; the page shows its recoverable-error state and Retry remounts the region. |

## REX4xx Server

| Code | Error | Hint |
| --- | --- | --- |
| [REX440](https://rex.sidioralabs.com/errors/REX440) | Server-only module imported by client code | Import rex/server, app/server and modules marked import "rex/server-only" only from actions, rex.config.ts and other server code. |
| [REX450](https://rex.sidioralabs.com/errors/REX450) | Runtime not available for the adapter | Run the bun adapter under Bun and the deno adapter under Deno, or pick the matching rex build --target. |

## REX5xx Checker and manifest

| Code | Error | Hint |
| --- | --- | --- |
| [REX500](https://rex.sidioralabs.com/errors/REX500) | Manifest scan failed | Fix the declaration error reported with the scan so the app declarations load, then run rex manifest again. |
| [REX501](https://rex.sidioralabs.com/errors/REX501) | Invalid manifest build option | Pass buildManifest an app name that is a non-empty string. |
| [REX502](https://rex.sidioralabs.com/errors/REX502) | Manifest value cannot be serialised | Keep declaration metadata to JSON values: finite numbers, strings, booleans, null, arrays and plain objects. |

## REX6xx CLI

| Code | Error | Hint |
| --- | --- | --- |
| [REX600](https://rex.sidioralabs.com/errors/REX600) | Invalid CLI command definition | Declare each command, argument and option once with a --long option name, <required> or [optional] arguments in that order, and no value on a --no- flag. |
| [REX610](https://rex.sidioralabs.com/errors/REX610) | Codemod left a placeholder | Replace the placeholder the codemod wrote, such as Img width and height, with the real values and run rex check. |
