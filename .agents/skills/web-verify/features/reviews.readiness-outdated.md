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

- The agent publishes a review with two passing checks. CLI gap: `cli agent publish-proof "Readme layer" --check "Unit tests=pass" --check "Save journey=pass" --screenshot "Saved notice"`.
- The agent comments on README.md. CLI gap: `cli agent comment README.md "Should the note mention the new flag?"`.

1. `$C open /`
   Look for: tab "Review Close Review", region "Published review".
2. `$C click --role button --name "Review"`
   Look for: in the dialog, region "Readiness" with buttons "2 checks passed" and "1 comment waiting on you".
3. On disk: `printf '# Sample repository\n\nA change to review.\nAnother line.\n' > "$REPO/README.md"`, then `$C snapshot`
   Look for: in region "Readiness", button "Checks ran before the latest changes" in place of "2 checks passed"; "1 comment waiting on you" still there; the proof row reads "Proof · outdated".
4. `$C click --role button --name "Checks ran before the latest changes"`
   Look for: the sheet closes; region "Proof" with heading "Proof", subtitle starting "Published " and containing "checks outdated", and alert "These checks ran before the latest changes".

## What proves it works

- Step 3's checks line change after the disk write and step 4's Proof document with the out-of-date alert and the "Published ..." subtitle.
- `apps/web/spec/integration/reviews-readiness-outdated.test.tsx`: with `agent.publishProof` (two passing checks) and `agent.comment` on README.md, readiness shows "2 checks passed" and "1 comment waiting on you"; after README.md changes it shows "Checks ran before the latest changes", and clicking it opens region "Proof" with "These checks ran before the latest changes", heading "Proof" and text "Published ".

## Gotchas

- Unreachable through the CLI: both the proof and the agent's comment are agent actions. Commands needed: `cli agent publish-proof ...` and `cli agent comment README.md "..."` as above.
- The sheet stays open across the disk write; if step 3 still shows "2 checks passed", snapshot again after a second (the server's watcher and the live connection carry the change).
- Restore README.md afterwards: `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
