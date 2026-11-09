# Verification

Status: 97 cases defined: 15 PASS, 1 FAIL and 81 UNRUN. Only wave 0 commands in this chapter have been executed for this feature.

## What counts as evidence

Evidence is a command that ran on a named revision, its exit code and a kept log. A test file that exists, a command listed in a task, a worker's sentence and a generated view are not evidence.

| Tier | Meaning | Runs |
|---|---|---|
| component | Named unit tests for the task's modules | In the task `verify_cmd` |
| integration | Tests that cross modules, processes or the file system | In the task `verify_cmd` |
| e2e | A full scaffold, example or tutorial run | In the task `verify_cmd` |
| release | Both gate scripts on a merged wave head | Once per wave by the manager |
| external | Needs a hosted runner, a host account or the registry | Not run in this feature; recorded as future |

## Task gate

1. Format the touched files.
2. Run one typecheck of the touched package.
3. Run the task `verify_cmd` once.
4. On failure, repair inside the task and rerun. Two cycles at most.
5. `hyperfide spec done W.N` reruns the command and records the result. The task case moves from UNRUN to PASS only then.

A task that cannot pass inside its time limit stays `implemented`. Its case stays UNRUN or becomes FAIL with the failing command, exit code and log path. It is never marked done by force.

## Wave gate

Each wave has one release case, `RX4-900` to `RX4-908`. The manager runs `tools/gate-test.sh` and `tools/gate-lint.sh` once on the wave head after every task branch is merged. Both must exit 0. Browser suites inside the test gate need Playwright browsers installed on the machine; a gate that could not start a browser is BLOCKED, not PASS.

## Rules that protect the evidence

- No assertion is relaxed, no bound loosened, no test skipped or deleted to pass a gate.
- No stub, mock or fake stands in for the code under test. Local servers started by a test, such as a registry fixture server or a PostgreSQL process, are real processes and are allowed.
- A test that cannot reach what it needs fails. It does not skip silently.
- A passed task gate is not rerun by the manager or the integrator.
- An unrelated failure is recorded once in [qualification.kvx](qualification.kvx).

## Required future evidence

These are outside what this feature can prove. Each stays open until the named run exists.

| Subject | Needed run |
|---|---|
| Platform matrix | First green CI run of the Node and operating-system matrix declared by task 0.11 |
| Runtime adapters | Green Bun, Deno and workerd smoke jobs in CI |
| Browser matrix | Green Firefox and WebKit projects in CI |
| Host adapters | One deployment per host serving the demo, for Cloudflare, Vercel and Netlify |
| Registry package | The post-publish job installing 0.4.0 from the registry and importing every entry |
| Release provenance | A signed `v0.4.0` tag on `main` published through trusted publishing with an attestation |
| Site | `rex.sidioralabs.com` resolving and serving the built site |

## Authoring validation

`python3 spec/rex-v04/tools/validate_spec.py` checks that every clause has a task and a case, that tasks and cases list each other, that the interface ledger and the roster agree with the tasks, and that chapter links resolve. It proves the pack is consistent. It proves nothing about the product.
