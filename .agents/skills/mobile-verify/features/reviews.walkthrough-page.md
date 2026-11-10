---
screen: /worktree
selectors:
  - 'Walkthrough'
  - 'No walkthrough yet.'
  - 'Write walkthrough'
  - 'Reading the change'
  - 'How the system grew'
  - "What the code doesn't say"
  - 'See the code'
  - 'See every changed file'
  - 'See the change'
  - 'The work changed after this was written.'
  - 'Update walkthrough'
  - 'Updating…'
  - 'Try again'
  - 'Your call'
  - 'Decide, or ask about this'
  - 'Ask about this'
  - 'Ask about this step'
  - 'Walkthrough agent'
  - 'Working…'
  - 'Read all'
  - 'Save for later'
  - 'Saved for later'
  - 'Undo'
  - 'Copy as prompt'
  - 'Copy together'
  - 'Copied brief'
  - 'Earlier comments'
  - 'By step'
  - 'All changes'
  - 'Not in the walkthrough yet'
  - 'Enlarge screenshot'
  - 'The walkthrough could not be read.'
tests:
  - packages/client/src/features/walkthroughs/rules/walkthrough.spec.ts
  - packages/client/src/features/walkthroughs/rules/conversations.spec.ts
  - packages/client/src/features/walkthroughs/commands/conversations.spec.ts
  - apps/mobile/src/features/walkthroughs/rules/post-notice.spec.ts
  - apps/mobile/src/features/projects/rules/worktree-section.spec.ts
api:
  - GET /api/worktrees/:worktreeId/walkthrough
  - POST /api/worktrees/:worktreeId/walkthrough
  - GET /api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId
  - GET /api/worktrees/:worktreeId/walkthrough/:runId/conversations
  - POST /api/worktrees/:worktreeId/walkthrough/:runId/conversations/messages
  - GET /api/worktrees/:worktreeId/branch-changes
---

# reviews.walkthrough-page

A worktree with a walkthrough run for its current branch opens on Walkthrough, which takes the first segment of its Worktree page in place of Changes (as the web's first tab does): the page a fresh agent wrote about the change, with the calls only the developer can make, how the system grew, one step per decision and what the code doesn't say. Under a call or a step the developer asks the Walkthrough agent and posts or copies the answer as a brief. Without a current-branch run, every worktree opens on Changes regardless of commits, with Walkthrough one tap away. On a walkthrough the top-bar Changes button pushes the plain [Changes list](projects.worktree-changes.md), with Uncommitted and Branch and the reviewed marks. Empty step groups and their By step heading are hidden. The wording follows the web map [reviews.walkthrough-page](../../web-verify/features/reviews.walkthrough-page.md).

On tablets with at least 700 units of content width the steps sit beside the page: All changes with its count, By step with each step's file count and a Your call dot, then Not in the walkthrough yet.

## How to get to it (user POV)

- Worktrees tab → a worktree. The page opens on Walkthrough only when its current branch has a ready, queued, running or failed run; otherwise Changes opens with Walkthrough one tap away.
- Each step's See the code opens [the step's code](reviews.walkthrough-step.md); a screenshot on a step opens [the screenshot](reviews.walkthrough-screenshot.md); See every changed file and See the change open [All changes](reviews.all-changes.md) on Branch. Native Back returns to the same place on the page.

## Driving it with agent-device

Preconditions: [surface baseline](README.md), started with `$C start --fixture focused --coding-tool`, which installs the fake writer. It answers from `$REPO/.git/porcelain-fake-walkthrough`: no file writes a ready walkthrough; `hold` waits until the file changes; `signed-out` fails signed out; `nothing` writes the short page.

```sh
git -C "$REPO" switch -c feature
printf 'first line\nsecond line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
```

### 1. Writing and reading

1. Open the worktree. With no run, expect Changes selected, followed by Walkthrough, Files and History. Select Walkthrough for "No walkthrough yet." and "Write walkthrough". With an existing run (queued, running, failed or ready), Walkthrough is first and opens by default; its top-bar Changes button pushes the Changes list and Back returns.
2. `printf hold > "$REPO/.git/porcelain-fake-walkthrough"`, press Write walkthrough. Expect "Reading the change" under the `written for <sha>` line.
3. `rm "$REPO/.git/porcelain-fake-walkthrough"`. Without leaving, expect the heading ending "One call is yours.", the call card ("Product call", "Step 1", the question, "Decide, or ask about this"), "How the system grew" with "1 more", the steps, "What the code doesn't say" with "2 more" and "See every changed file". Step 1 → scrolls to the step; Your call → back to the calls.
4. Open See the code on an uncommitted-only ready walkthrough: the existing one-page diff reader shows its dirty file. Back → See every changed file shows the same file. With committed and dirty files, both entries show Branch first, then Uncommitted; each comparison appears once and opening a file preserves that comparison. The steps list includes dirty files, and All changes opens the same complete reader.
   Worktrees list: the row now leads with the walkthrough title and shows the branch as small text beneath it.

### 2. Out of date, failure and the short page

5. Commit another change in `$REPO`. Expect "The work changed after this was written." with Update walkthrough. With `hold`, press it: the page and its conversations stay with "Updating…"; remove the file and the new page arrives.
6. `printf signed-out > …`, Update walkthrough: the page and its conversations stay, with "Sign in to Claude again with claude auth login, then try again." and Try again. With no ready page (a fresh worktree), Write walkthrough shows that sentence as the heading with Try again. With `hold` while an answer is pending, the answer reads "Working…"; switching to `signed-out` fails it with Try again.
7. `printf nothing > …`, write again. Expect a heading ending "Nothing needs you." and "See the change", which opens All changes.

### 3. Conversations

8. Type in "Decide, or ask about this" and Send. Expect a right-aligned bubble, "Walkthrough agent" with "Working…", then the answer. A short answer shows no Read all. Under a step, Ask about this reveals "Ask about this step". Leave the segment and return: an unsent draft is still there.
9. "Save for later" → "Saved for later" with Undo; the bar at the bottom reads "1 comment saved" with Copy together. Without a pull request, Copy as prompt and Copy together show the one line "Copied brief" and never the brief; read the clipboard independently.
10. Pull request, screenshots and long answers: `$C walkthrough sample` writes a ready walkthrough for pull request #423 with two screenshots on step 2, then reopen the worktree. `$C walkthrough answer long` before asking: the answer is clamped to three lines with Read all. "Post on #423" turns into the link "Posted on #423"; `$C walkthrough posts` reads what the fake GitHub received. Save two, "Post together on #423" posts them once. `$C walkthrough moved` then Post: "Nothing was posted. Copy the brief instead." with Copy.

### 4. Tablet

11. In landscape and portrait: the steps list sits beside the page when the content is at least 700 wide, otherwise the phone layout. Step rows open the step's code; All changes opens every file; rotate with the page scrolled.

Automated coverage: `walkthrough.spec.ts` (opening rule, page rules, update state), `conversations.spec.ts` (post outcome, labels, saved bar), `post-notice.spec.ts` (one-line notices).

## Gotchas

- The stock fake never produces evidence and has no pull request; `$C walkthrough sample` replaces the writer with the scripted one, so run the hold, signed-out and nothing journeys first or restart the instance.
- Notices are one short line; a brief, comment or answer never appears in one.
- The driver's helper input method draws no soft keyboard. To see the composer above a real keyboard, switch the emulator to its stock keyboard with `adb shell ime set`, focus the last step's field, capture, then switch back.
- Writing settings and the writer model stay on web and desktop.
