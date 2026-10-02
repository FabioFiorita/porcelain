---
route: /
selectors:
  - "Review"
  - "Review layer "
  - "as reviewed"
  - "as unreviewed"
  - "Collapse"
tests:
  - apps/web/spec/integration/reviews-layer-file-mark.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.layer-file-mark

## What it is

Inside a layer of the agent's published review, each step's code carries the same file mark as the Changes list: marking or unmarking README.md there marks the file itself, and the server keeps each change.

## How a user reaches it

- Review (sheet at phone width, sidebar at 1280px and wider) → Layers list → "1. Readme layer" → the step's code header → "Mark README.md as reviewed" / "Unmark README.md as unreviewed".
- `R` toggles the mark of the focused code entry while the layer tab is active and focus is not in a text field.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`.

### Setup

- The agent publishes a review. CLI gap: `cli agent publish-review "Readme layer"` (one layer "Readme layer", one step "New line" pointing at README.md line 3).

1. `$C open /`
   Look for: the handoff tab "Review Close Review" and region "Published review".
2. `$C click --role button --name "Review"`
   Look for: a dialog (the review sheet) with the sidebar tab "Review" selected and buttons "Review summary" and one whose name contains "Readme layer".
3. `$C click --role button --name "/Readme layer/"`
   Look for: the sheet closes; tab "1. Readme layer Close 1. Readme layer" selected; region "Review layer Readme layer" with heading "Readme layer", article "Step New line", buttons "Collapse README.md" and "Mark README.md as reviewed".
4. `$C click --role button --name "Mark README.md as reviewed"`
   Look for: button "Unmark README.md as unreviewed" (aria-pressed true, enabled).
5. `$C click --role button --name "Unmark README.md as unreviewed"`
   Look for: button "Mark README.md as reviewed" enabled again.

## What proves it works

- The control flips in steps 4 and 5, and `$C network` shows `PUT /api/worktrees/<id>/reviewed` then `DELETE /api/worktrees/<id>/reviewed?...` each answered 200.
- Persistence: after step 4, `$C open /` reloads onto the saved layer tab (the last tab opened) and still shows "Unmark README.md as unreviewed". Reading the marks back directly needs `cli server reviewed-files`.
- `apps/web/spec/integration/reviews-layer-file-mark.test.tsx`: in region "Review layer Readme layer", "Mark README.md as reviewed" turns into an enabled "Unmark README.md as unreviewed" and `server.reviewedFiles()` lists README.md; unmarking removes it.

## Gotchas

- Unreachable through the CLI: the layer exists only after the agent publishes. Command needed: `cli agent publish-review "Readme layer"`.
- Phone width: the review sidebar is a sheet behind the "Review" button; choosing the layer closes it.
- The sidebar's layer button has a number prefix; address it by `/Readme layer/`. Once the layer tab is open its "Close 1. Readme layer" button also matches that pattern, so go back to the layer with `$C click --role tab --name "/Readme layer/"` instead.
- Marks persist on the server across steps; unmark before handing the instance to another feature.
