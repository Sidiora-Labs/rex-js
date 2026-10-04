# Rex governance

Rex (`@sidioralabs/rex`) is an MIT-licensed open source project stewarded by Sidiora Labs and developed in the open at `github.com/Sidiora-Labs/rex-js`. This document describes who decides what, how decisions are made and recorded, who may cut a release, and how the project stays alive when any one person steps away.

## Principles

- **The spec is the record.** Every accepted change is described in the feature spec under `spec/` before it is built: `[decision]` records what Rex chooses, `[design]` records how, `[req.*]` states acceptance criteria and `[task.*]` lists the work. A decision that is not in the spec has not been made.
- **Convention over options.** Rex exists to remove micro-decisions. Proposals that add a second pattern for something Rex already has one pattern for are declined unless they replace the existing pattern through a deprecation and a codemod.
- **Agent operability is not negotiable.** Every UI surface Rex emits must stay operable by an agent driving a browser. A change that breaks the agent contract in [docs/agent-contract.md](docs/agent-contract.md) needs a major version.
- **Decisions in public.** Proposals, reviews, votes and their outcomes happen in GitHub issues and pull requests on the repository, so anyone can follow and cite them.

## Roles

| Role            | Who                                                            | Can                                                                                                            |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| User            | Anyone who uses Rex                                            | Open issues, ask questions, propose changes.                                                                   |
| Contributor     | Anyone whose pull request has been merged                      | Everything a user can, plus review pull requests (non-binding).                                                |
| Maintainer      | People listed in [MAINTAINERS.md](MAINTAINERS.md)              | Triage issues, approve and merge pull requests, approve spec changes, vote on governance decisions.            |
| Release manager | Maintainers marked as such in [MAINTAINERS.md](MAINTAINERS.md) | Tag releases and hold publish rights for `@sidioralabs/rex` on npm.                                            |
| Lead maintainer | One maintainer named in [MAINTAINERS.md](MAINTAINERS.md)       | Break ties, act as the conduct and security contact of last resort, and represent the project to Sidiora Labs. |

People and agents follow the same contract when they contribute: the workflow in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/development.md](docs/development.md). An agent's work is attributed to the maintainer or contributor who ran it, and that person is accountable for it.

## Decision process

### Everyday changes

Bug fixes, tests, documentation and changes that implement an existing `[task.*]` in the spec are decided by **lazy consensus**: a pull request with one approving review from a maintainer and no outstanding objection from another maintainer may be merged. A maintainer may not approve their own pull request when another maintainer is available; when the project has a single maintainer, that maintainer merges after the pull request has been open for at least two days.

### Spec changes

Adding or changing a `[decision]`, a `[design]` entry, a `[req.*]` acceptance criterion, or the task list of a feature is a spec change. A spec change:

1. is proposed as a pull request that edits the `.kvx` source under `spec/` and regenerates the mirrors with `cg spec render`;
2. states the problem, the chosen option and the options rejected;
3. stays open for at least five days so users and contributors can comment;
4. is accepted with approval from a majority of maintainers and no unresolved objection from a release manager on release impact.

Breaking changes to public API, the page folder convention or the agent contract also need a deprecation path (`deprecated()` warnings with a REX code) and, where code can be rewritten mechanically, a `rex migrate` codemod, as required by the versioning decision in the spec.

### Disagreement and votes

When consensus fails, any maintainer may call a vote on the issue or pull request. The vote stays open for seven days or until every maintainer has voted. Each maintainer has one vote; a simple majority of votes cast decides, and the lead maintainer breaks a tie. The outcome and the reasoning are recorded in the thread and, for spec changes, in the spec itself.

### Changing this document

Changes to this file, [MAINTAINERS.md](MAINTAINERS.md), [SECURITY.md](SECURITY.md) or [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) need a pull request open for at least seven days and approval from two thirds of maintainers (rounded up). With fewer than three maintainers, every maintainer must approve.

## Release authority

- Rex follows semantic versioning. Before 1.0, a minor version (0.x) may contain breaking changes, each listed in [CHANGELOG.md](CHANGELOG.md) with its migration.
- A release is made only from `main`, only when every release gate in [docs/development.md](docs/development.md) passes on the release revision: the package tests, the typecheck, `rex check` on the demo, the demo walks (operability, no-JS, axe, vitals, Lighthouse and screenshots), `pnpm audit --prod`, the license review and `cg spec render --check`, plus every gate the feature spec adds for that release.
- A release manager prepares the release pull request (version bump in `packages/rex/package.json` and the changelog entry). Another maintainer approves it; with a single maintainer, the release manager self-approves after the gates pass.
- The release manager pushes a signed `v<version>` tag. The release workflow publishes to npm from GitHub Actions with npm provenance. Nobody publishes from a local machine.
- A security release may skip the waiting periods in this document. It still needs the release gates and is announced through a GitHub security advisory as described in [SECURITY.md](SECURITY.md).

## Becoming a maintainer

A contributor becomes a maintainer when an existing maintainer nominates them in a pull request that adds them to [MAINTAINERS.md](MAINTAINERS.md) and a majority of maintainers approve it. Nominations look for sustained, high-quality contributions over at least three months, sound review judgement, and adherence to the spec-driven workflow and the [code of conduct](CODE_OF_CONDUCT.md). Release managers are appointed the same way from among the maintainers.

## Stepping down and inactivity

A maintainer may step down at any time by opening a pull request that moves them to the emeritus list in [MAINTAINERS.md](MAINTAINERS.md). A maintainer who has not reviewed, merged or commented for six months is asked whether they wish to continue; without an answer within thirty days, the other maintainers may move them to emeritus by majority. Emeritus maintainers can return through a normal nomination. A maintainer may be removed for a code of conduct violation through the enforcement process in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Continuity

The project is set up to outlive any one person:

- The repository, the npm scope `@sidioralabs` and the release credentials belong to the Sidiora Labs organisation, not to individuals.
- The project aims to keep at least two release managers with npm publish rights and at least two people with administrator rights on the GitHub organisation. While it has fewer, adding a second is the first item on the maintainers' agenda.
- Everything needed to build, verify and release Rex is in the repository: the spec, the gates in `tools/`, and the CI and release workflows. No step depends on a private machine or a private document.
- If every maintainer becomes inactive, Sidiora Labs appoints new maintainers from the contributors, or archives the repository with a notice in the README naming the last supported version.

## Funding

Rex is free to use under the MIT [license](LICENSE). Sponsorship is not yet open; `.github/FUNDING.yml` lists the channels and GitHub will show them as the Sponsor button once Sidiora Labs' GitHub Sponsors profile is live. Sponsorship money is held by Sidiora Labs and spent only on the project: maintainer time, CI and infrastructure, security audits, and documentation. Sponsors gain no say in technical decisions; those follow the process above. Maintainers publish a short summary of income and spending in a pinned GitHub issue at least once a year.

## Code of conduct and security

Everyone taking part in the project follows the [code of conduct](CODE_OF_CONDUCT.md). Vulnerabilities are reported privately as described in the [security policy](SECURITY.md), never in public issues.
