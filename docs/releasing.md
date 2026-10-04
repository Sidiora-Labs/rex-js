# Releasing Rex

This page is for the release manager listed in [MAINTAINERS.md](../MAINTAINERS.md): how a version of `@sidioralabs/rex` goes from `main` to npm and to a GitHub release, what the release workflow checks on the way, the one-time npm and GitHub setup it depends on, how to verify a published version and how to roll one back. What a patch, a minor and a breaking change are is defined in [versioning.md](versioning.md); who may release, and from where, is defined in the [release authority](../GOVERNANCE.md#release-authority) section of GOVERNANCE.md.

The path is: bump the version, generate the changelog, land `main`, push the `v<version>` tag. The tag is the only trigger of `.github/workflows/release.yml`, which runs the CI gates again, packs the package, smoke tests the tarball in a fresh app, publishes it to npm through OpenID Connect with a provenance attestation, and creates the GitHub release with the changelog section of the version as its body. Nobody publishes from a local machine, and the workflow holds no npm token.

## 1. Bump the version

The version is the `version` field of `packages/rex/package.json`. Two other places must move with it:

- `REX_VERSION` in `packages/rex/src/index.ts`, which `rex new` writes into every new app as `"@sidioralabs/rex": "^<REX_VERSION>"`. `node tools/freshness.mjs --check` fails when it differs from `package.json`.
- The supported versions table of [SECURITY.md](../SECURITY.md) when the minor version changes.

Search the README and `docs/` for the previous version string before committing (`grep -rn "0\.1\.0" README.md docs`); the quick start quotes the range `rex new` writes. Commit the bump on its own, in the house commit format (`cg commit -m "..."`).

## 2. Generate the changelog

`CHANGELOG.md` is generated from git history by `cg changelog`, never written by hand. `clif.toml` at the repository root is the git-cliff reference configuration it is checked against: one release per tag, groups from the commit-subject prefix (`feat:`, `fix:`, `docs:`, ...; a subject without a prefix lands under Other), and a trailing `[spec:<feature>/<task>]` on the subject turned into a task reference. Run it after the bump commit, naming the release so that its section exists before the tag does:

```sh
cg changelog --tag v0.2.0 -o CHANGELOG.md
```

The section is headed `## [v0.2.0] - <date>` (`--tag 0.2.0` writes `## [0.2.0] - <date>`); without `--tag`, everything since the last tag stays under `## [Unreleased]` and the release workflow finds no section to publish. With `CENTRA_API_KEY` set, a model writes a Highlights paragraph at the top of the section; without it, the section lists the commits by group. Read the section through, because the workflow publishes it verbatim as the body of the GitHub release, then commit it.

The release workflow accepts a section headed `## [0.2.0] - <date>`, `## [v0.2.0] - <date>` or `## 0.2.0 (<date>)` for version `0.2.0`, and fails before any gate runs when none exists.

## 3. Land main

Open the release pull request with the two commits. Per GOVERNANCE.md another maintainer approves it; with a single maintainer, the release manager self-approves after the gates pass. Merge it into `main` and push. The CI workflow (`.github/workflows/ci.yml`) on the merge commit must be green: the release workflow runs the same jobs, so a red CI is a red release.

## 4. Tag

On the `main` commit that carries the bump and the changelog:

```sh
git switch main && git pull --ff-only
git tag -s v0.2.0 -m "Rex 0.2.0"
git push origin v0.2.0
```

The tag is `v` followed by the `version` of `packages/rex/package.json`, exactly; the first job of the workflow stops when they differ. The tag is signed, as GOVERNANCE.md requires. A pre-release version (`0.3.0-rc.1`, anything with a hyphen) is published under the npm dist-tag `next` instead of `latest`, and its GitHub release is marked a pre-release.

## 5. What the workflow does

`.github/workflows/release.yml` runs on every pushed `v*` tag, one run per tag (`concurrency: release-<ref>`, never cancelled), with `permissions: contents: read` for every job that does not need more. Every action is pinned by major version, every job has a timeout and every pnpm job uses the pnpm cache of `actions/setup-node`.

| Job            | Runs                                                                                                                                                                                                                              | Needs                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `prepare`      | Checks that the tag equals `v` + the package version; extracts the `CHANGELOG.md` section of that version into the `release-notes` artifact and fails when there is none.                                                         |                      |
| `verify`       | `pnpm -r typecheck`, `pnpm -C packages/rex test` (which includes the size budgets).                                                                                                                                               | `prepare`            |
| `lint`         | The demo's `eslint`, the root or per-package eslint config, the prettier check of `packages/rex/src` and `examples/demo` with the rex preset.                                                                                     | `prepare`            |
| `coverage`     | `vitest run --coverage` with the thresholds of `packages/rex/vitest.config.ts`; the report is uploaded.                                                                                                                           | `prepare`            |
| `demo`         | Builds rex, runs the demo unit tests, installs Chromium, then `pnpm -C examples/demo test`: `rex check` and the operability, no-JS, axe, vitals, Lighthouse and screenshot walks.                                                 | `prepare`            |
| `docs`         | `pnpm docs:check` (links and API pages) and `node tools/freshness.mjs --check --skip pointers`.                                                                                                                                   | `prepare`            |
| `supply-chain` | `pnpm audit --prod` and `node tools/license-review.mjs`.                                                                                                                                                                          | `prepare`            |
| `package`      | Builds rex, `pnpm pack`, runs `tools/smoke-package.sh` on the tarball, uploads the tarball that passed as the `package` artifact.                                                                                                 | `prepare`            |
| `publish`      | In the `npm` environment with `id-token: write`: installs an npm with trusted publishing, downloads the `package` artifact and runs `npm publish <tarball> --provenance --access public --tag latest` (`next` for a pre-release). | every job above      |
| `release`      | With `contents: write`: `gh release create v<version> <tarball> --verify-tag --notes-file release.md`, titled `@sidioralabs/rex <version>`, using the `release-notes` artifact.                                                   | `prepare`, `publish` |

The tarball that is published and attached to the release is the one the smoke test passed, carried between jobs as an artifact; nothing is rebuilt after the gates.

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

npm trusted publishing lets a GitHub Actions job publish by presenting its OpenID Connect token instead of an npm token: no secret is stored in the repository, and the registry records which repository, workflow and commit produced the version. It needs npm CLI 11.5.1 or later and Node 22.14.0 or later (the `publish` job installs `npm@latest` on the Node that `package.json` pins), GitHub-hosted runners, and, for the provenance attestation, a public repository and a public package.

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

The published version must carry a provenance attestation that names this repository, the tag's commit and `.github/workflows/release.yml`:

- The package page on npmjs.com shows a Provenance section ("Built and signed on GitHub Actions") linking the source commit and the workflow run; both must point at `Sidiora-Labs/rex-js`.
- `npm view @sidioralabs/rex@0.2.0 dist.attestations` prints the attestations URL on the registry and the provenance predicate type; a version published without provenance has no `attestations` field.
- In an app that installed the version, `npm audit signatures` reports the package among those with verified attestations.
- The tarball on the registry is the one attached to the GitHub release: `npm view @sidioralabs/rex@0.2.0 dist.integrity` matches the `sha512` of the release asset (`openssl dgst -sha512 -binary sidioralabs-rex-0.2.0.tgz | openssl base64 -A`).

Then install it the way a user does: `tools/smoke-package.sh` on the release asset, or `pnpm add @sidioralabs/rex@0.2.0` in a fresh `rex new` app followed by `rex check`, `rex build` and `node dist/server.js`.

## 8. Roll back

A version on npm is immutable, so a bad release is superseded, hidden or, within a short window, removed. All of these are registry operations by a release manager with an npm login and 2FA; they publish nothing, so the rule that nothing is published from a local machine still holds.

- **Within 72 hours and with no dependents**, the registry allows `npm unpublish @sidioralabs/rex@0.2.0`. The version number is burnt: the fixed release is `0.2.1`, never a second `0.2.0`.
- **Otherwise**, deprecate it with the reason and the version to use: `npm deprecate @sidioralabs/rex@0.2.0 "broken build; use 0.2.1"`. Installs of the exact version warn, and caret ranges resolve past it once the fix is published.
- **Move `latest` back** while the fix is prepared, so new installs do not pick the bad version: `npm dist-tag add @sidioralabs/rex@0.1.0 latest`. The next publish from the workflow sets `latest` again.
- **On GitHub**, edit the release notes to say what is wrong and which version to use (`gh release edit v0.2.0 --notes-file ...`), and mark it a pre-release so it is no longer shown as the latest release (`gh release edit v0.2.0 --prerelease`). Delete the release and its tag (`gh release delete v0.2.0 --cleanup-tag`) only for a version that was unpublished; a version that stays on the registry keeps the tag that built it.
- **Then release the fix** through the normal path: bump to the next patch, changelog, land `main`, tag.

### When the workflow fails

- **In `prepare`** (tag and version differ, or no changelog section): nothing ran. Land the fix on `main`, delete the tag locally and on the remote (`git tag -d v0.2.0 && git push --delete origin v0.2.0`), and tag the new commit.
- **In a gate, `package` or `publish`**: nothing was published (`npm publish` is atomic). Fix on `main`, move the tag as above, and push it again; every job runs again.
- **In `release`** (the version is on npm, the GitHub release is missing): re-run the failed jobs of the same run from the Actions page; the `package` and `release-notes` artifacts are still attached to it. If the run is gone, create the release by hand as in the first-version steps above.
