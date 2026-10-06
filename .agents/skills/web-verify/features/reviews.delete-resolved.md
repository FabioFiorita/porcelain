# reviews.delete-resolved

## What it is

After confirming, the reviewer deletes every resolved thread they started, for them and for the agent; a resolved thread the agent started stays, and the confirmation says so beforehand.

## How a user reaches it

- Review (phone; the right sidebar on desktop) → tab "Comments" → filter button "resolved N" → button "Delete resolved" → alertdialog → "Delete" (or "Cancel").
- "Delete resolved" shows only on the "resolved" filter with at least one resolved thread, and is disabled when every resolved thread was started by the agent.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

The agent starts a thread on README.md: `$C agent comment README.md "I kept the old heading in the changelog"`.

1. Open `/` on the instance web URL, then click the button named 'Review'
   Look for: dialog "Worktree review" with tab "Comments".
2. Click the tab whose name starts with 'Comments'
   Look for: button "Comment on the whole change"; article "Comment thread" with "I kept the old heading in the changelog" and "From the agent".
3. Click the button named 'Comment on the whole change', set the text field named 'Comment' to 'Split this into two commits', then click the button named 'Comment'
   Look for: region "Comments" holding two articles "Comment thread", the agent's first and then yours with "Split this into two commits" and "Waiting for the agent", each with a button "Resolve".
4. Click the button named 'Resolve' in the region named 'Comments' (the first thread’s control), then click the button named 'Resolve' in the region named 'Comments'
   Look for: text "No open comments yet."; buttons "open 0" and "resolved 2".
5. Click the button whose name starts with 'resolved' (case-insensitive)
   Look for: two articles "Resolved comment thread"; button "Delete resolved" enabled.
6. Click the button named 'Delete resolved'
   Look for: alertdialog "Delete 1 resolved thread?" with the paragraph "This deletes the resolved threads you started, with the agent's replies in them, for you and for the agent. 1 resolved thread the agent started stays, since you cannot delete what the agent wrote on its own."; buttons "Cancel" and "Delete".
7. Click the button named 'Cancel'
   Look for: the alertdialog is gone; both resolved threads still listed.
8. Click the button named 'Delete resolved', then click the button named 'Delete'
   Look for: the alertdialog is gone; buttons "open 0" and "resolved 1"; button "Delete resolved" [disabled]; the one article "Resolved comment thread" left holds "I kept the old heading in the changelog". `$C server comment-threads` lists only the agent's thread, `"resolved": true`.
9. Inspect browser network evidence
   Look for: one `POST /api/worktrees/<id>/comments/resolved/deletion` answered 200 (step 8 only; Cancel sends nothing).

## What proves it works

- Step 8's list with only the agent's thread, the disabled "Delete resolved", the server's thread list and step 9's single 200 deletion request.
- Persistence: open `/` on the instance web URL, "Review", the tab whose name starts with "Comments", the filter button whose name starts with "resolved" still lists only the agent's thread.
- `apps/web/spec/integration/reviews-delete-resolved.test.tsx`: with an agent thread and a reviewer thread both resolved, the dialog reads "Delete 1 resolved thread?" and "1 resolved thread the agent started stays"; Cancel keeps everything; Delete removes only the reviewer thread, `server.commentThreads()` keeps only the agent thread, and "Delete resolved" is disabled.

## Gotchas

- "Delete" (in the alertdialog) and "Delete resolved" are different exact names; "Delete" exists only while the alertdialog is open.
- With both threads open, two "Resolve" buttons appear in the "Comments" region. Step 4 chooses the first thread’s button, then the remaining thread’s button. The agent thread's inline copy under README.md is behind the modal sheet and not addressable while it is open.
- Threads left by other features make "Resolve" ambiguous too. `stop` and `start` for a clean instance.
