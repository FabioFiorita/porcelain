# Sync Porcelain environments

Porcelain keeps per-repo companion data on the **daemon host**, keyed by **absolute** repo path. Nothing crosses machines automatically. You (the agent) copy what the human needs — deliberately, with path remapping — instead of a confusing Settings UI seed.

The CLI lives at `~/.porcelain/porcelain` on **every** daemon host (local Mac and remote alike) — installed automatically and kept fresh on every launch, no registration. Run it from inside the repo and it targets that repo (git toplevel of the cwd); add `--repo <absolute path>` to point at a specific checkout — which is how you drive the remote's CLI over SSH.

## What to copy (and what not to)

| Carry over | Source | Notes |
|---|---|---|
| **Saved actions** (commands) | `porcelain actions list` / `actions create` or `~/.porcelain/actions.json` | Same commands the human one-clicks in Terminal |
| **Project board** | `porcelain board list` / `board create` or `~/.porcelain/board.json` | Todo/doing/done — remap paths only on the key |
| **Repo notes** | `porcelain notes get` (read-only) + write notes via the app or file | Human scratchpad |
| **Flow layers** | `porcelain layers get` / `layers set` | Regex rules; paths inside patterns are usually relative |
| **Review comments** | `porcelain comments list` | Only if the human still wants open notes on the other host |
| **Hidden folders** | Daemon `config.json` → `repos[absPath].hiddenPaths` | Absolute paths — **must remap** |
| **Pinned folders** | Daemon `config.json` → `repos[absPath].pinnedPaths` | Absolute paths — **must remap** |

**Do not copy:**

- Review sets (`review-sets.json`) — the **Review** is session/work-specific
- Loop evidence
- Reviewed marks
- Agent chat (`chat.json`) — ephemeral relay; use [chat.md](chat.md) for live collab instead
- Daemon token, environments list, agent threads

## Paths by host

Channel files (board, actions, notes, layers, comments, chat, …):

- Always: `~/.porcelain/<name>.json` on the machine where the **daemon** runs
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
2. **On the local machine** (where you're running now):
   - `porcelain actions list`, `board list`, `notes get`, `layers get`, `comments list` (run from inside the repo, or with local `--repo`)
   - Read `config.json` hidden/pinned for that key (or ask the human what is hidden)
3. **Decide what still makes sense remotely**
   - Keep the same action **commands** if tools exist on remote (`pnpm`, `cargo`, …); drop Mac-only commands (e.g. `xcodebuild`, Simulator) or rewrite them
   - Board cards: usually copy as-is
   - Hidden/pinned: remap absolute prefixes `localRoot → remoteRoot`
4. **Apply on remote** — prefer one of:
   - **A. SSH + the remote's CLI** (best): SSH in and run the daemon-installed `~/.porcelain/porcelain` there — `actions create` / `board create` / `layers set` with `--repo <remote path>`. Nothing to install; the remote daemon already put the CLI in place.

     ```bash
     ssh you@remote-host '~/.porcelain/porcelain board create --title "Wire up auth" \
       --status todo --repo /home/you/code/my-app'
     ```
   - **B. SSH + edit channel JSON**: merge under the remote absolute path key in each `~/.porcelain/*.json` (atomic write: write `.tmp` then rename). Preserve other repos' keys
   - **C. Same host path remap only**: if both paths are on one daemon, the app still has `exportRepoSettings` / `importRepoSettings` / `copyRepoSettings` tRPC procedures for scripts — not the Settings UI
5. **Hidden/pinned on remote**: edit remote `config.json` `repos[remotePath]` (merge, don't wipe other repos). Remap every absolute path string.

## Remote → local

Same steps, reverse source/target. When the human works in a **remote Porcelain window**, the CLI on that host already targets remote `~/.porcelain` — list there, then apply on the Mac.

## SSH tips

```bash
# Reach the remote (Tailscale hostname or LAN)
ssh you@remote-host

# The CLI is already installed by the remote daemon
~/.porcelain/porcelain board list --repo /home/you/code/my-app

# Channel files
ls ~/.porcelain/
cat ~/.porcelain/board.json | head

# Daemon config (Linux default)
cat ~/.local/share/porcelain/config.json
```

## Principles

- **Never silent merge of feature review sets** — those are live review state
- **Remap absolute paths**; relative action `cwd` may also need adjustment
- Prefer **commands the remote can run**; drop or rewrite Mac-only tooling
- Prefer the CLI over hand-editing JSON when you can reach the target host
- Tell the human what you copied and what you skipped
