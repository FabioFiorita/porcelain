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

7. During an update, the last ready page, Step tabs and Changes grouping stay available with “Updating…”. A failed update keeps that page and shows the failure with “Try again”. With no ready page the initial running/failure states remain.
8. `printf signed-out > "$REPO/.git/porcelain-fake-walkthrough"`, press Update or Write. Expect heading "Claude needs you to sign in again." naming `claude auth login`; after removing the file, "Try again" writes the walkthrough.

### 4. Short page

8. `printf nothing > "$REPO/.git/porcelain-fake-walkthrough"`, write again. Expect heading ending "Nothing needs you." and button "See the change", which opens document "All changes".

## Gotchas

- The fake never produces evidence, because the fixture has no pull request; prove screenshots with seeded evidence or the real writer.
- Provider credentials are stripped from verification instances; the real writer cannot run through this skill.
