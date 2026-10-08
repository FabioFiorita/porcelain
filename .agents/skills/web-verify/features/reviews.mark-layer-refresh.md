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

`$C start`; pair your browser using the card’s pairing-link command (set `$REPO` from `connection.json` → `fixtures.repositoryPath`). Holding the review read keeps the disabled window open long enough to see.

### Setup

- The agent publishes a review: `$C agent publish-review "Readme layer"`.

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: tab "Review Close Review", region "Published review".
2. Click button named `Review`, then click button named `/Readme layer/`
   Look for: region "Review layer Readme layer", button "Mark layer reviewed" enabled.
3. Click button named `Mark layer reviewed`
   Look for: button "Reviewed" [pressed].
4. Hold matching `GET /api/worktrees/:worktreeId/review` requests in the browser before they reach the server (see [routing recipes and per-map instructions](../references/failure-injection.md))
   Look for: the browser gate records an arriving review GET only after the disk rewrite.
5. On disk: `printf '# Sample repository\n\nA revised change to review.\n' > "$REPO/README.md"`, then await the gate’s arrival promise and wait for button named `Mark changed layer reviewed` to be visible and inspect the accessibility tree
   Look for: button "Mark changed layer reviewed" [disabled] while the review read is held; `$C server reviewed-layers` already shows the mark `"stale": true`.
6. Release the held HTTP requests
   Look for: the held review GET answers 200. Inspect the accessibility tree: button "Mark changed layer reviewed" enabled and status "Code changed since the review was written." in article "Step New line".
7. Click button named `Mark changed layer reviewed`
   Look for: button "Reviewed" [pressed]; no alert "The layer mark could not be updated. Try again."; `$C server reviewed-layers` shows `"stale": false`.
8. Inspect HTTP requests and responses
   Look for: the released `GET /api/worktrees/<id>/review` 200 listed before the step 7 `PUT /api/worktrees/<id>/reviewed-layers` 200.

## What proves it works

- Step 5 shows the button disabled while the read is held, step 7 ends pressed with no alert and a fresh mark on the server, and the network log orders the review re-read before the accepted PUT.
- `apps/web/spec/integration/reviews-mark-layer-refresh.test.tsx`: holds the next review read, rewrites README.md, sees the server mark go stale while "Mark changed layer reviewed" stays disabled; after release, "Code changed since the review was written." shows, the button enables, marking makes `server.reviewedLayers()` fresh again and no failure alert appears.

## Gotchas

- Without the hold this drive is the same as `reviews.mark-layer`; the disabled window is too short to catch. Release within 15 s: a read held past the web's request timeout (`REQUEST_TIMEOUT_MS`) fails and the layer shows "Review could not be loaded" until a full reload of `/`.
- Restore README.md afterwards: `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
