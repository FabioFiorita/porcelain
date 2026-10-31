# Worktree cleanup and refusal contracts

`POST /api/worktrees/:worktreeId/delete` previews the one-off resource options, then confirms the same fingerprinted plan. Main worktrees, locked checkouts, detached branch deletion, stale plans and unacknowledged dirty or unpublished work must remain protected. `WorktreeCleanupRefusedError` maps to HTTP 409 with its safety reason in the central status policy as well as the route contract.

Run these named proofs against their owned disposable fixtures:

- [Status policy](../../../../apps/server/src/http/status-policy.spec.ts) checks the exact 409 body and prevents any exported domain error from falling through to 500.
- [Worktree actions](../../../../apps/server/spec/integration/projects-worktree-actions.integration.ts) uses a real unpublished linked-branch commit, protects stale bytes and unacknowledged changes, confirms the selected resources and retains the open linked review.
- [Review archive](../../../../apps/server/spec/integration/reviews-archive.integration.ts) preserves the same dirty, unpublished, stale-plan and partial-failure protections through the shared cleanup owner. Exact refusal text refers to deleting resources and reopening the deletion confirmation.
- [Authentication](../../../../apps/server/spec/integration/access-authentication.integration.ts) enumerates all 93 paired routes, including `GET /api/worktrees/:worktreeId/summary`, `GET /api/reviews/:reviewId/pull-request/checks` and `POST /api/worktrees/:worktreeId/delete`. For missing credentials, an unknown bearer and an unknown cookie, every route must answer 401 with a Bearer challenge and leave inventory unchanged.

The integration harness owns fixture setup and cleanup. Keep the real Git, authentication and exact-state assertions when adapting this map.
