## Spec task

<!--
The [task.*] this pull request implements, such as rex-v02/8.1. A change that has no task needs a
task first (CONTRIBUTING.md). A spec change names the [decision], [design] entry, [req.*] or task
list it edits instead, and states the problem, the chosen option and the options rejected.
-->

Task:

## What changed

<!-- The real change, in the words of the commit title. -->

## Verify evidence

<!-- One line per task, no prose: revision, verify_cmd, exit code, log path. -->

```
<revision> <verify_cmd> exit <code> <log path>
```

## Gates

- [ ] Typecheck: `pnpm -r typecheck` passes.
- [ ] Tests with coverage: `pnpm -C packages/rex exec vitest run --coverage` passes with the
      thresholds intact.
- [ ] `rex check` on the demo: `pnpm -C packages/rex build && pnpm -C examples/demo exec rex check`
      reports no errors.
- [ ] The walks: `pnpm -C examples/demo test` passes (operability, no-JS, axe, vitals, Lighthouse
      and screenshots), or the change touches nothing the demo renders and the description says so.
- [ ] Docs updated: `docs/`, `README.md`, `CHANGELOG.md` and the generated `examples/demo/AGENTS.md`
      (`rex manifest`) reflect the change, and `pnpm docs:check` passes.
- [ ] Spec updated: the `.kvx` source under `spec/` records the decision, design, criterion or task,
      the mirrors are regenerated with `cg spec render`, and `cg spec render --check` passes.
- [ ] One task per commit, in the house format (docs/development.md, Commit message format): eight
      lines ending in the quoted title with its `[spec:...]` tag and the `Signed By` line, then the
      `Co-Authored-By` trailer.

## Checks

- [ ] No assertion relaxed, bound loosened, type widened, silent fallback added, test skipped or
      deleted, or check disabled to make anything pass.
- [ ] No stubs, mocks or fake test doubles; the tests run real code paths with real types.
- [ ] Every control added or changed has its `data-rex` address, its sidecar entry and a visible
      counterpart, with no hover-only or drag-only interaction.
- [ ] No second pattern for anything Rex already has one pattern for.
- [ ] A breaking change carries a `deprecated()` warning with a REX code, a `rex migrate` codemod
      where code can be rewritten mechanically, and a CHANGELOG entry with its migration.
- [ ] A failure this pull request could not fix inside its own files is recorded once in
      `spec/<feature>/qualification.kvx`.
