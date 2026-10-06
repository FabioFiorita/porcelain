# changes.step-lines

## What it is

A step of an agent's published review that points at worktree lines (a context step) shows those lines as they are on disk now; once another writer rewrites them, the step says "Code changed since the review was written." instead of showing stale lines.

## How a user reaches it

- After an agent published a review: workspace → button "Review" → the layer row "<n>. <layer title>" → the step's article "Step <step title>" in the layer's Code view.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`, then `REPO=<the repository path start printed>`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

`$C agent publish-review "Readme walkthrough" --context` publishes one layer "Readme walkthrough" (lane "Docs") with one context step "New line" pointing at README.md line 3, the line "A change to review.".

1. Open `/` on the instance web URL
   Look for: tab "Review Close Review" selected and region "Published review".
2. Click the button named 'Review'
   Look for: the sheet's tab "Review" selected; buttons "Review summary" and "1. Readme walkthrough".
3. Click the button named '1. Readme walkthrough'
   Look for: the sheet closes; Page Title "Review — repository"; region "Review layer Readme walkthrough"; article "Step New line" whose code shows "3 A change to review.".
4. On disk: `printf '# Sample repository\n\nRewritten.\n' > "$REPO/README.md"`
5. Wait for the text 'Code changed since the review was written.', then inspect the current page
   Look for: inside article "Step New line", status "Code changed since the review was written."; no code block and no "A change to review." left in the article.

## What proves it works

- Step 3 shows the disk line inside the step and step 5 replaces it with the changed notice, with no page load in between. Browser network evidence shows `GET /api/worktrees/<worktreeId>/review` and `GET /api/worktrees/<worktreeId>/changes/lines?…` with 200, and fresh reads of both after the rewrite.
- `apps/web/spec/integration/changes-step-lines.test.tsx`: publishes the review with a context step, asserts the step article shows "A change to review."; after rewriting README.md it waits for the server to report the step location as `changed`, then asserts the notice shows and the old line is gone.

## Gotchas

- The layer row's name is built from its position and title ("1. Readme walkthrough"); a review with other layers shifts the number.
- The rewrite reaches the step through the watcher and live socket, which waiting for the status text follows; the published review also refreshes on its own every 30 minutes, too slow to wait for.
- The status has no accessible name; locate its visible status text.
