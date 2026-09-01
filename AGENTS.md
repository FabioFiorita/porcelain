# Porcelain

Porcelain is a companion for agentic tools. It exists because agents can produce work faster than
humans can confidently understand and review it. Porcelain gives that work a place to become
focused, explainable, and trusted.

A daemon owns repositories, worktrees, Git state, terminals, review data, and remote access.
Browser, Electron, and mobile are clients. Agents keep running in Codex, Claude Code, T3 Code, or
another native harness. Porcelain works alongside those tools; it is not an agent host or an IDE.

## What makes Porcelain special?

### 1. Safety at agent speed

Speed is useful only when the human still understands what is being delivered. Porcelain should
make it clear what changed, why it changed, where attention is needed, what has already been
reviewed, and what was actually proved. It must never turn an agent's confidence into evidence.

### 2. Human attention is the scarce resource

Large repositories and large diffs contain more information than a reviewer should treat equally.
Files lets people pin the paths that matter and hide distractions. Changes should organize diffs
into meaningful review layers so important and risky work is seen while the reviewer has the most
attention, and mechanical or low-risk work can follow later. Alphabetical order is not a review
strategy.

### 3. The surfaces work together

Files, Changes, comments, reviewed state, Git, History, and Canvas are different views of the same
work. They should reinforce one another instead of becoming isolated mini-products. A Review
Canvas can explain the larger story and point the human toward layered changes and important
comments; Changes remains authoritative for the diff.

### 4. Agents use Porcelain without moving into Porcelain

Agent integration exists for Porcelain-owned collaboration. The current MCP surface covers
projects, Canvases, comments, profiles, and Action definitions; the companion skill explains how to
combine them across the life of a task. Porcelain should not replace a harness's browser, terminal,
device tooling, reasoning, or execution model when the native capability is better.

### 5. Many worktrees, one review place

Agentic work spans projects, worktrees, machines, and concurrent tasks. Porcelain keeps those
contexts available from one client instead of requiring a separate window for every checkout.
Each daemon remains authoritative for the repositories and state on its own machine, whether the
client reaches it locally, over LAN, through Tailscale, or through Cloudflare.

## A note from the developer

Porcelain should feel powerful because its model is clear, not because the repository has
accumulated ceremony. Do not preserve complexity because it already exists, and do not introduce
machinery because it looks rigorous. Understand the observable outcome, then make the smallest
coherent change that makes the correct behavior unsurprising.

New sessions need the current way of working, not the history of how we arrived there. Code,
comments, tests, skills, and documentation should describe the system that exists now. Remove
superseded alternatives instead of preserving old debates, migration stories, or decisions that no
longer affect the work.

Validation proves the current change; it does not automatically justify permanent machinery. Add
a test, script, document, wrapper, skill, or gate only when it protects repeatable behavior or a
non-obvious invariant with a plausible accidental failure. Do not pin a color, label, name,
version, static value, or today's product choice in a test. If a legitimate future change would
only require updating the assertion alongside the source, the assertion is usually not useful.

Treat the rest of this document as strong defaults, not a substitute for judgment. Current human
direction and the code that ships outrank historical prose.

## A small glossary

- **you** means the agent reading this file and changing Porcelain.
- **we, us, and maintainers** mean the people building Porcelain and directing the work.
- **user** means the person using Porcelain to understand and review agent-created work.
- **agent** means a coding agent running in its native harness, including you when applicable.
- **daemon** means the headless Porcelain process that owns repositories, state, and capabilities.
- **client** means the browser, Electron, or mobile UI connected to a daemon.
- **environment** means one daemon and the machine, credentials, repositories, and state it owns.
- **project** means an environment-local repository record.
- **worktree** means one checkout of a project, with its own Git and development context.
- **review layer** means an ordered group of changes designed around human review attention.
- **Canvas** means agent-authored visual or structured material used to plan, explain, and prove
  work without replacing the diff.
- **Action** means a curated development command that an agent may define and a human chooses
  whether to run.

## The three ways to hurt yourself

1. **Writing to production state.** `~/.porcelain` and its configured listener belong to the real
   installed product. Never use production repositories, credentials, or daemon state as test
   fixtures. Product work uses `PORCELAIN_DEV`, development homes, and disposable playgrounds.
2. **Killing by pattern.** This machine may run production, the primary development checkout, and
   several worktrees at once. Never kill a process because its name or command happens to match.
   Stop only a PID captured when you started it or a process identified through its managed
   worktree record and verified ownership.
3. **Colliding environments.** A linked checkout without `.porcelain-worktree.json` may silently
   inherit the primary profile. Run `pnpm dev:env` before starting development. If an external
   worktree reports the primary profile, adopt it from the primary checkout with
   `pnpm worktree adopt <path> <slug>` before launching anything.

## Hit every affected surface

The common Porcelain defect is a change that works on the path that was tested but not everywhere
the same work appears. Before calling UI or cross-package work done, consider:

- **Files.** Pins and hidden paths are manual navigation choices. Preserve them exactly unless the
  human asks to change them. File operations and file-level comments belong to the selected file,
  no matter how the user reached it.
- **Changes.** Working changes and comparisons against local or remote branches share review
  behavior. Layers, comments, reviewed state, and selected-file context must agree with the diff
  being shown.
- **Git and History.** Working state, branch history, commit history, and file history are related
  but not interchangeable. Keep the active project, worktree, comparison, and file explicit.
- **Canvas and comments.** Canvas owns the larger Why and How; Changes owns the diff. Comments carry
  focused human or agent context. Links between them should preserve that division of authority.
- **Clients.** Browser and Electron share the web client; Electron also owns preload, IPC, windows,
  menus, updates, and its local daemon. Mobile is a separate native client.
- **Environments.** Local and remote daemons do not share authority. Selecting a remote environment
  must not rebind, overwrite, or impersonate the local one.
- **Contracts.** Anything crossing a process boundary belongs in `packages/contracts`; check every
  affected producer and consumer.
- **Agent integration.** The shipped plugin runs where this checkout does not exist. Keep it
  self-contained and link a public document when it must explain repository-owned behavior.

Say which surfaces were checked and which remain unproved. Do not imply universal coverage from a
single client, build, test, or mock.

## Development

Read [docs/development.md](docs/development.md) before setting up, running, testing, or working in
parallel. The common entry points are:

```sh
pnpm install
pnpm build
pnpm dev:env       # read-only profile, paths, ports, and start commands
pnpm dev           # Electron and its profile-scoped daemon
pnpm dev:daemon    # daemon for a separate browser or mobile client
pnpm dev:web       # web client with HMR against that checkout's daemon
```

Use the primary checkout for one direct change. Use `pnpm worktree create <slug>` when another
independent change needs isolation. Managed worktrees receive distinct daemon ports, homes,
playgrounds, Electron data, and Metro state. Start only processes you can identify, and stop what
you started.

The development daemon uses disposable playground repositories. Authenticate browsers through
`/dev-auth` or the pairing URL printed by `pnpm dev:daemon`; keep tokens out of browser
`localStorage`. Never run `pnpm dev` and `pnpm dev:daemon` against the same profile at once.

## Verifying

- Use the smallest proof that demonstrates the affected behavior. Format changed files and run the
  closest useful typecheck, test, procedure, schema check, or runtime path.
- Permanent coverage must protect behavior or a meaningful invariant, not merely restate the
  current source. A useful test fails for a plausible accidental defect while allowing intentional
  product changes.
- A successful build or mock is not runtime evidence. User-facing, remote, Electron, and mobile
  behavior needs the affected path observed in a real development client when useful.
- For browser, Electron, Android, and iOS behavior, use the strongest native capability available
  in the current harness. Repository instructions define the development environment and required
  outcome; they do not prescribe a browser or device driver.
- Broad verification is a delivery tool, not the inner loop. Run `pnpm verify` when the scope or
  request warrants it; CI owns clean-machine coverage.
- Record the command, result, surfaces checked, and remaining uncertainty. Clean up fixtures,
  evidence, and processes owned by the run.

## How it works

Clients call the daemon through typed HTTP procedures and a `/session` WebSocket for live state and
terminal streams. The daemon owns filesystem access, Git, worktrees, terminals, persistence,
pairing, and remote listeners. Agents reach semantic daemon operations through the shipped MCP
plugin. A connected client may display several environments, but each daemon remains authoritative
for its own state.

Private data lives under `PORCELAIN_HOME`. Repository-local `.porcelain/` data exists only when
portable state is explicitly promoted into Git. A clean Review Canvas binds to its commit for
History; a dirty Review is live-only until updated after commit.

Read [docs/architecture.md](docs/architecture.md) when a change crosses a package or runtime
boundary, [docs/remote-access.md](docs/remote-access.md) for exposure and pairing, and
[docs/release.md](docs/release.md) only for release work.

## Where code lives

- `apps/daemon` — HTTP/WebSocket API, filesystem, Git, terminals, persistence, and sharing.
- `apps/web` — React client used in browsers and loaded by Electron.
- `apps/desktop` — thin Electron shell and local-daemon lifecycle.
- `apps/mobile` — Expo/React Native client of the daemon.
- `packages/contracts` — shared wire contracts and procedure types.
- `packages/client-runtime` — client transport, queries, sessions, and shared semantics.
- `packages/shared` — low-level cross-cutting utilities.
- `packages/ui` — shared UI primitives and tokens.
- `plugins/porcelain` — shipped MCP connection and companion/remote procedures.

## Delivery

- Work on `main` for direct work, or use `pnpm worktree create <slug>` for an isolated branch.
- Commit one coherent unit when it is ready. Do not push, open a PR, publish, or release without an
  explicit request.
- Dogfood Porcelain's companion domain tools when they are available for the addressed checkout.
  Use one Decision Canvas for a material unresolved choice and one Review Canvas for a coherent
  completed unit that benefits from shared explanation. Keep updating the same Canvas rather than
  creating progress artifacts.
- Changes remains authoritative for diffs, status, staging, History, and reviewed state. A Review
  Canvas owns Why and How and should be updated after a clean commit until History binds it to that
  commit.
- Agents may create and edit Action definitions, but they do not use Porcelain to execute them. The
  human reads the command and chooses whether to run it.

The companion skill owns the detailed multi-tool workflow. Keep this file at the policy and product
level rather than duplicating its procedure.

## Taste

- Prefer one obvious model over layers that preserve old possibilities.
- Put behavior with its owner. The daemon owns capabilities; clients present them; contracts define
  the seam. Share code only when there is a real second consumer.
- Use existing platform and agent capabilities before adding a Porcelain wrapper. Keep only the
  project-specific orchestration Porcelain genuinely owns.
- Existing patterns are evidence, not permanent architecture. Remove obsolete paths instead of
  documenting the migration forever.
- Keep one source for each fact. Documentation describes current behavior and operational facts,
  not abandoned plans or the history of a decision.
- Optimize for the observable outcome. Keep unrelated cleanup and speculative flexibility out of
  the change.
- If a rule here fights the task in front of you, explain the conflict and get human direction
  before breaking it.
