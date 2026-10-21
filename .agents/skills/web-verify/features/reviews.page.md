---
route: /reviews/$reviewId
selectors:
  - "Review walkthrough"
  - "Review revisions"
  - "Asked"
  - "Recommendation"
  - "Not proven"
  - "Removed"
  - "Start here · "
  - "Review actions"
  - "Close review"
  - "Delete review"
  - "Delete review?"
  - "Review comments"
  - "Comment on this review"
tests:
  - apps/web/spec/integration/reviews-page.test.tsx
  - apps/web/spec/integration/reviews-summary.test.tsx
api:
  - GET /api/reviews/:reviewId
  - GET /api/projects/:projectId/reviews
  - PUT /api/reviews/:reviewId/seen
  - GET /api/reviews/:reviewId/marks
  - PUT /api/reviews/:reviewId/marks
  - POST /api/reviews/:reviewId/marks/removal
  - GET /api/reviews/:reviewId/comments
  - POST /api/reviews/:reviewId/comments
  - PATCH /api/reviews/:reviewId
  - DELETE /api/reviews/:reviewId
---

# reviews.page

One page owns the latest durable route, numbered revisions, decision links and the worktree's branch Review tab. The navigator has one status-grouped Reviews list across projects and environments; closed reviews are behind Closed. The verdict comes before the briefing, decisions, Not explained and proof. Deleted files come from Git's revision inventory and have a red frame.

## Drive it

Check `free -g` before startup. Start one disposable instance and retain the connection card. Run `$C agent publish-revision 'Retain the committed revision after removing the publishing checkout'` twice. Each command commits on an owned fixture worktree and publishes through MCP, returning reviewId, revision, headOid, layerId and worktree. Keep both responses. The fixture has a deletion, a long decision title, passing and failing checks, and an explicit desktop gap.

1. In a fresh unpaired browser, open `/reviews/<reviewId>?decision=<layerId>`. Expect `/pair` and "This browser is not paired". Redeem the card's fresh pairing link in the same tab. Expect the original route and its latest decision, with the pairing fragment consumed.
2. Open `/reviews/<reviewId>`. Check the verdict order: identity and revisions, Asked, Recommendation, Proven at the short head SHA, Not proven, Removed and Start here. The removal frame names `retired.ts` and its behavior and reason. The proof keeps its failing check first. Not proven names Desktop app and Mac is off.
3. Open the project navigator and its unified Reviews list. Its entry opens this same page. The worktree's Review tab opens its current branch review using this same component; run `$C agent advance-review-branch` and expect "The branch tip differs from this review. Publish a revision to include it." Exact newer-commit counts need a contract that accepts the retained revision SHA as the comparison base; the current branch-changes base accepts branch refs only.
4. Select r1, r2 and latest. The SHA and committed code follow the selected revision. Open the first decision with Start here. Its code uses the revision file/diffs endpoints, and each pointer opens the retained full file.
5. Use `$C agent remove-review-worktree`, reload each route, and check that verdict, explanations, code and proof remain readable. This removes only the fixture worktree created by publish-revision.
6. Mark a decision reviewed. Inspect PUT `/api/reviews/<id>/marks` and GET of the same endpoint: its files and decision are review-owned. Unmarking a decision keeps file marks. A file toggle changes the completion indicator without removing the decision mark.
7. Open Comments, then Comment on this review. Post a comment. Independently read the review comments endpoint: the thread names this review, revision and head OID. Reply and resolve through the thread controls.
8. Review actions → Close review. The closed review stays readable. Its menu has Delete review and no Reopen. Delete review opens a confirmation covering every revision and its owned proof, comments and marks. Cancel keeps it; Delete removes it and returns to the workspace.
9. Open an unknown review, revision and decision. A missing review/revision has a clear state and Back to workspace. An absent decision shows the briefing and a note explaining that the decision is not in this revision.
10. The publish-revision fixture omits summary HTML: expect no Agent summary tab, including after checkout removal. With `$C agent publish-review 'Optional summary' --summary-html '   '`, expect no tab either. Publish authored HTML with `--summary-html '<h1>Extra context</h1>'`: expect Agent summary to open its sandboxed page. The endpoint's injected theme/link bridge does not count as agent content.
11. Through desktop-verify's native app, repeat with another paired computer's authored summary. Both visibility detection and the iframe use the same app summary proxy; the visibility read must not send an authenticated CORS request to the remote signed-summary endpoint. The browser desktop-mode regression supplies that host port through its kit; `start --desktop` alone supplies views without the native proxy. The regression journeys are `apps/web/spec/e2e/projects-remote-workspace.desktop.e2e.ts` and `apps/desktop/spec/e2e/review-summaries.e2e.ts`.

Drive at 390 × 844 and 1280 × 800, light and dark. Check long branch names, revision controls, links, deletion paths, menus, comment controls and the wrapping Start/Continue button for overflow. Publish a decision containing a long unbroken filename as well as prose: Start here must keep its label inside the viewport and retain the full decision title in its accessible name. Scroll the complete button into view before retaining phone light/dark screenshots. Electron bridge and macOS behavior require desktop-verify; this web run does not prove them.
