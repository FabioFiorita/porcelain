---
route: /
selectors:
  - "Review"
  - "Review layer "
  - "Mark layer reviewed"
  - "Reviewed"
  - "Code changed since the review was written."
  - "Mark changed layer reviewed"
tests:
  - apps/web/spec/integration/reviews-mark-layer.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed-layers
  - GET /api/worktrees/:worktreeId/reviewed-layers
  - PUT /api/worktrees/:worktreeId/reviewed-layers
---

# reviews.mark-layer

## What it is

A layer of the agent's published review can be marked reviewed as a whole. The mark is kept with the layer's fingerprint; when the layer's code changes on disk the mark goes stale and the button asks to review the changed layer again; pressing the pressed "Reviewed" button removes the mark.

## How a user reaches it

- Review (sheet at phone width) → "1. Readme layer" → the layer toolbar button: "Mark layer reviewed" → "Reviewed" (aria-pressed true) → after a code change "Mark changed layer reviewed".

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (prints `repository <path>`; call it `$REPO`).

### Setup

- The agent publishes a review. CLI gap: `cli agent publish-review "Readme layer"` (one layer "Readme layer", one step "New line" pointing at README.md line 3, "A change to review.").
- The README.md rewrite happens in the middle (step 4), not before driving.

1. `$C open /`
   Look for: tab "Review Close Review", region "Published review".
2. `$C click --role button --name "Review"`, then `$C click --role button --name "/Readme layer/"`
   Look for: region "Review layer Readme layer" with button "Mark layer reviewed" enabled (aria-pressed false).
3. `$C click --role button --name "Mark layer reviewed"`
   Look for: button "Reviewed" with aria-pressed true.
4. On disk: `printf '# Sample repository\n\nA revised change to review.\n' > "$REPO/README.md"`, then `$C snapshot`
   Look for: status text "Code changed since the review was written." in article "Step New line"; the toolbar button is now "Mark changed layer reviewed" (aria-pressed false) and enabled.
5. `$C click --role button --name "Mark changed layer reviewed"`
   Look for: button "Reviewed" with aria-pressed true again.
6. `$C click --role button --name "Reviewed"`
   Look for: button "Mark layer reviewed" enabled.

## What proves it works

- The button label sequence Mark layer reviewed → Reviewed → Mark changed layer reviewed → Reviewed → Mark layer reviewed, with `$C network` showing `PUT /api/worktrees/<id>/reviewed-layers` 200 (steps 3, 5) and `DELETE /api/worktrees/<id>/reviewed-layers?layerId=...` 200 (step 6).
- Persistence: after step 3, `$C open /` reloads onto the layer tab and still shows "Reviewed". Reading the marks and their stale flag needs `cli server reviewed-layers`.
- `apps/web/spec/integration/reviews-mark-layer.test.tsx`: marking yields "Reviewed" pressed and `server.reviewedLayers()` holds one fresh mark; rewriting README.md shows "Code changed since the review was written.", an enabled "Mark changed layer reviewed" and a stale mark; marking again makes it fresh; unmarking leaves none.

## Gotchas

- Unreachable through the CLI: the layer exists only after the agent publishes. Command needed: `cli agent publish-review "Readme layer"`.
- The button is disabled while the marks or the review are being re-read after the disk change (it waits for the new fingerprint); snapshot again if step 4 shows it disabled.
- Address the sidebar's layer button by `/Readme layer/` only while no layer tab is open; afterwards use `$C click --role tab --name "/Readme layer/"`.
- The rewrite changes the sample README.md; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"` before another feature.
