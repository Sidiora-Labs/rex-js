# Build on the DesignX standard

DesignX is Rex's standard UI vocabulary. `@sidioralabs/rex/designx` holds the map from every Rex surface to one DesignX registry item per screen form, and the standard set of items that `rex new` installs. Generated shells, states and regions are written on that set, so an app starts on-system and stays there.

## What `rex new` installs

`rex new <name>` (the default `--ui designx`) fetches the standard set from `https://dxuireact.com/r/<item>.json`, follows each item's `registryDependencies`, and writes:

- `app/theme.css`, the DesignX theme behind `@import "tailwindcss"` and `@import "tw-animate-css"`;
- `app/components/ui/<item>.tsx` for every `registry:ui` item, `app/components/ui/utils.ts` for the `utils` lib and `app/components/ui/<hook>.ts` for the hooks, with the registry's `@/` aliases rewritten to relative imports and every file written through the `rex/prettier` preset;
- `app/components/ui/use-screen.ts`, which re-exports `useScreen` from `@sidioralabs/rex/client` and derives `useIsMobile` from the screen class, so the app never installs `use-mobile` and the sidebar follows the same phone, tablet, desktop and wide classes as the rest of Rex;
- `dx.json` with the registry URL, the installed items and the provided `use-mobile` replacement, the item dependencies, Tailwind 4 and `@tailwindcss/vite` in `package.json`, and the theme link in `index.html`.

The standard set is `DESIGNX_STANDARD`: the theme, `utils`, the 0.2 base set (button, card, field, input, select, sheet, dialog, skeleton, empty, command, table, tabs, tooltip, kbd, badge) and every item the map names. Only `registry:ui`, `registry:hook`, `registry:lib` and the theme style belong to it; `rex new` refuses a registry answer whose type disagrees with `DESIGNX_ITEMS`. `rex new --ui none` keeps the token components and installs nothing.

## The map

`DESIGNX_MAP` is typed so each surface resolves to exactly one item per form; `designxItem(surface, form)` reads it.

| Surface                                                                                           | Form                                                                                                          | Item                                                                                                |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `button` (shell `Button`)                                                                         | `default`                                                                                                     | `button`                                                                                            |
| `sheet` (shell `Sheet`)                                                                           | `dialog`, `bottom-sheet`                                                                                      | `dialog`, `sheet`                                                                                   |
| `paletteItem` (shell `PaletteItem`)                                                               | `default`                                                                                                     | `command`                                                                                           |
| `outcome` (shell `Outcome`)                                                                       | `default`                                                                                                     | `alert`                                                                                             |
| `nav` (shell `Nav`)                                                                               | `bar`, `sidebar`, `dock`                                                                                      | `navigation-menu`, `sidebar`, `toolbar`                                                             |
| `breadcrumbs`                                                                                     | `default`                                                                                                     | `breadcrumb`                                                                                        |
| `form`, `field`, `input`, `textarea`, `select`, `numberField`, `checkbox`, `switch`, `radioGroup` | `default`                                                                                                     | `form`, `field`, `input`, `textarea`, `select`, `number-field`, `checkbox`, `switch`, `radio-group` |
| `list`                                                                                            | `phone`; `tablet`, `desktop`, `wide`                                                                          | `card`; `data-table`                                                                                |
| `pagination`                                                                                      | `default`                                                                                                     | `pagination`                                                                                        |
| `states`                                                                                          | `loading`; `empty`; `stale`, `offline`; `partial`, `permission-denied`, `recoverable-error`, `terminal-error` | `skeleton`; `empty`; `badge`; `alert`                                                               |
| `pending`, `progress`                                                                             | `default`                                                                                                     | `spinner`, `progress`                                                                               |
| `region`                                                                                          | `default`                                                                                                     | `card`                                                                                              |
| `badge`, `avatar`, `tooltip`, `kbd`, `tabs`, `toolbar`, `separator`, `scrollArea`, `typography`   | `default`                                                                                                     | the item of the same name                                                                           |
| `mediaQuery`, `touch`                                                                             | `default`                                                                                                     | `use-media-query`, `use-touch-capable`                                                              |

The sheet and navigation forms are the ones the runtime picks by screen (`sheetFormFor` and `navFormFor` in `@sidioralabs/rex/client`): a dialog on tablet and larger and a bottom sheet on phone; a bar on tablet, a sidebar on desktop and wide, and a dock on phone. The motion-driven registry components (`bottom-sheet`, `dock`, `swipeable-list`, `theme-toggle`) are `registry:component` source to adapt, not part of the standard set, so the phone forms use the `sheet` item at the bottom edge, a `toolbar` of page links and a card list.

## What `rex new` generates on it

- `app/components/Shell.tsx`, registered through `ui: { kit: "designx", components: "app/components/Shell.tsx" }` in `rex.config.ts`, exports `Button`, `Sheet` (the dialog form on the dialog item's header, the bottom-sheet form on the sheet item's header), `PaletteItem` (the command shortcut with a `kbd` and a `badge` when the action is not allowed), `Outcome` (an `alert` in the success or destructive variant) and `Nav` (the `navigation-menu` bar, the `sidebar` menu and the `toolbar` dock, each link keeping `data-rex-nav` and `aria-current`). `Frame` keeps the token default, which places `Nav` by form. See [Shell components](../primitives.md#shell-components).
- `app/pages/home/states.tsx` renders loading on `skeleton`, empty on `empty`, the error states and partial on `alert`, and stale and offline on `badge` with a Refresh button.
- The first region's part, `app/pages/home/regions/welcome/parts/Welcome.tsx`, is a `card` with a `field` and `input` filtering the notes and the region's action on `button`, its `data-rex` control props spread onto it.

## Checks

`rex check` type-checks the installed items with the app, and its format rule holds the fetched files to the `rex/prettier` preset. Regions, parts, states and overlays use theme token utilities only; raw palette colors and arbitrary values are reported by `tokens/raw-color` and `tokens/arbitrary-value`, while `app/components` (including `app/components/ui`) may use any utility.
