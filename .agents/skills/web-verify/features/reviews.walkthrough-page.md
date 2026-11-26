---
route: /
selectors:
  - 'Review'
  - 'No walkthrough yet.'
  - 'Write walkthrough'
  - 'No writers available'
  - 'Check again'
  - 'Project walkthrough settings'
  - 'Writing the walkthrough'
  - 'How the system grew'
  - 'Not covered by the steps'
  - 'Comment on this step, or ask the agent'
  - 'Mark decided'
  - 'Update walkthrough'
  - 'Try again'
  - 'Writing the walkthrough'
  - 'By step'
  - 'Your call'
  - 'Not in the walkthrough yet'
  - 'Previous step'
  - 'Next step'
  - 'Open file'
  - 'Open step code'
  - 'Enlarge before screenshot'
  - 'Enlarge after screenshot'
  - 'More checks on the pull request'
tests:
  - apps/web/spec/integration/walkthroughs-page.test.tsx
  - apps/web/spec/integration/walkthrough-blocks.test.tsx
  - apps/web/spec/integration/walkthrough-writer-availability.test.tsx
  - apps/web/spec/integration/walkthrough-conversations.test.tsx
  - apps/server/spec/integration/walkthroughs-fake-writer.integration.ts
api:
  - GET /api/worktrees/:worktreeId/walkthrough
  - POST /api/worktrees/:worktreeId/walkthrough
  - GET /api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId
  - GET /api/worktrees/:worktreeId/branch-changes
---

# reviews.walkthrough-page

Every worktree opens on its review: the document tab "Review", pinned at the left of the first pane. A worktree can have one Walkthrough for its whole change since the base branch, committed or uncommitted: a fresh agent reads the change and writes one page with the calls that need the developer, how the system grew and one step per decision. With a Walkthrough, the review shows each step's prose with that step's own diffs inline (Branch, then Uncommitted, so a file changed in a commit and again locally shows both parts), then "Not covered by the steps" only when changed files are in no step. Without one (none yet, being written or failed), it shows the way to write one above every changed file's diff. Its files are also organized by step in the Changes panel, and the page marks itself out of date when its content or base changes.

## How to get to it (user POV)

- Every worktree opens on tab "Review"; there is no separate Changes or Walkthrough tab. Old links with `entry=handoff`, `entry=walkthrough` or `entry=walkthrough-changes` land on Review and the URL becomes `entry=review`; an old one in the right pane (`side=walkthrough`) is dropped, so Review only ever sits in the left pane. The window title is the Walkthrough's title once one is ready, otherwise "Review — <project>" (also while a run is writing or failed).
- Without a run, Review shows the one line "No walkthrough yet." with one action, "Write walkthrough", above group "Code: Every changed file" (regions "Every changed file: branch" and "Every changed file: uncommitted"). While writing or after a failure, the status or failure sits above the same code. The same line names the base and the effective project/default writer ("Since main · Claude / Opus 5.5 · high"). With no available coding CLI the line says to sign in to Claude Code or Codex and its one action is Check again; an unavailable chosen writer offers Project walkthrough settings (or the Settings link) instead of Write walkthrough. A missing saved project writer is never replaced with the default.
- A worktree with no change since the base and no run shows the one line "No changes to review." with one Files button in Review. A branch with no commits yet shows its local files with no comparison error.
- Review reads quietly: local files show without waiting for the branch comparison, code already shown stays while a newer patch is read, and no loading words or placeholders appear inside it (the writer's status stays). Each Uncommitted section shows its first 25 files, then "Read N more of <total files>". While another tab is shown, Review keeps its place but reads no patches; it catches up when shown again.
- Each step draws its blocks in the writer's order between its explanation and its code: an inline captured excerpt with a disclosure named "Hide the lines" or "Show the lines" for its path and range; a before/after pair as two thumbnails captioned "Before …" and "After …" (buttons "Enlarge before screenshot" / "Enlarge after screenshot"); files as list "Files", one button per file with the writer's note, opening the file; checks as region "Checks passing at <sha>" (failing, running) with one row per check and "More checks on the pull request" when GitHub listed more. Callouts stay in the calls section with their comparison as a two-column table. A step without evidence shows none.
- Open Full diff of this step to show group "Code: Step N": region "Step N: branch" for its committed files and "Step N: uncommitted" for its local edits, each diff rendered with Pierre; then the Full diff toggle (while open, the step's excerpts collapse to their headers so no line shows twice) and textbox "Comment on this step, or ask the agent". The sticky step bar names the current step; Previous/Next step carry K/J in their tooltips, and C focuses the current step's comment box. A file cited by two steps appears in both. Changed files no step cites appear under heading "Not covered by the steps" at the end (regions "Not covered by the steps: branch" / "…: uncommitted"); the heading is absent when every file is in a step.
- Type a question in a step that also has a call card. Its call card, the other steps and a second worktree's Walkthrough each have their own drafts. Return to the original step and confirm its unsent text stays there. Switch branches in the same worktree and confirm a same-titled step starts empty. Return to the original branch and update the Walkthrough. The draft remains if the step keeps its title.
- A captured excerpt starts expanded. Its disclosure collapses and reopens the same saved range. Open file opens the cited source. When the captured hunk is unavailable, Open step code opens the current comparison. Expanding Full diff keeps the excerpt header and shows the range in the full comparison below.
- The Changes panel's "By step" rows still open document "Step N" (`entry=walkthrough-step:N`) after Review: it selects the comparisons containing the step's files, with one Reviewed toggle for the step and buttons "Previous step" and "Next step" in its header row. Its "All changes" row opens the uncommitted file table ("All changes", `entry=all-changes`).
- Changes panel on a walkthrough worktree opens by default, on Uncommitted when there are local files and no committed files, otherwise Branch (an explicit tab choice wins): "All changes" with its count, "By step" with file counts and a "Your call" dot; under Uncommitted, empty step groups and their "By step" heading are hidden and files the walkthrough never read are under "Not in the walkthrough yet".

## Driving it with browser

Preconditions: [surface baseline](README.md), started with `$C start --coding-tool`, which installs the fake writer. The fake answers from a scenario file in the repository's Git directory: no file writes a ready walkthrough; `hold` waits until the file changes; `signed-out` fails signed out; `nothing` writes the short page.

For a ready synthetic page without running the fake writer, start with `$C start --walkthrough-sample` and open the initial worktree. Expect one call with a two-column comparison and buttons "Choose <option>", two steps, "How the system grew", and the briefing rows Your call ("0 of 1 decided"), Verified (each check name opens its row on the pull request page; a moved pull request head is named), Not verified and Comments; Step 2 shows its file, "Checks passing at <sha>" and a before/after pair. Follow the call to Step 1. Expect the inline captured `src/search.ts` range with the title-matching rule selected. Collapse and reopen the range and confirm the selected lines and step stay in view.

### Setup

```sh
git -C "$REPO" switch -c feature
printf 'first line\nsecond line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
```

### 1. Writing and reading

1. Navigate to `/`. Expect the only document tab "Review", selected, and title "Review — repository"; "No walkthrough yet.", "Write walkthrough" and below them the diff of notes.md in region "Every changed file: branch".
2. `printf hold > "$REPO/.git/porcelain-fake-walkthrough"`, click "Write walkthrough". Expect status "Writing the walkthrough" with the diffs still below.
3. `rm "$REPO/.git/porcelain-fake-walkthrough"`. Expect heading "Teach the sample to explain itself", then the briefing (with a Not verified row) and "How the system grew". Open Full diff of this step on the notes.md step and expect "first line" in its branch region; no "Not covered by the steps"; the Changes panel on Branch with "By step". The title becomes the Walkthrough's title.
4. In the Changes panel click "Step 1". Expect tab "Step 1" after Review, heading "Step 1 of N: …", previous and next arrows in that one header row; no second title block and no "Mark all reviewed". Click tab "Review": the page is where you left it.

### 2. Uncommitted and out of date

5. Edit a file the walkthrough covers and add a new one, then choose tab "Uncommitted" in the panel. Expect "All changes", only steps with edits, and "Not in the walkthrough yet" listing the new file.
6. Commit exactly the content already explained: the page stays fresh. Edit a file or commit different content. Expect "The work changed after this walkthrough’s snapshot. Update to include the latest changes." and button "Update walkthrough"; clicking it writes a new attempt (the meta line names the new head commit).

### Uncommitted-only journey

Start a branch at its base with no later commits. Leave a tracked edit and an untracked non-ignored file, then load the worktree: it opens on Review with "No walkthrough yet.", "Write walkthrough" and both files' diffs in region "Every changed file: uncommitted". Write it and expect a ready page whose meta line includes "and uncommitted work". Under Changes > Uncommitted, the captured files appear by step. Commit exactly that content: no out-of-date warning appears and an explicit repeated start reuses the run. Edit a file: without reloading, expect "The work changed after this walkthrough’s snapshot. Update to include the latest changes." and "Update walkthrough"; Update captures the new content. An added file outside the ready page stays under "Not in the walkthrough yet" until updated. Branch still groups committed files by step.

### Code scopes

For each of uncommitted-only, committed-only, and committed plus a later edit to the same file, write a walkthrough. In Review, expect the captured file’s actual code under region "Step 1: uncommitted", "Step 1: branch", or both respectively, with Branch first: a file changed in a commit and again locally shows its full change across both. Then open "Step 1" from the Changes panel: the Step document shows the same files under "Uncommitted code" and "Branch code". A step has one Reviewed toolbar toggle for all its files across both comparisons. Its pressed state requires every file in both comparisons to be reviewed. Click Reviewed or press R to mark all remaining reviewable files; when all are reviewed, either action clears the whole step. A partially reviewed step marks its remaining files. Files in other steps are untouched. Results and failures appear in a toast, with no result message beside Reviewed in the toolbar. Individual diff tabs and per-file controls toggle only that file. Clicking either comparison changes code-navigation focus without changing the step review scope. In the Changes sidebar, Branch lists committed files by step and Uncommitted lists dirty files by step, with no duplicate file within a comparison.

### 3. Failure

7. During an update, the last ready page, its conversations and composer, the saved bar, Step tabs and Changes grouping stay available with “Writing the walkthrough”. A failed update keeps that page and its conversation controls and shows the failure using the failed attempt’s writer, even when the kept page was written by another provider, with “Try again”. The sidebar keeps the last ready title for the current branch while updating and after failure; a ready title from another branch never replaces it. With no ready page the initial running/failure states remain.
8. `printf signed-out > "$REPO/.git/porcelain-fake-walkthrough"`, press Update or Write. Expect one sentence "Sign in to Claude again with claude auth login, then try again." (Codex names `codex login`) in both the initial failure and failed-update line; after removing the file, "Try again" writes the walkthrough.

After a ready page, add an untracked `.gitattributes` with `*.secret filter=example` and an untracked `new.secret`. Reload: the saved page remains visible with no notice about the failed freshness check. Update reports "This change uses Git conversion filters, which Porcelain will not execute." without removing the saved page.

### 4. Short page

8. `printf nothing > "$REPO/.git/porcelain-fake-walkthrough"`, write again. Expect heading "A small routine change" and below it group "Code: Every changed file" with every changed file's diff.

A later commit outside the steps: commit a new file after the walkthrough is ready. Expect heading "Not covered by the steps" at the end of Review with that file's diff in region "Not covered by the steps: branch", and "Not in the walkthrough yet" in the Changes panel.

## Gotchas

- The fake never produces evidence, because the fixture has no pull request; prove screenshots with seeded evidence or the real writer.
- Provider credentials are stripped from verification instances; the real writer cannot run through this skill.
- Review stays mounted (hidden) after you leave it, so its reading position survives; scope text checks to the shown document (`tabpanel`) because the hidden Review can hold the same code text. Opening a file directly (`entry=file:…`) does not mount Review until it is shown.

### 5. Conversations

9. The stock fake writer returns plain text for a comment follow-up, matching the conversation turn without a JSON schema. Under a step, textbox "Comment on this step, or ask the agent" is visible immediately: "Ask" (or Enter) asks the agent, "Comment" saves a draft review comment (Shift+Enter adds a line). A call has no composer; asking never decides it. Messages already on a step are visible immediately. Backticks render inline code.
10. Expect a right-aligned developer bubble and "Walkthrough agent", first "Working…", then its answer; "Read all" appears only when the answer exceeds its three-line clamp and expands it. Type another draft while the answer arrives; it must survive the notice without moving the document. A failed answer shows the plain failure and "Try again".
11. A call is decided with "Choose <option>" (or "Mark decided" without a comparison); it then reads "Decided: <option>" with who and when, and "Undo" removes it. Reload: the decision stays (server-stored per run and call). The briefing counts "N of M decided", and Merge #N names what it waits for (for example "Merge waits for: 1 call open.") beside "Open #N"; the header's Merge status line ("Not ready to merge: …" or "Ready to merge") comes from the same rule, which opens the pull request page with the full list; the pull request page blocks Merge for the same undecided call, says "Merge waits for it." and links to "Open step N". Draft comments remain informational; the briefing's Comments row reads "N draft comments" with Review and publish, then "N comments posted" once a review is posted. An agent answer offers "Add to review", which saves it as a draft comment on the step; everything reaches the pull request only through Publish.
12. Save a step comment and a file, line or diagram-node comment. Open Comments, then Publish and Preview review. Confirm the summary and edited comment bodies before choosing Post review. A diff line in the PR appears inline. Whole-file, step, node and outdated anchors belong in the review body. A successful post shows Review posted and leaves one posted link. A refused preview or post keeps the drafts and gives a reason. Copy Markdown and the CLI command remain available from Publish. Whole-walkthrough and removed-step conversations appear under Earlier comments.

Conversation browser proof: `apps/web/spec/integration/walkthrough-conversations.test.tsx`, using the isolated fake CLI against the real server. Its ready walkthrough is a synthetic fixture, with no external project content. Sweep at desktop and 414 × 896, light and dark.

13. After a later walkthrough has outcome `nothing`, retained agent threads still appear under "Earlier comments". Draft review comments are a separate list with one Publish flow.

14. With two ready walkthroughs on different branches in one checkout, read A’s comment and switch to B. B’s heading, comments and saved bar must name B; A’s comments disappear. Every agent conversation request includes the displayed ready run ID, so a pending A question remains targeted to A even if the branch switches.

15. Reject the send request using [failure injection](../references/failure-injection.md). Switch worktrees and return. The draft and send error stay together. Editing the text or displaying a new revision clears the error. Send again and confirm the draft clears on success.

### Pull request evidence at another commit

With a PR behind the local captured head, write a walkthrough. It becomes ready and keeps the PR target for comments, with no PR images or checks. The meta line says once: “Screenshots and checks are not shown: the pull request is at another commit. Push, then update.” Update remains available even without local edits. Push that head, then Update: the new run clears the notice and can show matching evidence. Missing GitHub accounts and GitHub read failures likewise leave the page ready with their shared explanatory notice. A walkthrough without a PR needs no notice.

A successfully loaded list supplies the open PR for the current branch, including during background refresh and when it replaces the displayed run's PR. If no open PR for this branch is known from that list, retain the displayed run's PR. With neither, the write has no PR target. A failed read with cached success still uses that last loaded list; a never-loaded list or failure without cached success supplies none.

### Progress and update log

Once saved, the status area is one quiet line, “Saved <date>” (with “· Behind the current work” when the work moved on), beside Update walkthrough; the stages, bar and Update log show only while an update runs or after it fails. “Walkthrough stages” is a progress bar with named stages: Queued, Reading pull request evidence, Reading the coding conversation, Writing the walkthrough, Checking the walkthrough, Walkthrough saved. The bar counts stages, not estimated time. Expand “Update log” to read timestamped events. Reload while the fake is held: the same stage and events remain. Release it: the log retains queueing, evidence, conversation, writing, validation and completion. Change work while held: completion shows that the snapshot is behind current work instead of claiming it is up to date. A failed update keeps the saved content, the failed attempt’s log and “Try again”. No update button appears between accepting the request and observing the server attempt. Older saved runs say they predate the log; they never invent events.

- Screenshot thumbnails show nothing while their image is read and nothing when it fails. The enlarged screenshot dialog shows one small spinner after 400 ms while it reads, and a failed read shows "This screenshot could not be loaded." with Try again.

### Live verification and diagram comments

- When the latest pull request status differs at the captured commit, Verified shows the live result on the first line and "Captured: …" on a second, quieter line. If the head changed, a line names the newer commit. Opening the Walkthrough does not start the pull request page's status polling.
- A diagram lays out anchored nodes in the step. Open a node's related file or save a draft comment on the node, then find it in the same Comments list as line and step drafts.
