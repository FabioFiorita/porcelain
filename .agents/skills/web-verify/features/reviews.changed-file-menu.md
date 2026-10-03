---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Changes"
  - "Mark as reviewed"
  - "Unmark as reviewed"
  - "Comment"
  - "Show timeline"
  - "Timeline of "
  - " as unreviewed"
tests:
  - apps/web/spec/integration/reviews-changed-file-menu.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/file-commits
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.changed-file-menu

## What it is

Right-clicking a changed file in the review sidebar marks it reviewed (and then offers "Unmark as reviewed"), starts a whole-file comment on it, and opens its timeline.

## How a user reaches it

- Review (phone; the right sidebar on desktop) → surface tab "Changes" (`Alt+1`) → tab "Changed files" (selected by default) → right-click a file row. The row's name is `<file name> · <scopes>`, for the sample `README.md · unstaged`.
- Menu items: "Mark as reviewed" ("Unmark as reviewed" when reviewed, "Mark as reviewed again" when changed since), "Comment", "Open diff", "Open file", "Show timeline", "Copy relative path", "Discard".
- `Alt+Shift+R` toggles the Review sheet at phone width.

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start`.

### Setup

None: the sample `README.md` is already modified.

1. `.agents/skills/web-verify/scripts/cli open /` then `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: dialog "Worktree review" with tab "Changes" selected and a button `README.md · unstaged`.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "/^README\.md( · .+)?$/" --button right`
   Look for: a menu with menuitems "Mark as reviewed", "Comment", "Open diff", "Open file", "Show timeline", "Copy relative path", "Discard".
3. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Mark as reviewed"`
   Look for: the menu closes; the README.md row text is struck through in a `screenshot` (the aria snapshot still names the row "README.md · unstaged"; step 4's menu is the readable proof).
4. `.agents/skills/web-verify/scripts/cli click --role button --name "/^README\.md( · .+)?$/" --button right`
   Look for: menuitem "Unmark as reviewed" (no "Mark as reviewed"). Then `.agents/skills/web-verify/scripts/cli press Escape`: the menu closes, the Review dialog stays.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "/^README\.md( · .+)?$/" --button right` then `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Comment"`
   Look for: dialog "Worktree review" is gone; Page Title "README.md — repository"; textbox "Comment" with the label text "README.md · Whole file".
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"` then `.agents/skills/web-verify/scripts/cli click --role button --name "/^README\.md( · .+)?$/" --button right` then `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Show timeline"`
   Look for: Page Title "Timeline of README.md — repository"; list "Timeline of README.md" holding the commit "Initial commit" and the text "Start of this file’s history."
7. `.agents/skills/web-verify/scripts/cli network`
   Look for: `PUT /api/worktrees/<id>/reviewed` answered 200 (step 3) and `GET /api/worktrees/<id>/file-commits?path=README.md&limit=…` answered 200 (step 6).

## What proves it works

- Step 4's "Unmark as reviewed", step 5's composer on README.md, step 6's timeline list, and step 7's 200 requests.
- Persistence: `.agents/skills/web-verify/scripts/cli open /` shows button "Unmark README.md as unreviewed" (pressed) in the README.md file header of the document that opens, read back from `GET .../reviewed`.
- `apps/web/spec/integration/reviews-changed-file-menu.test.tsx`: "Mark as reviewed" makes `server.reviewedFiles()` hold `README.md`; the next right-click offers "Unmark as reviewed"; "Comment" shows textbox "Comment"; "Show timeline" shows list "Timeline of README.md".

## Gotchas

- Address the row with the regex: its name carries the change scopes after " · " and they vary with the file's state.
- "Comment" and "Show timeline" open a document, which closes the Review sheet; click "Review" again before the next right-click.
- The composer from step 5 stays open in the README.md document; `Escape` in its textbox closes it.
- The reviewed mark persists in the instance. Reset it with `.agents/skills/web-verify/scripts/cli open /` then `.agents/skills/web-verify/scripts/cli click --role button --name "Unmark README.md as unreviewed"`.
- Tabs opened here ("README.md", "Timeline of README.md") are kept per worktree in browser storage and survive `open /`.
