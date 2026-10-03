---
route: /
selectors:
  - "Review"
  - "Review layer "
  - "Mark layer reviewed"
  - "Reviewed"
  - "Mark changed layer reviewed"
  - "Code changed since the review was written."
  - "The layer mark could not be updated. Try again."
tests:
  - apps/web/spec/integration/reviews-mark-layer-refresh.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed-layers
  - GET /api/worktrees/:worktreeId/review
  - GET /api/worktrees/:worktreeId/reviewed-layers
  - PUT /api/worktrees/:worktreeId/reviewed-layers
---

# reviews.mark-layer-refresh

## What it is

After a layer's code changes, the web re-reads the published review to get the layer's new fingerprint. Until that read lands, "Mark changed layer reviewed" stays disabled, so the mark is always sent with the fingerprint of the layer on screen and the server accepts it (no "The layer mark could not be updated. Try again.").

## How a user reaches it

- Review (sheet at phone width) → "1. Readme layer" → "Mark layer reviewed" → (code changes on disk) → "Mark changed layer reviewed".

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (prints `repository <path>`; call it `$REPO`). The CLI drives the ordinary path; the held review read that makes the race visible belongs to the test.

### Setup

- The agent publishes a review. CLI gap: `cli agent publish-review "Readme layer"`.
- Holding the review read open is a second gap: `cli network hold "GET /api/worktrees/*/review"` / `cli network release`.

1. `$C open /`
   Look for: tab "Review Close Review", region "Published review".
2. `$C click --role button --name "Review"`, then `$C click --role button --name "/Readme layer/"`
   Look for: region "Review layer Readme layer", button "Mark layer reviewed" enabled.
3. `$C click --role button --name "Mark layer reviewed"`
   Look for: button "Reviewed" with aria-pressed true.
4. On disk: `printf '# Sample repository\n\nA revised change to review.\n' > "$REPO/README.md"`, then `$C snapshot`
   Look for: text "Code changed since the review was written."; button "Mark changed layer reviewed" enabled. (Snapped while the review is still being re-read, the same button shows disabled.)
5. `$C click --role button --name "Mark changed layer reviewed"`
   Look for: button "Reviewed" with aria-pressed true; no alert "The layer mark could not be updated. Try again.".
6. `$C network`
   Look for: a `GET /api/worktrees/<id>/review` after the disk write and before the step 5 `PUT /api/worktrees/<id>/reviewed-layers`, which answered 200.

## What proves it works

- Step 5 ends pressed with no alert, and the network log orders the review re-read before the accepted PUT.
- `apps/web/spec/integration/reviews-mark-layer-refresh.test.tsx`: holds the next review read, rewrites README.md, sees the server mark go stale while "Mark changed layer reviewed" stays disabled; after release, "Code changed since the review was written." shows, the button enables, marking makes `server.reviewedLayers()` fresh again and no failure alert appears.

## Gotchas

- Unreachable through the CLI: the published layer needs an agent action (`cli agent publish-review "Readme layer"`), and the race itself needs a held request (`cli network hold ...`). Without the hold this drive is the same as `reviews.mark-layer`; the disabled window is too short to catch reliably.
- Restore README.md afterwards: `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
