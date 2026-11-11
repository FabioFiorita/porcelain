---
route: /
selectors:
  - 'Walkthrough'
  - 'No walkthrough yet.'
  - 'Write walkthrough'
  - 'Reading the change'
  - 'How the system grew'
  - 'See every changed file'
  - 'See the code'
  - 'See the change'
  - 'Update walkthrough'
  - 'Try again'
  - 'Updating…'
  - 'By step'
  - 'Your call'
  - 'Not in the walkthrough yet'
  - 'Previous step'
  - 'Next step'
tests:
  - apps/web/spec/integration/walkthroughs-page.test.tsx
  - apps/web/spec/integration/walkthrough-conversations.test.tsx
  - apps/server/spec/integration/walkthroughs-fake-writer.integration.ts
api:
  - GET /api/worktrees/:worktreeId/walkthrough
  - POST /api/worktrees/:worktreeId/walkthrough
  - GET /api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId
  - GET /api/worktrees/:worktreeId/branch-changes
---

# reviews.walkthrough-page

A worktree can have one Walkthrough for its whole change since the base branch, committed or uncommitted: a fresh agent reads the change and writes one page with the calls that need the developer, how the system grew and one step per decision. Its files are organized by step in the Changes panel, and the page marks itself out of date when its content or base changes.

## How to get to it (user POV)

- A worktree opens on "Walkthrough" only when its current branch has a queued, running, failed or ready walkthrough run, regardless of commits.
- Without a run, every worktree opens on Changes, regardless of commits. With no run yet, tab "Walkthrough" sits beside Changes; click it once for "No walkthrough yet." and "Write walkthrough". Once a current-branch run exists (queued, running, failed or ready), the worktree opens on Walkthrough.
- A worktree with no change since the base keeps tab "Changes".
- Each step: button "See the code for step N" opens document "Step N" (`entry=walkthrough-step:N`); the code view selects the comparisons containing the step’s files independently of the selected Changes tab. Uncommitted-only work shows its working diff, committed-only work shows Branch, and mixed work shows Branch then Uncommitted in one scrollable document, each file once per comparison. "See every changed file" opens both comparisons as "All changes" (`entry=walkthrough-changes`); buttons "Previous step" and "Next step" in its header row move between steps.
- Changes panel on a walkthrough worktree opens by default, on Uncommitted when there are local files and no committed files, otherwise Branch (an explicit tab choice wins): "All changes" with its count, "By step" with file counts and a "Your call" dot; under Uncommitted, empty step groups and their "By step" heading are hidden and files the walkthrough never read are under "Not in the walkthrough yet".

## Driving it with browser

Preconditions: [surface baseline](README.md), started with `$C start --coding-tool`, which installs the fake writer. The fake answers from a scenario file in the repository's Git directory: no file writes a ready walkthrough; `hold` waits until the file changes; `signed-out` fails signed out; `nothing` writes the short page.

For a ready synthetic page without running the fake writer, start with `$C start --walkthrough-sample` and open the initial worktree. Expect one call, two steps, "How the system grew" and "What the code doesn't say".

### Setup

```sh
git -C "$REPO" switch -c feature
printf 'first line\nsecond line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
```

### 1. Writing and reading

1. Navigate to `/`. Expect selected tab "Changes" and a matching window title, with "Walkthrough" beside it. Select "Walkthrough"; expect "No walkthrough yet." and "Write walkthrough". Reload after a run is running, ready or failed; it opens on Walkthrough.
2. `printf hold > "$REPO/.git/porcelain-fake-walkthrough"`, click "Write walkthrough". Expect status "Reading the change".
3. `rm "$REPO/.git/porcelain-fake-walkthrough"`. Expect heading ending "One call is yours.", then "How the system grew" and "What the code doesn't say"; the Changes panel on Branch with "By step".
4. Click button "See the code for step 1". Expect tab "Step 1", heading "Step 1 of N: …", previous and next arrows in that one header row; no second title block and no "Mark all reviewed".

### 2. Uncommitted and out of date

5. Edit a file the walkthrough covers and add a new one, then choose tab "Uncommitted" in the panel. Expect "All changes", only steps with edits, and "Not in the walkthrough yet" listing the new file.
6. Commit exactly the content already explained: the page stays fresh. Edit a file or commit different content. Expect "The work changed after this was written." and button "Update walkthrough"; clicking it writes a new attempt (the meta line names the new head commit).

### Uncommitted-only journey

Start a branch at its base with no later commits. Leave a tracked edit and an untracked non-ignored file, then load the worktree: it opens on Changes, with a Changes window title and a Walkthrough tab beside it. Click Walkthrough once and expect "No walkthrough yet." and "Write walkthrough". Write it and expect a ready page whose meta line includes "and uncommitted work". Under Changes > Uncommitted, the captured files appear by step. Commit exactly that content: no out-of-date warning appears and an explicit repeated start reuses the run. Edit a file: without reloading, expect "The work changed after this was written." and "Update walkthrough"; Update captures the new content. An added file outside the ready page stays under "Not in the walkthrough yet" until updated. Branch still groups committed files by step.

### Code scopes

For each of uncommitted-only, committed-only, and committed plus a later edit to the same file, write a walkthrough and open "See the code for step 1". Expect the captured file’s actual code under "Uncommitted code", "Branch code", or both respectively, with Branch first. A mixed step has one active set of Comment/Reviewed controls; clicking either section selects its controls. Return to Walkthrough and choose "See every changed file": both applicable comparisons remain present. In the Changes sidebar, Branch lists committed files by step and Uncommitted lists dirty files by step, with no duplicate file within a comparison.

### 3. Failure

7. During an update, the last ready page, its conversations and composer, the saved bar, Step tabs and Changes grouping stay available with “Updating…”. A failed update keeps that page and its conversation controls and shows the failure using the failed attempt’s writer, even when the kept page was written by another provider, with “Try again”. The sidebar keeps the last ready title for the current branch while updating and after failure; a ready title from another branch never replaces it. With no ready page the initial running/failure states remain.
8. `printf signed-out > "$REPO/.git/porcelain-fake-walkthrough"`, press Update or Write. Expect one sentence "Sign in to Claude again with claude auth login, then try again." (Codex names `codex login`) in both the initial failure and failed-update line; after removing the file, "Try again" writes the walkthrough.

After a ready page, add an untracked `.gitattributes` with `*.secret filter=example` and an untracked `new.secret`. Reload: the saved page remains visible and out of date. Update reports "This change uses Git conversion filters, which Porcelain will not execute." without removing the saved page.

### 4. Short page

8. `printf nothing > "$REPO/.git/porcelain-fake-walkthrough"`, write again. Expect heading ending "Nothing needs you." and button "See the change", which opens document "All changes".

## Gotchas

- The fake never produces evidence, because the fixture has no pull request; prove screenshots with seeded evidence or the real writer.
- Provider credentials are stripped from verification instances; the real writer cannot run through this skill.

### 5. Conversations

9. The stock fake writer returns plain text for a comment follow-up, matching the conversation turn without a JSON schema. Under a call, use textbox "Decide, or ask about this" and "Send" (Enter sends; Shift+Enter adds a line). Under a step, "Ask about this" reveals textbox "Ask about this step". Messages already on a step are visible immediately. Backticks render inline code.
10. Expect a right-aligned developer bubble and "Walkthrough agent", first "Working…", then its answer; "Read all" appears only when the answer exceeds its three-line clamp and expands it. Type another draft while the answer arrives; it must survive the notice without moving the document. A failed answer shows the plain failure and "Try again".
11. "Save for later" becomes "Saved for later" with "Undo". Save two messages: the sticky bar says "2 comments saved". On a PR, "Post on #N" posts one, "Post together on #N" posts saved messages once. A posted message links with "Posted on #N". Without a PR, use "Copy as prompt" or "Copy together" and expect a one-line "Copied brief" notification with no body.
12. A refused post says "Nothing was posted. Copy the brief instead." and offers "Copy". A partial post identifies comments still saved because they belong to a different repository. Whole-walkthrough and removed-stop conversations appear under "Earlier comments".

Conversation browser proof: `apps/web/spec/integration/walkthrough-conversations.test.tsx`, using its isolated fake CLI and fake GitHub against the real server. Its ready walkthrough is a synthetic fixture, with no external project content. Sweep at desktop and 414 × 896, light and dark.

13. After a later walkthrough has outcome `nothing`, retained threads still appear under "Earlier comments" with Undo, copy/post controls and the saved bar. A posted link always labels its original comment destination, even when the current walkthrough names another PR; an unrecognized URL reads "Posted comment".

14. With two ready walkthroughs on different branches in one checkout, read A’s comment and switch to B. B’s heading, comments and saved bar must name B; A’s comments disappear. Every conversation request includes the displayed ready run ID, so a pending A post remains targeted to A even if the branch switches.

### Pull request evidence at another commit

With a PR behind the local captured head, write a walkthrough. It becomes ready and keeps the PR target for comments, with no PR images or checks. The meta line says once: “Screenshots and checks are not shown: the pull request is at another commit. Push, then update.” Update remains available even without local edits. Push that head, then Update: the new run clears the notice and can show matching evidence. Missing GitHub accounts and GitHub read failures likewise leave the page ready with their shared explanatory notice. A walkthrough without a PR needs no notice.

When updating a displayed PR walkthrough during an unavailable or loading PR list, the request retains the displayed PR number; the notice and retry remain while GitHub is unavailable. The displayed run's PR takes precedence over the list. Without a displayed PR, use the last successfully loaded list even during a background refresh; a list that has never loaded supplies no PR.
