# Recipes

Each recipe solves one task with the pattern Rex already has for it. They assume an app written by `rex new` (see the [tutorial](../tutorial.md)) and use the wallet demo in `examples/demo` for examples where it has one.

| Recipe                                                     | What it shows                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [Load page data with a loader](loader.md)                  | `page.load`, `useLoader`, SSR dehydration, caching and invalidation                                                      |
| [A form that works without JavaScript](form-without-js.md) | `ActionForm`, the `/rex/form/<action>` route, CSRF, outcome cookies and the confirmation page                            |
| [Add an overlay](overlay.md)                               | declaring a sheet in `page.ts` and its file, opening it from a region, URL binding                                       |
| [Gate a flow on an approval](flow-approval.md)             | `flow()` with an approval step, `useFlow`, the approve and reject affordances                                            |
| [Ship a static page](static-page.md)                       | `render: "static"` and `"ssg"`, prerendering, regeneration and the zero-JavaScript rules                                 |
| [Translate an app](i18n.md)                                | `app/locales`, `msg:` keys, `useT`, locale resolution and prefixed routes                                                |
| [Export a part as a web component](web-component.md)       | `defineElement`, attribute props, `Native`                                                                               |
| [Adopt Rex one page at a time](incremental-adoption.md)    | the Vite plugin in an existing app and `mountRexPage`                                                                    |
| [Build on the DesignX standard](designx.md)                | `@sidioralabs/rex/designx`, the surface-to-item map, what `rex new --ui designx` installs and generates, the token rules |

Every recipe ends with the checker rules that guard it. Run `rex check` after each change; it prints the rule id, the file and line, and a hint.
