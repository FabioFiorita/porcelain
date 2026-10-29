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
  - 'Pull request'
  - 'Link pull request'
  - 'Pull request actions'
  - 'Pull request link'
  - 'Open pull request'
  - 'Open on GitHub'
  - 'Close review'
  - 'Delete review…'
  - 'Delete review?'
  - 'Side panel'
  - 'Review sidebar'
  - 'Comment on the whole branch'
  - 'Try again'
tests:
  - apps/web/spec/integration/reviews-file-tabs.test.tsx
  - apps/web/spec/integration/reviews-page.test.tsx
  - apps/web/spec/integration/reviews-summary.test.tsx
  - apps/web/spec/integration/reviews-briefing.test.tsx
  - apps/web/spec/integration/reviews-panel.test.tsx
  - apps/web/spec/e2e/reviews-live-refresh.e2e.ts
  - apps/web/spec/e2e/reviews-summary-link.e2e.ts
api:
  - GET /api/reviews/:reviewId
  - GET /api/projects/:projectId/reviews
  - PUT /api/reviews/:reviewId/seen
  - GET /api/reviews/:reviewId/marks
  - PUT /api/reviews/:reviewId/marks
  - POST /api/reviews/:reviewId/marks/removal
  - GET /api/reviews/:reviewId/comments
  - POST /api/reviews/:reviewId/comments
  - GET /api/reviews/:reviewId/pull-request
  - PUT /api/reviews/:reviewId/pull-request
  - GET /api/projects/:projectId/pull-requests
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

The navigator has one status-grouped Reviews list across projects and environments; closed reviews are behind Closed. The briefing owns the verdict, proof and review details. Wide proof places checks beside media; Removed aligns with owners and Not proven with proof. Decision, Not explained and summary views do not repeat the verdict. The page has one pane bar and no separate Proof view; Readiness checks open the briefing. Back to workspace and the review state remain in the briefing margin. The page's own Review panel holds Readiness, Changed files and Comments: at 1280px and wider it docks beside the page with a rail (button "Review", `Alt+2`; `Alt+Shift+R` hides or shows it); below 1280px button "Review" in the bar opens it as a sheet. Inside a worktree the branch Review tab uses the worktree's own panel instead. In both panels the walkthrough lists the decisions (a filled check once reviewed), then "Not explained", "All changes" and "Open all specs"; the expanded decision's steps each pair checkbox "<path> reviewed", which marks or unmarks that file, with a button named by the step number and title (for example "1 Read the retained revision"). On the review page the Changed files rows start their accessible names with the file's review state, "Not reviewed" or "Reviewed", shown as a dot or a check. While Explore is shown, the panel header holds an icon button "Comment on the whole change" ("Comment on the whole branch" on the Branch tab and on the review page) that switches to Comments and opens the composer; inside Comments the composer's own button takes its place. Deleted paths and their behavior and reason appear in the briefing margin; at narrow widths each margin section follows its matching content.

Check `free -g` before startup. Start one disposable instance and retain the connection card. Run `$C agent publish-revision 'Retain the committed revision after removing the publishing checkout'` twice. Each command commits on an owned fixture worktree and publishes through MCP, returning reviewId, revision, headOid, layerId and worktree. Keep both responses. The fixture has a deletion, a long decision title, passing and failing checks, and an explicit desktop gap.

1. In a fresh unpaired browser, open `/reviews/<reviewId>?decision=<layerId>`. Expect `/pair` and "This browser is not paired". Redeem the card's fresh pairing link in the same tab. Expect the original route and its latest decision, with the pairing fragment consumed.
2. Open `/reviews/<reviewId>`. Check the briefing order: two-tone title, You asked and links, Recommendation, Continue at decision n, Needs your decision, What this adds, Proven at the short head SHA, and The walkthrough. The margin holds revisions, branch/head, Close review, Delete review…, Removed and Not proven. The removed group names `retired.ts` and its behavior and reason. The proof keeps its failing check first. Not proven names Desktop app and Mac is off.
3. Open the project navigator and its unified Reviews list. Its entry opens this same page. The worktree's Review tab opens its current branch review using this same component; run `$C agent advance-review-branch` and expect "The branch tip differs from this review." with "Publish a revision to include it." beneath it. At 414 and 1440 in light and dark, the complete notice heading wraps without ellipsis or clipping. Exact newer-commit counts need a contract that accepts the retained revision SHA as the comparison base; the current branch-changes base accepts branch refs only.
4. In the margin's Revisions rows (newest first, the latest with a dot and "Latest", each with its age), select r1, then the latest row. The SHA and committed code follow the selected revision. Open the first decision with Continue at decision 1. Return with Open the briefing before selecting revisions. Its code uses the revision file/diffs endpoints, and each pointer opens the retained full file.
5. On a decision, comment on `review-page.ts` from its code; in the Review panel's Comments tab use "Comment on the whole branch". Use `$C agent remove-review-worktree`, reload each route, and check that verdict, explanations, code and proof remain readable, and that the Review panel's Comments tab still lists both threads; reply to one and resolve the other. This removes only the fixture worktree created by publish-revision.
6. Mark a decision reviewed. Inspect PUT `/api/reviews/<id>/marks` and GET of the same endpoint: its files and decision are review-owned. Unmarking a decision keeps file marks. A file toggle changes the completion indicator without removing the decision mark.
7. On the briefing, choose Close review. The closed review stays readable. The margin keeps Delete review… and removes Close review. Delete review… opens a confirmation covering every revision and its owned proof, comments and marks. Cancel keeps it; Delete removes it and returns to the workspace.
8. Open an unknown review, revision and decision. A missing review/revision has a clear state and Back to workspace. An absent decision shows the briefing and a note explaining that the decision is not in this revision.
9. The publish-revision fixture omits summary HTML: expect no Agent summary tab, including after checkout removal. With `$C agent publish-review 'Optional summary' --summary-html '   '`, expect no tab either. Publish authored HTML with `--summary-html '<h1>Extra context</h1>'`: expect Agent summary to open its sandboxed page. The endpoint's injected theme/link bridge does not count as agent content.
10. In the disposable native app, repeat with a paired computer’s authored summary: it renders and opens its decision without an authenticated cross-origin summary request. `start --desktop` supplies views only; native summary proxy proof requires desktop verification.

Opening an unseen revision records it once per connection epoch. If that acknowledgement fails, the review remains readable and an inline alert offers Try again; retry is disabled while pending and clears the alert on success. Reconnect rechecks canonical seen state without repeating an acknowledged write.

If a live review refresh fails after a new publication, keep the last loaded revision readable and show "This review could not be refreshed. Showing the last loaded revision." with Try again. Restore the read, retry, and expect the latest revision with the warning cleared. While renewing an expired Agent summary link, its existing fresh-link error owns the retry instead of showing a second alert.

Drive at 414 × 896 and 1440 × 900, light and dark. Check long branch names, revision controls, links, deletion paths, menus, comment controls and the wrapping Continue button for overflow. Publish a decision containing a long unbroken filename as well as prose: The title and walkthrough row must retain the full decision text; the Continue at decision n button must fit the viewport. Scroll the complete button into view before retaining phone light/dark screenshots. Electron bridge and macOS behavior require desktop-verify; this web run does not prove them.

Automated coverage: `reviews-page.test.tsx`, `reviews-summary.test.tsx`.

## Gotchas

- Opening Agent summary after its signed link expires requests a fresh link before mounting the frame. A failed refresh shows Could not display with Try again. Native remote summary proof is separate from desktop-mode web views.

## Pull request linking

The review's first row has a PR chip, and the top of the Review panel has the PR block. The chip opens the PR tab when linked, or the Review panel when linking or recovery is needed. The panel finds open pull requests for this branch from the project's list. Select Link to this review on a found PR, or paste its URL in Pull request link and select Link (accessible name Link pull request). A PR held by another open review names that review and explains how to unlink it there first. A different repository or branch and an unknown PR are refused without changing this review. A repository without a GitHub remote shows neither chip nor block. After linking or unlinking by keyboard, focus returns to Pull request actions or Pull request link. Malformed input replaces any earlier failure; pending writes disable repeat submissions.

Check the eight drawn states (the state badge shows Open with the add colours, Draft with muted colours, Merged with brand colours and Closed with delete colours; Draft applies only to an open pull request, so a merged or closed draft keeps its terminal state): not linked with no match, found for this branch, linked open, draft, head differs, GitHub unavailable, merged and closed. The block says 12 checks passed, names both heads when they differ, and explains that merged or closed reviews remain readable under Closed. Open pull request opens a PR tab, in the worktree and on standalone review routes. The tab shows its title/state, author, base and head branches, labels, description, read-only conversation with review states and file links, and GitHub checks with durations and Details links. Back to the review returns to the review; Open on GitHub opens the external PR. Removed or changed links cannot leave a different PR under an old tab's number.

Pull request actions opens a menu with Open on GitHub, Copy link and Unlink #n. Unlink works while GitHub is unreachable, preserves review/revisions and keeps closed reviews closed. GitHub unavailable explains each reason: Choose an account opens Settings → Reviews & Git; How to install opens the GitHub CLI site; Copy gh auth login copies the sign-in command; Try again retries transient failures. A transport failure offers Try again and never claims checks passed from retained data. Drive long titles/branches, empty/many/truncated checks and conversation, request failures/recovery, 1440/1080/414 light and dark. Phone native keeps its existing linked block and Unlink; device verification is separate.

## File tabs retain the walkthrough

A path on a decision's route opens a retained file tab beside Review. The banner reads `Part of the review · Decision n, stop m · <stop title>` and offers `Back to the walkthrough`. The Review chip remains visible, including when file controls arrive or several documents are open. Opening the same retained path again selects its existing tab. Review, the banner, previous-tab and close-tab shortcuts return to the same decision and scroll. The retained file follows the selected revision, including after the publishing worktree disappears. Open-to-side uses the existing pane layout; each pane has its own document controls and Git appears once.

File headers use a mono breadcrumb with a medium-weight filename, change status and deletion/addition counts when a textual comparison is available. Header actions stay on one row and use named, tooltip-labelled icons in narrow panes. Added lines have a change bar. File comment markers expand their threads; an agent reply is named on the marker. Ordinary Files tabs retain editing and preview behavior without a review-origin banner.

Automated coverage: `reviews-file-tabs.test.tsx`, plus `reviews-pane-bar.test.tsx` for the shared tab shell.
