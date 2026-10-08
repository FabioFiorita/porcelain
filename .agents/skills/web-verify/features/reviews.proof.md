---
route: /
selectors:
  - "Review"
  - "Proof"
  - " failing"
  - "1 check failed"
  - "The agent reported this work as not passing yet."
  - "Checks"
  - "Attachments"
tests:
  - apps/web/spec/integration/reviews-proof.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review/proof
---

# reviews.proof

## What it is

The checks and attachments the agent published with its review open as a Proof document: a failing check raises a destructive alert, failing checks are listed first with their output, and an image attachment renders from the server.

## How a user reaches it

- Review (sheet at phone width) → the Layers list's proof row, named `Proof · <status>` (for example "Proof · 1 failing").
- Review → Readiness → the checks line ("1 of 2 checks failing", "2 checks passed", "Checks ran before the latest changes"...) opens the same document.
- Inside a layer, the checks attached to that layer show above its steps.

## Driving it

`$C start`; pair your browser using the card’s pairing-link command.

### Setup

- The agent publishes a review with proof: `$C agent publish-proof "Readme layer" --check "Unit tests=pass" --check "Save journey=fail" --output "Save journey=Expected the Saved notice to be visible" --screenshot "Saved notice"` (the sample review plus a one-pixel PNG attachment titled "Saved notice", checks tied to the layer, as the tests' `agent.publishProof` sends it).

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: tab "Review Close Review", region "Published review".
2. Click button named `Review`
   Look for: the review sheet with button "Proof · 1 failing" (and, in Readiness, "1 of 2 checks failing").
3. Click button named `Proof · 1 failing`, then wait for img named `Saved notice` to be visible
   Look for: the sheet closes; Page Title "Proof — repository"; region "Proof" with heading "Proof" and paragraph "Published <date, time> · checks 1 failing · 1 attachment"; alert "1 check failed The agent reported this work as not passing yet."; region "Checks" whose first listitem is "Save journey: Failed" holding "Readme layer" and "Expected the Saved notice to be visible", the second "Unit tests: Passed"; region "Attachments" with figure "Saved notice" holding img "Saved notice".

## What proves it works

- Step 3's alert, check order and image; Inspect HTTP requests and responses shows `GET /api/worktrees/<id>/review/proof?...` 200 for the image bytes.
- `apps/web/spec/integration/reviews-proof.test.tsx`: after `agent.publishProof` with a passing and a failing check, "Proof · 1 failing" opens region "Proof" whose alert reads "1 check failed", whose first check is "Save journey: Failed" with its output, the second "Unit tests: Passed", and img "Saved notice" is visible.

## Gotchas

- The proof row's name is built from the status, so it changes with the checks: "Proof · no checks", "Proof · passed", "Proof · all 2 passed", "Proof · outdated" (code changed after publishing).
- The image shows "Loading image…" until its bytes arrive; the visible-image wait in step 3 covers it.
