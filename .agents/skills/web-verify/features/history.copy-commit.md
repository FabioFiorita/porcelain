---
route: /
selectors:
  - "Review content"
tests:
  - apps/web/spec/integration/history-copy-commit.test.tsx
api:
  - GET /api/worktrees/:worktreeId/commits
  - GET /api/worktrees/:worktreeId/commits/:oid/files
---

# history.copy-commit

## What it is

A commit's full id or its whole message is copied from its History row and from its commit document.

## How a user reaches it

- Review → History → right-click a commit → Copy commit id or Copy message, and the commit document → Copy id or Copy message

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

## What proves it works

- `apps/web/spec/integration/history-copy-commit.test.tsx` (Browser Mode integration): .
- The tests read back what the server kept through the kit: `server.commits()`.

## Gotchas

- None known.
