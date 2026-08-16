# Agent development foundations

**Status:** W1 and W2 landed; W3–W7 proposed. See "Landed" at the end for what changed and what
the runtime proof showed.

Post-0.53.0 the Mac app is visibly broken in ways the repo's own gates ran green on: a project
folder can be chosen but never opens, remote environments misbehave. Before fixing anything, this
plan settles *why the setup could not have caught it* and what foundation work makes the next
regression reproducible on a Linux box, by an agent, without a human at a Mac.

Reference point: `~/code/t3code`. It solves the same problem (many agents, many worktrees, one
always-on developer machine, remote-first) and its `AGENTS.md` + `test-t3-app` skill encode the
answers. Where a section below borrows, it says so.

## The finding

The dev daemon's project guard already permits a **fleet** of playgrounds
(`apps/daemon/src/dev-config.ts` accepts `~/code/porcelain-playground`, anything under
`~/code/porcelain-playgrounds/`, and anything under `~/code/porcelain-playground-worktrees/`).
The fleet has exactly **one** member per profile — `~/code/porcelain-playground` for the primary
checkout (accumulated by hand over time), and for a managed worktree whatever
`scripts/worktree.mjs` generates: a README, one `src/example.ts`, one commit.

Consequences, and they are the whole story:

- **Add-a-project cannot be exercised in dev.** There is nothing to add. `seedDevConfig` registers
  the single playground at boot, so every dev session starts already past the flow that broke.
- **Remove, switch, and multi-project routing cannot be exercised either.** All three need ≥2
  projects.
- **Nothing in the fleet has a shape worth reviewing.** No dirty tree, no staged/unstaged split, no
  conflict, no history, no second branch. Porcelain is a review layer, and its dev fixture has
  nothing to review.
- **Remote environments have no second daemon** to be remote *from*.

So the honest claim is not "the guard broke prod" — the guard is correctly gated on
`PORCELAIN_DEV` and production daemons never set it. The claim is: **the broken flows are
unreproducible in the current dev setup**, which is worse, because it means the fix will also be
unprovable.

Everything below follows from that.

## Cost the setup imposes today

Measured against what an agent must do before it can look at a single pixel:

| Step | Today | Should be |
|---|---|---|
| Pair a browser | mint token, run `daemon-cli.js access issue`, hand-plant into `localStorage` | printed pairing URL in the boot banner |
| Get reviewable state | create canvas, tasks, files, diffs by hand, every time | `pnpm dev:seed <scenario>` |
| Get a second project | impossible | `pnpm playground new <shape>` |
| Prove a remote environment | impossible without hand-rolling a second daemon | one command |
| Worktree first run | install, build, remember the port, re-pair, re-seed | one setup script on create |
| Mobile in a worktree | Metro port is not part of the worktree profile | derived per worktree, like the daemon port |

`scripts/dev-env.mjs` already carries the hard part — per-profile port, home, user data,
playground — and refuses to let a worktree land on shared state. The gap is everything layered
above it.

## Workstreams

Ordered by how much they unblock. W1–W3 are the ones that pay for themselves immediately.

### W1 — One-command paired environment

`pnpm dev:daemon` prints an admin-token path and *the command you should run next*. It should
print the finished artifact instead.

`node scripts/daemon-cli.js access issue --name … --base-url …` already writes a complete pairing
URL to stdout (`scripts/daemon-cli.js:262`), and the daemon already exchanges pairing grants
(`apps/daemon/src/server.ts`). So this is launcher work, not product work:

- After the daemon reports ready, mint a pairing link and print it as a banner line — LAN form
  (`http://beelink:<port>/pair#token=…`) so any device or a LAN-peer browser can take it.
- Print the loopback and LAN origins separately from the pairing URL, since a bare origin is
  useless to whoever needs to pair and a pairing URL must not be opened twice.
- Keep `--share`-style semantics in mind for the tailnet flag, but do not invent a second sharing
  mechanism.
- Treat a pairing token as one-time: an agent that hands the URL to the human must not open it.
  (t3code's `test-t3-app` skill has the exact failure mode written down; borrow the wording.)

Retires the "plant the admin token in `localStorage` by hand" workaround.

### W2 — Playground fleet

Replace the single disposable repo with a generator. Proposed surface:

```
pnpm playground new <shape> [--name <slug>]
pnpm playground list
pnpm playground rm <slug>
pnpm playground reset <slug>
```

Shapes, chosen so each one makes a Porcelain surface exercisable:

| Shape | Exercises |
|---|---|
| `clean` | add/remove project, switcher, empty-state |
| `dirty` | Changes tab, unstaged diff rendering |
| `staged` | staged/unstaged split |
| `conflicted` | merge-conflict surfaces |
| `history` | many commits, branches, Process/Execution tabs |
| `monorepo` | nested packages, path handling, file tree at depth |
| `worktrees` | a playground that itself has linked worktrees (Hub Worktrees) |

Constraints:

- **Namespace fleet members away from worktree playgrounds.** `~/code/porcelain-playgrounds/<slug>`
  is currently owned by managed worktrees (`scripts/worktree.mjs`), and a fleet slug could collide
  with a worktree slug. Either give the fleet its own root or prefix members; decide before writing
  code. The guard in `dev-config.ts` must keep recognizing whatever is chosen.
- Generation is deterministic and offline — fixed authorship, fixed dates, no network.
- `rm` refuses any path outside the managed roots, same discipline as
  `scripts/worktree.mjs:safeManagedTarget`.
- Fleet members are disposable by definition; never a real checkout, and the existing dev guard
  keeps that true.

### W3 — Seeded daemon state

An empty database is a bad test (t3code's phrasing, and it is right). Porcelain has no seeding at
all today.

- `pnpm dev:seed <scenario>` builds daemon-root state — projects registered against fleet
  playgrounds, Reviews with real Canvas content across all four tabs, Tasks, Actions, comments,
  Evidence with images and check results.
- **Drive it through the bundled CLI**, not raw store writes. Business state produced by the real
  commands is state the product can actually reach; raw writes prove nothing about correctness and
  rot the moment a store changes. Reserve direct writes for genuinely disposable UI fixtures, and
  say so at the call site.
- Scenarios worth having on day one: `empty` (Welcome), `one-review`, `busy` (several projects,
  mixed review states), `evidence-heavy`.
- Idempotent, and safe to re-run against a live dev daemon.

### W4 — Remote-environment proof loop

The regression the human hit is invisible until two daemons exist.

- One command brings up a **secondary** daemon on its own port, home, and user data, and registers
  it with the primary as a remote environment — the same topology the Hub work in
  `a621c652`/`31d79aed` shipped.
- Both daemons must be individually addressable, individually pairable, and individually killable
  by tracked PID.
- Cover the three connection modes the product claims: loopback, LAN, and tailnet/Funnel. A
  feature that works on one is not proven on the others.

### W5 — Surface walk

t3code's "Hit every surface" is the doctrinal fix for "it worked on the path I tested," which is
exactly the defect class in 0.53.0. Porcelain's version, to live in `AGENTS.md`:

- **Entry points.** Project open is reachable from Welcome, the project switcher, the picker
  dialog, and the command palette. Fixing one is not fixing the feature.
- **Clients.** Electron shell, daemon-served browser, mobile. Shared client code means a change
  lands in all three or is deliberately scoped to one.
- **Environments.** Local daemon, secondary/remote environment, tunnel. Multi-environment is real
  and currently under-proven.
- **Contracts.** Anything crossing the wire is typed in `packages/contracts`; the 1:1 router lint
  already enforces shape, not coverage.
- **Reverse states.** If you added a way in, add the way out and the way to see it. Add-project
  needs remove-project. A one-way door is a bug.
- **Docs.** Behavior a user notices belongs in `docs/`.

Before calling frontend work done, say which entries applied. That sentence is the whole
mechanism — it is cheap and it would have caught this.

**Open question that must be answered before this section is written for real:** which browser
each harness actually has on this machine. Chrome is not installed on beelink; the
`claude-in-chrome` route drives a **LAN peer**, and Playwright is headless-only here. Codex and
other harnesses differ again. The current `web-e2e` skill says "use the in-app Browser first"
without naming what that resolves to per harness, which makes it unactionable half the time. This
plan should not pretend a uniform browser lane exists — it should enumerate the real ones and say
which is authoritative for proof.

### W6 — Environment lifecycle rules

Borrowed nearly verbatim from t3code, because the failure modes are identical and it has already
paid for the lesson:

- **Never kill by pattern.** No `pkill -f`, no `pgrep | kill`. The agent's own process carries the
  worktree path in its argv, and this box runs several dev servers at once. Kill only a PID
  captured at spawn, or the owner of the port from `ss -H -ltnp` after confirming `/proc/<pid>/cwd`.
  `dev-daemon.json` already records pid + worktree root + port; make it the contract.
- **Never write to the production install.** `~/.porcelain` and `~/.local/share/porcelain` are the
  human's real reviewed work. Read and copy from them freely; never serve from them, never clean
  them up.
- **The testing loop, not the assistant turn, is the lifecycle boundary.** Keep the daemon, ports,
  paired browser tab, and seeded fixtures alive across turns. Reuse a healthy environment before
  starting another. Tear down when the human says the loop is done.
- Tell the human what is still running and on which URL.

### W7 — Worktree onboarding

t3code runs a setup script on worktree create (`t3.json` → `runOnWorktreeCreate`). Porcelain's
`pnpm worktree create` allocates a port and makes a playground, then leaves everything else to the
agent.

- One setup step on create: install, build, seed the fleet, seed daemon state, print the cheat
  sheet (port, home, playground, pairing command).
- **Derive the Metro port from the worktree profile** the way the daemon port already is. This is
  the pain the human named explicitly, and it is the one piece of the mobile loop that is not yet
  profile-aware: `scripts/mobile-remote-dev.mjs` takes a `--sim-port` default of `3200` and says
  nothing about Metro per worktree.
- Extend `.worktreeinclude` handling if the setup step needs gitignored inputs.

## What is deliberately not in this plan

- Fixing the Mac bugs. They come after the loop that can prove the fix — the "can't open a
  project" flow specifically needs W2 before a fix is even demonstrable.
- Diagnosing the remote-environment misbehavior. Same reason; W4 first.
- Changing the dev playground guard. It is correct, it is gated, and it already permits the fleet.

## Sequencing

W1 and W2 are independent and both cheap; W3 depends on W2 (seeded state needs repos with shape).
W4 depends on W1 (a second daemon must be pairable). W5 and W6 are prose plus a lint where a rule
is mechanical, and can land alongside anything. W7 is last — it is the assembly of W1–W4 into one
command.

Each workstream ships with the ratchet that keeps it from regrowing: a generator without
`pnpm playground list`/`rm` becomes orphaned directories, a seeding script without idempotency
becomes a one-shot, and a surface-walk rule with no place to record the answer becomes a slogan.

## Landed

### W1 — paired environment (done)

`pnpm dev:daemon` waits for its own listener, mints a pairing link through the shipped
`daemon-cli.js access issue` path, and prints a ready-to-open URL. `pnpm dev:pair` mints another.
Two things surfaced while proving it:

- `daemon-cli.js` cannot resolve `@trpc/client` from the monorepo — it ships inside the published
  package, where its dependencies sit beside it. `scripts/dev-pair.mjs` lends it a resolution root
  rather than teaching the shipped CLI about the checkout layout.
- Links expire in fifteen minutes, so the launcher mints on every boot instead of only when no
  client is paired. This stack had **twenty** authorized clients and not one of them belonged to
  the agent about to work — the accumulated cost of pairing by hand.

### W2 — playground fleet (done)

`pnpm playground new|list|rm|reset|shapes`, with members at
`~/code/porcelain-playgrounds/.fleet/<profile>/<name>`. `.fleet` cannot collide with a managed
worktree slug (slugs must start with `[a-z0-9]`), the profile segment keeps worktrees from sharing
fixtures, and the location needs no change to the daemon guard. Seven shapes, each justified by
the surface it unlocks; generation is deterministic and offline.

`scripts/playground.test.mjs` asserts the shape each fixture claims to have — a `dirty` fixture
that generated clean would open fine and prove nothing. The removal guard was mutated and watched
to fail. `pnpm test:scripts` is the ratchet and now runs inside `pnpm verify`; it also rescues
`scripts/worktree-base.test.mjs`, which was orphaned from every gate.

### The guard was never armed

Proving W2 meant opening a fleet member through the real `openRepoPath` procedure. The dev daemon
accepted it — and then accepted `~/code/porcelain`, this repository, which the documented boundary
exists to refuse.

`apps/daemon/src/server.ts` gates both the playground boundary and dev seeding on `PORCELAIN_DEV`.
Only the Electron shell ever set it (`is.dev`). `scripts/dev-env.mjs` did not — so **every dev
daemon an agent has ever started ran with the boundary disabled**, and dev seeding never ran. One
line in `devEnv()` fixes it; `scripts/dev-env.test.mjs` keeps it fixed. After the change the same
probe returns *"Development daemons accept playgrounds only; real repositories are blocked"*, and
seeding pruned the real checkout back out of recents.

This is the strongest argument for the rest of the plan: the boundary was inert for as long as it
has existed, and nothing noticed, because nothing in the dev loop ever exercised it.

### Loose end worth fixing in W6

While restarting the daemon, `kill <launcher-pid>` left the spawned server process alive and
holding port 43118 — the launcher forwards `SIGINT`/`SIGTERM` to its child, but the child outlived
it. Orphaned daemons on the dev port are exactly the confusion the lifecycle rules are meant to
prevent, so W6 should fix the handoff rather than only document it.

## Next

W3 (seeded daemon state) is the next payer: the fleet now gives it repositories with shape, and
Reviews/Tasks/Evidence are still built by hand every session. W4 (a second daemon) is what makes
the remote-environment regressions reproducible at all.
