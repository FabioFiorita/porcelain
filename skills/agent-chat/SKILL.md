---
name: agent-chat
description: Exchange messages with other coding agents (or the human) through Porcelain's agent chat relay — especially local ↔ remote collab (e.g. simulator on the local machine, build on a remote server). Use when agents need to share context across environments, ask another host for a capability they lack, or when the human mentions the Chat tab / agent relay.
---

# Porcelain agent chat

Porcelain has a per-repo **agent chat** (sidebar **Chat** tab, Cmd+7): a message relay so agents on different environments can collaborate without stuffing notes into board cards.

Channel file: `~/.porcelain/chat.json` (keyed by absolute repo path), on the daemon host.

## The CLI

Talk to Porcelain through the bundled CLI at `~/.porcelain/porcelain` — installed automatically and kept fresh on every app launch (no registration, no MCP config). Run it from **inside the repo** and it targets that repo automatically (git toplevel of the cwd); add `--repo <absolute path>` only to point at a different checkout.

- `~/.porcelain/porcelain chat list` → thread (id, from, body, time)
- `~/.porcelain/porcelain chat post --from <label> --body <text>` → post one message
- `~/.porcelain/porcelain chat clear` → empty the thread (only when asked)

### `from` labels

Use a short, stable origin so the other side knows who wrote:

- Environment: `local`, `remote`, `mac`, `linux`
- Or agent: `mac:claude`, `remote:codex`

## Same-host vs cross-host

**Same daemon host:** both agents (or human + agent) run the CLI against the same repo — messages show up live in the Chat tab.

**Local ↔ remote:** channel files do **not** sync by themselves. Pick **one hub** (usually the remote where primary work runs):

1. Both agents post/read on the **hub** host — its `~/.porcelain/porcelain`, its repo path, **or**
2. The non-hub agent SSHs to the hub and runs the CLI there:

```bash
ssh you@remote-host '~/.porcelain/porcelain chat post --from mac:claude \
  --body "Screenshot at /Users/.../shot.png" --repo /home/you/code/my-app'
```

Example flow:

- Remote agent: "Need an iOS Simulator screenshot of the login screen after this API change."
- Local agent (Mac): reads chat → runs Simulator → posts "Screenshot at /Users/…/shot.png" or a summary of what failed
- Remote agent: continues with that context

## When to use chat vs board

| Use **chat** | Use **board** |
|---|---|
| Cross-environment handoff, Q&A, "please run X on your machine" | Durable tasks: todo / doing / done |
| Ephemeral collab notes | Work the human queues for later |

## Principles

- Keep messages short and actionable
- Don't dump secrets (tokens, `.env`) into chat
- Prefer the hub host for the whole thread so both sides see one conversation
- Don't clear the thread unless the human asks
