---
route: /
selectors:
  - "Commit"
  - "Commit changes"
  - "No coding CLI available."
  - "Generate with AI"
  - "Commit selected files"
  - "Message"
  - "succeeded"
tests:
  - apps/web/spec/integration/git-actions-commit-draft.test.tsx
api:
  - GET /api/git/commit-models
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.commit-draft

Without a coding CLI on the server, the Commit dialog says no model is available, keeps drafting and groups disabled, and a message typed by hand still commits.

## How to get to it (user POV)

- Group "Git controls" → button "Commit" → dialog "Commit changes": button "Generate with AI" and the line "No coding CLI available.".
- Group "Git controls" → button "Git actions" → menuitem "Commit… Commit selected files" (name `/^Commit…/`).

## Driving it with browser

Preconditions: [surface baseline](README.md).

1. Navigate to `/`
   Expect: button "Commit" enabled.
2. Click button `Commit`
   Expect: dialog "Commit changes"; no combobox "Commit model"; button "Generate with AI" [disabled] with the line "No coding CLI available." below it; no tab "Use groups"; button "Commit selected files" [disabled].
3. Fill textbox `Message` with 'Commit written by hand'
   Expect: button "Commit selected files" enabled.
4. Click button `Commit selected files`
   Expect: a status in the dialog reads "succeeded".
   Disk: `git -C "$REPO" log -1 --format=%s` prints `Commit written by hand`.

### Observable proof

Read empty model list/200, disabled Generate with "No coding CLI available.", then successful typed commit on disk; action POST answers 200.

Automated coverage: `git-actions-commit-draft.test.tsx`.

## Gotchas

- Run before adding a coding CLI. Model availability is cached for 60 seconds; a full reload refreshes it.
- Successful commit leaves a clean tree/disabled Commit; write a change before repeating.
