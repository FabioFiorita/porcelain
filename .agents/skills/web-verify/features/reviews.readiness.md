# reviews.readiness

## What it is

The readiness panel at the top of the review sidebar counts reviewed files, marks that went stale, changes the review does not explain, comments waiting on the agent and failing checks; its header sums the open items ("<n> things to check") and each line opens what it counts (the checks line opens the Proof document).

## How a user reaches it

- Review (sheet at phone width; sidebar at 1280px and wider) → region "Readiness" (expanded by default; header button "Readiness <summary>" collapses it).
- `Alt+Shift+R` toggles the review sheet; `Escape` closes it.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (prints `repository <path>`; call it `$REPO`). Steps 1 to 8 need no agent; step 9 has the agent publish its proof.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

- None up front. The disk writes come in steps 7 and 8.
- Step 9 publishes the agent's proof with `$C agent publish-proof`.

1. Open `/` on the instance web URL, then click the button named 'Review'
   Look for: in the dialog, region "Readiness" with buttons "0 of 1 file reviewed", "No marks went stale", "No review published", "No open comments", "No checks attached"; header button "Readiness 3 things to check".
2. Press `Escape`
   Look for: the dialog is gone.
3. Click the button named 'Comment on README.md (unstaged · modified)'
   Look for: textbox "Comment" (placeholder "Share feedback…") under the README.md header.
4. Set the text field named 'Comment' to 'Why?', then click the button named 'Comment'
   Look for: a comment thread "Why?" with text "Waiting for the agent".
5. Click the button named 'Mark README.md as reviewed'
   Look for: button "Unmark README.md as unreviewed" enabled.
6. Click the button named 'Review'
   Look for: lines "1 of 1 file reviewed" and "1 comment waiting on the agent".
7. On disk: `printf '# Sample repository\n\nA change to review.\nAnother line.\n' > "$REPO/README.md"`, then wait for the button named '1 mark changed since reviewed' and inspect the current page
   Look for: lines "1 mark changed since reviewed" and "0 of 1 file reviewed"; header button "Readiness 5 things to check".
8. On disk: `printf 'A note the review leaves out.\n' > "$REPO/notes.md"`, then wait for the button named '0 of 2 files reviewed'
   Look for: line "0 of 2 files reviewed".
9. `$C agent publish-proof "Readme layer" --check "Unit tests=pass" --check "Save journey=fail" --screenshot "Saved notice"`, then wait for the button named '1 of 2 checks failing' and inspect the current page
   Look for: lines "0 of 2 files reviewed", "1 mark changed since reviewed", "1 line in 1 file not explained", "1 comment waiting on the agent" and "1 of 2 checks failing"; header button "Readiness 5 things to check".
10. Click the button named '1 of 2 checks failing'
    Look for: the sheet closes; Page Title "Proof — repository"; region "Proof" with heading "Proof" and alert "1 check failed The agent reported this work as not passing yet.".

## What proves it works

- The line texts after each step, ending with "5 things to check" and the checks line opening the Proof document.
- Browser network evidence: `POST /api/worktrees/<id>/comments` 200 (step 4) and `PUT /api/worktrees/<id>/reviewed` 200 (step 5).
- `apps/web/spec/integration/reviews-readiness.test.tsx`: the same sequence: empty-state lines, then "1 comment waiting on the agent" and "1 of 1 file reviewed", then "1 mark changed since reviewed" / "0 of 1 file reviewed", "0 of 2 files reviewed", and after `agent.publishProof` "1 line in 1 file not explained", "1 of 2 checks failing" and "5 things to check"; clicking the checks line shows the Proof heading.

## Gotchas

- Phone width: the panel lives in the review sheet; the comment and mark controls (steps 3 to 5) are in the document behind it, so close the sheet with `Escape` first.
- Typing leaves focus in the text field; the composer's submit button is "Comment" exactly, distinct from the header's "Comment on README.md (unstaged · modified)".
- The panel follows disk writes and the agent's publish through the watcher and the live connection, which the wait lines follow.
- This leaves a comment, a mark, notes.md and a changed README.md behind; restore with `rm "$REPO/notes.md"` and `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"` (the comment stays on the server).
