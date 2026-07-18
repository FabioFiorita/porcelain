# Plans — record & backlog

The `improve` skill's home. Two live docs sit alongside this index; the completed
plan files were removed after reconcile (**recoverable from git** — e.g.
`git show 0a7e59c:plans/025-unify-persistence-factories.md`). This file is the
standalone record of what shipped.

> Verification gate for every code change: `pnpm verify` (hook-enforced before
> any commit). Commit straight to `main` — the git-guard hook hard-blocks branch
> creation. Never push without the maintainer.

## Live docs (not finished — keep)

- **`nova-preset-and-light-dark-mode.md`** — preset switch `b1tNqHXYe` → `b5J4txmSY`
  (nova/neutral/sky, translucent menus) + persisted light/dark/system theme. PLANNED.
- **`remote-environments-phase4.md`** — Beelink bring-up runbook. Prep code +
  `npx porcelain-daemon@latest serve` path shipped; preferred remote UX is
  on-demand npx (no scp tarball / no always-on systemd). Its parent spec +
  Phase 1 doc shipped and were removed (in git history).

## Completed — the Review + chat claims + Linux release leg, 2026-07-18

Three workstreams shipped together (breaking changes sanctioned for this release);
the working docs were removed, **recoverable from git**
(`git show HEAD:plans/feature-view-proposal-notes.md`, `…:plans/chat-coordination-brief.md`,
`…:plans/linux-rebuild-map.md`):

- **The Review** — the feature view became ONE agent-authored document. The review-set
  schema gained `thesis` + `sections` (markdown prose, agent-rendered inline-SVG diagrams
  shown sandboxed, line-range anchors); the viewer renders thesis → flow-ordered walkthrough
  sections → a "More files" block → the loop-evidence **final chapter**. The
  **feature-artifact channel is deleted** (store/CLI/verbs/event/tab kind/companion skill),
  its narrative folded into the sections. The import-graph **baseline is gone** (`featureView`
  null → "No review yet" empty state; agent-only). The `artifact`/`evidence` tab kinds are
  removed; the Feature list is now the **outline** (J/K section nav, Z zen), and Feature Quick
  Access gained a Review group. Design now lives in the shipped code plus the
  `review-with-porcelain` companion skill and this shipped record — no separate spec doc.
- **Chat coordination claims** — a chat message can carry `--files`/`--intent`/`--closes`
  (a claim); the Chat tab's **Coordination** panel derives live claims + overlaps at read
  time (`lib/chat-claims.ts`), no new channel. Agent-authored claim paths are repo-contained
  before the panel opens one (`isContainedClaimPath` — the audit gap this truth-pass caught
  and fixed).
- **Linux release leg** — `release.yml` gained a Linux build/publish job (the port itself —
  window chrome, Ctrl-primary, opaque design — landed earlier in `b649dc9`).

Docs reconciled in the same pass: CLAUDE.md nomenclature, `architecture` (channel count
11→10, tab kinds, reading-surface rows), `audit` (artifact invariant → review-sections
invariant; chat-claim containment; evidence-as-chapter), `product`, and the
`review-with-porcelain` / `loop-evidence` / `sync-environments` companion skills.

## Completed — deep audit, 2026-07-05 → reconciled 2026-07-07 (`2e72017`)

All 15 plans (023–037) executed and spot-checked holding on HEAD at reconcile —
including the three whose files were touched again after landing (031/037 tailnet
+LAN listeners re-hardened in `0d1686b`, never-`0.0.0.0` bind invariant intact;
034's `answer_review_comment` survived the skills.sh plugin overhaul; 024's
`src/backend` skill pointers still resolve). Nothing drifted or was rejected.

| Plan | Title | Cat | Notes |
|------|-------|-----|-------|
| 023 | Failed autosave keeps the buffer dirty (silent data-loss fix) | bug | |
| 024 | Skills doc-truth pass (src/backend pointers, dead plan refs, "no port") | docs | |
| 025 | One durable-JSON factory (fold 4 hand-copied stores; cache modes; size cap) | tech-debt | |
| 026 | One working-tree snapshot per poll tick (dedupe 3s git spawns) | perf | |
| 027 | Daemon integration harness (auth gate, CORS, WS session) | tests | |
| 028 | WS-client characterization tests (reconnect, outbox, pending rejection) | tests | |
| 029 | Verify typechecks once; release builds once, ships the tested artifact | dx | Release path **proven** — v0.20.0–0.20.3 shipped via the build-once pipeline |
| 030 | Highlighting perf (cross-mount token LRU + fine-grained Shiki) | perf | Renderer assets 17M→8.4M |
| 031 | Tailnet posture: record the token blast radius; deterministic iface pick | security | |
| 032 | Clear build-path advisories (undici/form-data); stage Electron 43 | deps | Steps 1–3 shipped; prod audit clean. **Electron 43 staged, not executed** (pinned 42.6.0); override in `pnpm-workspace.yaml`; residual dev-only esbuild low accepted |
| 033 | Lint-enforce named-exports-only (noDefaultExport) | dx | |
| 034 | Agent comment replies (answer_review_comment; plugin 2.8.0) | direction | |
| 035 | Unread dots on the rail when the agent pushes | direction | |
| 036 | Branch-create in the picker + read-only PR-review spike | direction | Part A shipped; Part B (PR review) deferred — see below |
| 037 | Share on local network (LAN listener — tailnet without Tailscale) | direction | |

Audit coverage: all nine playbook categories, repo-wide (8 parallel auditors +
advisor vetting). Not audited: `node_modules`, generated bundles, marketing-site
copy beyond staleness.

## Deferred until requested

- **Read-only PR review** (plan 036 Part B). Full GO analysis — minimal shape,
  the exact reuse of the range-flow path, the two new helpers, costs, and 5 open
  questions with recommended answers — was written as a spike, verdict **GO / ~M
  effort**. **Decision: not building it until a user actually requests it** — the
  maintainer commits straight to `main` and doesn't use PRs, so the value is
  entirely for PR-using Porcelain users, of whom none have asked. Recoverable in
  full: `git show f8ef9ef:plans/spike-pr-review.md`. When a request lands, start
  there — don't re-analyze.

## Findings considered and rejected (don't re-audit these)

- **Truncated-numstat rename drop** (`diff.ts` guard): the proposed trigger can't
  occur — `execFile` rejects on `maxBuffer` overflow rather than delivering
  truncated output, and git doesn't emit partial `-z` records. Hardening-only.
- **Tailnet listener start/stop race** (`tailnet-listener.ts`): the error handler
  closes the listener (state stays consistent); the stop-before-listen window is
  milliseconds on a user-driven toggle. Not worth fixing.
- **`gitDiffFile` rename-probe misread** (LOW-confidence): needs a
  working-tree-rename repro before any fix; investigate only if a blank
  rename-diff is ever reported.
- **Terminal-roster hydrate clobber of an optimistic create**: documented,
  self-healing ≤5s, and the naive fix resurrects killed rows. Leave as-is.
- **Repo-scoping the daemon's file procedures**: breaks legitimate cross-repo
  viewer flows; the token holder IS the user. Recorded as an accepted decision
  (plan 031).
- **Consolidating the two markdown pipelines** (react-markdown vs
  tiptap-markdown): one renders, one edits — both load-bearing; consolidation
  costs more than it saves.
- **CONTRIBUTING.md / .env.example**: CLAUDE.md is the contributor contract; no
  `.env` is read (the `PORCELAIN_*` vars are dev/test harness flags).
- **node-pty 1.1.0 / tiptap-markdown 0.9**: pin-and-watch. node-pty's ABI
  compatibility gates every Electron major (checked in plan 032); tiptap-markdown
  is contained to one file — revisit at the next tiptap major.
- **Dev-tooling majors** (vite 8, @vitejs/plugin-react 6, @types/node 26,
  conventional-changelog 8, @base-ui/react 1.6): no security/EOL cost today;
  batch in a later maintenance pass.
- **`useNamingConvention` / explicit-return-type lint rules**: Biome 2.5 can't
  express the `handleX` ban or return-type requirement cleanly; they stay prose
  (recorded in plan 033).
- **`api.ts` split into nested tRPC routers** (~1068 lines, 76 procedures): real,
  but nesting renames every client call path (`trpc.gitCommit` → `trpc.git.commit`)
  — a wide mechanical diff the solo maintainer should opt into deliberately, not
  receive from an audit. Raise again if the file keeps growing.
- **Channel-store test-scaffolding dedup**: only sensible after 025 soaks; deferred.
- **`resolveImport`'s O(N²·M) scans in `flow.ts`**: only bites on cache-miss
  rebuilds of very large change sets; the fix needs an index that preserves
  ends-with semantics (MED risk). Reopen if large-repo flow builds measurably lag.
- **Marketing-site refresh + icon-regen script + daemon-deploy tooling**: real but
  low/uncertain value; the Beelink deploy tooling should wait until the hardware
  day proves what's actually painful.
- **e2e additions** (reconnect-after-crash, stage→commit flow) and **daemon
  spawn/restart state-machine tests** (`src/main/daemon.ts`): worthy test gaps
  ranked below 027/028; queue for the next round.
- **Feature-artifact multi-artifact + share/export**: MOOT — the feature-artifact
  channel was deleted on 2026-07-18 (folded into the Review's walkthrough sections).
  Any future "share a review" feature still inherits the unresolved auth boundary
  (the static server is deliberately unauthenticated); design that boundary first.
