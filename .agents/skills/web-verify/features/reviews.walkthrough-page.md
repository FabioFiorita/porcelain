---
route: /
selectors:
  - "Walkthrough"
  - "No walkthrough yet."
  - "Write walkthrough"
  - "Reading the change"
  - "How the system grew"
  - "See every changed file"
  - "See the code"
  - "See the change"
  - "Update walkthrough"
  - "Try again"
  - "Updating…"
  - "By step"
  - "Your call"
  - "Not in the walkthrough yet"
  - "Previous step"
  - "Next step"
tests:
  - apps/web/spec/integration/walkthroughs-page.test.tsx
  - apps/web/spec/integration/walkthrough-conversations.test.tsx
api:
  - GET /api/worktrees/:worktreeId/walkthrough
  - POST /api/worktrees/:worktreeId/walkthrough
  - GET /api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId
  - GET /api/worktrees/:worktreeId/branch-changes
---

# reviews.walkthrough-page

A worktree with commits to explain shows a Walkthrough as its first tab: a fresh agent reads the change and writes one page with the calls that need the developer, how the system grew and one step per decision. Its files are organized by step in the Changes panel, and the page marks itself out of date when new commits land.

## How to get to it (user POV)

- A worktree on a branch with commits and no published review opens on tab "Walkthrough", state "No walkthrough yet.", button "Write walkthrough".
- A worktree with no committed change keeps tab "Changes"; a worktree with only a published review keeps tab "Review".
- Each step: button "See the code for step N" opens document "Step N" (`entry=walkthrough-step:N`); buttons "Previous step" and "Next step" in its header row move between steps.
- Changes panel on a walkthrough worktree opens by default, on Branch: "All changes" with its count, "By step" with file counts and a "Your call" dot; under Uncommitted, steps without local edits are hidden and files the walkthrough never read are under "Not in the walkthrough yet".

## Driving it with browser

Preconditions: [surface baseline](README.md), started with `$C start --coding-tool`, which installs the fake writer. The fake answers from a scenario file in the repository's Git directory: no file writes a ready walkthrough; `hold` waits until the file changes; `signed-out` fails signed out; `nothing` writes the short page.

### Setup

```sh
git -C "$REPO" switch -c feature
printf 'first line\nsecond line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
```

### 1. Writing and reading

1. Navigate to `/`. Expect tab "Walkthrough", heading "No walkthrough yet.", button "Write walkthrough".
2. `printf hold > "$REPO/.git/porcelain-fake-walkthrough"`, click "Write walkthrough". Expect status "Reading the change".
3. `rm "$REPO/.git/porcelain-fake-walkthrough"`. Expect heading ending "One call is yours.", then "How the system grew" and "What the code doesn't say"; the Changes panel on Branch with "By step".
4. Click button "See the code for step 1". Expect tab "Step 1", heading "Step 1 of N: …", previous and next arrows in that one header row; no second title block and no "Mark all reviewed".

### 2. Uncommitted and out of date

5. Edit a file the walkthrough covers and add a new one, then choose tab "Uncommitted" in the panel. Expect "All changes", only steps with edits, and "Not in the walkthrough yet" listing the new file.
6. Commit a change from a terminal. Expect "New commits landed after this was written." and button "Update walkthrough"; clicking it writes a new attempt (the meta line names the new head commit).

### 3. Failure

7. During an update, the last ready page, its conversations and composer, the saved bar, Step tabs and Changes grouping stay available with “Updating…”. A failed update keeps that page and its conversation controls and shows the failure using the failed attempt’s writer, even when the kept page was written by another provider, with “Try again”. With no ready page the initial running/failure states remain.
8. `printf signed-out > "$REPO/.git/porcelain-fake-walkthrough"`, press Update or Write. Expect heading "Claude needs you to sign in again." naming `claude auth login`; after removing the file, "Try again" writes the walkthrough.

### 4. Short page

8. `printf nothing > "$REPO/.git/porcelain-fake-walkthrough"`, write again. Expect heading ending "Nothing needs you." and button "See the change", which opens document "All changes".

## Gotchas

- The fake never produces evidence, because the fixture has no pull request; prove screenshots with seeded evidence or the real writer.
- Provider credentials are stripped from verification instances; the real writer cannot run through this skill.

### 5. Conversations

9. Under a call, use textbox "Decide, or ask about this" and "Send" (Enter sends; Shift+Enter adds a line). Under a step, "Ask about this" reveals textbox "Ask about this step". Messages already on a step are visible immediately. Backticks render inline code.
10. Expect a right-aligned developer bubble and "Walkthrough agent", first "Working…", then its answer with "Read all". Type another draft while the answer arrives; it must survive the notice without moving the document. A failed answer shows the plain failure and "Try again".
11. "Save for later" becomes "Saved for later" with "Undo". Save two messages: the sticky bar says "2 comments saved". On a PR, "Post on #N" posts one, "Post together on #N" posts saved messages once. A posted message links with "Posted on #N". Without a PR, use "Copy as prompt" or "Copy together" and expect "Copied brief".
12. A refused post says "Nothing was posted. Copy the brief instead." and offers "Copy". A partial post identifies comments still saved because they belong to a different repository. Whole-walkthrough and removed-stop conversations appear under "Earlier comments".

Conversation browser proof: `apps/web/spec/integration/walkthrough-conversations.test.tsx`, using its isolated fake CLI and fake GitHub against the real server. Its ready walkthrough is a synthetic fixture, with no external project content. Sweep at desktop and 414 × 896, light and dark.

13. After a later walkthrough has outcome `nothing`, retained threads still appear under "Earlier comments" with Undo, copy/post controls and the saved bar. A posted link always labels its original comment destination, even when the current walkthrough names another PR; an unrecognized URL reads "Posted comment".

14. With two ready walkthroughs on different branches in one checkout, read A’s comment and switch to B. B’s heading, comments and saved bar must name B; A’s comments disappear. Every conversation request includes the displayed ready run ID, so a pending A post remains targeted to A even if the branch switches.
