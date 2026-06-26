# Plan 022: Make the agent loop agent-agnostic — ship Codex support (spike + vertical slice)

> **Executor instructions**: This is a **spike-first** plan. Step 1 is
> investigation that produces a written decision; do NOT build the installer
> until Step 1's findings confirm the assumptions. Follow the steps in order, run
> every verification command, and honor the STOP conditions. When done, update
> the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 9670e07..HEAD -- src/main/plugin.ts src/main/plugin-assets.ts src/main/api.ts src/renderer/src/components/settings/agents-section.tsx src/renderer/src/hooks/use-plugin.ts src/mcp/server.ts`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat it
> as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L (spike + a vertical slice; a full polished Cursor path is a follow-up)
- **Risk**: MED (writes into the user's `~/.codex/config.toml`, which holds their other settings)
- **Depends on**: none
- **Category**: direction (audience expansion; stated roadmap)
- **Planned at**: commit `9670e07`, 2026-06-26

## Why this matters

Porcelain's whole agent loop — feature review sets, review comments, the board,
actions, flow layers — runs over a **generic stdio MCP server** that imports only
Node builtins (`src/mcp/server.ts`, `src/mcp/protocol.ts`). The server is already
agent-agnostic. The only thing welded to Claude Code is the **packaging**: the
local marketplace manifest, the `claude plugin …` install commands, and the
skills shipped as `SKILL.md` files (`src/main/plugin-assets.ts`).

The README already promises *"Codex & Cursor support is coming soon"*, the
Settings → Agents screen renders **"Coming soon"** placeholders for both
(`src/renderer/src/components/settings/agents-section.tsx:7-16`), and the project
board has a `Codex plugin` card queued. Supporting a second agent is the single
biggest audience multiplier available, and the server already runs there — the
work is a second install path plus a way to deliver the guidance Claude Code gets
from skills (which Codex doesn't have).

This plan does **Codex** end-to-end as the proof, deliberately scoped so the same
shape extends to Cursor next.

## Current state (the Claude Code path this mirrors)

The Claude install is two pure modules + one side-effecting installer:

- `src/main/plugin-assets.ts` — **pure, unit-tested** definitions: the
  marketplace + plugin manifests, the `installCommands()` (the `claude plugin …`
  CLI lines), `PLUGIN_VERSION` (`'2.6.0'`), and the five skill strings + the
  `SKILLS` array. No electron/fs imports, so it's testable.
- `src/main/plugin.ts` — the **side-effecting** installer: `writePluginFiles()`
  writes the marketplace dir under `~/.porcelain/plugin`, copies the built server
  (`out/main/mcp/server.js`) in, and `installPlugin()` runs the CLI commands
  through a login shell, returning a `PluginInstallResult` (`ok`, `output`,
  `marketplaceDir`, `commands`).
- The built server path (`plugin.ts:30-32`):
  ```ts
  function builtServerPath(): string {
    return join(app.getAppPath(), 'out', 'main', 'mcp', 'server.js')
  }
  ```
  The server is emitted as a **second main build input** (see
  `electron.vite.config.ts`) so a plain `node out/main/mcp/server.js` runs it with
  nothing to resolve from `node_modules` — this is exactly what a non-Claude agent
  needs too.
- tRPC surface (`src/main/api.ts`): `pluginInfo` (query) returns
  `{ marketplaceDir, commands, version }`; `installPlugin` (mutation) runs the
  install. Consumed by `usePluginInfo()` / `useInstallPlugin()`
  (`src/renderer/src/hooks/use-plugin.ts`).
- UI: `PluginSection` (`src/renderer/src/components/settings/plugin-section.tsx`)
  renders Install / Update-to-vN / Up-to-date + a manual-commands block + a
  "Plugin written to <dir>" line. `AgentsSection`
  (`src/renderer/src/components/settings/agents-section.tsx`) renders the Claude
  section over `PluginSection`, then a `PLANNED` list (Codex, Cursor) as
  greyed-out "Coming soon" placeholders:
  ```ts
  const PLANNED = [
    { name: 'Codex', blurb: 'Push feature review sets from the OpenAI Codex CLI. Planned.' },
    { name: 'Cursor', blurb: 'Feed the feature view from Cursor’s agent. Planned.' },
  ]
  ```

**The key asymmetry to solve:** Claude Code has *skills* (the five `SKILL.md`
files) that teach the agent *when and how* to call the tools. Codex has no skills
construct. But the MCP tool **descriptions** in `src/mcp/protocol.ts` are already
rich and self-contained (e.g. the `set_feature_review` description, lines 49-61,
explains flow order, `layer`, etc.). So on Codex the guidance rides in the tool
descriptions the agent sees on `tools/list`, optionally reinforced by an
`AGENTS.md` snippet the user can paste. **No skill files are needed for Codex.**

**Conventions to match:** keep the pure/impure split (`*-assets.ts` pure +
unit-tested, the installer side-effecting). Named exports, explicit return types.
Tests next to source. The MCP server stays dependency-free (do not add deps to
it). The installer runs in the **main** process, which may use Node builtins
freely. `~/.porcelain` is the home for app-written agent files (never a work
repo) — reuse the already-copied `~/.porcelain/plugin/server.js`, don't copy the
server a second time.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Lint      | `pnpm lint`              | exit 0              |
| Typecheck | `pnpm typecheck`         | exit 0, no errors   |
| Unit test | `pnpm test <filter>`     | all pass            |
| Full gate | `pnpm verify`            | all four pass       |

`pnpm verify` is hook-enforced before any commit. Commit straight to `main` (no
branches).

## Scope

**In scope (after the Step 1 spike confirms the approach):**
- `plans/022-codex-findings.md` (create) — the spike's written output (Step 1).
- `src/main/codex-assets.ts` (create) + `src/main/codex-assets.test.ts` (create)
  — pure: the `~/.codex/config.toml` MCP-server block + manual instructions.
- `src/main/codex.ts` (create) + `src/main/codex.test.ts` (create) — the
  installer (write/merge the config, report manual fallback).
- `src/main/api.ts` — add a `codexInfo` query + `installCodex` mutation
  (mirror `pluginInfo`/`installPlugin`).
- `src/renderer/src/hooks/use-codex.ts` (create) — mirror `use-plugin.ts`.
- `src/renderer/src/components/settings/codex-section.tsx` (create) — mirror
  `plugin-section.tsx`, scoped down (Codex has no version/update flow in v1).
- `src/renderer/src/components/settings/agents-section.tsx` — replace the Codex
  `PLANNED` placeholder with a real `CodexSection`; keep Cursor as "Coming soon".
- `README.md` — update the "Connect your agent" note once Codex actually works.

**Out of scope (do NOT touch):**
- `src/mcp/**` — the server is already agent-agnostic. Do **not** add deps,
  tools, or Codex-specific branches to it. If you think the server needs to
  change for Codex, STOP — that is a sign the approach is wrong.
- The Claude Code path (`plugin.ts`, `plugin-assets.ts` install logic,
  `PluginSection`) — leave it working exactly as-is.
- Cursor — its placeholder stays "Coming soon" this round (the design must make
  Cursor a small follow-up, but don't build it here).
- A robust general TOML editor — see Step 1's recommended minimal approach.

## Steps

### Step 1 (SPIKE — produce `plans/022-codex-findings.md`, build nothing yet)

Confirm the two unknowns and write them down. Use the Codex CLI docs (web
search/fetch if available) and, if Codex is installed locally, inspect it.

1. **MCP server registration.** Confirm how the OpenAI Codex CLI registers a
   local stdio MCP server. The expected mechanism (verify before relying on it):
   a `~/.codex/config.toml` with a table per server, e.g.
   ```toml
   [mcp_servers.porcelain]
   command = "node"
   args = ["/Users/<you>/.porcelain/plugin/server.js"]
   ```
   Confirm: the exact file path, the exact table key (`mcp_servers` vs
   `mcp.servers`), whether `args`/`env` are supported, and whether there is a
   `codex mcp add …` CLI command (preferred if it exists — it edits the config
   safely, the way `claude plugin …` does). Record the verified answer.
2. **Guidance delivery.** Confirm Codex has no "skills" equivalent and that tool
   descriptions from `tools/list` are surfaced to the model. Decide how standing
   guidance is delivered: (a) rely on the existing rich tool descriptions in
   `protocol.ts` (recommended — they already carry the how/when), and optionally
   (b) provide an `AGENTS.md` snippet the user can paste into their project.
   Record which.
3. **Write `plans/022-codex-findings.md`** with: the confirmed config path +
   format (or the `codex mcp add` command), the guidance-delivery decision, and a
   **recommended install strategy** — preferring, in order: (i) a `codex mcp add`
   CLI command run through a login shell (mirrors `runInstall` in `plugin.ts`
   exactly, lowest risk), else (ii) **append-if-absent** of the
   `[mcp_servers.porcelain]` block to `~/.codex/config.toml` as text (no TOML
   parser, no new dep): if the file already contains `[mcp_servers.porcelain]`,
   leave it (and tell the user to update manually); otherwise append the block.
   Always also return the manual block so the UI can show a copy-paste fallback,
   exactly like the Claude path does.

**Verify**: `plans/022-codex-findings.md` exists and answers all three points
with confirmed (not assumed) facts.

**STOP if**: you cannot confirm the config format from docs or a local install
(do not guess and write into a user config file blind); or Codex turns out to
require a network endpoint / does not support local stdio MCP servers (then the
whole approach changes — report back).

### Step 2: `codex-assets.ts` (pure)

Mirror `plugin-assets.ts`'s pure style. Export:
- `codexServerArgs()` / a function returning the confirmed config block as a
  string (the `[mcp_servers.porcelain]` TOML, using
  `join(homedir(), '.porcelain', 'plugin', 'server.js')` for the path — reuse the
  server the Claude installer already copies there; import
  `pluginMarketplaceDir`/derive the server path from `plugin-assets.ts` so the
  path stays single-sourced).
- `codexInstallCommand()` if Step 1 confirmed a `codex mcp add` CLI exists, else
  omit.
- `codexConfigPath()` → the confirmed `~/.codex/config.toml` path.
- `codexManualInstructions()` → the human-readable block for the UI fallback.

Keep it free of electron/fs imports so it's unit-testable.

**Verify**: `pnpm typecheck` → exit 0. `pnpm test codex-assets` → new tests pass
(assert the block contains `[mcp_servers.porcelain]` and the server path).

### Step 3: `codex.ts` (installer) + ensure the server file exists

The Codex config points at `~/.porcelain/plugin/server.js`. That file is written
by the Claude installer's `writePluginFiles()` (`plugin.ts:35-56`). For Codex to
work **without** installing the Claude plugin, the installer must guarantee the
server file exists. Reuse `writePluginFiles()` (it's idempotent) or extract a
tiny `ensureServerCopied()` helper that copies just `server.js` — do NOT
duplicate the copy logic.

Implement `installCodex()` returning a result shaped like `PluginInstallResult`
(`ok`, `output`, `configPath`, instructions/commands), following the recommended
strategy from Step 1's findings:
- If a `codex mcp add` CLI exists: run it through a login shell with the
  augmented PATH, exactly like `runInstall` in `plugin.ts:74-90` (reuse/extract
  that helper rather than re-implementing the PATH augmentation).
- Else: ensure the server is copied, then **append-if-absent** the config block
  to `~/.codex/config.toml` (create the file + `~/.codex` dir if missing; write
  atomically tmp+rename like the channel writers do). If the block is already
  present, no-op and report success. Always return the manual block.

**Verify**: `pnpm test codex` → new installer tests pass (use a temp `HOME`/temp
config path via an env override — mirror how the channels honor `PORCELAIN_*`
env vars for tests; if no override exists, inject the config path as a parameter
so the test can point it at a tmp file). Cover: appends when absent;
idempotent (second run does not duplicate the block); creates the file when
missing.

### Step 4: tRPC + hook

In `src/main/api.ts`, add `codexInfo` (query → `{ configPath, instructions,
commands? }`) and `installCodex` (mutation) next to `pluginInfo`/`installPlugin`.
Create `src/renderer/src/hooks/use-codex.ts` mirroring `use-plugin.ts`
(`useCodexInfo` + `useInstallCodex`, using `mutate` not `mutateAsync` so failures
surface via `error`).

**Verify**: `pnpm typecheck` → exit 0.

### Step 5: UI — flip the placeholder into a real section

Create `src/renderer/src/components/settings/codex-section.tsx` modeled on
`plugin-section.tsx` but simpler (no version/update/`pluginInstalled` state in
v1): an "Install for Codex" button, the success/error states, and the manual
copy-paste block + "Config written to <path>". In `agents-section.tsx`, remove
`Codex` from `PLANNED`, add a real `<section>` for Codex rendering `<CodexSection
/>` (mirror the Claude `<section>` at lines 21-33), and keep Cursor in `PLANNED`.

**Verify**: `pnpm lint && pnpm typecheck` → exit 0. If a component test exists for
the agents/plugin section, extend it; otherwise a render smoke test for
`CodexSection` modeled on `plugin-section.test.tsx` is sufficient.

### Step 6: Docs

Update `README.md`'s "Connect your agent" section (currently ends *"Codex &
Cursor support is coming soon."*, line 51) to document the Codex install once it
works. Leave Cursor as coming-soon.

**Verify**: `pnpm verify` → all four pass.

## Test plan

- `src/main/codex-assets.test.ts` — the config block contains
  `[mcp_servers.porcelain]`, the `command`/`args`, and the
  `~/.porcelain/plugin/server.js` path; the path matches the one the Claude
  installer copies to (single-sourced).
- `src/main/codex.test.ts` (model after `repo-config.test.ts` /
  `json-store.test.ts` for temp-file handling): install appends the block to a
  fresh temp config; a second install is idempotent (no duplicate block); a
  pre-existing block is left intact; the result reports `ok` + the manual block.
  If the chosen strategy is the `codex mcp add` CLI, test the command-string
  builder instead and keep the shell-spawn untested (matches how `plugin.ts`'s
  spawn is not unit-tested).
- `src/renderer/src/components/settings/codex-section.test.tsx` — renders the
  install button and the manual block; mock `use-codex` the way component tests
  mock domain hooks (see `plugin-section.test.tsx`).
- Verification: `pnpm test codex codex-section` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `plans/022-codex-findings.md` exists with the confirmed config format +
      strategy.
- [ ] `pnpm verify` exits 0.
- [ ] `src/main/codex-assets.ts`, `src/main/codex.ts`,
      `src/renderer/src/hooks/use-codex.ts`, and
      `src/renderer/src/components/settings/codex-section.tsx` exist.
- [ ] `grep -n "Codex" src/renderer/src/components/settings/agents-section.tsx`
      shows a real section (not a `PLANNED` "Coming soon" entry); Cursor is still
      in `PLANNED`.
- [ ] `git grep -n "mcp_servers.porcelain" src/main` → present in the assets
      module (or the confirmed key from Step 1).
- [ ] `src/mcp/**` is unchanged (`git status` shows no edits under `src/mcp/`).
- [ ] New tests for the assets module + the installer exist and pass.
- [ ] `plans/README.md` status row for plan 022 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 cannot confirm Codex's local stdio MCP config format from docs or an
  install — do not write into a user's `~/.codex/config.toml` on a guess.
- The approach seems to require changing `src/mcp/**` (adding a tool, a dep, or a
  Codex branch). The server is agent-agnostic by design; needing to touch it
  means the integration belongs elsewhere — report back.
- A robust solution appears to need a TOML-parsing dependency. Adding a runtime
  dep is a CLAUDE.md hard-rule decision (and the project avoids deps) — stop and
  ask; do not add one unilaterally. The append-if-absent text strategy is the
  approved no-dep path.
- Codex's config merge risks clobbering the user's existing servers/settings and
  you cannot make it provably idempotent + non-destructive — fall back to a
  manual copy-paste-only UI (write nothing) and report.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Cursor is the next iteration of this exact shape.** Cursor registers MCP
  servers in `.cursor/mcp.json` (project-level) or `~/.cursor/mcp.json` (global)
  as JSON. If `codex-assets.ts` / `codex.ts` are written generically (a
  per-agent "assets + installer" pair), Cursor becomes a third small module + a
  third settings section — keep that factoring in mind so Cursor doesn't force a
  rewrite.
- The server binary is single-sourced at `~/.porcelain/plugin/server.js`. If that
  location ever moves, every agent's config points at it — update one place
  (`plugin-assets.ts`'s derivation) and all agents follow.
- A reviewer should scrutinize the `~/.codex/config.toml` write path hardest:
  idempotency, not clobbering other `[mcp_servers.*]` tables, atomic write, and
  dir creation. That file is the user's, like a work repo — treat it carefully.
- Guidance for Codex lives in the MCP **tool descriptions** (`protocol.ts`), not
  skills. If those descriptions are edited for Claude, Codex benefits for free —
  but there is no Codex-side version/update prompt, so a description change just
  takes effect on the agent's next `tools/list`. Note this in the findings doc.
- Deferred out of this plan: a Codex plugin-version/update flow (Claude's exists
  because it ships skill files; Codex has none to version), and Cursor.
