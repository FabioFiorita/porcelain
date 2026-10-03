---
route: /
selectors:
  - "Review"
  - "Readiness"
  - " passed"
  - " waiting on you"
  - "Checks ran before the latest changes"
  - "These checks ran before the latest changes"
  - "Proof"
tests:
  - apps/web/spec/integration/reviews-readiness-outdated.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
---

# reviews.readiness-outdated

## What it is

A comment the agent left for you and checks that ran before the latest code change keep the readiness panel from clearing: it lists "1 comment waiting on you", and once the code changes its checks line turns from "2 checks passed" into "Checks ran before the latest changes", which opens the Proof document saying when it was published and that its checks are out of date.

## How a user reaches it

- Review (sheet at phone width) → region "Readiness" at the top of the Changes/Review sidebar tab (expanded by default; its header button "Readiness <n> things to check" collapses it) → the checks line.
- `Alt+Shift+R` toggles the review sheet at phone width (the right sidebar at 1280px and wider).

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (prints `repository <path>`; call it `$REPO`).

### Setup

- The agent publishes a review with two passing checks: `$C agent publish-proof "Readme layer" --check "Unit tests=pass" --check "Save journey=pass" --screenshot "Saved notice"`.
- The agent comments on README.md: `$C agent comment README.md "Should the note mention the new flag?"`.

1. `$C open /`
   Look for: tab "Review Close Review", region "Published review".
2. `$C click --role button --name "Review"`
   Look for: in the dialog, region "Readiness" with header button "Readiness 2 things to check" and buttons "0 of 1 file reviewed", "No marks went stale", "Every change explained", "1 comment waiting on you" and "2 checks passed".
3. On disk: `printf '# Sample repository\n\nA change to review.\nAnother line.\n' > "$REPO/README.md"`, then `$C wait --role button --name "Checks ran before the latest changes"` and `$C snapshot`
   Look for: in region "Readiness", button "Checks ran before the latest changes" in place of "2 checks passed"; "1 comment waiting on you" still there; header "Readiness 3 things to check"; the proof row reads "Proof · outdated".
4. `$C click --role button --name "Checks ran before the latest changes"`
   Look for: the sheet closes; Page Title "Proof — repository"; region "Proof" with heading "Proof", paragraph "Published <date, time> · checks outdated · 1 attachment", and alert "These checks ran before the latest changes The code changed after the agent published this proof. Ask it to run the checks again.".

## What proves it works

- Step 3's checks line change after the disk write and step 4's Proof document with the out-of-date alert and the "Published ..." subtitle.
- `apps/web/spec/integration/reviews-readiness-outdated.test.tsx`: with `agent.publishProof` (two passing checks) and `agent.comment` on README.md, readiness shows "2 checks passed" and "1 comment waiting on you"; after README.md changes it shows "Checks ran before the latest changes", and clicking it opens region "Proof" with "These checks ran before the latest changes", heading "Proof" and text "Published ".

## Gotchas

- The sheet stays open across the disk write; the server's watcher and the live connection carry the change, which the `wait` in step 3 follows.
- Restore README.md afterwards: `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
