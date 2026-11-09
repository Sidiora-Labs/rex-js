# Fleet roles

Status: roles assigned; the mechanics below were verified by a discarded pilot on 2026-11-09. The roster is [fleet.kvx](fleet.kvx) and the templates are in `spec/workflow.kvx`.

## Roles

| Role | Agent | Branch | Cut from | Writes |
|---|---|---|---|---|
| Main integrator | `rex-main` | `main` | n/a | `main` only, by landing a gated wave |
| Feature manager for wave N | `fm-rex-v04-N` | `wave/rex-v04/N` | `main` | Its wave branch: merges, wave-close regeneration, gate fixes |
| Task worker for task W.N | `w-rex-v04-W.N` | `task/rex-v04/W.N` | `wave/rex-v04/W` | Its task branch, inside its `touches` |

## Feature managers

| Manager | Wave | Scope | Tasks | Owner lanes |
|---|---:|---|---|---|
| `fm-rex-v04-0` | 0 | Green main and release integrity | 0.1 to 0.12 | release, quality, client, cli, docs |
| `fm-rex-v04-1` | 1 | Security and correctness | 1.1 to 1.15 | security, server, client, build, data |
| `fm-rex-v04-2` | 2 | Request model and server | 2.1 to 2.9 | server |
| `fm-rex-v04-3` | 3 | Data and policy | 3.1 to 3.5 | data |
| `fm-rex-v04-4` | 4 | Routing and client | 4.1 to 4.8 | client |
| `fm-rex-v04-5` | 5 | Build and deploy | 5.1 to 5.8 | build |
| `fm-rex-v04-6` | 6 | Checker, testing and CLI | 6.1 to 6.9 | checker, quality, cli |
| `fm-rex-v04-7` | 7 | Agent contract, accessibility and i18n | 7.1 to 7.7 | agent, a11y |
| `fm-rex-v04-8` | 8 | Documentation, examples and release preparation | 8.1 to 8.11 | docs, quality, release |

## Main integrator duties

1. Keep the spec, the interface ledger and the roster valid; run the validator before each wave.
2. Start a wave manager only when every wave in its `after` list has landed on `main`.
3. Read each wave report. Check the gate evidence lines and the qualification entries. Do not rerun a passed task gate.
4. Land the wave with `hyperfide fleet land N` behind the test and lint gates. Resolve conflicts with `main` on the wave branch, never on `main`.
5. Record Asks and never perform a human-only step.

## Feature manager duties

1. Cut the wave branch and confirm the consumed interfaces are stable on it.
2. Start one worker per eligible task, at most eight at a time. Give each worker its task id, the clauses, the interface blocks it provides and consumes, and the audit item numbers.
3. Order merges so tasks that share a path merge in ascending id order. A later worker syncs with `hyperfide fleet sync` before it qualifies.
4. Review each returned branch against its clauses and its `touches`. Reject a diff that weakens a check, adds a fake, or edits outside `touches` without a recorded widening.
5. Merge a task the worker marked done with `hyperfide fleet merge-up W.N`. The worker runs `hyperfide spec done W.N` in its own worktree first. Never use `--force` on a task whose `verify_cmd` failed.
6. Update a provided interface to `stable` in the ledger when its provider is done, and tell consumers if the signature changed.
7. At wave close: regenerate `docs/api` and `docs/errors.md`, run the formatter, run both gate scripts once on the wave head, set the wave gate case, and write the wave report.
8. Report implemented-not-qualified honestly. A task that ran out of budget stays `implemented` with its failing command, exit code and log path.

## Task worker duties

1. Read the task, its clauses, its interfaces and the cited audit items before writing.
2. Write the entire implementation and its tests first. Use real code paths and real types. No stub, mock or placeholder to make a test pass.
3. Qualify once: format touched files, one typecheck, one `verify_cmd`. Repair at most twice.
4. Stay inside `touches`. Widen with a reason when a path is truly needed. Append only to shared registries.
5. Record an unrelated failure once in the qualification log and do not fix it.
6. Commit in the house format on the task branch and report revision, command, exit code and log path in one line.

## Verified mechanics

These were observed with Hyperfide 2.2.0 on this repository. Every command runs with the role environment set: `HYPERFIDE_AGENT`, `HYPERFIDE_ROLE`, `HYPERFIDE_PARENT`, `HYPERFIDE_FEATURE=rex-v04` and `HYPERFIDE_WAVE`.

1. `hyperfide fleet begin W.N --agent w-rex-v04-W.N` cuts the wave branch on first use, cuts the task branch from the wave head, creates the worktree under `.codegraph/worktrees/task-rex-v04-W.N` and takes the claim. It is run from the repository root.
2. A claim is refused while a live claim lists an overlapping `touches` path, and the refusal names the path. Same-wave tasks that share a path therefore run in rounds. The claim frees once the holder is done and merged up.
3. A claim lasts 30 minutes. The worker renews it with `hyperfide spec heartbeat W.N --agent w-rex-v04-W.N --ttl 180` right after `spec start`.
4. A new worktree has no dependencies. `pnpm install --frozen-lockfile --offline` takes a few seconds and warns about the missing `rex` bin until the package is built.
5. `hyperfide spec start W.N` and `hyperfide spec done W.N` edit `spec/rex-v04/spec.kvx` and `spec/rex-v04/tasks.md` in the task worktree. The worker commits those edits with its work.
6. `hyperfide spec done W.N` runs the `verify_cmd` and then checks each `touches` path. A declared path that does not exist and was not created is reported. Remove such a path from the task's `touches` only when the task truly did not need it, and record that in the qualification log.
7. `hyperfide fleet merge-up W.N` runs from the task worktree, needs the task done, and merges into the wave worktree at `.codegraph/worktrees/wave-rex-v04-W`. The manager runs the wave-close work in that worktree.
8. A task branch cut before a later merge-up is behind the wave head. `hyperfide fleet sync` in the task worktree brings the wave head in.
9. Parallel workers each change one status line in `spec.kvx` and `tasks.md`, so those merges are clean. The derived views go stale and the manager re-renders them once at wave close.

## Commit format

Every commit follows the eight-line house format in `docs/development.md`, written with `git commit -F`. The signature line names the role: `Rex Task Worker w-rex-v04-W.N`, `Rex Feature Manager fm-rex-v04-N` or `Rex Main Integrator rex-main`.

## Wave report

A wave report has five parts and no prose beyond them: the wave head revision; one evidence line per task; the two gate evidence lines; the list of qualification entries added; the list of Asks raised. An evidence line is revision, command, exit code, log path.
