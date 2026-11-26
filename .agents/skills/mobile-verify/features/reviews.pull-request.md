---
screen: /pull-request
selectors:
  - 'Open on GitHub'
  - 'Read pull request again'
  - 'The pull request could not be read.'
  - 'Merge'
  - 'Nothing on GitHub blocks the merge.'
  - 'Checks'
  - 'Re-run failed jobs'
  - 'Re-run this job'
  - 'Full log'
  - 'Copy'
  - 'Description'
  - 'Conversation'
  - 'Comment on GitHub'
  - 'Try again'
  - 'spinner'
  - 'Archive'
  - 'Image unavailable'
tests:
  - apps/mobile/src/features/workspace/rules/pull-request-checks.spec.ts
  - apps/mobile/src/shared/application/notice.spec.ts
  - apps/mobile/src/shared/adapters/demo-transport.spec.ts
  - packages/client/src/features/projects/rules/pull-request.spec.ts
  - packages/client/src/features/projects/rules/pull-request-checks.spec.ts
api:
  - GET /api/projects/:projectId/pull-requests/:number
  - GET /api/projects/:projectId/pull-requests/:number/status
  - GET /api/projects/:projectId/pull-requests/:number/jobs/:jobId/log
  - POST /api/projects/:projectId/pull-requests/:number/rerun
  - POST /api/projects/:projectId/pull-requests/:number/comments
  - POST /api/projects/:projectId/pull-requests/:number/archive
  - GET /api/worktrees/:worktreeId/comments
---

# reviews.pull-request

A pull request reads as one page scoped to its project, number and computer, matching the web's pull request page inside the native bars: header, Merge, Checks, Description and Conversation, with Open on GitHub in the top bar. Status polls only while the screen is focused and the app is in the foreground.

## How to get to it (user POV)

- Changes tab → Pull request #n row (shown when the worktree's branch has a pull request). Back returns to Changes.
- Worktrees → a worktree's PR number. From the end of the Walkthrough, Open #n.

## Driving it with agent-device

Preconditions: [surface baseline](README.md). Run `$C walkthrough sample` for branch `walkthrough-sample` with a ready Walkthrough on pull request #423 (origin `example/sample`). Its `gh` answers only a bare pull request; checks with steps and logs, reviews, merge and re-run need a `gh` on the sandbox's `bin` folder (the server manifest's `bin`, under `fixtures.projectHome`) that answers `gh api` for `repos/example/sample/pulls/423`, its status GraphQL, `actions/jobs/:id/logs`, re-runs, merge and issue comments for that branch and head. Install it after `$C walkthrough sample`, which writes its own `gh` into the same folder. The bundled demo answers the same page without a server: Settings → Try the demo → Changes → Pull request #7.

1. Header: `#n` and title, the state badge (Open, Draft, Merged, Closed), author, `base ← head`, updated time and labels.
2. Merge: the heading shows `No conflicts`/`Conflicts`/`Not known yet` and the short head. Each blocker is one line with its state icon: failed checks name their failing step and `· required`, a running check its step, conflicts, behind base, review required, changes requested, a branch rule. `Nothing on GitHub blocks the merge.` when none. With the pull request's branch selected as the worktree and a Walkthrough at the same head, an undecided call adds `Your call in Walkthrough step n is not decided yet.` with Open step n, which switches to the Walkthrough tab on that step. A Walkthrough at another head adds the covers/at line with Open Walkthrough. Draft comments on the branch add `n draft comments are not published yet.` with Publish. Uncommitted work never blocks. Merge is disabled while anything blocks and opens the [Merge sheet](reviews.merge-pull-request.md). A merged or closed pull request says so and offers Archive ([archive](projects.archive-pull-request.md)).
3. Checks: counts (failed, running, passed), then one card per workflow run (`run n`) with failed and running jobs first and `n passed` folded. Tap a job: its steps with durations; the failing step's log opens with `Step n · m lines`, Copy (notification `Copied the log lines`) and Full log. A missing log explains why with Full log and annotations. External checks show their summary. Re-run failed jobs (per run) starts at once; Re-run this job asks first when it would re-run finished sibling jobs. A refusal reason (not Actions, no permission, run still busy, not open) shows under the disabled button. After a re-run the job shows `Re-run requested` until GitHub reports it running.
4. Description renders Markdown text (headings, lists, code, links; images as links). Conversation lists comments and reviews with their review comments nested, each with its GitHub link; Comment on GitHub posts a comment (notification `Commented on #n`), and a refusal shows under the composer.
5. Leave the screen or background the app: the server's call log shows status reads stop; return and one read happens at once.

Verify loading (one delayed spinner), missing PR, rate limit and disconnected states, then retry after recovery. Verify an Android phone and a tablet in landscape and portrait (one column, capped width). Report iOS proof separately.

## Description evidence

Seed the pull request description with a heading, a list, inline code, a fenced block, a link, a Markdown image with a reachable URL, one unreachable image with a meaningful alt label and one image with an unsafe URL scheme. Description shows them as text inside the page: headings, bullets, code and a tappable link; reachable images fit the content width and keep their aspect ratio, and tapping one opens it; an unreachable or rejected image shows `Image unavailable: <alt>`. Repeat with light and dark appearance.

## Gotchas

- The status poll backs off from 20 seconds to 2 minutes while checks run and stops when none run; the GitHub budget is shared across projects.
- Open step n and Publish appear only when the pull request's branch is the selected worktree.
