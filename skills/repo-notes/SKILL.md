---
name: repo-notes
description: Read the human's per-repo project notes from Porcelain — a freeform markdown scratchpad of conventions, gotchas, todos, and context for the repo. Use to pick up project context the human jotted down instead of spelling it out in chat, especially when they say "my notes" or you're starting work in a repo.
---

# Porcelain project notes

Porcelain keeps a per-repo notes scratchpad — a freeform markdown card (Files → Notes) where the human jots conventions, gotchas, todos, and context for the repo. It's a ONE-WAY channel: the human writes, you read.

Call the `porcelain` MCP tool with `repoPath` set to the ABSOLUTE path of the repo you're working in (your cwd):

- `get_repo_notes` — `{ repoPath }` → the human's notes as markdown (or a hint that there are none yet).

## How to use it

- When the human says "check my notes", "see my project notes", or "what did I write down", call `get_repo_notes` first.
- When you start work in a repo, read the notes for standing context (conventions to follow, gotchas to avoid, what the human wants next) before asking.
- The notes are the human's scratchpad — read-only, there is no write tool; don't try to edit them. Capture actionable tasks on the project board instead (see the project-board skill).
