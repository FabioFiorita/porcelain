---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Comments"
  - "Comment on the whole change"
  - "Comment"
  - "Resolve"
  - "Delete resolved"
  - "Cancel"
  - "Delete"
  - "Nothing resolved yet."
  - "the agent started"
tests:
  - apps/web/spec/integration/reviews-delete-resolved.test.tsx
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - POST /api/worktrees/:worktreeId/comments/resolved/deletion
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# reviews.delete-resolved

## What it is

After confirming, the reviewer deletes every resolved thread they started, for them and for the agent; a resolved thread the agent started stays, and the confirmation says so beforehand.

## How a user reaches it

- Review (phone; the right sidebar on desktop) → tab "Comments" → filter button "resolved N" → button "Delete resolved" → alertdialog → "Delete" (or "Cancel").
- "Delete resolved" shows only on the "resolved" filter with at least one resolved thread, and is disabled when every resolved thread was started by the agent.

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start`.

### Setup

The full promise needs a resolved agent thread beside the reviewer's: `cli agent comment README.md "I kept the old heading in the changelog"`, which the CLI lacks. The steps below drive the reviewer's part; with that gap filled, also resolve the agent thread at step 4 and expect the extra sentence noted at step 6.

1. `.agents/skills/web-verify/scripts/cli open /` then `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: dialog "Worktree review" with tab "Comments".
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "/^Comments/"`
   Look for: button "Comment on the whole change"; button "resolved 0".
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment on the whole change"` then `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Split this into two commits"` then `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: article "Comment thread" with the text "Split this into two commits".
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Resolve"`
   Look for: text "No open comments yet."; button "resolved 1".
5. `.agents/skills/web-verify/scripts/cli click --role button --name "/^resolved/i"`
   Look for: article "Resolved comment thread" with "Split this into two commits"; button "Delete resolved" enabled.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Delete resolved"`
   Look for: alertdialog with heading "Delete 1 resolved thread?" and the text "This deletes the resolved threads you started, with the agent's replies in them, for you and for the agent."; buttons "Cancel" and "Delete". With a resolved agent thread present the text adds "1 resolved thread the agent started stays, since you cannot delete what the agent wrote on its own."
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Cancel"`
   Look for: the alertdialog is gone; "Split this into two commits" is still listed.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Delete resolved"` then `.agents/skills/web-verify/scripts/cli click --role button --name "Delete"`
   Look for: the alertdialog is gone; text "Nothing resolved yet."; button "resolved 0"; button "Delete resolved" is gone. (With the agent thread present: that thread stays listed and "Delete resolved" is disabled.)
9. `.agents/skills/web-verify/scripts/cli network`
   Look for: one `POST /api/worktrees/<id>/comments/resolved/deletion` answered 200 (step 8 only; Cancel sends nothing).

## What proves it works

- Step 8's empty resolved list and step 9's single 200 deletion request.
- Persistence: `.agents/skills/web-verify/scripts/cli open /`, "Review", tab `/^Comments/`, button `/^resolved/i` still shows "Nothing resolved yet."
- `apps/web/spec/integration/reviews-delete-resolved.test.tsx`: with an agent thread and a reviewer thread both resolved, the dialog reads "Delete 1 resolved thread?" and "1 resolved thread the agent started stays"; Cancel keeps everything; Delete removes only the reviewer thread, `server.commentThreads()` keeps only the agent thread, and "Delete resolved" is disabled.

## Gotchas

- Unreachable through the CLI: the agent's resolved thread that stays (the second half of the promise) needs `cli agent comment README.md "I kept the old heading in the changelog"` before step 1.
- "Delete" (in the alertdialog) and "Delete resolved" are different exact names; "Delete" exists only while the alertdialog is open.
- With an agent thread and the reviewer thread both open, `--name "Resolve"` matches two buttons and the click fails (strict mode); the agent thread also shows inline under README.md behind the sheet. The CLI cannot scope a click to one article: that needs something like `cli click --role button --name "Resolve" --within "Comment thread" --has-text "I kept the old heading in the changelog"`.
- Threads left by other features make "Resolve" ambiguous too. `stop` and `start` for a clean instance.
