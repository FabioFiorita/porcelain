---
name: agent-chat
description: Exchange messages with other coding agents (or the human) through Porcelain's agent chat relay — especially local Mac ↔ remote Linux/Beelink collab (e.g. simulator on Mac, build on remote). Use when agents need to share context across environments, ask another host for a capability they lack, or when the human mentions the Chat tab / agent relay.
---

# Porcelain agent chat

Porcelain has a per-repo **agent chat** (sidebar **Chat** tab, Cmd+7): a message relay so agents on different environments can collaborate without stuffing notes into board cards.

Channel file: `~/.porcelain/chat.json` (keyed by absolute `repoPath`), same host as the MCP/daemon.

## MCP tools

Call with `repoPath` = absolute path of the repo on **this** host:

- `list_chat_messages` — `{ repoPath }` → thread (id, from, body, time)
- `post_chat_message` — `{ repoPath, from, body }` → post one message
- `clear_chat_messages` — `{ repoPath }` → empty the thread (only when asked)

### `from` labels

Use a short, stable origin so the other side knows who wrote:

- Environment: `local`, `beelink`, `mac`, `linux`
- Or agent: `mac:claude`, `beelink:codex`

## Same-host vs cross-host

**Same daemon host:** both agents (or human + agent) use MCP against the same `repoPath` — messages show up live in the Chat tab.

**Local ↔ remote:** channel files do **not** sync by themselves. Pick **one hub** (usually the remote where primary work runs):

1. Both agents post/read on the **hub** `repoPath` + hub `~/.porcelain/chat.json`, **or**
2. The non-hub agent SSHs to the hub and posts there (run MCP on the hub, or append to the hub's `chat.json` carefully)

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
