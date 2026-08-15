# Porcelain — product

**Where agent work becomes trusted work.**

Porcelain is the lightweight **review layer for agentic coding**: a macOS app plus a browser viewer
served by the daemon (anywhere Node runs, Linux included). A native Expo client for the same daemon
is in development. A focused **companion**, not a cockpit: not an agent host and not an IDE. Agents
keep writing where they already write; Porcelain is where you read, annotate, and sign off.

## Who it is for

Engineers already serious about coding agents whose bottleneck is **reading and trusting** what
shipped — often in monorepos, often with a second machine as compute. Not "AI for non-engineers";
not an IDE; not a second agent host.

## Pillars (priority order)

1. **Review depth** (the moat): the Review (Intent · Process · Execution · Evidence), flow-ordered diffs,
   comments both ways, explore-a-flow, monorepo hide/pin.
2. **Remote as a product** (second moat): one token-gated daemon; local app, remote environment, or
   any browser. State and PTYs daemon-side.

There is no third pillar. Agents run in a terminal — Porcelain's or any other — and feed the Review
through the CLI. Do not rebuild an in-app agent runner.

## Core features (summary)

- **File viewer** — fast, always-editable single files, not an IDE (no autocomplete, multi-file
  refactor, format-on-save). Markdown Reader/Source; split is two panes only.
- **Scoped navigation** — hide/pin folders in huge monorepos (CLI `scope`).
- **Git** — diffs, worktrees, history, staging, commit composer without a terminal.
- **Flow-ordered review** — layers as a timeline of connected work, agent-managed per tree.
- **The Review** — Intent · Process · Execution · Evidence canvas for one unit of work; agent-authored via
  porcelain CLI. Board is the queue; Review is the active story.
- **Explore a flow** — read-only comprehension of existing code (symbol or file seed).
- **Tasks** — one daemon-owned table per Environment for work that spans Projects: configurable
  columns, explicit Project/Environment/Worktree references, Quick Add with copied-file
  attachments and links. The Hub aggregates the Environments it can reach and omits the ones it
  cannot; every write names the Environment it targets. Retires the per-repository Board (#28).
- **Review comments / board / notes / actions** — companion surfaces; human runs Actions. The
  per-repository Board is retiring in favor of Tasks.
- **Terminal** — real PTY next to review; remote-bound windows can also shell on This device.
- **Remote / environments** — one daemon, many clients; per-device credentials; LAN / Tailscale /
  opt-in Funnel.

## Principles

- **Trust over velocity** — review depth beats cockpit breadth.
- **Viewer, not editor** — lightweight always wins.
- **Performance is a feature** — stay fast on large monorepos.
- **Companion, not competitor** — integrate with the editor and agent host; don't replace them.
  Public copy sells Porcelain's surfaces, not transport debates or third-party brand lists.
- **Connected, not siloed** — one home per concern (Changes, Review, Files, Board, Terminal);
  previews hand off, never second Diff/commit UXes.
- **Local by default** — machine secrets on the daemon host under `~/.porcelain/`; project
  companion data (reviews, board, scope, actions, …) lives in `<repo>/.porcelain/` and is
  shareable via git when you choose to track it. Tasks are the deliberate exception: they belong
  to the machine, not a checkout, so they live in `$PORCELAIN_HOME/tasks/` and never appear in a
  repository. No Porcelain cloud for your code, no telemetry.
- **Your repository is yours** — Canvases and Project defaults live in the daemon's private store,
  not in your working tree. `<repo>/.porcelain/` appears only when you **promote** something into
  it, and a promoted file is then the one canonical copy: Porcelain indexes it in place, never
  keeps a competing private version, and never runs `git add` for you.

Open this file when designing features, prioritizing, or writing public identity copy. Day-to-day
implementation does not need it if root `AGENTS.md` is enough.
