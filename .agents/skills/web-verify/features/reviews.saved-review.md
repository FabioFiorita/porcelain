---
route: /
selectors:
  - 'Saved review'
  - 'Open saved review'
  - 'Review walkthrough'
  - 'Agent summary'
  - 'Walkthrough'
  - 'Committed · Show code'
  - 'Open proof'
tests:
  - apps/web/spec/integration/reviews-saved-review.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
---

# reviews.saved-review

## What it is

The latest published review stays readable when its pointers become committed or broken and the publication becomes inactive. The existing walkthrough, ordered decisions, agent summary and proof remain available as "Saved review". This is the current worktree's latest publication, not an archive: there is no historical diff replay, pointers follow current code and publishing another review replaces it.

## How a user reaches it

- The handoff document tab becomes "Saved review" after the commit.
- Review (sheet at phone width) → tab "Saved review" → button "Saved review" opens the briefing. The existing decision rows open their stops, and "Proof" opens the publication's proof.
- Closing the document leaves "Open saved review" in the empty pane, even with no uncommitted changes.
- Files and Git History remain separate sidebar tabs. Open current code or a commit there, then select the saved document tab to return. `Alt+2` selects the review surface as before; no palette or settings entry is added.

## Driving it

`$C start`; pair your browser using the card. Drive at desktop width, then 414 × 896.

1. `$C agent publish-review "Explain this change"`; open the handoff tab.
   Look for: heading "Review", its briefing and ordered decisions. No saved-publication notice.
2. In `connection.json`'s `fixtures.repositoryPath`, commit the sample README.md change using real Git. `$C server published-review`.
   Look for: the same revision and decision, `active: false`, pointer state `committed`. The live document and sidebar tab read "Saved review". The notice explains the latest-publication and historical-diff limits.
3. Close the Saved review document; click "Open saved review".
   Look for: the walkthrough returns. Open Review → tab "Saved review" → button "Saved review" to return to its briefing. Select the decision and read its original explanation and "committed" pointer. "Committed · Show code" reads current code, not a historical diff.
4. Open "Agent summary", then return through a decision row to "Walkthrough"; open "Open proof" from the briefing, then return via the Saved review document tab.
   Look for: canonical summary and proof retained. Selecting Agent summary refreshes its short-lived signed URL.
5. Open a file or Git History, then return to the Saved review tab. Reload; close and reopen the saved document again.
   Look for: the latest publication remains reachable and the last walkthrough stop is retained for this worktree.
6. Remove the pointed-at README.md in the disposable repository and read the decision again.
   Look for: original explanation and path retained, "broken pointer" and "Broken pointer · File no longer exists or the published range was empty." Current-file opening is disabled. Restore the file before other journeys.
7. Switch to another disposable worktree/project with no publication, then back.
   Look for: no saved review leaks into the other worktree; the original Saved review remains available on return. A newly published active review uses the normal Review label.

## What proves it works

- The typed read in step 2 distinguishes retained publication from hidden UI. HTTP `GET /api/worktrees/<id>/review` returns 200 JSON.
- `apps/web/spec/integration/reviews-saved-review.test.tsx` covers initial inactive publication, commit transition, canonical decision/pointer, proof, sidebar, empty-pane reopening and broken-pointer recovery against a real server and Git repository.
- Report browser reload, multiple-worktree/project and width journeys separately from the named spec. Web proof exercises the renderer shared by Electron; native bridge and macOS behavior require desktop verification.
