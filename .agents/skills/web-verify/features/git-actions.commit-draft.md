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

## What it is

Without a coding CLI on the server, the Commit dialog says no model is available, keeps drafting and groups disabled, and a message typed by hand still commits.

## How a user reaches it

- Group "Git controls" → button "Commit" → dialog "Commit changes": the select "Commit model", button "Generate with AI", tab "Use groups".
- Group "Git controls" → button "Git actions" → menuitem "Commit… Commit selected files" (name `/^Commit…/`).

## Driving it

`$C start`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`. The CLI's default instance has NO coding CLI (its sandbox PATH holds only `git`; the fake `claude` is installed only by the test kit's `codingTool.install()`), so this feature is the one a fresh instance reaches.

### Setup

None.

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: button "Commit" enabled.
2. Click button named `Commit`
   Look for: dialog "Commit changes"; combobox "Commit model" [disabled] showing "No coding CLI available"; button "Generate with AI" [disabled]; tab "Use groups" [disabled]; button "Commit selected files" [disabled].
3. Replace the contents of textbox named `Message` with 'Commit written by hand'
   Look for: button "Commit selected files" enabled.
4. Click button named `Commit selected files`
   Look for: a status in the dialog reads "succeeded".
   Disk: `git -C "$REPO" log -1 --format=%s` prints `Commit written by hand`.

## What proves it works

- The disabled model select reading "No coding CLI available", then "succeeded" and the commit on disk. Inspect HTTP requests and responses shows `GET /api/git/commit-models` 200 (an empty list) and `POST /api/worktrees/<worktreeId>/git/actions` 200.
- `apps/web/spec/integration/git-actions-commit-draft.test.tsx`: asserts the server lists no commit models, the select is disabled with display value "No coding CLI available", "Generate with AI", "Use groups" and "Commit selected files" are disabled, typing enables the commit, and the newest commit subject is the typed message.

## Gotchas

- Drive this before anything installs a coding tool in the same instance: the server looks for `claude` on every `GET /api/git/commit-models`, and the web keeps the answer for 60 s (`packages/client/src/config/limits.ts`, `COMMIT_MODELS_STALE_MS`); a full reload of `/` reloads it.
- After the commit the tree is clean and "Commit" is disabled; write a change on disk to drive it again (see git-actions.commit).
