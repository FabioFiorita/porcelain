---
route: /
selectors:
  - "Review content"
  - "as reviewed"
  - "as unreviewed"
  - "Unmark "
  - "Toggle reviewed"
tests:
  - apps/web/spec/integration/reviews-mark-file.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.mark-file

A changed file's reviewed control in its diff header marks it reviewed at its current fingerprint and unmarks it again; the control's name flips and the server keeps each change.

## Sub-features

- `reviews.mark-file` — File marking, unmarking and changed content.

## How to get to it (user POV)

- In any diff header (Changes document, a single change tab, a walkthrough stop): button "Mark README.md as reviewed" → "Unmark README.md as unreviewed"; a file changed since it was marked shows "Mark changed README.md as reviewed".
- Shortcut `R` (listed as "Toggle reviewed" in the shortcuts dialog, `Mod+/`): toggles the focused entry of the active code document. It is ignored while focus is in a text field. `J` / `K` move the focused entry.
- The review sidebar's changed-file row (button "README.md · unstaged") offers it on right-click: menuitem "Mark as reviewed" / "Unmark as reviewed" (see `reviews.changed-file-menu`).

## Driving it with browser

Preconditions: [surface baseline](README.md).

1. Navigate to `/`
   Expect: region "Review content", heading "Changes", button "Mark README.md as reviewed".
2. Click button `Mark README.md as reviewed`
   Expect: button "Unmark README.md as unreviewed" [pressed]; the toolbar's mark-all button now reads "Unmark all". `$C server reviewed-files` lists README.md in `marks`.
3. Click button `Unmark README.md as unreviewed`
   Expect: button "Mark README.md as reviewed" enabled; toolbar button "Mark all 1 files reviewed". `$C server reviewed-files` shows `"marks": []`.
4. Press `r`
   Expect: button "Unmark README.md as unreviewed" (the shortcut marked the focused, first entry).
5. Press `r`
   Expect: button "Mark README.md as reviewed" again.

### Observable proof

Read marks after each toggle; reload after marking preserves Unmark README.md as unreviewed. PUT/DELETE answer 200.

Automated coverage: `reviews-mark-file.test.tsx`.

## Gotchas

- Press lowercase r outside text fields; Escape a composer first. It targets the focused pane/document/entry; J/K, line clicks and header toggles move the entry.
- Pending writes disable controls. Wait for diff load after toolbar; leave README unmarked afterward.
