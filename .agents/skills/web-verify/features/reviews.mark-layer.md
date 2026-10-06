# reviews.mark-layer

## What it is

A layer of the agent's published review can be marked reviewed as a whole. The mark is kept with the layer's fingerprint; when the layer's code changes on disk the mark goes stale and the button asks to review the changed layer again; pressing the pressed "Reviewed" button removes the mark.

## How a user reaches it

- Review (sheet at phone width) → "1. Readme layer" → the layer toolbar button: "Mark layer reviewed" → "Reviewed" (aria-pressed true) → after a code change "Mark changed layer reviewed".

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (prints `repository <path>`; call it `$REPO`).
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

- The agent publishes a review: `$C agent publish-review "Readme layer"` (one layer "Readme layer", one step "New line" pointing at README.md line 3, "A change to review.").
- The README.md rewrite happens in the middle (step 4), not before driving.

1. Open `/` on the instance web URL
   Look for: tab "Review Close Review", region "Published review".
2. Click the button named 'Review', then click the button whose name contains 'Readme layer'
   Look for: region "Review layer Readme layer" with button "Mark layer reviewed" enabled (aria-pressed false).
3. Click the button named 'Mark layer reviewed'
   Look for: button "Reviewed" [pressed]. `$C server reviewed-layers` lists one mark with `"stale": false`.
4. On disk: `printf '# Sample repository\n\nA revised change to review.\n' > "$REPO/README.md"`, then wait for the button named 'Mark changed layer reviewed' and inspect the current page
   Look for: status "Code changed since the review was written." in article "Step New line"; the toolbar button is now "Mark changed layer reviewed", enabled and not pressed. `$C server reviewed-layers` shows the mark `"stale": true`.
5. Click the button named 'Mark changed layer reviewed'
   Look for: button "Reviewed" [pressed] again; `$C server reviewed-layers` shows `"stale": false`.
6. Click the button named 'Reviewed'
   Look for: button "Mark layer reviewed"; `$C server reviewed-layers` lists no mark (`"marks": []`).

## What proves it works

- The button label sequence Mark layer reviewed → Reviewed → Mark changed layer reviewed → Reviewed → Mark layer reviewed, with browser network evidence showing `PUT /api/worktrees/<id>/reviewed-layers` 200 (steps 3, 5) and `DELETE /api/worktrees/<id>/reviewed-layers?layerId=...` 200 (step 6).
- Persistence: `$C server reviewed-layers` reads the mark and its stale flag after each step; after step 3, open `/` on the instance web URL also reloads onto the layer tab and still shows "Reviewed".
- `apps/web/spec/integration/reviews-mark-layer.test.tsx`: marking yields "Reviewed" pressed and `server.reviewedLayers()` holds one fresh mark; rewriting README.md shows "Code changed since the review was written.", an enabled "Mark changed layer reviewed" and a stale mark; marking again makes it fresh; unmarking leaves none.

## Gotchas

- The button is disabled while the marks or the review are being re-read after the disk change (it waits for the new fingerprint); the wait in step 4 returns once the button shows, so inspect the page again if it still reads disabled.
- Choose the "Readme layer" button in the Review sidebar while no layer tab is open; afterwards choose the "Readme layer" tab.
- The rewrite changes the sample README.md; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"` before another feature.
