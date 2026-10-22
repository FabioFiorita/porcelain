---
route: /
selectors:
  - "Review"
  - "Proof"
  - " failing"
  - "check failed"
  - "The agent reported this work as not passing yet."
  - "Checks"
  - "Attachments"
tests:
  - apps/web/spec/integration/reviews-proof.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review/proof
---

# reviews.proof

The checks and attachments the agent published with its review open as a Proof document: a failing check raises a destructive alert, failing checks are listed first with their output, and an image attachment renders from the server.

## How to get to it (user POV)

- Review (sheet at phone width) → tab "Review" → nav "Walkthrough"'s proof row, named `Proof · <status>` (for example "Proof · 1 failing").
- Review → Readiness → the checks line ("1 of 2 checks failing", "2 checks passed", "Checks ran before the latest changes"...) opens the same document.
- The walkthrough's briefing: section "Proven at <head>" shows all checks, output and image/video/link attachments directly, including stale-proof and failed-check notices. The Proof tab also remains available.
- Inside a decision stop, the checks attached to that decision show in list "Checks for this decision" below its steps.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

- The agent publishes a review with proof: `$C agent publish-proof "Readme layer" --check "Unit tests=pass" --check "Save journey=fail" --output "Save journey=Expected the Saved notice to be visible" --screenshot "Saved notice"` (the sample review plus a one-pixel PNG attachment titled "Saved notice", checks tied to the layer).

1. Navigate to `/`
   Expect: tab "Review Close Review", region "Review walkthrough".
2. Click button `Review`, then click tab `Review`
   Expect: the review sheet with button "Proof · 1 failing" in nav "Walkthrough" (and, in Readiness, "1 of 2 checks failing").
3. Click button `Proof · 1 failing`, then wait for img named `Saved notice`
   Expect: the sheet closes; title "Proof — repository"; region "Proof" with heading "Proof" and paragraph "Published <date, time> · checks 1 failing · 1 attachment"; alert "1 check failed The agent reported this work as not passing yet."; region "Checks" whose first listitem is "Save journey: Failed" holding "Readme layer" and "Expected the Saved notice to be visible", the second "Unit tests: Passed"; region "Attachments" with figure "Saved notice" holding img "Saved notice".

### Observable proof

Capture failing check first, alert and attachment; proof-image GET answers 200.

Automated coverage: `reviews-proof.test.tsx`.

## Gotchas

- Match status-dependent names: Proof · no checks / passed / all 2 passed / outdated. Wait beyond Loading image… for actual attachment bytes.
