# Re-founding Porcelain

Status: proposed, awaiting sign-off. Delete when shipped; distil keepers into `docs/`.

## The request

Fabio proposed deleting the repo and starting over, citing a bad foundation accumulated across
pivots: agent harness → companion, MCP plugin → CLI/skills, multi-window → single window, LAN →
LAN + Tailscale, solo Electron Mac app → Linux daemon + web + Mac shell.

## The finding: the foundation is not the problem

The stated vision maps 7/7 onto `docs/product.md`, already on `main`:

| Vision | `docs/product.md` |
|---|---|
| Hide/pin files in a huge monorepo | "Scoped navigation — hide/pin folders in huge monorepos" (L30) |
| Story order, not alphabetical diffs | "Flow-ordered review — layers as a timeline of connected work" (L32) |
| Agent shows diagrams and tables | "Canvas evidence" (L19), "Review Canvas" (L40) |
| Mac as viewer of an always-on Linux box | "Remote as a product… local app, remote environment, or any browser" (L20) |
| Personal cross-project task board | "Tasks — one daemon-owned table… configurable columns… Quick Add with attachments" (L36) |
| Not a harness | "companion, not a cockpit… Do not rebuild an in-app agent runner" (L7, L24) |
| Commit composer, pull/push/history | "Git — diffs, worktrees, history, staging, commit composer" (L31) |

`docs/internals/nomenclature.md:66` likewise already demotes the Review to a Canvas *template*,
matching Fabio's own correction. `docs/internals/architecture.md` states dependency direction and
invariants at a quality comparable to t3code's `docs/internals/overview.md`.

**The docs are more right than they are believed to be. `CLAUDE.md` lags the docs; the code lags
both.** A rewrite would delete the daemon, the remote/token model, the worktree tree, the CLI seam,
19 lint gates, and 1,382 commits of monorepo performance work — in order to fix a documentation
genre gap and an enforcement gap.

**Verdict: no rewrite. Re-found in place, then delete hard against the re-founded pillars.**

## What is actually missing

Measured against the three reference repos:

1. **Per-surface behavioural decision docs** (paseo's genre). `docs/hover.md` opens: *"Read this
   before writing any hover code… The pattern is hardwon — copy it, don't reinvent it"*, and points
   at a canonical exemplar by `file:line`. Porcelain has no doc of this kind. Its `docs/internals/`
   is entirely process meta-docs (`agent-foundations`, `one-architecture`, `composition`,
   `quality-metrics`) — how to *work*, never how the product *behaves*.
2. **Audience separation** (t3code's genre): `docs/user/` for humans, `docs/internals/` for
   maintainers, `docs/operations/` for runbooks. Porcelain has only internals.
3. **Any gate tying code to product intent.** All 19 lint gates check *structure*. None asks "which
   pillar does this surface serve?", so harness-era surfaces pass every gate forever.
4. **Written decisions.** 19 lint gates, 2 ADRs.

## The core object: the worktree

Established from Fabio's notes, and it is the domain decision this plan turns on. Focus config and
review layers are not two features — they are **one per-worktree profile**, written by the agent
through the companion skill and CLI at worktree setup. Parallel agents across worktrees is the
working pattern; worktrees are how the product is read.

`docs/adr/0001` already promised this ("one persistent client shell that can connect to and navigate
across multiple local and remote Environments… tabbed and splittable inside that shell") and the
implementation still behaves as one window per worktree. Sixth instance in this planning
conversation of a complaint that is already a written decision. **Design runs ahead of execution;
the constraint is weekend capacity, not foundation.** Phase two therefore optimises for deleting
whatever competes for those hours, not for architectural purity.

## Pillars (amended by Fabio's notes)

1. **Worktree navigation** — many worktrees legible in one window, side by side, fast to switch.
   Create with a destination and branch picker plus a repo `create` hook; dispose with a `dispose`
   hook. The frame every other pillar hangs on.
2. **Per-worktree focus** — the full repo tree is always available; nothing is permanently hidden.
   Pinned and hidden paths are **dynamic per worktree**, set by the agent at setup so the tree
   matches the task. Stable worktree keeps the plain default.
3. **Per-worktree story layers** — flow ordering is likewise per worktree, because a web task and a
   mobile task have different layers. **Same mechanism as pillar 2** — one profile, one CLI seam,
   two pillars.
4. **Canvas** — the agent's free playground: explore a flow, review a flow, diagram, tabulate, write
   anything. HTML-first because humans read it easily. The four-step Review and explore-a-flow are
   **templates on the Canvas**, not features. Carries quantitative evidence as reading triage.
5. **Remote** — trivial to set up, and equally good locally. Fabio's own use is remote-first; most
   users will not be, so the Mac-local path must carry the same value.
6. **Tasks** — Linear-like, cross-project, screenshot-first quick add, agent picks work up from it.
   No task → canvas → execution chain required.

**Sequencing (agreed).** Pillars 1–3 are one build (the worktree profile). Pillar 4 is closest to
done, pillar 6 exists and needs a UI redo. **Pillar 5 is held until the rest are in daily use** — it
is the only pillar that adds a permanent operational commitment, and the only one serving other
people rather than Fabio's Monday. Held, not cut.

Supporting: search (moved to the right panel; recent search kept), the commit tab (absorbs surfaces
as other tabs retire), git quick actions, commit composer, history, settings, and a bottom terminal
for a dev server.

Cut: explore-a-flow as a feature (becomes a Canvas template), terminal as a full tab kind, and the
right-panel surfaces that exist only to fill space — Fabio: *"there are a lot of things we added
just to occupy space on the right side."*

Layout target: structurally very close to t3code — left rail, centre, right panel tabs, bottom
strip. Copy the structure, not the content model: t3code's spine is a thread list, Porcelain's is
worktrees.

## Remote transport (researched, not assumed)

- **Paseo** does **not** use Cloudflare. `docs/architecture.md:158`: the production relay is a
  distributed Elixir service in `getpaseo/paseo-relay`; the in-repo Cloudflare implementation is
  "retained as legacy code and is not deployed."
- **t3code** does: `infra/relay` deployed via Alchemy onto Cloudflare, authenticated with Clerk.

The pattern worth copying is neither vendor but the shape both share: **the daemon dials outbound to
a relay**, removing port forwarding, Tailscale installation, and firewall configuration — the setup
cost that defeated Fabio's friends.

Two constraints on adopting it: it collides with `product.md`'s "No Porcelain cloud for your code"
unless the relay is **zero-knowledge** (paseo's is — `architecture.md:151`, routes encrypted bytes,
cannot read content), which is also the property that makes it acceptable to carry a work
repository; and running a relay is a permanent operational commitment against weekend capacity.

Explicit non-goals: agent hosting, an in-app agent runner, an IDE, an Effect rewrite
(`docs/internals/architecture.md:122-124` already closed this).

`apps/mobile` is **frozen**: it keeps compiling and stays in `pnpm verify`, is marked `frozen` in
the pillar manifest, gains no new surfaces, and is excluded from foundation docs. No stricter
ratchet — a contracts change must stay free to touch it mechanically.

## On tests and quantitative quality

Raised mid-planning: unit and e2e tests may not be adding value; strong foundations plus agent
self-validation plus quantitative metrics should remove the need to look at the codebase at all
(citing Uncle Bob: *"I don't review code written by agents. I measure test coverage, dependency
structure, cyclomatic complexity, module sizes, mutation testing."*).

**Porcelain already implements all five metrics, plus one Bob does not list:**

| Metric | Status | Location |
|---|---|---|
| Test coverage | per-domain baseline, 59.6% statements | `scripts/quality/baseline.json` |
| Dependency structure | machine-enforced, not merely measured | `lint-architecture` |
| Cyclomatic/cognitive complexity | scored via Biome | `scripts/quality/report.mjs:172-211` |
| Module sizes | 450-line ceiling enforced; headroom reported | `lint-architecture`, `report.mjs` |
| Mutation testing | scoped to changed production files | `scripts/quality/mutate.mjs` |
| Dead code | knip baseline | `scripts/quality/dead-code.mjs` |

**The tests stay.** Coverage and mutation score are test-derived; deleting the suite deletes two of
the five metrics. Bob's claim is that tests are the instrument he reads *instead of reading code* —
it is a maximally pro-test position.

**The suite is not hollow.** 511 `toHaveBeenCalled` against 6,749 `expect()` calls — 7.6%
mock-assertion density, well below the mock-theatre range. 384 test files, ~53k test LOC against
~94k src LOC.

**The real weakness is where measurement stops.** Coverage: daemon 81%, CLI 88%, contracts 92%,
client-runtime 93% — against web 48%, desktop 39%, mobile 35%. The five pillars are almost entirely
UI. The committed mutation baseline covers 4 files, all under `apps/daemon/src/features/git`, so
there is no repo-wide mutation number. Measurement stops exactly where the product lives.

**The unresolved tension.** "Don't review agent code" contradicts a product whose first pillar is
review depth. Metrics answer *is this code healthy*; review answers *is this the thing I asked
for*. No metric detects a well-built wrong feature, and agents raise that risk rather than lowering
it. Resolution: the metrics belong **inside** the review — coverage delta, mutation score,
complexity, new dead code carried as Canvas evidence on the change itself. Bob's position becomes a
feature of the product rather than a refutation of it.

Consequent refinement to pillar 3: **Evidence** = the agent's visuals *and* the quantitative proof.

## Two modes: how Porcelain is built vs what Porcelain is for

Settled during planning, and it resolves the tension above.

- **Weekend mode — the development process of this repo.** A side project, worked on tired. Metrics,
  agent loops, and self-validation carry the quality load; the code does not get read. Uncle Bob's
  position applies here in full, and this is the job nobody pays for.
- **Weekday mode — the product.** Paid to read code in a large work monorepo, across worktrees,
  where agent output must actually be understood. This is Porcelain's user.

Fabio is therefore not Porcelain's user *while building Porcelain*. He is its user at work.

This sharpens why metrics belong in the review: not decoration, but **triage**. When several agent
PRs land and reading time is finite, a tight diff with a high mutation score and clean structure
means skim; thin coverage on a complex service means read every line. Metrics do not replace
reading — they direct it.

### Consequence: the dogfood loop is missing

A dev daemon may open only the playground family. Current fleet sizes: `porcelain-playground` 745
files; every worktree playground 2 files. Pillar 1 exists because a real monorepo holds thousands of
never-opened files owned by other teams — a scale no current fixture reaches. Story-ordering and
every performance claim in `product.md` have the same problem.

Two corrections, neither requiring an architecture change:

1. **Use the production daemon (43117) on the work monorepo, daily.** Already sanctioned —
   production is where real work gets reviewed. This is the feedback loop paseo and t3code have and
   Porcelain does not: authors using the product all day on real work. Bugs and gaps found there
   drive the roadmap.
2. **Add a large synthetic playground shape** (~20k files) so dev-mode work on scoped navigation and
   scroll performance runs against something honest.

Constraint that hardens as a result: `product.md`'s "local by default, no cloud, no telemetry" stops
being a preference and becomes a requirement, since the daemon will hold a work repository. Private
hostnames and paths stay in ignored `AGENTS.local.md` files.

## react-doctor (client-side quality)

[`millionco/react-doctor`](https://github.com/millionco/react-doctor) — MIT, deterministic static
analysis (no LLM, no API key), CI mode reports only newly introduced issues, telemetry opt-out via
`--no-telemetry`.

**Baseline measured 2026-08-16** on `apps/web` + `apps/desktop` + `apps/mobile`, 774 files:
**393 issues** — maintainability 294 warnings; bugs 7 errors / 55 warnings; performance 5 errors /
27 warnings; accessibility 4 warnings; security 1 warning.

**Precision caveat, verified.** The highest-severity finding — `rules-of-hooks`, "Hook called
conditionally" at `apps/web/src/components/viewer/editor-source.tsx:91,219` — is mislabelled. Both
sites call `flushSave()`, a function returned by `useEffectEvent` (line 71), from event handlers.
That is not a conditional hook call. Findings need triage; the list is not a to-do list.

**Highest-value finding:** `auth-token-in-web-storage` at `apps/web/src/lib/daemon.ts:264`. Not a
defect — the packaged app uses the Electron bridge and the browser client has no better option — but
its threat model changed with the decision that the daemon holds a work repository. Re-evaluate
under the two-modes section above.

**What it does and does not cover.** It fills a genuine hole: all five of Bob's metrics are
backend-shaped and none detect a ref mutated during render or a fetch inside an effect, while the
thinnest coverage (web 48%, desktop 39%) is exactly where the pillars live. It does **not** close the
coverage/mutation gap — static analysis finds known bad shapes; it cannot tell whether
story-ordering returns the wrong order. Complementary, not a substitute.

**Sequencing.** 294 of 393 are maintainability warnings on code phase two deletes. Baseline is
recorded now; `react-doctor install` (agent skill, `doctor` script, dev dependency, CI workflow)
lands **with** the deletion pass, so the ratchet pins surviving code. The 393 is never worked as a
backlog.

## Phase one — write the foundation

No code changes. Ordered by cascade.

Landed:

1. ✅ **`docs/product.md` rewritten** — six pillars, the worktree as core object, the two-modes
   split, explicit non-goals.
2. ✅ **ADR 0003 — the worktree is the core object and carries a profile** (pins, hides, layer
   order; agent-written, never inferred; layers declarative, not heuristic).
3. ✅ **ADR 0004 — Canvas is the primitive**, the Review is a skill-shipped template, explore-a-flow
   retires into a template, Canvas carries quantitative evidence as triage.
4. ✅ **ADR 0005 — shell layout** — navigator left, viewer centre, panel tabs right, terminal strip
   below; `terminal` and `explore` retired as tab kinds; structure from t3code, content model not.
5. ✅ **`AGENTS.md` glossary and `nomenclature.md` realigned** to the three ADRs.

Remaining:

6. ✅ **Surface decision docs** in paseo's genre, under `docs/surfaces/`: `navigator.md`,
   `worktree-profile.md` (pillars 2 and 3 — one mechanism, one doc), `canvas.md`, `tasks.md`,
   `git.md`. Written as behavioural contracts; no exemplar pointers are invented — the "canonical
   exemplar at `file:line`, copy this shape" line is added to each as its slice lands. Remote gets
   its doc when pillar 5 comes off hold.
7. **Grill it.** `ask-matt` routes a working-directory idea to **`/grill-with-docs`** — stateful,
   and it leaves its trail in `CONTEXT.md` and ADRs, which is what this tree wants. Both skills are
   user-invoked (`ask-matt` is `disable-model-invocation: true`), so this step is Fabio's to run.
   It is the phase-one close and the gate on phase two.

Deliberately deferred to phase two: `docs/internals/architecture.md` still describes the Review
template as a daemon surface and mobile as a peer client. The charter describes what is built, and
phase two changes what is built — it is corrected then, not now.

`docs/user/` (t3code's genre) is deferred — it documents shipped behaviour, and phase two changes
what has shipped.

## Phase two — audit and delete

Every feature directory is asked: *which pillar?* No pillar → deleted. This will be the largest
deletion pass in the repo's history, and it is where the appetite for a rewrite gets spent
legitimately.

Sequencing: the **pillar manifest lint** (every feature dir declares its pillar or `frozen`;
unlisted dirs fail the gate) is built *after* the pillar list is signed off, and lands in the same
commit as the first deletion — never before it, never after.

`plans/` is itself audited in this phase: `agent-dev-foundations.md` and anything harness-era is
deletion candidate, not inheritance.

## Scale reference

| Repo | src LOC | commits | `docs/*.md` | Notes |
|---|---|---|---|---|
| porcelain | ~94k (src) / 153k (all) | 1,382 | 16 | 19 lint gates, 2 ADRs |
| paseo | 280k | 4,927 | 40 | per-surface agent decision docs |
| t3code | 279k | 2,523 | 30 | audience-split docs; Effect-based |
| synara | 739k | 2,784 | 23 | |

`apps/mobile` is 24,993 LOC — 26% of Porcelain's source, serving no pillar. Frozen, not deleted, by
Fabio's call.
