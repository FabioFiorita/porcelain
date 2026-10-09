---
route: /
selectors:
  - "Review"
  - "Walkthrough stop"
  - "Mark decision reviewed"
  - "Decision reviewed"
  - "Code moved"
  - "Mark "
  - "Unmark "
  - "Could not update the decision"
tests:
  - apps/web/spec/integration/reviews-mark-decision.test.tsx
  - apps/web/spec/integration/reviews-mark-decision-refresh.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
  - GET /api/worktrees/:worktreeId/reviewed-layers
  - PUT /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
  - PUT /api/worktrees/:worktreeId/reviewed-layers
  - DELETE /api/worktrees/:worktreeId/reviewed-layers
---

# reviews.mark-decision

## What it is

A decision of the agent's published review can be marked reviewed from its walkthrough stop. Marking it marks every file of the stop reviewed and records the decision. A file can still be marked on its own without recording the decision. When the decision's code changes on disk, its mark goes stale and the button asks again; marking again counts. Pressing "Decision reviewed" removes only the decision mark; the file marks stay. While the marks or the published review are being read again, the button is disabled, so a mark is always sent with the fingerprint of the decision on screen. The files are marked first and the decision is recorded only when every file was marked: if a file changed after the stop was shown, a toast "Some files changed before they were marked" names the result, the decision stays unrecorded and the walkthrough does not move on. A decision counts as done, with a green check in the sidebar and a full progress segment, only while it is recorded and every file it shows is reviewed.

## How a user reaches it

- Review (sheet at phone width) → tab "Review" → nav "Walkthrough" row "1 Readme layer" → region "1. Readme layer" → nav "Walkthrough stop" → "Mark decision reviewed" → pressed "Decision reviewed".
- The closing card of the stop: "Mark reviewed and continue" or "Mark reviewed and finish" does the same and moves on.

## Driving it

`$C start`; pair your browser using the card's pairing-link command (set `$REPO` from `connection.json` → `fixtures.repositoryPath`).

### Setup

- The agent publishes a review: `$C agent publish-review "Readme layer"` (one decision "Readme layer", one step "New line" pointing at README.md line 3, "A change to review.").
- The README.md rewrite happens in the middle (step 5), not before driving.

1. Navigate to `/` on the card's web URL (full page load), click button named `Review`, tab named `Review`, then button named `/Readme layer/`
   Look for: region "1. Readme layer" with button "Mark README.md as reviewed" and, in nav "Walkthrough stop", button "Mark decision reviewed" enabled and not pressed.
2. Click button named `Mark README.md as reviewed`, then `Unmark README.md as unreviewed`
   Look for: `$C server reviewed-files` lists README.md after the first click and nothing after the second; `$C server reviewed-layers` lists no mark throughout.
3. Click button named `Mark decision reviewed`
   Look for: button "Decision reviewed" [pressed]; the brief shows badge "Reviewed". `$C server reviewed-files` lists README.md; `$C server reviewed-layers` lists one mark with `"stale": false`.
4. Inspect HTTP requests
   Look for: `PUT /api/worktrees/<id>/reviewed-bulk` 200 and `PUT /api/worktrees/<id>/reviewed-layers` 200.
5. On disk: `printf '# Sample repository\n\nA revised change to review.\n' > "$REPO/README.md"`, then wait for text 'Code moved since it was explained' to be visible
   Look for: the brief's badge "Code moved since it was explained"; the button reads "Mark decision reviewed" again and becomes enabled once the new review read lands. `$C server reviewed-layers` shows the mark `"stale": true`.
6. Click button named `Mark decision reviewed`
   Look for: button "Decision reviewed" [pressed]; `$C server reviewed-layers` shows `"stale": false`; `$C server reviewed-files` lists README.md.
7. Click button named `Decision reviewed`
   Look for: button "Mark decision reviewed"; `$C server reviewed-layers` lists no mark (`"marks": []`); `$C server reviewed-files` still lists README.md. Inspect HTTP requests: `DELETE /api/worktrees/<id>/reviewed-layers?…` 200.

### The refresh window (optional, needs a request hold)

Use the HTTP hold recipe in [failure-injection.md](../references/failure-injection.md). After step 3, hold `GET /api/worktrees/[^/]+/review`, then rewrite README.md as in step 5 and await the hold's arrival.

- Look for: button "Mark decision reviewed" [disabled] while the read is held, and `$C server reviewed-layers` already shows `"stale": true`.
- Release the hold. The review GET answers 200, "Code moved since it was explained" shows, and the button enables. Click it: "Decision reviewed" [pressed], no toast "Could not update the decision", and `$C server reviewed-layers` shows `"stale": false`. The network log lists the released review GET before the accepted `PUT …/reviewed-layers`.

## What proves it works

- The label sequence Mark decision reviewed → Decision reviewed → (code change) Mark decision reviewed → Decision reviewed → Mark decision reviewed, with the server readbacks after each step: the decision mark follows the button, and the file mark stays after unmarking the decision.
- `apps/web/spec/integration/reviews-mark-decision.test.tsx`: a file marked alone records no decision; marking the decision marks README.md and records a fresh decision mark; rewriting README.md shows "Code moved since it was explained" and a stale mark; marking again makes it fresh; unmarking leaves no decision mark and keeps README.md reviewed.
- `apps/web/spec/integration/reviews-mark-decision-refresh.test.tsx`: holds the next review read, rewrites README.md, sees the server mark go stale while "Mark decision reviewed" stays disabled; after release the notice shows, the button enables, and marking makes the decision mark fresh again.

## Gotchas

- Without the hold, the disabled window after a disk change is too short to catch by hand. Release a held read within 15 s: a read held past the web's request timeout fails and the walkthrough shows "Review could not be loaded" until a reload.
- Address the sidebar row by `/Readme layer/`: its accessible name joins the number, title and file count ("1 Readme layer 0/1").
- The walkthrough remembers its stop per worktree; after a reload it reopens on "1. Readme layer".
- The rewrite changes the sample README.md; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"` before another feature.
