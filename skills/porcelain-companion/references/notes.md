# Repo notes

Porcelain keeps a per-repo notes scratchpad — a freeform markdown card (Files → Notes) where the human jots conventions, gotchas, todos, and context for the repo. It's a **one-way** channel: the human writes, you read.

Talk to Porcelain through the bundled CLI at `~/.porcelain/porcelain` — installed automatically and kept fresh on every app launch (no registration, no MCP config). Run it from **inside the repo** and it targets that repo automatically (git toplevel of the cwd); add `--repo <absolute path>` only to point at a different checkout.

- `~/.porcelain/porcelain notes get` → the human's notes as markdown (or a hint that there are none yet).

## How to use it

- When the human says "check my notes", "see my project notes", or "what did I write down", run `notes get` first.
- When you start work in a repo, read the notes for standing context (conventions to follow, gotchas to avoid, what the human wants next) before asking.
- The notes are the human's scratchpad — **read-only**, there is no write command; don't try to edit them. Capture actionable tasks on the project board instead (see [board.md](board.md)).
