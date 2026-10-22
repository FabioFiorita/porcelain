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

An initial review read that fails without a confirmed reply shows its error and Try again. Retrying refreshes the native reads for this connection and worktree before reopening the surface. The current workspace address stays intact; another workspace or computer is not refreshed.

## Sub-features

- `reviews.read-retry` — Review loading, failure and retry.

## How to get to it (user POV)

- Open a workspace while its review read cannot be answered, then choose Try again.
- The review content, Review sidebar and individual document panes use the same boundary and scoped retry command.

## Driving it with browser

Preconditions: [surface baseline](README.md).

1. Answer matching `GET /api/worktrees/:worktreeId/changes` requests with 503 in the browser (see [routing recipes and per-map instructions](../references/failure-injection.md)), then navigate to `/`.
   Expect: button Try again in the review surface.
2. Restore HTTP pass-through (dispatch `online` only for access.restore-outage), then click button `Try again`.
   Expect: heading Changes and the sample diff; Try again is gone, and the workspace address is unchanged.
3. Inspect HTTP traffic.
   Expect: the refused Changes read followed by a successful read after Try again.
4. Inspect console, then `$C stop`.
   Expect: the expected refused-read diagnostics and no later JavaScript failure.

Automated coverage: `reviews-read-retry.e2e.ts`.

## Gotchas

- This journey starts without a confirmed reply; failed refreshes with prior data retain it.
- Restore failures with pass-through rather than removing the last interceptor while viewer workers load. For a renderer failure inspect trace and code-viewer.json diagnostics; absent debug data is not a reason to create/mutate a worker pool.
