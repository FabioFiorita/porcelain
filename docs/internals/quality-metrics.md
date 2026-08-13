# Quality metrics

What the repo measures about **whether its tests are worth anything** — as opposed to the
architecture gates, which measure structure. Read this before changing a threshold, adding a
metric, or arguing with a number.

## Why this exists

The architecture gates already cover half of the usual code-quality checklist: dependency
direction, module sizes, escape hatches, contract parity. Nothing covered the other half. A suite
can grow to 3,600 passing tests and still prove very little, because a test that never asserts the
condition it was written for still counts as a passing test and still lights up a coverage report.

So: structure was measured, tests were not. This closes that.

## The metrics

| Metric | Source | What it actually tells you |
|---|---|---|
| Statement / branch coverage | `@vitest/coverage-v8`, per domain and per package | Which code the suite *reaches* — a floor, never a target |
| Cognitive complexity | Biome `noExcessiveCognitiveComplexity`, run via `--only` | Which functions are too branchy to reason about or to test honestly |
| Module size | `ARCHITECTURE_LINE_CEILING` (450) over production source | Same ceiling the architecture gate enforces, reported as a distribution |
| Dead code | `knip` | Unused exports, files, and dependencies — the debt that inflates every other number |
| Test shape | `scripts/quality/test-shape.mjs` (TS AST) | Tests that pass without proving anything |

Run it:

```bash
pnpm quality            # scorecard; reuses a coverage report under an hour old
pnpm quality:baseline   # fresh suite run, then snapshot to scripts/quality/baseline.json
pnpm test:coverage      # coverage alone, no scorecard
pnpm lint:test-shape    # the gate that runs on every commit
node scripts/quality/test-shape.mjs --list   # every shape finding, not just the head
```

## Test shape: the half coverage cannot see

A test that renders a component and asserts nothing executes every line it touches and reports as
**covered**. Coverage is structurally blind to it. The AST scan reads six shapes:

| Kind | Gated | Why |
|---|---|---|
| `focused` | yes | `.only` silently skips every sibling in the file |
| `disabled` | yes | `.skip` / `.todo` / `xit` — not a test |
| `tautology` | yes | `expect(true).toBe(true)` cannot fail |
| `no-assert` | yes | reaches no assertion, directly or through a file-local helper |
| `weak-only` | no | only `toBeDefined` / `toBeTruthy` / bare `toHaveBeenCalled` |
| `mock-only` | no | asserts mock call state, never a value or the DOM |

The four gated kinds all measured **zero** when the gate landed; it exists so they stay there. The
fix for a gated finding is to write the assertion or delete the test — never to skip it.

`weak-only` and `mock-only` are deliberately *not* gated. They are judgment calls, and gating a
judgment call teaches people to write around the gate rather than think. They are reported so a
domain owner can look.

Shape is a proxy, and it has a hard limit: it cannot see a spec that passes because a sibling left
the fixture in the wrong state. That needs semantics, which is mutation testing's job.

## Read coverage by domain, not in total

A repo-wide percentage is close to meaningless — it moves when generated code lands and stalls
when the hard code is skipped. The number that means something is per **domain**, because a domain
spans `packages/contracts`, `apps/daemon`, `packages/client-runtime`, `apps/web`, and
`apps/mobile`. `pnpm quality` sums across all five roots so `git` reads as one number, the same way
the architecture gate treats it as one unit.

Two caveats that are design, not decay:

- **`apps/desktop` reads low** and should. It is the Electron shell — windows, menu, updater,
  spawn. Its contract is proved by `test:e2e:native` on a Mac, not by Vitest.
- **`apps/mobile` reads low** because screen tests belong in the native loop; the jsdom suite only
  globs the pure modules. See the `mobile` skill.

## Coverage is a floor, never a target

This is the one rule worth stating in prose, because getting it wrong makes the codebase worse.

Told to raise a coverage number, an agent will write tests that execute lines without asserting
behavior — and that is precisely the failure the metric was added to catch. A guard clause with a
test that never exercises the guard is *worse* than an untested guard, because it reports as safe.

So coverage is only ever used as a ratchet: it may not drop. It is never a goal to hit. The metric
that resists that pressure is mutation score, because the only way to raise it is to write an
assertion that pins behavior — and that is the intended next unit here, not a coverage percentage.

## Measurement only, for now

Nothing on this page fails a build. That is deliberate: a threshold chosen before anyone has read
the distribution is either toothless or permanently in the way. `scripts/quality/baseline.json` is
the committed snapshot the ratchet will be written against, and it is regenerated with
`pnpm quality:baseline` — never hand-edited.

When the ratchet lands it follows the shape already used by `OVERSIZED_PRODUCTION_FILES` in
`scripts/architecture/domains.mjs`: a per-entry ledger that may shrink and may not grow.

## Keeping the instruments honest

Both of these were wrong on the first run, and both would have produced confident nonsense:

- **Coverage `include` globs cannot climb out of `test.root`.** The suite spans every package, so
  `apps/desktop/vitest.config.ts` sets `test.root` to the monorepo root. With the root left at
  `apps/desktop`, coverage silently reported 15 files and 654 statements instead of 921 and 26,167
  — a plausible-looking report of almost nothing.
- **knip needs per-workspace `paths`.** `apps/daemon`, `apps/web`, and `packages/client-runtime`
  have no tsconfig of their own (they typecheck through `apps/desktop`), so knip could not resolve
  `@shared/*` or `@backend/*` and reported 405 phantom "unlisted dependencies". With the aliases
  declared per workspace in `knip.json`, that is 1.

If a leg of the scorecard cannot run, it reports **not measured** rather than zero. A metric that
fails open is a metric that lies.

## Two holes this found, and what closed them

**The visual e2e lane had no runner.** `visual.spec.ts` holds nine tests — screenshot baselines
plus real layout assertions like the sidebar ring geometry — and the only script that named it was
`test:e2e:update`, which always passes `--update-snapshots`. Its baselines were rewritten on every
run and never compared, so the regression net was cast exactly never. `test:e2e:visual` runs it as
a check and CI runs it after `test:e2e`. Regenerate baselines deliberately with `test:e2e:update`,
never as a way to make a red run green.

**Test files were outside every TypeScript project.** `tsconfig.node.json` and `tsconfig.web.json`
both excluded `**/*.test.ts`, and only `tsconfig.mobile-tests.json` included any tests at all. A
`const x: number = 'string'` in a web test file passed `pnpm typecheck`, and an `expectTypeOf`
assertion asserting something false passed both vitest and tsc — inert in every gate it appeared
to satisfy.

`apps/desktop/tsconfig.tests.json` is now the project that checks them, and `pnpm typecheck:tests`
runs it as part of `pnpm verify`. Turning it on surfaced **127 errors across 47 files**, which is
too many to clear in one sitting and far too many to leave a gate red over — so it uses the same
shrink-only ledger shape as `OVERSIZED_PRODUCTION_FILES`: `scripts/quality/test-types-ledger.json`
records each file's count, counts may shrink or hold, growth fails, and a file absent from the
ledger must be clean. Re-record with `pnpm typecheck:tests:ledger` after fixing some.

Nearly all of the backlog is two shapes, and both are the masking problem expressed in types:

- **`as const` fixtures.** `reviewContractFixtures…output[0]` infers `body: "Synthetic comment."`,
  so a test building a variant is a type error rather than a case. Widen to the contract type
  (`ReviewComment`, `PorcelainError`) — never clone the fixture to dodge it.
- **Untyped mocks.** `vi.fn(() => ({ ok: true, value: x }))` infers `{ ok: boolean }` and is handed
  to a port that returns a discriminated union. A test asserting against that mock asserts against
  a fiction, and stays green when production narrows away from it. Type the mock to the port.

One defect this immediately caught: `terminal-stream-gateway.test.ts` imported `TerminalAttachValue`
from `@porcelain/contracts/terminal`, which has never exported it. Type imports erase at runtime,
so vitest was happy and no project typechecked the file.
