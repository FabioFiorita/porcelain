---
route: /
selectors:
  - "Commit"
  - "Pull"
  - "Apply stash"
  - "Git actions"
  - "Stash changes"
  - "Git controls"
tests:
  - apps/web/spec/integration/git-actions-suggested-step.test.tsx
  - packages/client/src/features/preferences/rules/review-git-settings.spec.ts
api:
  - GET /api/worktrees/:worktreeId/git/status
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.suggested-step

The Git button (group "Git controls", left of Git actions) suggests the next step: Commit while anything changed, then Pull, then Push, and, once nothing is left to commit, pull or push, Apply stash for a waiting stash; following it brings the stashed changes back and keeps the stash.

Pull works before the user visits Settings: an unconfigured computer uses merge, the existing default. A confirmed rebase preference is honored. Unreadable settings still show their read failure; no upstream, dirty worktree, detached HEAD and in-progress operations retain their Git-specific reasons.

## How to get to it (user POV)

- The Git button in group "Git controls": its accessible name is the suggestion ("Commit", "Pull", "Push", "Apply stash"); with nothing to suggest it reads "Commit" and is disabled with the hint "Nothing to commit, pull or push."
- Apply stash opens dialog "Apply stash" (combobox "Stash", checkbox "Restore staged changes", button "Apply stash"). The Git actions menu has no Apply stash entry; only the suggestion offers it.

## Driving it with browser

Preconditions: [surface baseline](README.md).

1. Inspect the accessibility tree
   Expect: group "Git controls" holds button "Commit" and button "Git actions"; no button "Apply stash".
2. Click button `Git actions`
   Expect: menuitem starting "Stash changes".
3. Click menuitem `/^Stash changes/`
   Expect: dialog "Stash changes".
4. Click button `Stash changes`
   Expect: `status` "succeeded" in the dialog.
5. Press `Escape`
   Expect: the dialog is gone; group "Git controls" now holds button "Apply stash" (visible text "Apply stash") instead of "Commit"; README.md is no longer listed.
6. Click button `Apply stash`
   Expect: dialog "Apply stash" with the description "Its changes come back into the working tree and the stash is kept.", combobox "Stash" showing "On main: Porcelain review · <id>" and button "Apply stash".
7. Click button `Apply stash`
   Expect: `status` "succeeded" in the dialog.
8. Press `Escape`
   Expect: the dialog is gone; the Git button is "Commit" again (no button "Apply stash"); README.md is listed again.

### Observable proof

Read README ending A change to review. and retained `stash@{0}: On main: Porcelain review`; Apply keeps the stash.

Automated coverage: `git-actions-suggested-step.test.tsx`.

### First-use Pull

On the disposable fixture only, commit its sample changes and clone it to a bare remote. Configure that absolute local remote as origin and its main branch as upstream. From an independent clone, commit and push a new file. Keep `GET /api/review-git-settings` at `{"kind":"unconfigured"}` throughout; do not initialize settings as setup.

1. Git actions → Fetch. Expect success; independently confirm origin/main advanced while HEAD and worktree stayed unchanged.
2. The primary button now reads Pull. Click it. Expect success without a Settings visit; independently compare HEAD with the bare remote ref and read the new file on disk.
3. Confirm `GET /api/review-git-settings` still answers unconfigured. The strategy default did not enable archive/delete settings or persist a new preference.

The shared strategy rule is covered by `packages/client/src/features/preferences/rules/review-git-settings.spec.ts`; the complete remote journey requires the independent live readbacks above.

## Gotchas

- The modal Apply stash button shares the page trigger name, but hides the page. Scope the dialog if needed.
- Apply keeps the stash; `git -C "$REPO" stash drop` restores the expected Commit primary action.
