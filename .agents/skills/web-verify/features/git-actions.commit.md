---
route: /
selectors:
  - "Commit"
  - "Git controls"
  - "Commit changes"
  - "Message"
  - "Commit selected files"
  - "succeeded"
tests:
  - apps/web/spec/integration/git-actions-commit-draft.test.tsx
api:
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.commit

The Commit dialog commits the selected changed files with a typed message, and that commit becomes the newest commit of the real repository.

## Sub-features

- `git-actions.commit` — Commit entry, message, submission and receipt.

## How to get to it (user POV)

- Workspace header, group "Git controls" → button "Commit" (the primary Git button; its name is "Commit" whenever there are changes to commit).
- Group "Git controls" → button "Git actions" → menuitem "Commit… Commit selected files" (address it with name `/^Commit…/`).
- Inside the dialog, `ControlOrMeta+Enter` with focus in the form submits it, like the button "Commit selected files".

## Driving it with browser

Preconditions: [surface baseline](README.md).

Preconditions: fresh README.md is modified/unstaged; no fixture commit is needed. This flow works at desktop or phone width.

1. Open `/` → Git controls → Commit. Expect Commit changes, branch main, Single commit selected, Amend last and Use groups present (Use groups is disabled without a coding CLI), README.md (1 of 1), empty Message and disabled Commit selected files.
2. Fill Message with `Browser commit`: submit enables. Click Commit selected files and wait for succeeded. Independently read `git -C "$REPO" log -1 --format=%s` → Browser commit and `git -C "$REPO" status --porcelain` → empty.
3. Escape closes the dialog; Changes no longer lists README. Repeat with another disk change through Git actions → /^Commit…/ and submit with ControlOrMeta+Enter in the form.
4. Record action POST/202 and terminal receipt. After both entries, compare the final subject/clean tree independently.

Automated coverage: `git-actions-commit-draft.test.tsx`.

## Gotchas

- After commit, Commit is disabled with Nothing to commit. Rewrite README with the fixture change before repeating.
- New disk changes after the dialog opens need refusal/Look again. Escape closes only when idle.
