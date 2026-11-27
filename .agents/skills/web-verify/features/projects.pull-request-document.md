---
route: /
selectors:
  - 'Open on GitHub'
  - 'Archive'
  - 'Archive pull request?'
  - 'Merge'
  - 'Merge pull request #'
  - 'What blocks the merge'
  - 'Re-run failed jobs'
  - 'Re-run this job'
  - 'Comment on GitHub'
  - 'Back to the worktree'
tests:
  - apps/desktop/spec/e2e/images.e2e.ts
  - apps/web/spec/e2e/projects-pr-state.e2e.ts
  - apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts
  - apps/web/spec/e2e/review-archive.e2e.ts
api:
  - GET /api/projects/:projectId/pull-requests/:number
  - POST /api/projects/:projectId/pull-requests/:number/archive
  - POST /api/projects/:projectId/pull-requests/:number/merge
  - GET /api/projects/:projectId/pull-requests/:number/status
  - GET /api/projects/:projectId/pull-requests/:number/jobs/:jobId/log
  - POST /api/projects/:projectId/pull-requests/:number/rerun
  - POST /api/projects/:projectId/pull-requests/:number/comments
---

# projects.pull-request-document

A sidebar PR button opens a document in the current workspace, using the PR's project, number and computer. The displaying workspace stays selected. PR payloads are fetched on opening; the navigator reads only the lightweight list and checks.

Use the disposable GitHub fixture in `apps/web/spec/kit/archive-fixture.ts`, with `codeComment: true` for a source link. At desktop and phone widths, open a local PR beside another checkout, then a PR from a second computer. Description, checks and GitHub comments stay scoped to the PR's computer. A rate limit or missing PR keeps the document identity and offers retry. After a PR list has loaded, an unavailable refresh keeps its sidebar PR button mounted on the same worktree and branch; a successful list can remove or replace that association.

A conversation source link opens the PR branch's current available checkout. Move that branch to another checkout and verify the new checkout and original source. If no checkout holds the branch, the document remains readable and has no source-opening button; it never opens another branch's file.

In Porcelain Dev, open a PR with HTTPS image attachments and check that the description shows the images, including inside expanded evidence disclosures. Retain a screenshot and verify nonzero natural image dimensions. GitHub private attachments use the signed image URLs returned with the PR; use fresh URLs for this journey. The desktop image policy admits HTTPS sources as well as app, data and blob images.

Merge appears in the decision section on an open PR. Draft status, conflicts, failing or running checks, an offline computer and an undecided call in a Walkthrough at this PR head disable it. Open step takes you to the call. Draft comments ("N draft comments are not published yet.") show as a neutral note below the blocker list with "Publish review", are not named in "Merge waits for", and leave Merge available when its other conditions are met. The dialog offers the methods the repository allows and sends the head the page read; after a merge the page shows Merged, "Merged into <base>." in the Merge section and Archive (a closed PR reads "Closed without merging."). To drive it, extend a fake `gh` like the one in `apps/web/spec/kit/archive-fixture.ts` so it answers `repos/<owner>/<repo>/pulls/<n>/merge` (`--method PUT`, JSON body on stdin) and then reports the PR as merged. Never merge a real pull request from a verification run.

The Merge section at the top lists, in plain words, what blocks the merge: conflicts, each failed check with its failing step, the running check and its step, the review decision with requested reviewers, a Walkthrough written for an older head, and reviewed files whose content changed since they were marked. A check line moves focus to its row and expands it. Checks group by workflow run, labelled with GitHub's run number ("#812") when the read has one, failed first, running next, passed collapsed to a count. A row does not repeat its group: a check named "reviewdog / eslint" in group "reviewdog" reads "eslint", while the Merge list and the Walkthrough keep the full name. A row expands with Enter or Space, and j/k or the arrow keys move between rows. An Actions job lists its steps; a running job names its current step ("Step 6 of 9"); a failed job opens its failing step, which reads a bounded excerpt of the job log on demand (falls back to the job's end, then annotations, then the GitHub link). External checks show their summary and annotations. Re-run failed jobs (per run) and Re-run this job (per job) are disabled with a reason while the run is still in progress, for non-Actions checks or without write permission; re-running a passed job that shares its run asks first. After a re-run the row shows the new attempt without a reload: the status read polls from 20 s, backing off to 2 min while nothing changes, only while something runs and the page is visible. The composer posts one comment to the conversation. To drive it, extend the fake `gh` from `apps/web/spec/kit/archive-fixture.ts` so it answers the `PullRequestStatus` query (check runs with `steps`, `annotations`, `databaseId` and `checkSuite.workflowRun` with `databaseId` and `runNumber`), `repos/<owner>/<repo>/actions/jobs/<id>/logs` (timestamped log text), `actions/runs/<id>/rerun-failed-jobs` and `actions/jobs/<id>/rerun` (`--method POST`), and `issues/<n>/comments` (`--method POST`, JSON body on stdin). The fake runs inside the server sandbox, so keep its script under the instance's project home. Never re-run or comment on a real pull request from a verification run.

Archive appears only on a merged or closed PR. A same-named branch from another head repository, a different upstream or unrelated commits refuses with a plain message and no deletion. Preview discloses the entire folder deletion including ignored files. Cancel preserves it. Locked folders show a plain failure; dirty files and unpublished commits require acknowledgement. Confirm deletion only in disposable fixtures, read back Git and filesystem state, and verify navigation and reload reach a surviving worktree.

When GitHub is unreachable or no account can read the PR, the document shows one line with one action. A computer with no signed-in account reads "No GitHub account is signed in. Run gh auth login on this computer." with Try again, so the open document reads again after signing in without a reload.
