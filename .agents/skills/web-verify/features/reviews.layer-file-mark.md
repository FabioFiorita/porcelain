# reviews.layer-file-mark

## What it is

Inside a layer of the agent's published review, each step's code carries the same file mark as the Changes list: marking or unmarking README.md there marks the file itself, and the server keeps each change.

## How a user reaches it

- Review (sheet at phone width, sidebar at 1280px and wider) → Layers list → "1. Readme layer" → the step's code header → "Mark README.md as reviewed" / "Unmark README.md as unreviewed".
- `R` toggles the mark of the focused code entry while the layer tab is active and focus is not in a text field.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

- The agent publishes a review: `$C agent publish-review "Readme layer"` (one layer "Readme layer", one step "New line" pointing at README.md line 3).

1. Open `/` on the instance web URL
   Look for: the handoff tab "Review Close Review" and region "Published review".
2. Click the button named 'Review'
   Look for: a dialog (the review sheet) with the sidebar tab "Review" selected and buttons "Review summary" and one whose name contains "Readme layer".
3. Click the button whose name contains 'Readme layer'
   Look for: the sheet closes; tab "1. Readme layer Close 1. Readme layer" selected; region "Review layer Readme layer" with heading "Readme layer", article "Step New line", buttons "Collapse README.md" and "Mark README.md as reviewed".
4. Click the button named 'Mark README.md as reviewed'
   Look for: button "Unmark README.md as unreviewed" [pressed]. Then `$C server reviewed-files`: `marks` holds README.md with its fingerprint.
5. Click the button named 'Unmark README.md as unreviewed'
   Look for: button "Mark README.md as reviewed" again. Then `$C server reviewed-files`: `marks` is `[]`.

## What proves it works

- The control flips in steps 4 and 5, and browser network evidence shows `PUT /api/worktrees/<id>/reviewed` then `DELETE /api/worktrees/<id>/reviewed?...` each answered 200.
- Persistence: `$C server reviewed-files` after steps 4 and 5 reads the mark, then none, from the server; after step 4, open `/` on the instance web URL also reloads onto the saved layer tab (the last tab opened) and still shows "Unmark README.md as unreviewed".
- `apps/web/spec/integration/reviews-layer-file-mark.test.tsx`: in region "Review layer Readme layer", "Mark README.md as reviewed" turns into an enabled "Unmark README.md as unreviewed" and `server.reviewedFiles()` lists README.md; unmarking removes it.

## Gotchas

- Phone width: the review sidebar is a sheet behind the "Review" button; choosing the layer closes it.
- The sidebar’s layer button has a number prefix and includes "Readme layer". Once the layer tab is open, go back to it by selecting the "Readme layer" tab; its separate close button also includes that name.
- Marks persist on the server across steps; unmark before handing the instance to another feature.
