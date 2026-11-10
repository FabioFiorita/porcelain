---
route: /
selectors:
  - 'Open on GitHub'
  - 'Archive'
  - 'Archive review?'
  - 'Back to the review'
tests:
  - apps/web/spec/e2e/projects-pr-state.e2e.ts
  - apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts
  - apps/web/spec/e2e/review-archive.e2e.ts
api:
  - GET /api/reviews/:reviewId
  - GET /api/reviews/:reviewId/pull-request
  - POST /api/reviews/:reviewId/archive
---

# projects.pull-request-document

A sidebar PR button opens its document in the current workspace. Its conversation's source links follow the PR branch's current checkout on its own computer, falling back to the recorded checkout only when that branch has no checkout. Archiving a closed or merged PR retains the existing deletion safeguards and chooses a workspace after cleanup and a confirmed inventory refresh.

## How to get to it (user POV)

Open a worktree, then another worktree's PR button in the sidebar. The document appears as a PR tab without changing the current workspace. GitHub conversation comments link to their source file. Closed and merged PRs offer Archive in the document bar.

## Driving it with browser

Use disposable repositories and the stored-review/GitHub fixture in `apps/web/spec/kit/archive-fixture.ts`. It seeds legacy PR identity through the server kit, with no agent publisher. Pass `codeComment: true` for a conversation file link. Use desktop mode and pair a second disposable computer for the remote case.

1. At 1440 and 414, open a PR beside a different checkout. Confirm that the current workspace stays selected. A rate-limit or not-found response keeps the PR identity and offers retry.
2. Open the conversation's source-file button. Confirm the URL names the PR's project, worktree and, for another computer, environment. Read the file's actual contents and reload to confirm the same checkout stays selected. Then switch the recorded checkout to a different branch, change its file and check out the PR branch elsewhere: reopening the source link must choose the PR branch's new checkout and original contents. If no checkout holds that branch, it falls back to the recorded checkout and its current contents. Repeat for local and remote PRs.
3. Preview Archive on the closed or merged PR. The dialog discloses the entire folder deletion, including ignored files. Cancel preserves the folder. A locked folder reports that nothing was deleted and leaves the PR document available. Dirty changes require explicit acknowledgement.
4. Confirm deletion on the disposable topic checkout. Read back that the folder was removed. Confirm navigation reaches a surviving checkout, with no Worktree not found state, and reload there.

## Gotchas

The stored review identity remains solely for mobile readers and PR operations until those callers migrate. A PR from another computer reads through that computer's connection even while displayed beside a local worktree. File links must never inherit the displaying workspace's checkout.
