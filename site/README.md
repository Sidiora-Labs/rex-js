# rex.sidioralabs.com

The Rex site: the marketing home, the documentation, the error catalog, the API reference, the standards table and the changelog. It is an ordinary Rex app on the DesignX standard, built with Rex itself, so building it tests the framework the way a user would.

## Layout

The site follows the Rex convention described in [docs/convention.md](../docs/convention.md):

- `app/pages/<page>/` holds one folder per page with `page.ts`, `view.tsx`, `states.tsx`, `regions/` and `test/`.
- `app/components/Shell.tsx` is the shell: a sidebar on desktop, a bar on tablet and a dock on phone, the GitHub link and the theme toggle.
- `app/components/Mark.tsx` renders the Rex mark, the light mark on the light theme and the warm mark on the dark theme.
- `app/components/ui/` is the DesignX standard set installed by `rex new --ui designx`, plus `theme-provider.tsx` adapted for both color schemes.
- `app/theme.css` holds the DesignX tokens derived from the Rex mark. Every color is a `light-dark()` pair, so the scheme follows the system without JavaScript and the toggle pins it.
- `public/` holds `CNAME` (`rex.sidioralabs.com`), `robots.txt`, `favicon.png`, `og.png` and both marks.
- `e2e/` holds the gates; `e2e/walk.ts` has the helpers they share.

## Commands

Run them from the repository root after `pnpm install` and `pnpm -C packages/rex build`:

| Command                                        | What it does                                                                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm -C site dev`                             | Starts the dev server.                                                                                                                          |
| `pnpm -C site check`                           | Runs `rex check` on the site.                                                                                                                   |
| `pnpm -C site test:unit`                       | Runs the page and content tests in happy-dom.                                                                                                   |
| `pnpm -C site build`                           | Builds the site with `rex build`.                                                                                                               |
| `pnpm -C site build:static`                    | Builds the static deployment into `dist/client` with `rex build --target static`.                                                               |
| `pnpm -C site test:e2e`                        | Runs the gates against `dist/client` served by `tools/serve-static.mjs`.                                                                        |
| `node tools/serve-static.mjs site/dist/client` | Serves the built directory the way GitHub Pages does: directory index resolution, `404.html` for unknown routes and content types by extension. |

## Deployment

`.github/workflows/site.yml` installs the workspace, builds the package, runs `rex check` and the unit tests on the site and builds it on every push and pull request that touches the site, the docs, the package, the changelog or the workflow. The site is served from the root of `https://rex.sidioralabs.com`, the host every REX error docs link points at.
