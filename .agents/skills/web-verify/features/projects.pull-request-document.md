---
route: /
selectors:
  - 'Open on GitHub'
  - 'Archive'
  - 'Archive pull request?'
  - 'Back to the worktree'
tests:
  - apps/web/spec/e2e/projects-pr-state.e2e.ts
  - apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts
  - apps/web/spec/e2e/review-archive.e2e.ts
api:
  - GET /api/projects/:projectId/pull-requests/:number
  - POST /api/projects/:projectId/pull-requests/:number/archive
---

# projects.pull-request-document

A sidebar PR button opens a document in the current workspace, using the PR's project, number and computer. The displaying workspace stays selected. PR payloads are fetched on opening; the navigator reads only the lightweight list and checks.

Use the disposable GitHub fixture in `apps/web/spec/kit/archive-fixture.ts`, with `codeComment: true` for a source link. At desktop and phone widths, open a local PR beside another checkout, then a PR from a second computer. Description, checks and GitHub comments stay scoped to the PR's computer. A rate limit or missing PR keeps the document identity and offers retry. After a PR list has loaded, an unavailable refresh keeps its sidebar PR button mounted on the same worktree and branch; a successful list can remove or replace that association.

A conversation source link opens the PR branch's current available checkout. Move that branch to another checkout and verify the new checkout and original source. If no checkout holds the branch, the document remains readable and has no source-opening button; it never opens another branch's file.

Archive appears only on a merged or closed PR. A same-named branch from another head repository, a different upstream or unrelated commits refuses with a plain message and no deletion. Preview discloses the entire folder deletion including ignored files. Cancel preserves it. Locked folders show a plain failure; dirty files and unpublished commits require acknowledgement. Confirm deletion only in disposable fixtures, read back Git and filesystem state, and verify navigation and reload reach a surviving worktree.
