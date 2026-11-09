# Rex 0.4: release integrity, secure defaults and production basics

Status: **specified; no task has run; every verification case is UNRUN**.

This feature turns the November 2026 audit of commit `5fe1aa2` into work that a fleet can execute and a reviewer can check. The audit found a coherent design with four gaps: the published package does not import, the defaults are unsafe, production basics are missing, and no gate on `main` has ever passed. This pack orders the fixes into nine waves, names the interface each wave hands to the next, and states the evidence each task owes before it counts as done.

The audit report is kept outside this repository. Tasks cite its item numbers in their `audit` key and state the behaviour required, not how a defect could be abused.

## Read in this order

| Document | Purpose |
|---|---|
| [Specification](spec.kvx) | Normative requirements, acceptance clauses, tasks with dependencies and owned paths, and UNRUN verification cases. |
| [Design](design.body.md) | Product boundary, invariants, and how one task moves from claim to main. |
| [Decisions](decisions.md) | Fixed constraints, proposed choices and the evidence each choice still needs. |
| [Interface contracts](interface-contracts.md) | The rules for shared interfaces, with the ledger in [interfaces.kvx](interfaces.kvx). |
| [Fleet roles](fleet-roles.md) | The main integrator, the nine wave managers and the task workers, with the roster in [fleet.kvx](fleet.kvx). |
| [Verification](verification.md) | Evidence tiers, the task gate, the wave gate and what remains future evidence. |
| [Implementation plan](implementation-plan.md) | Generated wave and task view. |
| [Traceability](traceability.md) | Generated links from each acceptance clause to tasks, cases and interfaces. |
| [Qualification log](qualification.kvx) | Unrelated failures, contradictions and gaps found while working. |
| [Asks](asks.kvx) | Steps only a human can take, with their state. |

## Waves

| Wave | Scope | Manager | Starts after |
|---:|---|---|---|
| 0 | Green main and release integrity | `fm-rex-v04-0` | none |
| 1 | Security and correctness | `fm-rex-v04-1` | 0 |
| 2 | Request model and server | `fm-rex-v04-2` | 1 |
| 3 | Data and policy | `fm-rex-v04-3` | 2 |
| 4 | Routing and client | `fm-rex-v04-4` | 3 |
| 5 | Build and deploy | `fm-rex-v04-5` | 2 |
| 6 | Checker, testing and CLI | `fm-rex-v04-6` | 4 |
| 7 | Agent contract, accessibility and i18n | `fm-rex-v04-7` | 6 |
| 8 | Documentation, examples and release preparation | `fm-rex-v04-8` | 3, 5 and 7 |

The flow is drawn in [diagrams/waves.mmd](diagrams/waves.mmd).

## Authority and evidence

`spec.kvx` is the normative catalogue. A chapter that contradicts it is a defect to fix, not a licence to pick the easier reading. `implementation-plan.md` and `traceability.md` are generated and never edited by hand. Earlier Rex features keep their recorded statuses; this feature does not rewrite them.

`spec/workflow.kvx` selects `rex-v04` and defines the roles and gates. A task is done only when `hyperfide spec done` reruns its `verify_cmd` and it passes. A wave lands only when both gate scripts pass on the merged wave head. A command that appears in this pack is a requirement on future work; it is not a claim that the command exists or passes today.

Run the authoring check from the repository root:

```bash
python3 spec/rex-v04/tools/validate_spec.py            # structure, coverage, interface ledger, roster, links
python3 spec/rex-v04/tools/validate_spec.py --render   # also rewrites the two generated views and the report
hyperfide spec lint -f rex-v04                         # dependency cycles and path warnings
```

The validator executes no product code. Its report in [authoring-validation.json](authoring-validation.json) says so.

## Out of scope

Realtime transports, background jobs, islands, content collections, editor tooling and the other items the audit placed after 1.0 are not in this feature. React Server Components, file-system routing, route groups, rewrites, MDX and per-route runtimes remain non-goals.
