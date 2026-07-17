---
name: sync-environments
description: Copy Porcelain companion setup (saved actions/commands, board, notes, flow layers, review comments, and hidden/pinned folders) from one environment to another — local Mac ↔ remote daemon (Beelink/Linux) — via MCP tools and SSH. Use when the human asks to seed, share, or mirror Porcelain config/settings between machines, or when a remote clone is missing the project board/actions. Do NOT copy the dynamic feature view (review sets), artifacts, loop evidence, or reviewed marks.
---

# Sync Porcelain environments

Porcelain keeps per-repo companion data on the **daemon host**, keyed by **absolute** repo path. Nothing crosses machines automatically. You (the agent) copy what the human needs — deliberately, with path remapping — instead of a confusing Settings UI seed.

## What to copy (and what not to)

| Carry over | Source | Notes |
|---|---|---|
| **Saved actions** (commands) | MCP `list_actions` / `create_action` or `~/.porcelain/actions.json` | Same commands the human one-clicks in Terminal |
| **Project board** | MCP `list_cards` / `create_card` or `~/.porcelain/board.json` | Todo/doing/done — remap paths only on the key |
| **Repo notes** | MCP `get_repo_notes` (read-only) + write notes via the app path or file | Human scratchpad |
| **Flow layers** | MCP `get_flow_layers` / `set_flow_layers` | Regex rules; paths inside patterns are usually relative |
| **Review comments** | MCP `get_review_comments` | Only if the human still wants open notes on the other host |
| **Hidden folders** | Daemon `config.json` → `repos[absPath].hiddenPaths` | Absolute paths — **must remap** |
| **Pinned folders** | Daemon `config.json` → `repos[absPath].pinnedPaths` | Absolute paths — **must remap** |

**Do not copy:**

- Feature review sets (`review-sets.json`) — the **dynamic feature view** is session/work-specific
- Feature artifacts / loop evidence
- Reviewed marks
- Agent chat (`chat.json`) — ephemeral relay; use the `agent-chat` skill for live collab instead
- Daemon token, environments list, agent threads

## Paths by host

Channel files (board, actions, notes, layers, comments, chat, …):

- Always: `~/.porcelain/<name>.json` on the machine where the **daemon / MCP** runs
- Override for tests: `PORCELAIN_*` env vars (see channel modules)

Hidden/pinned live in the **daemon config**, not `~/.porcelain`:

- **Mac app:** `~/Library/Application Support/porcelain/config.json` (dev: `…/porcelain-dev/config.json`)
- **Linux / standalone daemon:** `~/.local/share/porcelain/config.json` (or `$PORCELAIN_USER_DATA/config.json` if set)

Shape:

```json
{
  "repos": {
    "/absolute/path/to/repo": {
      "hiddenPaths": ["/absolute/path/to/repo/apps/legacy"],
      "pinnedPaths": ["/absolute/path/to/repo/apps/web"]
    }
  }
}
```

## Local → remote workflow (typical)

1. **Confirm both absolute paths**
   - Local: e.g. `/Users/you/Code/my-app`
   - Remote: e.g. `/home/you/code/my-app`
2. **On the local machine** (where you have MCP now):
   - `list_actions`, `list_cards`, `get_repo_notes`, `get_flow_layers`, `get_review_comments` with local `repoPath`
   - Read `config.json` hidden/pinned for that key (or ask the human what is hidden)
3. **Decide what still makes sense remotely**
   - Keep the same action **commands** if tools exist on remote (`pnpm`, `cargo`, …); drop Mac-only commands (e.g. `xcodebuild`, Simulator) or rewrite them
   - Board cards: usually copy as-is
   - Hidden/pinned: remap absolute prefixes `localRoot → remoteRoot`
4. **Apply on remote** — prefer one of:
   - **A. SSH + MCP on the remote** (best): SSH in, ensure Porcelain MCP is installed for the remote agent, call `create_action` / `create_card` / `set_flow_layers` with **remote** `repoPath`
   - **B. SSH + edit channel JSON**: merge under the remote absolute path key in each `~/.porcelain/*.json` (atomic write: write `.tmp` then rename). Preserve other repos' keys
   - **C. Same host path remap only**: if both paths are on one daemon, the app still has `exportRepoSettings` / `importRepoSettings` / `copyRepoSettings` tRPC procedures for scripts — not the Settings UI
5. **Hidden/pinned on remote**: edit remote `config.json` `repos[remotePath]` (merge, don't wipe other repos). Remap every absolute path string.

## Remote → local

Same steps, reverse source/target. When the human works in a **remote Porcelain window**, MCP on that host already targets remote `~/.porcelain` — list there, then apply on the Mac.

## SSH tips

```bash
# Reach the remote (Tailscale hostname or LAN)
ssh you@beelink

# Channel files
ls ~/.porcelain/
cat ~/.porcelain/board.json | head

# Daemon config (Linux default)
cat ~/.local/share/porcelain/config.json
```

If remote agents need Porcelain MCP: Settings → Agents on a window bound to that environment (installs on the daemon host), or configure MCP to the packaged/out MCP server path on that machine.

## Principles

- **Never silent merge of feature review sets** — those are live review state
- **Remap absolute paths**; relative action `cwd` may also need adjustment
- Prefer **commands the remote can run**; drop or rewrite Mac-only tooling
- Prefer MCP CRUD over hand-editing JSON when MCP is available on the target
- Tell the human what you copied and what you skipped
