---
route: /
selectors:
  - "Review"
  - "Changes"
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

The readiness panel at the top of the review sidebar counts reviewed files, marks that went stale, changes the review does not explain, comments waiting on the agent and failing checks; its header sums the open items ("<n> things to check") and each line opens what it counts (the checks line opens the Proof document).

## Sub-features

- `reviews.readiness` — Review readiness and reasons.

## How to get to it (user POV)

- Review (sheet at phone width; sidebar at 1280px and wider) → tab "Changes" ("Review" once the agent publishes a review) → region "Readiness" (expanded by default; header button "Readiness <summary>" collapses it).
- `Alt+Shift+R` toggles the review sheet; `Escape` closes it.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

- None up front. The disk writes come in steps 7 and 8.
- Step 9 publishes the agent's proof with `$C agent publish-proof`.

1. Navigate to `/`, then click button `Review`, then click tab `Changes`
   Expect: in the dialog, region "Readiness" with buttons "0 of 1 file reviewed", "No marks went stale", "No review published", "No open comments", "No checks attached"; header button "Readiness 3 things to check".
2. Press `Escape`
   Expect: the dialog is gone.
3. Click button `Comment on README.md (unstaged · modified)`
   Expect: textbox "Comment" (placeholder "Share feedback…") under the README.md header.
4. Fill textbox `Comment` with 'Why?', then click button `Comment`
   Expect: a comment thread "Why?" with text "Waiting for the agent".
5. Click button `Mark README.md as reviewed`
   Expect: button "Unmark README.md as unreviewed" enabled.
6. Click button `Review`
   Expect: lines "1 of 1 file reviewed" and "1 comment waiting on the agent".
7. On disk: `printf '# Sample repository\n\nA change to review.\nAnother line.\n' > "$REPO/README.md"`, then wait for button `1 mark changed since reviewed`
   Expect: lines "1 mark changed since reviewed" and "0 of 1 file reviewed"; header button "Readiness 5 things to check".
8. On disk: `printf 'A note the review leaves out.\n' > "$REPO/notes.md"`, then wait for button `0 of 2 files reviewed`
   Expect: line "0 of 2 files reviewed".
9. `$C agent publish-proof "Readme layer" --check "Unit tests=pass" --check "Save journey=fail" --screenshot "Saved notice"`, then wait for button `1 of 2 checks failing`
   Expect: lines "0 of 2 files reviewed", "1 mark changed since reviewed", "1 line in 1 file not explained", "1 comment waiting on the agent" and "1 of 2 checks failing"; header button "Readiness 5 things to check".
10. Click button `1 of 2 checks failing`
    Expect: the sheet closes; title "Proof — repository"; region "Proof" with heading "Proof" and alert "1 check failed The agent reported this work as not passing yet.".

### Observable proof

Check each readiness line/count ending at 5 things to check; comment POST/mark PUT answer 200.

Automated coverage: `reviews-readiness.test.tsx`.

## Gotchas

- Close the phone sheet before document comment/mark controls. Comment is submit, distinct from Comment on README.md (unstaged · modified).
- Wait for live writes/publication. Cleanup notes.md, restore README and clear marks; comments remain unless deleted or instance reset.
