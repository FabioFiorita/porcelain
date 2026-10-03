---
route: /
selectors:
  - "Review"
  - "Step "
  - "Code changed since the review was written."
tests:
  - apps/web/spec/integration/changes-step-lines.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes/lines
  - GET /api/worktrees/:worktreeId/review
---

# changes.step-lines

## What it is

A step of an agent's published review that points at worktree lines (a context step) shows those lines as they are on disk now; once another writer rewrites them, the step says "Code changed since the review was written." instead of showing stale lines.

## How a user reaches it

- After an agent published a review: workspace → button "Review" → the layer row "<n>. <layer title>" → the step's article "Step <step title>" in the layer's Code view.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`, then `REPO=<the repository path start printed>`.

### Setup

CLI gap, blocking: the step exists only after an agent publishes a review through the MCP `publish_review` tool, which the CLI cannot do. Needed: `cli agent publish-review "Readme walkthrough" --step context`, publishing one layer "Readme walkthrough" (lane "Docs") with one context step "New line" pointing at README.md line 3, the line "A change to review.".

With that command run:

1. `$C open /`
   Look for: Page Title "Changes — repository"; the document tab now reads "Review Close Review".
2. `$C click --role button --name "Review"`
   Look for: the sheet's first tab reads "Review"; buttons "Review summary" and "1. Readme walkthrough".
3. `$C click --role button --name "1. Readme walkthrough"`
   Look for: the sheet closes; Page Title "Review — repository"; region "Review layer Readme walkthrough"; article "Step New line" containing text "A change to review.".
4. On disk: `printf '# Sample repository\n\nRewritten.\n' > "$REPO/README.md"`
5. `$C snapshot`
   Look for: inside article "Step New line", status "Code changed since the review was written."; text "A change to review." gone from the article.

## What proves it works

- Step 3 shows the disk line inside the step and step 5 replaces it with the changed notice, with no `open` in between. `$C network` shows `GET /api/worktrees/<worktreeId>/review` and `GET /api/worktrees/<worktreeId>/changes/lines?…` with 200, and fresh reads of both after the rewrite.
- `apps/web/spec/integration/changes-step-lines.test.tsx`: publishes the review with a context step, asserts the step article shows "A change to review."; after rewriting README.md it waits for the server to report the step location as `changed`, then asserts the notice shows and the old line is gone.

## Gotchas

- Unreachable through the CLI: publishing a review is an agent action; needed `cli agent publish-review "Readme walkthrough" --step context`.
- The layer row's name is built from its position and title ("1. Readme walkthrough"); a review with other layers shifts the number.
- The rewrite reaches the step through the watcher and live socket; if step 5 still shows the old line, run `$C snapshot` again after a second (the published review also refreshes on its own every 30 minutes, too slow to wait for).
