---
name: project-board
description: Read and update the Porcelain project board — the repo's todo/doing/done cards. Use to pick up queued work the human added, capture new tasks you discover, and move cards to doing/done as you progress, so the human can queue and track work without spelling it out in chat.
---

# Porcelain project board

Porcelain shows a per-repo todo/doing/done board of cards (features/tasks). It's how the human queues work without spelling everything out in chat, and how you reflect progress back — a two-way channel. Read it to know what to build; keep it in sync as you work.

Call the `porcelain` MCP tools with `repoPath` set to the ABSOLUTE path of the repo you're working in (your cwd):

- `list_cards` — `{ repoPath }` → the board grouped by column, each card with an id, title, and body. Check it to pick up queued work.
- `create_card` — `{ repoPath, title, body?, status? }` → capture a task (defaults to the "todo" column).
- `update_card` — `{ repoPath, id, title?, body? }` → edit a card.
- `move_card` — `{ repoPath, id, status }` → move a card to "doing" when you start it and "done" when you finish, so the human sees progress.
- `delete_card` — `{ repoPath, id }`.

## How to use it

- When the human says "what's on my board", "what should I build next", or asks you to pick up queued work, call `list_cards` first.
- When you start a card, `move_card` it to "doing"; when you finish, move it to "done" — keep the board honest so the human sees real-time progress.
- Capture follow-ups and tasks you discover with `create_card` so nothing gets lost in chat.
