---
route: /reviews/$reviewId
selectors:
  - 'Review walkthrough'
  - 'Review revisions'
  - 'You asked'
  - 'Recommendation'
  - 'Not proven'
  - 'Removed'
  - 'Continue at decision '
  - 'Close review'
  - 'Delete review…'
  - 'Delete review?'
  - 'Side panel'
  - 'Review sidebar'
  - 'Comment on the whole branch'
  - 'Try again'
tests:
  - apps/web/spec/integration/reviews-page.test.tsx
  - apps/web/spec/integration/reviews-summary.test.tsx
  - apps/web/spec/integration/reviews-briefing.test.tsx
  - apps/web/spec/integration/reviews-panel.test.tsx
  - apps/web/spec/e2e/reviews-live-refresh.e2e.ts
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

One page owns the latest durable route, numbered revisions, decision links and the worktree's branch Review tab.

## How to get to it (user POV)

- Navigator Reviews list; worktree branch Review tab.
- `/reviews/<reviewId>`, numbered revision routes and `?decision=<layerId>` links.

## Driving it with browser

Preconditions: [surface baseline](README.md).

The navigator has one status-grouped Reviews list across projects and environments; closed reviews are behind Closed. The briefing owns the verdict, proof and review details. Wide proof places checks beside media; Removed aligns with owners and Not proven with proof. Decision, Not explained and summary views do not repeat the verdict. The page has one pane bar and no separate Proof view; Readiness checks open the briefing. Back to workspace and the review state remain in the briefing margin. The page's own Review panel holds Readiness, Changed files and Comments: at 1280px and wider it docks beside the page with a rail (button "Review", `Alt+2`; `Alt+Shift+R` hides or shows it); below 1280px button "Review" in the bar opens it as a sheet. Inside a worktree the branch Review tab uses the worktree's own panel instead. In both panels an expanded decision's steps, and on the review page the Changed files rows, start their accessible names with the file's review state, "Not reviewed" or "Reviewed" (for example "Not reviewed 1 Read the retained revision"), shown as a dot or a check. Deleted paths and their behavior and reason appear in the briefing margin; at narrow widths each margin section follows its matching content.

Check `free -g` before startup. Start one disposable instance and retain the connection card. Run `$C agent publish-revision 'Retain the committed revision after removing the publishing checkout'` twice. Each command commits on an owned fixture worktree and publishes through MCP, returning reviewId, revision, headOid, layerId and worktree. Keep both responses. The fixture has a deletion, a long decision title, passing and failing checks, and an explicit desktop gap.

1. In a fresh unpaired browser, open `/reviews/<reviewId>?decision=<layerId>`. Expect `/pair` and "This browser is not paired". Redeem the card's fresh pairing link in the same tab. Expect the original route and its latest decision, with the pairing fragment consumed.
2. Open `/reviews/<reviewId>`. Check the briefing order: two-tone title, You asked and links, Recommendation, Continue at decision n, Needs your decision, What this adds, Proven at the short head SHA, and The walkthrough. The margin holds revisions, branch/head, Close review, Delete review…, Removed and Not proven. The removed group names `retired.ts` and its behavior and reason. The proof keeps its failing check first. Not proven names Desktop app and Mac is off.
3. Open the project navigator and its unified Reviews list. Its entry opens this same page. The worktree's Review tab opens its current branch review using this same component; run `$C agent advance-review-branch` and expect "The branch tip differs from this review." with "Publish a revision to include it." beneath it. Exact newer-commit counts need a contract that accepts the retained revision SHA as the comparison base; the current branch-changes base accepts branch refs only.
4. In the margin's Revisions rows (newest first, the latest with a dot and "Latest", each with its age), select r1, then the latest row. The SHA and committed code follow the selected revision. Open the first decision with Continue at decision 1. Return with Open the briefing before selecting revisions. Its code uses the revision file/diffs endpoints, and each pointer opens the retained full file.
5. On a decision, comment on `review-page.ts` from its code; in the Review panel's Comments tab use "Comment on the whole branch". Use `$C agent remove-review-worktree`, reload each route, and check that verdict, explanations, code and proof remain readable, and that the Review panel's Comments tab still lists both threads; reply to one and resolve the other. This removes only the fixture worktree created by publish-revision.
6. Mark a decision reviewed. Inspect PUT `/api/reviews/<id>/marks` and GET of the same endpoint: its files and decision are review-owned. Unmarking a decision keeps file marks. A file toggle changes the completion indicator without removing the decision mark.
7. On the briefing, choose Close review. The closed review stays readable. The margin keeps Delete review… and removes Close review. Delete review… opens a confirmation covering every revision and its owned proof, comments and marks. Cancel keeps it; Delete removes it and returns to the workspace.
8. Open an unknown review, revision and decision. A missing review/revision has a clear state and Back to workspace. An absent decision shows the briefing and a note explaining that the decision is not in this revision.
9. The publish-revision fixture omits summary HTML: expect no Agent summary tab, including after checkout removal. With `$C agent publish-review 'Optional summary' --summary-html '   '`, expect no tab either. Publish authored HTML with `--summary-html '<h1>Extra context</h1>'`: expect Agent summary to open its sandboxed page. The endpoint's injected theme/link bridge does not count as agent content.
10. In the disposable native app, repeat with a paired computer’s authored summary: it renders and opens its decision without an authenticated cross-origin summary request. `start --desktop` supplies views only; native summary proxy proof requires desktop verification.

Opening an unseen revision records it once per connection epoch. If that acknowledgement fails, the review remains readable and an inline alert offers Try again; retry is disabled while pending and clears the alert on success. Reconnect rechecks canonical seen state without repeating an acknowledged write.

Drive at 414 × 896 and 1440 × 900, light and dark. Check long branch names, revision controls, links, deletion paths, menus, comment controls and the wrapping Continue button for overflow. Publish a decision containing a long unbroken filename as well as prose: The title and walkthrough row must retain the full decision text; the Continue at decision n button must fit the viewport. Scroll the complete button into view before retaining phone light/dark screenshots. Electron bridge and macOS behavior require desktop-verify; this web run does not prove them.

Automated coverage: `reviews-page.test.tsx`, `reviews-summary.test.tsx`.

## Gotchas

- Summary links expire shortly after reading; a late frame needs a full reload. Native remote summary proof is separate from desktop-mode web views.
