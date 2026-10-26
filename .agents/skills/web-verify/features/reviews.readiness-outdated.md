---
route: /
selectors:
  - "Review"
  - "Readiness"
  - " passed"
  - " waiting on you"
  - "Checks ran before the latest changes"
  - "These checks ran before the latest changes"
  - "Proven at "
tests:
  - apps/web/spec/integration/reviews-readiness-outdated.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
---

# reviews.readiness-outdated

A comment the agent left for you and checks that ran before the latest code change keep the readiness panel from clearing: it lists "1 comment waiting on you", and once the code changes its checks line turns from "2 checks passed" into "Checks ran before the latest changes", which opens proof in the briefing, saying when it was published and that its checks are out of date.

## How to get to it (user POV)

- Review (sheet at phone width) → region "Readiness" at the top of the Changes/Review sidebar tab (expanded by default; its header button "Readiness <n> things to check" collapses it) → the checks line.
- `Alt+Shift+R` toggles the review sheet at phone width (the right sidebar at 1280px and wider).

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

- The agent publishes a review with two passing checks: `$C agent publish-proof "Readme layer" --check "Unit tests=pass" --check "Save journey=pass" --screenshot "Saved notice"`.
- The agent comments on README.md: `$C agent comment README.md "Should the note mention the new flag?"`.

1. Navigate to `/`
   Expect: tab "Review", region "Review walkthrough".
2. Click button `Review`
   Expect: in the dialog, region "Readiness" with header button "Readiness 2 things to check" and buttons "0 of 1 file reviewed", "No marks went stale", "Every change explained", "1 comment waiting on you" and "2 checks passed".
3. On disk: `printf '# Sample repository\n\nA change to review.\nAnother line.\n' > "$REPO/README.md"`, then wait for button `Checks ran before the latest changes`
   Expect: in region "Readiness", button "Checks ran before the latest changes" in place of "2 checks passed"; "1 comment waiting on you" still there; header "Readiness 3 things to check".
4. Click button `Checks ran before the latest changes`
   Expect: the sheet closes; the Review tab stays selected; the briefing's region "Proven at <head>" contains the published timestamp and the notice "These checks ran before the latest changes The code changed after the agent published this proof. Ask it to run the checks again.".

### Observable proof

After write, checks/readiness change; the briefing shows the stale-proof notice and Published subtitle.

Automated coverage: `reviews-readiness-outdated.test.tsx`.

## Gotchas

- Keep the sheet open through the write; wait for live checks state without reload. Restore README afterward.
