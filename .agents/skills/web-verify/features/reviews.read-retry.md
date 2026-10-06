---
route: /$projectId/$worktreeId
selectors:
  - "Try again"
  - "Changes"
tests:
  - apps/web/spec/e2e/reviews-read-retry.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/changes
---

# reviews.read-retry

## What it is

An initial review read that fails without a confirmed reply shows its error and Try again. Retrying refreshes the native reads for this connection and worktree before reopening the surface. The current workspace address stays intact; another workspace or computer is not refreshed.

## How a user reaches it

- Open a workspace while its review read cannot be answered, then choose Try again.
- The review content, Review sidebar and individual document panes use the same boundary and scoped retry command.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` starts a disposable workspace.

1. `$C network fail "GET /api/worktrees/:worktreeId/changes" --status 503`, then `$C open /`.
   Look for: button Try again in the review surface.
2. `$C network restore`, then `$C click --role button --name "Try again"`.
   Look for: heading Changes and the sample diff; Try again is gone, and the workspace address is unchanged.
3. `$C network`.
   Look for: the refused Changes read followed by a successful read after Try again.
4. `$C console`, then `$C stop`.
   Look for: the expected refused-read diagnostics and no later JavaScript failure.

## What proves it works

- `apps/web/spec/e2e/reviews-read-retry.e2e.ts` refuses the initial Changes read, restores transport, clicks Try again and observes the same workspace address and loaded Changes document.
- The named shared text-read cases prove retrying a failed native read and isolation from another worktree and another connection.

## Gotchas

- A failed refresh with a previous confirmed reply keeps that reply on screen; this boundary is for a read that has no confirmed reply.
- A source edit requires stopping and starting the disposable instance before driving it again.
- Test outages restore by passing requests through the existing context interceptor. Removing the last interceptor while module workers load can strand their dependency requests and leave the code viewer initializing.
- An E2E failure attaches `code-viewer.json`: page closure, worker URLs, renderer bounds and virtual window, rendered file count and optional upstream worker-pool statistics. The upstream debug handle may be absent; the snapshot never creates or mutates a viewer or worker pool. Use this with the trace to distinguish a missing read from an unfinished renderer.
