---
screen: /history
selectors:
  - 'History'
  - 'Select a worktree to continue.'
  - 'Refresh history'
  - 'Back to history'
  - 'Changed files'
  - 'Back to commit'
  - 'No commits yet'
  - 'No files changed in this commit.'
  - 'Load older commits'
  - 'Read commit again'
  - 'Read diff again'
tests:
  - apps/mobile/spec/e2e/phone-shell.e2e.ts
  - apps/mobile/spec/e2e/destinations.e2e.ts
  - apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts
  - apps/mobile/spec/e2e/history.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/commits
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
---

# history.history

## What it is

History is the third destination. It reads the selected worktree's commits, newest first, with their subjects, authors, dates, short ids and refs. Opening a commit shows its message, full id, parent comparison and changed files. A merge can be compared with either parent. Opening a changed file shows that commit's diff, including both paths of a rename. History prepares rows with the shared parser and presentation rules; FileDiff displays selectable monospaced lines, old/new gutters, hunk headers and change colors. Binary, metadata-only and omitted diffs retain their server-provided meaning.

The presentation follows Porcelain web: compact subject and muted metadata rows, neutral actions, ref badges and a bordered, rounded commit header. History uses the shared mobile Button for full-row touch targets and selected-parent accessibility state. Theme token classes resolve into native styles for light and dark. Back controls stay above the list; the opened diff has a constrained flex container, with FileDiff owning its vertical viewport. These revised styles require fresh paired native screenshots before visual parity is claimed.

## How a user reaches it

- phone: the History tab; iPad: History in the sidebar
- the deep link `porcelain.dev://history` (the CLI opens it as `/history`), warm or straight after a cold launch

## Driving it

Start an instance first: `.agents/skills/mobile-verify/scripts/cli start`.

```sh
.agents/skills/mobile-verify/scripts/cli open /history
.agents/skills/mobile-verify/scripts/cli snapshot
.agents/skills/mobile-verify/scripts/cli screenshot
```

With no worktree selected, look for “History” and “Select a worktree to continue.”, with the History tab selected in the screenshot. Pairing alone does not select a worktree.

Select the instance's environment, project and main worktree through the toolbar picker as described in [projects.workspace-picker](projects.workspace-picker.md), while staying on History. Include `--instance <id>` on every CLI command when more than one instance exists.

```sh
.agents/skills/mobile-verify/scripts/cli tap --id "history-commit-<root commit id from snapshot>"
.agents/skills/mobile-verify/scripts/cli snapshot
.agents/skills/mobile-verify/scripts/cli screenshot
```

Look for: heading “Initial commit”, “Root commit”, the full commit id, “Changed files”, and README.md marked “added”. The current unstaged README change is not part of this commit.

```sh
.agents/skills/mobile-verify/scripts/cli tap --id "history-file-README.md"
.agents/skills/mobile-verify/scripts/cli snapshot
.agents/skills/mobile-verify/scripts/cli tap --label "Back to commit"
.agents/skills/mobile-verify/scripts/cli tap --label "Back to history"
.agents/skills/mobile-verify/scripts/cli tap --label "Refresh history"
.agents/skills/mobile-verify/scripts/cli screenshot
```

Look for: the README file header, a hunk header and the added “# Sample repository” line with a plus marker and new-line gutter 1. Its accessible label is “Added line 1: # Sample repository”. “Back to commit” returns to the same changed-file list, then “Back to history” returns to the commit list ending at “Start of history.”. Commit rows expose their subject, short id, author and timestamp as one accessible label; changed-file rows expose their path and status. Use the stable row ids or copy the complete label from the snapshot.

For richer fixtures, use only the disposable repository path printed by `start`: commit its README change with a body, rename README.md to GUIDE.md and commit, add and commit a binary file, and create a merge with different files on each parent. Refresh the list, open each commit, then compare the metadata and changed paths with `git show --stat`. In the merge, choose the second parent and confirm the changed-file list changes. For a repository with over one page of commits, “Load older commits” appends older rows until “Start of history.”; a failed page offers “Read older commits again”. An empty repository says “No commits yet”; an empty commit says “No files changed in this commit.”.

Switch worktrees or environments while a commit is open. The new worktree starts at its commit list, without retaining the prior commit or file. Reopen `/history` after a cold launch: the remembered worktree's list loads again. The same steps apply on iPhone and iPad; use the deep link when the iPad sidebar is hidden.

## What proves it works

- `apps/mobile/spec/e2e/destinations.e2e.ts`: the deep link opens History directly, warm and after a cold launch, with the tab selected and its empty state.
- `apps/mobile/spec/e2e/phone-shell.e2e.ts` and `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts`: History is selectable on phone and iPad.
- `apps/mobile/spec/e2e/history.e2e.ts`: pairs a disposable environment, selects its worktree, opens a rename, a commit with a body and a root commit, checks changed paths and statuses, and opens rename, text and root patches. Switching worktrees from a commit resets to the new list, which contains only that worktree's commits. The fixture checks the successful native history, commit-file and diff requests against the exact commit ids.
- `packages/client/src/features/history/rules/commit-file.spec.ts`: changed-path labels and diff path groups preserve additions, deletions and both sides of a rename.
- The shared client History integration spec covers root files and patch, merge parents, binary/deleted/empty changes, and pagination.

## Gotchas

- The selected workspace hook validates project and worktree availability; an unavailable saved worktree does not make History reads.
- `Refresh history`, `Read commit again` and `Read diff again` recover failed reads without clearing the workspace selection.
- Mac drives and native e2e execution are gated by the orchestrator. Agent acceptance targets iPhone; the owner validates iPad. Preserve tablet implementation and static checks, and report its native coverage as delegated to the owner. Do not boot iPad or investigate its previous pairing refusal.
- Android and physical-device LAN permission behavior require separate native proof.
