# Releasing Rex

This page is for the release manager: how the Rex site reaches [rex.sidioralabs.com](https://rex.sidioralabs.com), what the site workflow checks on the way, the one-time GitHub Pages and DNS setup it depends on, and how to verify and roll back a deployment.

## Deploying the site

The site is the Rex app under [site/](../site/README.md), built with `rex build --target static` and served by GitHub Pages from the root of `https://rex.sidioralabs.com`, the host every REX error docs link points at. Nobody deploys from a local machine: every push to `main` that touches the site, the docs, the package, the changelog or the workflow deploys it through [.github/workflows/site.yml](../.github/workflows/site.yml).

### The workflow

The workflow runs on every push and pull request that touches `site/`, `docs/`, `packages/rex/`, `CHANGELOG.md`, `tools/serve-static.mjs`, `tools/site-verify.mjs`, `pnpm-lock.yaml` or the workflow itself. Its default permissions are `contents: read`; every action is pinned by major version, every job has a timeout and every pnpm job uses the pnpm cache of `actions/setup-node`. A pull request run is cancelled by a newer push to the same pull request; a run on `main` is never cancelled.

| Job      | Runs                                                                                                                                                                                                                                                                                                                                                                           | Needs    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `verify` | Builds rex, runs the `tools/serve-static.mjs` tests, `pnpm -C site check`, `pnpm -C site test:unit` and `pnpm -C site build`.                                                                                                                                                                                                                                                  |          |
| `e2e`    | Builds rex, runs `pnpm -C site build:static`, checks the built directory with `node tools/site-verify.mjs site/dist/client`, installs Chromium and runs `pnpm -C site test:e2e` against `site/dist/client` served by `tools/serve-static.mjs`; uploads the reports as the `site-e2e-report` artifact. On a push to `main` it uploads `site/dist/client` as the Pages artifact. | `verify` |
| `deploy` | On a push to `main` only, in the `github-pages` environment with `pages: write` and `id-token: write`: `actions/configure-pages` and `actions/deploy-pages`. Deployments run one at a time in the `pages` concurrency group and are never cancelled.                                                                                                                           | `e2e`    |

The directory that is deployed is the one the gates passed; nothing is rebuilt after them.

### The static build

`pnpm -C site build:static` runs `rex build --target static`, which writes `site/dist/client` (every page as HTML, `index.md` beside each prerendered page, `rex/manifest`, `404.html`) and `site/dist/prerender.json`, as described in [platforms.md](platforms.md). It then runs `site/scripts/sitemap.mjs`, which writes `site/dist/client/sitemap.xml` from the routes of `rex/manifest` and the paths of `prerender.json` on the host named by `site/public/CNAME`.

`node tools/site-verify.mjs site/dist/client` fails unless the built directory holds:

- `CNAME` with the one host name `rex.sidioralabs.com`, `robots.txt` naming `https://rex.sidioralabs.com/sitemap.xml`, `404.html`, `rex/manifest`, `sitemap.xml` and `og.png`;
- an `index.html` for every route of the manifest without route params and for every path of `prerender.json` (read from `site/dist/prerender.json`, or from `--prerender <file>`), and at least one prerendered path for every `ssg` or `static` page with route params;
- `data-rex-page` and the `application/rex+json` sidecar script with id `rex-page` in every prerendered page;
- a sitemap listing exactly those pages, each at an address the static host answers with a page;
- for every `href` and `src` in every HTML file, and every `og:url` and `og:image`, that points at the site, a built file the static host resolves the way `tools/serve-static.mjs` does.

Run the same checks locally after `pnpm install` and `pnpm -C packages/rex build`:

```sh
pnpm -C site build:static
node tools/site-verify.mjs site/dist/client
node tools/serve-static.mjs site/dist/client
```

### One-time setup

GitHub Pages, in the repository settings under Pages:

1. Build and deployment, Source: **GitHub Actions**. The site workflow is the only thing that deploys; there is no `gh-pages` branch.
2. Custom domain: **rex.sidioralabs.com**. `site/public/CNAME` carries the same name into every deployment, so the setting survives each deploy.
3. **Enforce HTTPS**, once GitHub has issued the certificate for the domain.

The same settings through the GitHub API:

```sh
gh api -X POST repos/Sidiora-Labs/rex-js/pages -f build_type=workflow
gh api -X PUT repos/Sidiora-Labs/rex-js/pages -f cname=rex.sidioralabs.com -F https_enforced=true
```

The `github-pages` environment is created by the first deployment; restrict its deployment branches to `main`.

DNS, at the provider of `sidioralabs.com`: a `CNAME` record `rex` pointing at `sidiora-labs.github.io`. Verify the domain for the organization in its Pages settings so no other repository can claim it.

### Verifying a deployment

The `deploy` job prints the deployed URL as the environment URL of the run. Check that `gh run list --workflow site.yml --branch main` shows the latest run green, then fetch the pages an agent reads first:

```sh
curl -s https://rex.sidioralabs.com/ | grep -o 'data-rex-page="home"'
curl -s https://rex.sidioralabs.com/ | grep -o '<script type="application/rex+json" id="rex-page"'
curl -s https://rex.sidioralabs.com/rex/manifest | head -c 200
curl -s https://rex.sidioralabs.com/sitemap.xml | head
```

### Rolling back

Revert the commit on `main` that broke the site and push; the workflow deploys the reverted tree. To restore a known good deployment at once, re-run the `deploy` job of the run that produced it from the Actions tab: it deploys that run's Pages artifact again while the artifact is retained.
