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
  - apps/web/spec/integration/git-actions-commit.test.tsx
api:
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.commit

## What it is

The Commit dialog commits the selected changed files with a typed message, and that commit becomes the newest commit of the real repository.

## How a user reaches it

- Workspace header, group "Git controls" → button "Commit" (the primary Git button; its name is "Commit" whenever there are changes to commit).
- Group "Git controls" → button "Git actions" → menuitem "Commit… Commit selected files" (address it with name `/^Commit…/`).
- Inside the dialog, `ControlOrMeta+Enter` with focus in the form submits it, like the button "Commit selected files".

## Driving it

`$C start`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`.

### Setup

None: a fresh instance has README.md modified and unstaged, which is what the dialog commits.

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Changes — repository"; group "Git controls" with button "Commit" enabled.
2. Click button named `Commit`
   Look for: dialog "Commit changes"; the branch strip reads "main"; tabs "Single commit" [selected], "Amend last", "Use groups"; text "README.md" in the Files list "(1 of 1)"; textbox "Message" empty; button "Commit selected files" disabled.
3. Replace the contents of textbox named `Message` with 'Browser commit'
   Look for: button "Commit selected files" becomes enabled.
4. Click button named `Commit selected files`
   Look for: a status in the dialog reads "succeeded".
   Disk: `git -C "$REPO" log -1 --format=%s` prints `Browser commit`; `git -C "$REPO" status --porcelain` prints nothing.
5. Press `Escape`
   Look for: dialog "Commit changes" is gone; the Changes document no longer lists README.md (button "Mark README.md as reviewed" is gone).

## What proves it works

- The status "succeeded" in the dialog, and on disk `git -C "$REPO" log -1 --format=%s` = `Browser commit` with a clean working tree. Inspect HTTP requests and responses shows `POST /api/worktrees/<worktreeId>/git/actions` with status 202 (Accepted); the terminal outcome arrives through its receipt.
- `apps/web/spec/integration/git-actions-commit.test.tsx`: fills Message, clicks "Commit selected files", sees "succeeded", and polls the server until the newest commit's subject is the typed message.

## Gotchas

- After the commit the tree is clean, so the "Commit" button stays named `Commit` but is disabled ("Nothing to commit"). To drive it again in the same instance, write a change first: `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`, then inspect the accessibility tree until button "Mark README.md as reviewed" is back.
- The dialog lists the files as they were when it opened; a file written while it is open appears only after a refusal and "Look again" (see git-actions.stale-draft).
- Pressing Escape while the commit is running does nothing: the dialog closes only when idle.
