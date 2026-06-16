# Implementation Plans

Two advisor runs contributed to this directory, both against commit `e1f8d02`
(v0.6.0):

- **`/improve next`** (direction run) → plans **006–009**: roadmap spikes + builds.
- **`/improve deep`** (full audit, 2026-06-16) → plans **010–021**: bugs, security,
  tests, tech-debt, perf, DX, docs.

A still-earlier hardening run (plans 001–005: external-URL allowlist, large-file
guard, durable config store, hidden-path tests, glaze) has **shipped**; those plan
files were removed from the tree. Numbering stays monotonic so cross-references
never collide.

Each executor: read the plan fully before starting, honor its STOP conditions, and
update your row below when done. Per `CLAUDE.md` hard rule 8, every executor
**commits straight to `main`, never branches**, and runs the gate (`pnpm lint &&
pnpm typecheck && pnpm test && pnpm build`) before committing.

## Execution order & status

> **Execute run (2026-06-16).** All 12 audit plans (010–021) plus the two concrete
> builds (008, 009) were executed by dispatched subagents in an isolated worktree and
> reviewed plan-by-plan (diff + scope + targeted tests + new-test audit). They live as
> 16 commits on branch **`improve/execute-all`** (based on current `main` `cbdee99`),
> NOT yet merged — merging is the maintainer's call. Final full gate on the complete
> branch is green: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass
> (228 tests, 31 files). **The two direction spikes (006, 007) were also run** at the
> maintainer's request: 006 landed an inert, tested data-layer prototype (commit
> `4b67dea`) + a design memo (`006-…notes.md`); 007 is a pure design memo
> (`007-…notes.md`, no code). Both stop before the product decision they tee up —
> 006's review surface, 007's annotation channel direction — which remain the
> maintainer's calls (hard rule 1). **One CI follow-up:** plan 020's release-gate e2e
> step (`pnpm test:e2e` in `release.yml`, kept at the maintainer's request) is
> unvalidated and may fail on screenshot-baseline AA drift on the first tagged release
> — that's baseline drift, not a regression; regenerate on a matching env if it trips.

### Direction plans (from the `next` run) — roadmap

| Plan | Title | Kind | Priority | Effort | Depends on | Status |
|------|-------|------|----------|--------|------------|--------|
| 006 | Branch/base-diff review (review the cumulative diff vs merge-base) | spike+prototype | P1 | M | — | DONE — spike (prototype `4b67dea` + memo `006-…notes.md`); **surface decision pending maintainer** |
| 007 | Close the agent loop (review feedback flows back via MCP) | design spike | P1 | M | — | DONE — spike (memo `007-…notes.md`, no code); **channel-direction decision pending maintainer** |
| 008 | Mark-as-reviewed — review progress on the Changes list | build | P2 | S–M | — | DONE (`e7f556f`, on `improve/execute-all`) |
| 009 | Project-wide content search (Cmd+Shift+F) | build | P2 | S–M | — | DONE (`f4d0301`+`01d7939`, on `improve/execute-all`) |

### Audit plans (from the `deep` run) — correctness, security, quality

| Plan | Title | Category | Priority | Effort | Risk | Depends on | Status |
|------|-------|----------|----------|--------|------|------------|--------|
| 010 | Fix `-z` rename parsing (`parseStatus` + `parseNumstat`) | bug | P1 | S | LOW | — | DONE (`0824bc5`) |
| 011 | Constrain agent review-set paths to the repo | security | P1 | S | LOW | — | DONE (`8b19ec9`) |
| 012 | Capture the repo for notes autosave (no wrong-repo flush) | bug | P1 | S | LOW | — | DONE (`be21bbf`) |
| 013 | Key every viewer tab branch by its identity | bug | P2 | S | LOW | — | DONE (`cff4312`) |
| 014 | Guard per-file diff reads in `featureReading` | bug | P2 | S | LOW | 016 (optional test only) | DONE (`ad1cfd6`; injected-failure test deferred — `api.ts` imports electron) |
| 015 | Stop `gitGrep` swallowing real failures as "no matches" | bug | P3 | S | LOW | — | DONE (`7ae08d2`) |
| 016 | Characterize the MCP dispatch + the feature cache keys | tests | P2 | M | LOW | — | DONE (`5acd715`) |
| 017 | Consolidate layer grouping + precompile its regexes | tech-debt/perf | P2 | M | LOW | 016 (soft — safety net) | DONE (`f6a4054`) |
| 018 | Defer editor syntax highlighting off the keystroke path | perf | P2 | M | LOW | — | DONE (`9383e31`) |
| 019 | Point VS Code at Biome (not Prettier/ESLint) | dx | P3 | S | LOW | — | DONE (`5d28b5d`) |
| 020 | Add `verify` script, run e2e checks in CI, pin Node | dx | P3 | M | MED | — | DONE (`8b9d44c`; ⚠ Step 4 release-gate e2e needs maintainer first-run validation) |
| 021 | Fix stale `CODEBASE_GUIDE.md` references | docs | P3 | S | LOW | — | DONE (`767b626`) |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

## Recommended sequencing

**Audit plans first if you want risk down fast:** the P1 cluster (010 → 011 → 012)
fixes a data-display bug, a security boundary, and a silent wrong-repo write — all
S-effort, LOW-risk, HIGH-confidence. Then the P2 quality plans (013 → 014 → 016 →
017 → 018), then the P3 hygiene (015 → 019 → 020 → 021). Every audit plan is
independent enough to do alone.

**Direction plans are strategy, not cleanup:** 006 → 007 is the strategic spine
(branch review gives the unit people actually review in the agent era; the agent
loop-back is what you do with what you find). Do those spikes when you're ready to
make product decisions; 008 and 009 are cheap independent builds you can land
anytime (008 clones the `pinnedPaths` feature; 009 reuses the `gitGrep` backend +
the Cmd+P overlay).

If executing non-interactively, do the audit P1/P2 plans and the two concrete
direction builds (008, 009); treat 006/007 as producing memos for the maintainer.

## Dependency notes

- **No audit plan hard-depends on another.** Two soft couplings: 017 (flow
  refactor) is safest *after* 016 (which adds cache-key + MCP-dispatch
  characterization), though the existing `flow.test.ts`/`feature-view.test.ts`/
  `feature-explore.test.ts` already pin 017's output; and 014's *optional* injected-
  failure test only becomes writable once 016 makes `api.ts` testable (014's fix
  itself is independent — don't block it).
- **Direction plans 006/007** are sequenced by *value*, not code: 006's data unit
  (a committed branch) makes 007's loop meaningful. Both deliberately stop before
  UI/router/channel-shaping decisions (hard rule 1 — get maintainer approval before
  a new pattern); their build plans come after the memos.

## Findings considered and rejected (do not re-audit)

From the `deep` audit (vetted, deliberately not planned):

- **`resolveImport` alias-suffix false positives** (`flow.ts:81`): documented
  heuristic; affects only cosmetic "connects" hints, not diff correctness. Not
  worth tsconfig-paths machinery.
- **Unbounded MCP promise-chain growth** (`server.ts:67`): errors caught internally,
  tiny call volume over a short session. Negligible.
- **`sliceSource` bracket-counting in strings/comments** (`feature-slice.ts`):
  bounded by caps + whole-file fallback; a robust fix needs a tokenizer, which the
  "no LSP" rule rejects. Investigate-only.
- **PERF (feature-reading O(files²), `JSON.stringify` memo key on large trees,
  unthrottled hover prefetch)**: real but bounded by existing memo/caps; magnitudes
  unproven without profiling. Hold for a measured cost.
- **DEBT (import-parser triplication, duplicated `FileRow` markup, `handleClear`
  naming)**: minor; lower leverage than the grouping consolidation (017).
- **SEC (`will-navigate` hardening, `form-data` build-path advisory bump)**:
  defense-in-depth only (CSP `default-src 'self'` + forced `_blank` cover the
  navigation surface; `form-data` is dev/build-path only — prod audit is clean).
  Do opportunistically.

Carried forward from the shipped 001–005 run (still settled): arbitrary **local**
absolute-path reads = by-design; markdown XSS = N/A (no `rehype-raw`); unbounded
in-memory caches = bounded by ~1 repo/window; esbuild dev-only advisories =
build-time only.

From the `next` direction run (settled product decisions — do not re-audit):

- **Light theme / theme picker**: explicitly *cut* ("ship v1 with one dark theme").
- **Hunk-level staging**: file-granularity staging chosen deliberately.
- **Recursive/grid splits, embedded terminal**: rejected by product principle.
- **GitHub PR review**: strong adjacent-possible but **deferred, not rejected** —
  adds a network+auth dependency (the MCP design deliberately avoids an inbound
  surface) and overlaps with local branch review (006) + the agent loop (007).
  Sequence after the local-first surfaces prove out.

## Direction findings (from the `deep` run — options, not planned here)

The `next` run already turned several roadmap ideas into plans 006–009. The deep
audit surfaced these additional grounded options (each would start as a design/
spike, not a build):

- **Agent-session integration** (the dangling `history` bullet; product is an
  "agent companion" but the only agent surface is the one-way review-set channel).
  Closely related to plan **007** (close the agent loop) — fold into that spike.
- **Explore-flow alias resolution** (`feature-explore.ts` walks relative imports
  only; the ~50 GB monorepos Porcelain targets mostly use `@/`-aliased imports, so
  explore silently under-walks). Parse tsconfig `paths` once, feed the resolver into
  the walker. M effort.
- **Surface the agent's invariant `note`s as a review checklist** (carried in the
  schema, rendered only as scattered per-row flags). A derived "Invariants to check"
  Quick Access card — S–M, no schema/MCP change.
- **Decouple the MCP server from Claude-Code-only distribution** (the stdio server
  is already agent-agnostic; only the one-click install is Claude-specific). A
  Settings "use with another agent" block — S, additive.

## What the deep audit did NOT cover

Whole repo, all nine categories. Not exercised: the release/signing pipeline
end-to-end (notarization), live profiling of the perf findings (magnitudes are
reasoned from code + bounds, not measured), the `ui/` shadcn primitives (vendored,
intentionally untested), and product-level UX review of the visual surfaces (glaze
rollout, split-view ergonomics) beyond the direction findings.
