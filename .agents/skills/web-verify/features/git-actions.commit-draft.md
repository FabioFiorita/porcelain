---
route: /
selectors:
  - "Commit"
  - "Commit changes"
  - "Commit model"
  - "No coding CLI available"
  - "Generate with AI"
  - "Use groups"
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

## Sub-features

- `git-actions.commit-draft` — Coding-tool availability and commit drafting.

## How to get to it (user POV)

- Group "Git controls" → button "Commit" → dialog "Commit changes": the select "Commit model", button "Generate with AI", tab "Use groups".
- Group "Git controls" → button "Git actions" → menuitem "Commit… Commit selected files" (name `/^Commit…/`).

## Driving it with browser

Preconditions: [surface baseline](README.md).

1. Navigate to `/`
   Expect: button "Commit" enabled.
2. Click button `Commit`
   Expect: dialog "Commit changes"; combobox "Commit model" [disabled] showing "No coding CLI available"; button "Generate with AI" [disabled]; tab "Use groups" [disabled]; button "Commit selected files" [disabled].
3. Fill textbox `Message` with 'Commit written by hand'
   Expect: button "Commit selected files" enabled.
4. Click button `Commit selected files`
   Expect: a status in the dialog reads "succeeded".
   Disk: `git -C "$REPO" log -1 --format=%s` prints `Commit written by hand`.

### Observable proof

Read empty model list/200, disabled No coding CLI available, then successful typed commit on disk; action POST answers 200.

Automated coverage: `git-actions-commit-draft.test.tsx`.

## Gotchas

- Run before adding a coding CLI. Model availability is cached for 60 seconds; a full reload refreshes it.
- Successful commit leaves a clean tree/disabled Commit; write a change before repeating.
