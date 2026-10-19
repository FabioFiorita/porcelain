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
  - "Mark available files reviewed"
  - "Review unavailable"
  - "Some files cannot be marked reviewed"
tests:
  - apps/web/spec/integration/reviews-mark-decision.test.tsx
  - apps/web/spec/integration/reviews-mark-decision-refresh.test.tsx
  - apps/web/spec/integration/reviews-unavailable-completion.test.tsx
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

A decision of the agent's published review can be marked reviewed from its walkthrough stop. Marking it marks every file of the stop reviewed and records the decision. A file can still be marked on its own without recording the decision. When committed code is republished with a different decision fingerprint, its mark goes stale and the button asks again; marking again counts. Pressing "Decision reviewed" removes only the decision mark; the file marks stay. While the marks or the published review are being read again, the button is disabled, so a mark is always sent with the fingerprint of the decision on screen. The files are marked first and the decision is recorded only when every file was marked: if a file changed after the stop was shown, a toast "Some files changed before they were marked" names the result, the decision stays unrecorded and the walkthrough does not move on. A decision counts as done, with a green check in the sidebar and a full progress segment, only while it is recorded and every file it shows is reviewed.

## How a user reaches it

- Review (sheet at phone width) → tab "Review" → nav "Walkthrough" row "1 Readme layer" → region "1. Readme layer" → nav "Walkthrough stop" → "Mark decision reviewed" → pressed "Decision reviewed".
- The closing card of the stop: "Mark reviewed and continue" or "Mark reviewed and finish" does the same and moves on.

## Driving it

`$C start`; pair your browser using the card's pairing-link command (set `$REPO` from `connection.json` → `fixtures.repositoryPath`).

### Setup

`$C agent publish-review "Readme layer"` commits and publishes the decision. Then append a follow-up line to README.md so the existing Uncommitted view has a file to mark.

1. Open Review → tab "Review" → the Readme layer row. The stop shows its retained note and the live follow-up diff.
2. Mark README.md alone, then unmark it. `$C server reviewed-files` follows both actions; no decision mark is recorded.
3. Click "Mark decision reviewed". The button becomes pressed "Decision reviewed". The server lists README.md and one decision mark with `stale: false`.
4. Rewrite the live README.md again. The decision mark stays current because the published fingerprint has not changed; its retained excerpt stays readable. File marks independently follow live fingerprints.
5. Click "Decision reviewed". Only the decision mark is removed; the file mark remains.

### The refresh window (optional, needs a request hold)

Use the HTTP hold recipe in [failure-injection.md](../references/failure-injection.md). Remove the decision mark, hold the next worktree review GET, and edit README.md. While the new read is held, "Mark decision reviewed" is disabled. Release the read: marking becomes available and records the committed decision fingerprint.

## What proves it works

- `apps/web/spec/integration/reviews-mark-decision.test.tsx` covers combined file/decision marking, a live edit preserving the committed decision, and unmarking only the decision.
- `apps/web/spec/integration/reviews-mark-decision-refresh.test.tsx` holds a review refresh and checks that marking waits for it before recording the fingerprint.
- Domain and HTTP reviewed-layer tests cover a republished decision with a different fingerprint making its old mark stale.

## Gotchas

- A file above the fingerprint limit or otherwise unreadable cannot be marked. A mixed stop offers "Mark available files reviewed" and names the unavailable paths, explaining that the stop stays open. Its successful file marks remain, with no new decision mark or advance. Once no available files remain, the toolbar, closing card and sidebar completion action show disabled "Review unavailable"; navigation stays available. Making the file readable restores ordinary completion. The same rule applies to Not explained. The bulk report counts unavailable files as skipped and describes already-reviewed files separately.

- Without the hold, the disabled window after a disk change is too short to catch by hand. Release a held read within 15 s: a read held past the web's request timeout fails and the walkthrough shows "Review could not be loaded" until a reload.
- Address the sidebar row by `/Readme layer/`: its accessible name joins the number, title and file count ("1 Readme layer 0/1").
- The walkthrough remembers its stop per worktree; after a reload it reopens on "1. Readme layer".
- The rewrite changes only the live sample README.md; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"` before another feature.
