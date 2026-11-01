---
route: /
selectors:
  - 'Review'
  - 'Proven at '
  - ' failing'
  - 'check failed'
  - 'The agent reported this work as not passing yet.'
  - 'Checks'
  - 'Attachments'
  - 'Enlarge '
  - 'View original size'
  - 'Fit image'
tests:
  - apps/web/spec/integration/reviews-proof.test.tsx
  - apps/desktop/src/rules/content-security-policy.spec.ts
api:
  - GET /api/worktrees/:worktreeId/review/proof
---

# reviews.proof

The checks and attachments the agent published with its review live in the briefing: a failing check raises a destructive alert, failing checks are listed first with their output, and an image attachment renders from the server.

## How to get to it (user POV)

- Review → Readiness → the checks line ("1 of 2 checks failing", "2 checks passed", "Checks ran before the latest changes"...) opens the briefing.
- The walkthrough's briefing: section "Proven at <head>" shows all checks, output and image/video/link attachments directly, including stale-proof and failed-check notices. There is no separate Proof tab.
- Inside a decision stop, the checks attached to that decision show in list "Checks for this decision" below its steps.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

- The agent publishes a review with proof: `$C agent publish-proof "Readme layer" --check "Unit tests=pass" --check "Save journey=fail" --output "Save journey=Expected the Saved notice to be visible" --screenshot "Saved notice"` (the sample review plus a one-pixel PNG attachment titled "Saved notice", checks tied to the layer).

1. Navigate to `/`
   Expect: tab "Review", region "Review walkthrough".
2. Click button `Review`, then click tab `Review`
   Expect: the review sheet with Readiness and its "1 of 2 checks failing" button.
3. Click button `1 of 2 checks failing`, then wait for img named `Saved notice`
   Expect: the sheet closes; the permanent Review tab stays selected; region "Proven at <head>" holds the published timestamp, alert "1 check failed The agent reported this work as not passing yet.", region "Checks" whose first listitem is "Save journey: Failed" holding "Readme layer" and "Expected the Saved notice to be visible", the second "Unit tests: Passed", and region "Attachments" with figure "Saved notice" holding img "Saved notice". No Proof tab or second review bar appears.

4. Activate button `Enlarge Saved notice` by keyboard.
   Expect: stock dialog named "Saved notice", the image and "View original size" button. Use it to inspect the original pixels within the scrollable dialog, then Fit image to restore the fitted view. Escape dismisses it and restores focus to the thumbnail button. Repeat with a readable large image at 1440 and 414; the image stays inside the dialog and its size controls remain reachable.

### Observable proof

Capture failing check first, alert and attachment; proof-image GET answers 200.

Automated coverage: `reviews-proof.test.tsx`.

## Gotchas

- Match the Readiness checks line to its current status. Wait beyond Loading image… for actual attachment bytes.
- In Porcelain Dev's `porcelain://app` renderer, verify retained video bytes decode and play. The desktop media policy admits app/blob sources; a direct HTTP media URL must still produce a `media-src` refusal. HTTP-browser playback alone does not cover this policy.
