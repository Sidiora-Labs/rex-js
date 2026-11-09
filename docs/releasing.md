# Releasing Rex

The site at [rex.sidioralabs.com](https://rex.sidioralabs.com) has its own path, described at the end of this page.

This page is for the release manager listed in [MAINTAINERS.md](../MAINTAINERS.md): how a version of `@sidioralabs/rex` goes from `main` to npm and to a GitHub release, what the release workflow checks on the way, the one-time npm and GitHub setup it depends on, how to verify a published version and how to roll one back. What a patch, a minor and a breaking change are is defined in [versioning.md](versioning.md); who may release, and from where, is defined in the [release authority](../GOVERNANCE.md#release-authority) section of GOVERNANCE.md.

The path is: bump the version, generate the changelog, land `main`, push the `v<version>` tag. The tag is the only trigger of `.github/workflows/release.yml`, which refuses a tag whose commit is not on `main`, runs the same checks as CI through the reusable workflow `.github/workflows/checks.yml`, packs the package, smoke tests the tarball in a fresh app, publishes it to npm through OpenID Connect with a provenance attestation, installs the published version back from the registry and imports every entry, and creates the GitHub release with the changelog section of the version as its body. Nobody publishes from a local machine, and the workflow holds no npm token.

## 1. Bump the version

The version is the `version` field of `packages/rex/package.json`, and it is the only place to edit. `REX_VERSION`, which `rex --version` prints and `rex new` writes into every new app, lives in `packages/rex/src/version.ts`, which `packages/rex/scripts/write-version.mjs` generates from `package.json` whenever the package's `build`, `typecheck` or `test` script runs; `node tools/freshness.mjs --check` fails when the two differ. The supported versions table of [SECURITY.md](../SECURITY.md) moves with it when the minor version changes.

Search the README and `docs/` for the previous version string before committing (`grep -rn "0\.1\.0" README.md docs`); the quick start quotes the range `rex new` writes. Commit the bump on its own, in the house commit format (`cg commit -m "..."`).

## 2. Generate the changelog

`CHANGELOG.md` is generated from git history by `cg changelog`, never written by hand. `clif.toml` at the repository root is the git-cliff reference configuration it is checked against: one release per tag, groups from the commit-subject prefix (`feat:`, `fix:`, `docs:`, ...; a subject without a prefix lands under Other), and a trailing `[spec:<feature>/<task>]` on the subject turned into a task reference. Run it after the bump commit, naming the release so that its section exists before the tag does:

```sh
cg changelog --tag v0.2.0 -o CHANGELOG.md
```

The section is headed `## [v0.2.0] - <date>` (`--tag 0.2.0` writes `## [0.2.0] - <date>`); without `--tag`, everything since the last tag stays under `## [Unreleased]` and the release workflow finds no section to publish. With `CENTRA_API_KEY` set, a model writes a Highlights paragraph at the top of the section; without it, the section lists the commits by group. Read the section through, because the workflow publishes it verbatim as the body of the GitHub release, then commit it.

The release workflow accepts a section headed `## [0.2.0] - <date>`, `## [v0.2.0] - <date>` or `## 0.2.0 (<date>)` for version `0.2.0`, and fails before any gate runs when none exists.

## 3. Land main

Open the release pull request with the two commits. Per GOVERNANCE.md another maintainer approves it; with a single maintainer, the release manager self-approves after the gates pass. Merge it into `main` and push. The CI workflow (`.github/workflows/ci.yml`) on the merge commit must be green: CI and the release workflow both call the same reusable workflow, `.github/workflows/checks.yml`, so a red CI is a red release.

## 4. Tag

On the `main` commit that carries the bump and the changelog (the workflow refuses a tag whose commit is not an ancestor of `main`):

```sh
git switch main && git pull --ff-only
git tag -s v0.2.0 -m "Rex 0.2.0"
git push origin v0.2.0
```

The tag is `v` followed by the `version` of `packages/rex/package.json`, exactly; the first job of the workflow stops when they differ. The tag is signed, as GOVERNANCE.md requires. A pre-release version (`0.3.0-rc.1`, anything with a hyphen) is published under the npm dist-tag `next` instead of `latest`, and its GitHub release is marked a pre-release.

## 5. What the workflow does

`.github/workflows/release.yml` runs on every pushed `v*` tag, one run per tag (`concurrency: release-<ref>`, never cancelled), with `permissions: contents: read` for every job that does not need more. Every job has a timeout and runs on a named runner image (`ubuntu-24.04`, `macos-15`, `windows-2025`), never a `-latest` label.

| Job                | Runs                                                                                                                                                                                                                                                                                            | Needs                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `prepare`          | Checks out the full history and fails unless `git merge-base --is-ancestor` finds the tag's commit on `origin/main`; checks that the tag equals `v` + the package version; extracts the `CHANGELOG.md` section of that version into the `release-notes` artifact and fails when there is none.  |                                          |
| `checks`           | Calls `.github/workflows/checks.yml`, the jobs CI runs, listed below; it uploads the smoke-tested tarball as the `package` artifact.                                                                                                                                                            | `prepare`                                |
| `publish`          | In the `npm` environment with `id-token: write`, on Node 24.22.2: fails unless the npm bundled with that Node is 11.5.1 or later (it installs nothing), downloads the `package` artifact and runs `npm publish <tarball> --provenance --access public --tag latest` (`next` for a pre-release). | `prepare`, `checks`                      |
| `verify-published` | `node tools/verify-published.mjs --version <version>`: installs the published version from the registry, as described in step 7.                                                                                                                                                                | `prepare`, `publish`                     |
| `release`          | With `contents: write`: `gh release create v<version> <tarball> --verify-tag --notes-file release.md`, titled `@sidioralabs/rex <version>`, using the `release-notes` artifact.                                                                                                                 | `prepare`, `publish`, `verify-published` |

The tarball that is published and attached to the release is the one the smoke test passed, carried between jobs as an artifact; nothing is rebuilt after the gates.

### The shared checks

`.github/workflows/checks.yml` is triggered only by `workflow_call`. `ci.yml` calls it on every push to `main` and every pull request, and its `Gate` job fails when the call did not succeed, including when it was skipped or cancelled. `release.yml` calls it as `checks`. Every job except the platform matrix runs on Node 24.22.2 on `ubuntu-24.04`, and every pnpm job uses the pnpm version of `packageManager` in the root `package.json` and the pnpm cache of `actions/setup-node`.

| Job             | Runs                                                                                                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform`      | The matrix: Node 22.19.0, 24.22.2 and 26.13.0, each on `ubuntu-24.04`, `macos-15` and `windows-2025`, nine legs that do not cancel each other. Each builds rex, runs `pnpm -r typecheck` and `pnpm -C packages/rex test`.                                                                       |
| `verify`        | `pnpm -r typecheck`, `pnpm -C packages/rex test` (which includes the size budgets), builds rex, the demo unit tests (recorded for the ratio), `node --test tools/qualification-gates.test.mjs`, the workflow lint and its tests, and `node tools/test-ratio.mjs --check`.                       |
| `lint`          | The demo's `eslint`, the root or per-package eslint config, the prettier check of `packages/rex/src` and `examples/demo` with the rex preset.                                                                                                                                                   |
| `coverage`      | `vitest run --coverage` with the thresholds of `packages/rex/vitest.config.ts`; the report is uploaded.                                                                                                                                                                                         |
| `demo`          | Builds rex, runs `rex check --runtime` on the demo and the site and the demo unit tests, installs Chromium, Firefox and WebKit, then `pnpm -C examples/demo test`: `rex check` and the operability, no-JS, axe, vitals, Lighthouse and screenshot walks, and `node tools/navigation-races.mjs`. |
| `docs`          | `pnpm docs:check` (links and API pages) and `node tools/freshness.mjs --check --skip pointers`.                                                                                                                                                                                                 |
| `supply-chain`  | `pnpm audit --prod` and `node tools/license-review.mjs`.                                                                                                                                                                                                                                        |
| `package`       | Builds rex, `pnpm pack`, `publint@0.3.25` and `@arethetypeswrong/cli@0.18.5` on the tarball, `tools/smoke-package.sh` on it, `node tools/smoke-cli-bootstrap.mjs`, and uploads the tarball that passed as the `package` artifact.                                                               |
| `smoke-bun`     | Installs Bun 1.4.4 and serves an app from the built package through `startBunServer`; `/rex/health` must answer `{"status":"ok"}` and `/rex/manifest` 200.                                                                                                                                      |
| `smoke-deno`    | The same through `startDenoServer` on Deno 2.9.8.                                                                                                                                                                                                                                               |
| `smoke-workerd` | Serves a worker built on `createEdgeHandler` in `wrangler@4.158.0 dev`, which runs it on workerd, and expects the same two answers.                                                                                                                                                             |

The demo's and the site's Playwright configurations run the operability, no-JS and axe walks (the demo) and the site gates (the site) in the `firefox` and `webkit` projects as well as in Chromium; the vitals, Lighthouse and screenshot walks stay Chromium-only. `.github/workflows/codeql.yml` runs CodeQL's `security-extended` queries over the JavaScript and TypeScript on every push to `main`, every pull request and weekly.

### Pinning and the workflow lint

Every third-party action is pinned by its full commit SHA, with the release tag in a trailing comment (`actions/checkout@<sha> # v5.1.0`); Dependabot moves the SHA and the comment together. Every tool a job installs names an exact version: Node, Bun and Deno through their setup actions, and `publint`, `@arethetypeswrong/cli` and `wrangler` in their `pnpm dlx` calls. No job installs anything globally, and the job that holds `id-token: write` downloads no tool at all.

`node tools/workflow-lint.mjs .github/workflows` enforces this, and the `verify` job runs it with its tests (`node --test tools/workflow-lint.test.mjs`). It fails, naming the file and the job, on:

- `unpinned-action`: a `uses:` that is not a local path, a full 40-character commit SHA or a `docker://` image with a `sha256` digest;
- `floating-version`: a `version` or `*-version` input that is not an exact `x.y.z` (after resolving `matrix.*`), `node-version-file`, `check-latest: true`, a setup action without its version input, a `-latest` runner, and a `npx`, `pnpm dlx`, `yarn dlx`, `bunx` or global install of a package without an exact version;
- `id-token-install`: a global install or a downloaded tool in a job that holds `id-token: write`;
- `missing-matrix-entry`: a Node line (22.19, 24, 26) and operating system (Linux, macOS, Windows) pair that no job runs with `runs-on` and `node-version` taken from `matrix.os` and `matrix.node`, a missing Bun, Deno or workerd smoke job, or a missing Chromium, Firefox or WebKit browser install;
- `missing-codeql`: no CodeQL analysis;
- `tag-not-on-main`: a tag-triggered workflow without a `git merge-base --is-ancestor` check against `main`, or a job holding `id-token: write` that does not need that check.

### The package smoke test

`tools/smoke-package.sh [tarball]` proves that the packed package works outside the workspace, the way a user installs it:

1. Extracts the tarball and reads which of its declared peer dependencies the `rex` bin imports, by walking the static imports of the bin and its command modules.
2. Installs the tarball and those peers with pnpm into a scratch package in a temporary directory.
3. Runs that bin: `rex new my-app --ui none --no-install`.
4. Points the app's `package.json` at the tarball (`"@sidioralabs/rex": "file:<tarball>"`) and runs `pnpm install`.
5. Runs `rex check` and `rex build` in the app.
6. Starts `node dist/server.js` with `PORT=0` and `HOST=127.0.0.1`, reads the `rex: serving <url>` line, and expects `GET /` to answer 200 with `data-rex-page="home"` and the `application/rex+json` sidecar script with id `rex-page`, `GET /rex/manifest` to answer 200 with a `pages` list containing `home`, and `POST /rex/rpc/ping` with an `origin` header to answer 200 with `{ "json": { "ok": true } }`.
7. Stops the server and removes the temporary directory, also on failure; any miss exits non-zero.

Locally, after `pnpm -C packages/rex build`, `sh tools/smoke-package.sh` packs `packages/rex` itself, and `sh tools/smoke-package.sh /tmp/sidioralabs-rex-0.2.0.tgz` tests a tarball from `pnpm -C packages/rex pack --pack-destination /tmp`.

## 6. One-time setup

### The `npm` environment on GitHub

In the repository settings, Environments, create an environment named `npm`. The `publish` job runs inside it, so its protection rules gate every publish: set the release managers as required reviewers if a human approval is wanted before each publish, and restrict deployment branches and tags to the tag pattern `v*`. The name is part of the identity npm checks, so it must be exactly `npm`.

### Trusted publishing on npm

npm trusted publishing lets a GitHub Actions job publish by presenting its OpenID Connect token instead of an npm token: no secret is stored in the repository, and the registry records which repository, workflow and commit produced the version. It needs npm CLI 11.5.1 or later (the `publish` job pins Node 24.22.2, whose bundled npm is 11.19.1, and fails rather than upgrades npm when the bundled one is older), GitHub-hosted runners, and, for the provenance attestation, a public repository and a public package.

The configuration lives on the package's settings page on npmjs.com: Packages, `@sidioralabs/rex`, Settings, Trusted publishing. Add a GitHub Actions publisher with these values:

| Field                | Value                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Organization or user | `Sidiora-Labs`                                                                                     |
| Repository           | `rex-js`                                                                                           |
| Workflow filename    | `release.yml` (the file name only, with its extension; the file must live in `.github/workflows/`) |
| Environment name     | `npm`                                                                                              |

A trusted publisher connection cannot be edited: to change it, delete it and add a new one. Afterwards, under Settings, Publishing access, choose "Require two-factor authentication and disallow tokens": trusted publishers keep working, and no token can publish the package any more. The workflow needs nothing else; it does not pass `registry-url` or a `NODE_AUTH_TOKEN`, so no token is ever in play.

### The first version of a package that is not on npm yet

The trusted publisher settings exist on the package page, so the package must have been published once before they can be configured. `@sidioralabs/rex` is published for the first time as follows:

1. Push the tag as in step 4. Every gate runs; the `publish` job fails because the package has no trusted publisher yet. The run keeps its `package` and `release-notes` artifacts.
2. The release manager downloads the `package` artifact of that run (the tarball the gates and the smoke test passed), creates a granular access token on npmjs.com limited to publishing `@sidioralabs/rex` with the shortest expiry offered, publishes that tarball once with `npm publish <tarball> --access public` from a machine with 2FA, and revokes the token. This is the one publish that does not come from the workflow and carries no provenance attestation.
3. Configure the trusted publisher as above, then the Publishing access setting.
4. Create the GitHub release for that tag by hand from the run's artifacts: `gh release create v0.2.0 <tarball> --verify-tag --title "@sidioralabs/rex 0.2.0" --notes-file release.md`.

Every later version goes through the workflow unchanged.

## 7. Verify a published version

The `verify-published` job runs `node tools/verify-published.mjs --version <version>` after every publish. In a fresh directory it installs `@sidioralabs/rex@<version>` from the registry, retrying while the registry propagates the version (`--attempts`, default 10, `--delay`, default 30 seconds), then installs every peer the published manifest declares at its declared range. It fails unless the installed version is the one asked for, the published `exports` map has exactly the entries of `packages/rex/package.json`, every entry imports in Node (`./package.json` as JSON), and `rex --version` prints the version. Run it locally the same way; `--registry <url>` points it at another registry and `--keep` keeps the directory.

The published version must also carry a provenance attestation that names this repository, the tag's commit and `.github/workflows/release.yml`:

- The package page on npmjs.com shows a Provenance section ("Built and signed on GitHub Actions") linking the source commit and the workflow run; both must point at `Sidiora-Labs/rex-js`.
- `npm view @sidioralabs/rex@0.2.0 dist.attestations` prints the attestations URL on the registry and the provenance predicate type; a version published without provenance has no `attestations` field.
- In an app that installed the version, `npm audit signatures` reports the package among those with verified attestations.
- The tarball on the registry is the one attached to the GitHub release: `npm view @sidioralabs/rex@0.2.0 dist.integrity` matches the `sha512` of the release asset (`openssl dgst -sha512 -binary sidioralabs-rex-0.2.0.tgz | openssl base64 -A`).

Then install it the way a user starts an app: `tools/smoke-package.sh` on the release asset, or `pnpm add @sidioralabs/rex@0.2.0` in a fresh `rex new` app followed by `rex check`, `rex build` and `node dist/server.js`.

## 8. Roll back

A version on npm is immutable, so a bad release is superseded, hidden or, within a short window, removed. All of these are registry operations by a release manager with an npm login and 2FA; they publish nothing, so the rule that nothing is published from a local machine still holds.

- **Within 72 hours and with no dependents**, the registry allows `npm unpublish @sidioralabs/rex@0.2.0`. The version number is burnt: the fixed release is `0.2.1`, never a second `0.2.0`.
- **Otherwise**, deprecate it with the reason and the version to use: `npm deprecate @sidioralabs/rex@0.2.0 "broken build; use 0.2.1"`. Installs of the exact version warn, and caret ranges resolve past it once the fix is published.
- **Move `latest` back** while the fix is prepared, so new installs do not pick the bad version: `npm dist-tag add @sidioralabs/rex@0.1.0 latest`. The next publish from the workflow sets `latest` again.
- **On GitHub**, edit the release notes to say what is wrong and which version to use (`gh release edit v0.2.0 --notes-file ...`), and mark it a pre-release so it is no longer shown as the latest release (`gh release edit v0.2.0 --prerelease`). Delete the release and its tag (`gh release delete v0.2.0 --cleanup-tag`) only for a version that was unpublished; a version that stays on the registry keeps the tag that built it.
- **Then release the fix** through the normal path: bump to the next patch, changelog, land `main`, tag.

### When the workflow fails

- **In `prepare`** (tag and version differ, or no changelog section): nothing ran. Land the fix on `main`, delete the tag locally and on the remote (`git tag -d v0.2.0 && git push --delete origin v0.2.0`), and tag the new commit.
- **In `prepare` because the tag is not on `main`**: nothing ran. Delete the tag, land the commit on `main` through a pull request, and tag the `main` commit.
- **In `checks` or `publish`**: nothing was published (`npm publish` is atomic). Fix on `main`, move the tag as above, and push it again; every job runs again.
- **In `verify-published`** (the version is on npm but does not install or import): no GitHub release is created. Re-run the job once in case the registry was slow; if it fails again, roll the version back as above and release the fix.
- **In `release`** (the version is on npm, the GitHub release is missing): re-run the failed jobs of the same run from the Actions page; the `package` and `release-notes` artifacts are still attached to it. If the run is gone, create the release by hand as in the first-version steps above.

## Deploying the site

The site is the Rex app under [site/](../site/README.md), built with `rex build --target static` and served by GitHub Pages from the root of `https://rex.sidioralabs.com`, the host every REX error docs link points at. Nobody deploys from a local machine: every push to `main` that touches the site, the docs, the package, the changelog or the workflow deploys it through [.github/workflows/site.yml](../.github/workflows/site.yml).

### The workflow

The workflow runs on every push and pull request that touches `site/`, `docs/`, `packages/rex/`, `CHANGELOG.md`, `tools/serve-static.mjs`, `tools/site-verify.mjs`, `pnpm-lock.yaml` or the workflow itself. Its default permissions are `contents: read`; every action is pinned by commit SHA, every job runs on Node 24.22.2 on `ubuntu-24.04` with a timeout, and every pnpm job uses the pnpm cache of `actions/setup-node`. A pull request run is cancelled by a newer push to the same pull request; a run on `main` is never cancelled.

| Job      | Runs                                                                                                                                                                                                                                                                                                                | Needs    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `verify` | Builds rex, runs the `tools/serve-static.mjs` tests, `pnpm -C site check`, `pnpm -C site test:unit` and `pnpm -C site build`.                                                                                                                                                                                       |          |
| `e2e`    | Builds rex, runs `pnpm -C site build:static`, installs Chromium, Firefox and WebKit and runs `pnpm -C site test:e2e` against `site/dist/client` served by `tools/serve-static.mjs`; uploads the reports as the `site-e2e-report` artifact. On a push to `main` it uploads `site/dist/client` as the Pages artifact. | `verify` |
| `deploy` | On a push to `main` only, in the `github-pages` environment with `pages: write` and `id-token: write`: `actions/configure-pages` and `actions/deploy-pages`. Deployments run one at a time in the `pages` concurrency group and are never cancelled.                                                                | `e2e`    |

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
