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

Right-clicking a changed file in the review sidebar marks it reviewed (and then offers "Unmark as reviewed"), starts a whole-file comment on it, and opens its timeline.

## Sub-features

- `reviews.changed-file-menu` — File menus, marking, comments and timeline.

## How to get to it (user POV)

- Review (phone; the right sidebar on desktop) → surface tab "Changes" (`Alt+2`) → tab "Changed files" (selected by default) → right-click a file row. The row's name is `<file name> · <scopes>`, for the sample `README.md · unstaged`.
- Menu items: "Mark as reviewed" ("Unmark as reviewed" when reviewed, "Mark as reviewed again" when changed since), "Comment", "Open diff", "Open file", "Show timeline", "Copy relative path", "Discard".
- `Alt+Shift+R` toggles the Review sheet at phone width.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

 the sample `README.md` is already modified.

1. Navigate to `/` then click button `Review`, then click tab `Changes`
   Expect: dialog "Worktree review" with tab "Changes" selected and a button `README.md · unstaged`.
2. Right-click button `/^README\.md( · .+)?$/`
   Expect: a menu with menuitems "Mark as reviewed", "Comment", "Open diff", "Open file", "Show timeline", "Copy relative path", "Discard".
3. Click menuitem `Mark as reviewed`
   Expect: the menu closes; the README.md row text is struck through in a screenshot (the aria snapshot still names the row "README.md · unstaged"; step 4's menu is the readable proof).
4. Right-click button `/^README\.md( · .+)?$/`
   Expect: menuitem "Unmark as reviewed" (no "Mark as reviewed"). Then Press `Escape`: the menu closes, the Review dialog stays.
5. Right-click button `/^README\.md( · .+)?$/` then click menuitem `Comment`
   Expect: dialog "Worktree review" is gone; title "README.md — repository"; textbox "Comment" with the label text "README.md · Whole file".
6. Click button `Review` then right-click button `/^README\.md( · .+)?$/` then click menuitem `Show timeline`
   Expect: title "Timeline of README.md — repository"; list "Timeline of README.md" holding the commit "Initial commit" and the text "Start of this file’s history."
7. Inspect HTTP traffic
   Expect: `PUT /api/worktrees/<id>/reviewed` answered 200 (step 3) and `GET /api/worktrees/<id>/file-commits?path=README.md&limit=…` answered 200 (step 6).

### Observable proof

Reload: reviewed control stays pressed from server marks. Comment composer and timeline have correct file; all requests answer 200.

Automated coverage: `reviews-changed-file-menu.test.tsx`.

## Gotchas

- Row names include changing scopes: use regex. Comment/Show timeline close the phone sheet; reopen before another row menu. Escape inside the comment field cancels its draft.
- Marks and tabs persist; unmark README and close leftovers before another map.
