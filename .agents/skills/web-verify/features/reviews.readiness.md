---
route: /
selectors:
  - "Review"
  - "Readiness"
  - " to check"
  - "No marks went stale"
  - "No review published"
  - "No open comments"
  - "No checks attached"
  - "Comment on "
  - "Comment"
  - "Waiting for the agent"
  - "as reviewed"
  - " waiting on the agent"
  - " changed since reviewed"
  - " not explained"
  - " failing"
  - "Proof"
tests:
  - apps/web/spec/integration/reviews-readiness.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/comments
  - GET /api/worktrees/:worktreeId/reviewed
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.readiness

## What it is

The readiness panel at the top of the review sidebar counts reviewed files, marks that went stale, changes the review does not explain, comments waiting on the agent and failing checks; its header sums the open items ("<n> things to check") and each line opens what it counts (the checks line opens the Proof document).

## How a user reaches it

- Review (sheet at phone width; sidebar at 1280px and wider) → region "Readiness" (expanded by default; header button "Readiness <summary>" collapses it).
- `Alt+Shift+R` toggles the review sheet; `Escape` closes it.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (prints `repository <path>`; call it `$REPO`). Steps 1 to 8 need no agent; steps 9 and 10 need the agent's proof.

### Setup

- None up front. The disk writes come in steps 7 and 8.
- Before step 9: CLI gap `cli agent publish-proof "Readme layer" --check "Unit tests=pass" --check "Save journey=fail" --screenshot "Saved notice"`.

1. `$C open /`, then `$C click --role button --name "Review"`
   Look for: in the dialog, region "Readiness" with buttons "0 of 1 file reviewed", "No marks went stale", "No review published", "No open comments", "No checks attached"; header button "Readiness 3 things to check".
2. `$C press Escape`
   Look for: the dialog is gone.
3. `$C click --role button --name "Comment on README.md (unstaged · modified)"`
   Look for: textbox "Comment" (placeholder "Share feedback…") under the README.md header.
4. `$C fill --role textbox --name "Comment" "Why?"`, then `$C click --role button --name "Comment"`
   Look for: a comment thread "Why?" with text "Waiting for the agent".
5. `$C click --role button --name "Mark README.md as reviewed"`
   Look for: button "Unmark README.md as unreviewed" enabled.
6. `$C click --role button --name "Review"`
   Look for: lines "1 of 1 file reviewed" and "1 comment waiting on the agent".
7. On disk: `printf '# Sample repository\n\nA change to review.\nAnother line.\n' > "$REPO/README.md"`, then `$C snapshot`
   Look for: lines "1 mark changed since reviewed" and "0 of 1 file reviewed"; header button "Readiness 5 things to check".
8. On disk: `printf 'A note the review leaves out.\n' > "$REPO/notes.md"`, then `$C snapshot`
   Look for: line "0 of 2 files reviewed".
9. (After `cli agent publish-proof ...`.) `$C snapshot`
   Look for: lines "1 line in 1 file not explained" and "1 of 2 checks failing"; header button "Readiness 5 things to check".
10. `$C click --role button --name "1 of 2 checks failing"`
    Look for: the sheet closes; region "Proof" with heading "Proof" and alert "1 check failed".

## What proves it works

- The line texts after each step, ending with "5 things to check" and the checks line opening the Proof document.
- `$C network`: `POST /api/worktrees/<id>/comments` 200 (step 4) and `PUT /api/worktrees/<id>/reviewed` 200 (step 5).
- `apps/web/spec/integration/reviews-readiness.test.tsx`: the same sequence: empty-state lines, then "1 comment waiting on the agent" and "1 of 1 file reviewed", then "1 mark changed since reviewed" / "0 of 1 file reviewed", "0 of 2 files reviewed", and after `agent.publishProof` "1 line in 1 file not explained", "1 of 2 checks failing" and "5 things to check"; clicking the checks line shows the Proof heading.

## Gotchas

- Unreachable through the CLI (steps 9 and 10 only): the proof is an agent action. Command needed: `cli agent publish-proof ...` as above.
- Phone width: the panel lives in the review sheet; the comment and mark controls (steps 3 to 5) are in the document behind it, so close the sheet with `Escape` first.
- `fill` leaves focus in the textbox; the composer's submit button is "Comment" exactly, distinct from the header's "Comment on README.md (unstaged · modified)".
- The panel follows disk writes through the watcher and the live connection; snapshot again if a line has not changed yet.
- This leaves a comment, a mark, notes.md and a changed README.md behind; restore with `rm "$REPO/notes.md"` and `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"` (the comment stays on the server).
