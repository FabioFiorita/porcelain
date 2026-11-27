---
screen: /walkthrough
selectors:
  - 'Walkthrough'
  - 'No walkthrough yet.'
  - 'Write walkthrough'
  - 'Writing the walkthrough'
  - 'Before you merge'
  - 'Your call'
  - 'Your calls'
  - 'Nothing needs your decision.'
  - 'Verified'
  - 'Not verified'
  - 'Comments'
  - 'No draft comments'
  - 'Checks'
  - 'Scope'
  - 'Ready to merge'
  - 'Merge status'
  - 'Publish review'
  - 'Shown in the before and after screenshots'
  - 'In this change'
  - 'How the system grew'
  - 'Mark decided'
  - 'Undo'
  - 'Decisions could not be read.'
  - 'See the code'
  - 'Comment'
  - 'Ask about this'
  - 'Ask about this step'
  - 'Add to review'
  - 'Added to the review'
  - 'Open file'
  - 'See every changed file'
  - 'See the change'
  - 'The work changed after this walkthrough’s snapshot. Update to include the latest changes.'
  - 'Update walkthrough'
  - 'Try again'
  - 'Check again'
  - 'Walkthrough agent'
  - 'spinner'
  - 'Read all'
  - 'Earlier comments'
  - 'By step'
  - 'All changes'
  - 'Not in the walkthrough yet'
  - 'Enlarge before screenshot'
  - 'Enlarge after screenshot'
  - 'These lines are unavailable in the saved walkthrough.'
  - 'More checks on the pull request'
  - 'The walkthrough could not be read.'
tests:
  - packages/client/src/features/walkthroughs/rules/walkthrough.spec.ts
  - packages/client/src/features/walkthroughs/rules/briefing.spec.ts
  - packages/client/src/features/walkthroughs/rules/conversations.spec.ts
  - packages/client/src/features/walkthroughs/commands/conversations.spec.ts
  - packages/client/src/features/projects/rules/walkthrough-checks.spec.ts
  - packages/client/src/features/comments/rules/comments.spec.ts
  - apps/mobile/src/shared/adapters/demo-transport.spec.ts
api:
  - GET /api/worktrees/:worktreeId/walkthrough
  - POST /api/worktrees/:worktreeId/walkthrough
  - GET /api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId
  - GET /api/worktrees/:worktreeId/walkthrough/:runId/conversations
  - POST /api/worktrees/:worktreeId/walkthrough/:runId/conversations/messages
  - PUT /api/worktrees/:worktreeId/walkthrough/:runId/calls/:step/:call/decision
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/projects/:projectId/pull-requests
  - GET /api/projects/:projectId/pull-requests/:number
  - GET /api/projects/:projectId/pull-requests/:number/status
---

# reviews.walkthrough-page

The Walkthrough tab, the first of the four worktree tabs, shows the page a fresh agent wrote about the change. It reads like the web's Walkthrough: the meta line, the title and verdict, the merge status line (from the same shared rule as the pull request's Merge: "Ready to merge" or "Not ready to merge: <reasons>", or only "n calls open" when there is no pull request or its status cannot be read) with a "#n · Open" button that opens the pull request, the summary, then a one-line status (Saved · freshness, the writer, Update walkthrough, Writing log; the full stage list only while writing or after a failure), then the briefing "Before you merge" (Your call(s) with each call's step explanation, Checks when GitHub now disagrees with what was written, Verified, Scope, Not verified, Comments), "How the system grew", one section per step and, when the branch has a pull request, the merge footer. Each call sits in its step; its comparison table names each option once, as a column header, and while undecided the table's last row holds "Choose" under each column (accessible name "Choose <option>"), with "In this change" and what choosing means beneath it (or Mark decided when there is no comparison); each step carries its evidence (excerpts, diagrams, files, checks, screenshots), its draft comments, See the code, Comment and Ask about this. Without a current-branch run, every worktree opens on Changes regardless of commits, with Walkthrough one tap away. The wording follows the web map [reviews.walkthrough-page](../../web-verify/features/reviews.walkthrough-page.md).

On tablets with at least 700 units of content width the steps sit beside the page: All changes with its count, By step with each step's file count and a Your call dot, then Not in the walkthrough yet. Empty step groups and their By step heading are hidden.

## How to get to it (user POV)

- The Walkthrough tab of the selected worktree (the app opens on it). With no run yet it shows Write walkthrough.
- The briefing's call rows, its Step N buttons and its screenshot row scroll to that call or step. A call row shows the attention label and question, a check and the chosen option once decided; the row label reads "x of y decided".
- Each step draws its blocks in the writer's order under its explanation: an excerpt as `path · New line N`, the caption and the captured lines; a diagram as a framed drawing (it scrolls sideways when wider than the phone); a before/after pair as two thumbnails; files as rows with the writer's note that open the file on Branch (or Uncommitted when only local); checks as a card headed "Checks passing at <sha>" (failing, running), one row per check, "#N is now at <sha>" when the pull request moved. A step without evidence shows none.
- Tap a diagram node: it is outlined, its neighbours and their edges stay lit, and below the diagram appear its facts and connections, its captured lines or Open file, its draft comments and "Comment on <node>", which opens [the comment sheet](reviews.comment.md). Tap it again to clear.
- Comment (step) opens [the comment sheet](reviews.comment.md); a draft under a step or node has Edit comment (the same sheet) and Delete comment. Comments → Publish review opens [Publish review](reviews.publish-comments.md).
- The writer button under the status (for example "Claude / Opus 5.5 · high") opens [the writer sheet](reviews.walkthrough-writer.md); the next Write, Update or Try again uses its choice.
- Each step's See the code opens [the step's code](reviews.walkthrough-step.md); a screenshot opens [the screenshot](reviews.walkthrough-screenshot.md); See every changed file and See the change open [All changes](reviews.all-changes.md) on Branch. Merge #N pushes the merge sheet (`/merge-pull-request`), Open #N the [pull request](reviews.pull-request.md). Native Back returns to the same place on the page.

## Driving it with agent-device

Preconditions: [surface baseline](README.md), started with `$C start --fixture focused --coding-tool`, which installs the fake writer. It answers from `$REPO/.git/porcelain-fake-walkthrough`: no file writes a ready walkthrough; `hold` waits until the file changes; `signed-out` fails signed out; `nothing` writes the short page.

```sh
git -C "$REPO" switch -c feature
printf 'first line\nsecond line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
```

### 1. Writing and reading

1. Open the worktree. With no run, Changes is selected; choose Walkthrough for "No walkthrough yet.", the writer button and "Write walkthrough".
2. `printf hold > "$REPO/.git/porcelain-fake-walkthrough"`, press Write walkthrough. Expect "Writing the walkthrough" under the `written for <sha>` line. With a saved effort the connected computer reports as unsupported, Write, Update and Try again are disabled and the note names the model and effort. A failed check, missing writer or signed-out run shows one bordered notice ("Sign in to Claude Code or Codex on the connected computer." or "Could not check Claude Code or Codex on the connected computer.") with a single Check again button; on "No walkthrough yet." and a failed first write it replaces Write walkthrough / Try again as the page's one primary action.
3. `rm "$REPO/.git/porcelain-fake-walkthrough"`. Without leaving, expect the heading ending "One call is yours.", "Before you merge" with "Your call · 0 of 1 decided", "Verified" with "No checks or screenshots were captured for <sha>.", "Not verified", "Comments · No draft comments", then "How the system grew" and the steps. Tap the call row: the page scrolls to the call inside its step.

### 2. Out of date, failure and the short page

4. Commit another change in `$REPO`. Expect "The work changed after this walkthrough’s snapshot. Update to include the latest changes." with Update walkthrough. With `hold`, press it: the page stays with "Writing the walkthrough"; remove the file and the new page arrives.
5. `printf signed-out > …`, Update walkthrough: the page stays, with "Sign in to Claude again with claude auth login, then try again." and Try again.
6. `printf nothing > …`, write again. Expect a heading ending "Nothing needs you.", the briefing with "Nothing needs your decision." and See the change.

### 3. The full sample: calls, diagrams, evidence, comments

7. `$C walkthrough sample` writes the shared note-search sample for pull request #423 (the server's web sample plus a second call on step 2), with checks and two screenshots on step 2; reopen the worktree. Expect the meta line "#423 · 4 files, 1 uncommitted · written for …" (the live change, as on the web), "Your calls · 0 of 2 decided", a Checks row and Verified with the after screenshot's claim "The search results with “3 notes found”" over "Shown in the before and after screenshots · Step 2". When GitHub reports pull request #423 for the branch with 2 failing checks, 1 running and review required (see [the pull request page](reviews.pull-request.md)), the line under the title reads "Not ready to merge: 2 checks failing, 1 check running, review required, 2 calls open" beside "#423 · Open", and the briefing's Checks row reads "Checks failing at <sha>: Browser tests and 1 passing" (only failing checks are named, passing ones are counted, and checks that failed when written never sit under Verified). Re-run failed jobs on the pull request page, then return: the Checks row reads "Failing now: reviewdog / eslint" over "Failing when written, at <sha>: Browser tests and 1 passing", step 2's checks heading reads "Failing when written, at <sha>" with "Failing now", and Browser tests reads "Running now · failed when written". With an uncommitted file, Scope reads "<file> is uncommitted, so not in #423. The checks cover <sha> only." and, for files no step cites, "No step covers <file>." which opens every changed file.
8. Step 1's call table names "Show all notes" and "Show no notes" once, as column headers; its last row has "Choose" under each (accessible names "Choose Show all notes, In this change" and "Choose Show no notes"), with an "In this change" badge and "Keeps the code as it is." under the first and "Needs a new commit: this change does not do this yet." under the second, and under the table "Choosing records your call. Merge stops waiting for it unless the call needs a new commit. Porcelain changes no code." (a call with no implemented option keeps "Choosing records your call, and Merge stops waiting for it."). Choose under Show all notes → the Choose row goes away, a green tick, "Decided: Show all notes · <time>" with Undo, and the briefing reads "1 of 2 decided" with the option beside the question. Undo restores the choices. Choosing the option the change does not do adds the same "Needs a new commit…" line under the decision and swaps the tick for an amber warning mark, and Merge keeps waiting ("1 call needs a new commit"). With writes blocked (a revoked or offline computer) the buttons are disabled.
9. Step 1's sequence diagram "An empty query, end to end" scrolls sideways on a phone; tap renderSearch: the detail shows "function, new", its connections and the captured lines. Comment on renderSearch → type → Comment: the sheet closes, the node shows a comment badge and the draft appears under the diagram; the briefing reads "1 draft comment · 1 on the Walkthrough".
10. Step 2's flow diagram "Matching and wording stay apart" lays out downwards on a phone and across on a tablet in landscape.
11. Ask about this → "Ask about this step" → Send: a right-aligned bubble, "Walkthrough agent" with a `spinner`, then the answer with Add to review. `$C walkthrough answer long` first: the answer is clamped to three lines with Read all. Add to review → "Added to the review", and the briefing's draft count grows.

### 4. Tablet

12. In landscape and portrait: the steps list sits beside the page when the content is at least 700 wide, otherwise the phone layout. Step rows open the step's code; All changes opens every file; rotate with the page scrolled.

Automated coverage: `briefing.spec.ts` (pull request choice, verified rows, decisions), `walkthrough-checks.spec.ts` (live and captured checks, moved head), `pull-request.spec.ts` (Checks versus Verified rows, each check now and when written), `pull-request-checks.spec.ts` (merge readiness, the status line and the Merge reason), `comments.spec.ts` (summary, labels, review form), `demo-transport.spec.ts` (bundled demo comments and decisions).

## Gotchas

- The stock fake never produces evidence and has no pull request; `$C walkthrough sample` replaces the writer with the scripted one, so run the hold, signed-out and nothing journeys first or restart the instance.
- The fixture's fake GitHub does not list pull request #423 for the branch nor answer review previews, so the merge footer, live check results and "Post as one pull request review" are not drivable with it; the bundled demo answers previews with "no pull request".
- Notices are one short line; a comment or answer never appears in one.
- The driver's helper input method draws no soft keyboard. To see the composer above a real keyboard, switch the emulator to its stock keyboard with `adb shell ime set`, focus the last step's field, capture, then switch back.

### Pull request evidence at another commit

With a PR behind the local captured head, write a walkthrough. It becomes ready and keeps the PR target for comments, with no PR images or checks. The Verified row says once: “Screenshots and checks are not shown: the pull request is at another commit. Push, then update.” Missing GitHub accounts and GitHub read failures likewise leave the page ready with their shared explanatory notice.

### Progress and writing log

The status area stays visible after completion and says “Up to date with the current work.” when verified. “Walkthrough stages” is a progress bar with named stages: Queued, Reading pull request evidence, Reading the coding conversation, Writing the walkthrough, Checking the walkthrough, Walkthrough saved. Expand “Writing log” to read timestamped events. A failed update keeps the saved content, the failed attempt’s log and “Try again”. Older saved runs say they predate the log; they never invent events.
