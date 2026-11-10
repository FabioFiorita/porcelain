---
screen: /review
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'Review'
  - 'Select a worktree'
  - 'No changes'
  - 'Changed files'
  - 'review-all-changes'
  - 'review-comments'
  - 'You asked'
  - 'Try it'
  - 'Asked, built, left'
  - 'The walkthrough'
  - 'Continue at decision'
  - 'Read agent summary'
  - 'Refresh review'
  - 'No agent review'
  - 'No walkthrough decisions'
  - 'Review progress is unavailable.'
  - 'Needs your decision'
  - 'Answer'
  - 'Pull request'
  - 'Read pull request again'
  - 'Uncommitted'
  - 'Reading branches…'
  - 'Refreshing branches…'
  - 'Base branches could not be read.'
  - 'No base branches available.'
  - 'Read branches again'
  - 'Open pull request'
  - 'Unlink pull request'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/features/reviews/rules/pointer-source.spec.ts
  - packages/client/src/features/reviews/queries/publication.spec.ts
  - packages/client/src/features/reviews/commands/decisions.spec.ts
  - packages/client/src/features/reviews/commands/project-reviews.spec.ts
  - apps/mobile/src/features/reviews/store.spec.ts
  - packages/client/src/features/reviews/rules/revision.spec.ts
  - packages/client/src/features/reviews/rules/walkthrough.spec.ts
  - apps/mobile/src/features/reviews/rules/briefing.spec.ts
  - apps/mobile/src/features/workspace/rules/thread-folds.spec.ts
  - apps/mobile/src/features/workspace/reading-place.spec.ts
  - apps/mobile/src/shared/application/document-reading.spec.ts
api:
  - GET /api/worktrees/:worktreeId/text
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/review
  - GET /api/reviews/:reviewId
  - GET /api/reviews/:reviewId/marks
  - PUT /api/reviews/:reviewId/marks
  - POST /api/reviews/:reviewId/marks/removal
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/reviewed
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/reviews/:reviewId/revisions/:revision/diffs
  - GET /api/reviews/:reviewId/pull-request
  - PUT /api/reviews/:reviewId/pull-request
---

# reviews.review

Review is the overview of the selected worktree: the agent's published briefing and walkthrough, the review's Comments, and the Changed files list with independent Uncommitted and Branch comparisons. The list's first row, All changes, opens [every diff as one page](reviews.all-changes.md) for the chosen comparison. Each walkthrough stop opens its own [Decision](reviews.decision.md) screen.

## How to get to it (user POV)

- Reviews tab → a published review. The Worktree page's Changes (a segment, or the [Changes list](projects.worktree-changes.md) a walkthrough opens) keeps the Comments and Changed files parts but no longer shows the published overview; the [Walkthrough](reviews.walkthrough-page.md) replaces it there.
- `porcelain.dev://review` for the selected worktree; Reviews remains the default launch destination.

## Driving it with agent-device

Preconditions: [surface baseline](README.md). Use the [bounded document gesture](../references/driving.md#scroll-the-review-document), verifying tablets in landscape and portrait with fresh bounds after rotation.

1. With no worktree (`porcelain.dev://review`) expect Select a worktree with Choose a worktree in Worktrees to continue to Review. Pair/select the focused sample in Worktrees, open Review; expect Review README.md. Open it, then Back returns. Comments → Close (iOS sheet X, Android Back) returns to the same screen. The opaque header keeps content from sliding under it on iOS 26.
2. Expect a visible, naturally sized Uncommitted menu beside the Changed files heading, below the walkthrough. An ordinary tap opens the menu on Android and iOS; dismiss with Back/outside and reopen. Choose Branch, an explicit local/remote base, then Uncommitted: every choice closes the menu, the Branch trigger names its actual base, and the file set matches that comparison. Long base names/many choices and larger text must remain reachable without horizontal page overflow. Check tablets in landscape and portrait. Open a changed file: it captures that comparison. Switch worktrees/back: each restores its comparison.
3. A cold base read says Reading branches; an in-flight refresh says Refreshing branches while retaining available choices. Uncommitted and default Branch remain available. A successful empty list says No base branches available; a refused read says Base branches could not be read and offers Read branches again. For refusal proof, keep the workspace selected and refuse only GET /api/worktrees/:worktreeId/branch-bases in the disposable transport; record the injection used. Restore that read and select Read branches again: the choices recover. Moving .git tests workspace availability instead and does not prove this isolated retry. Do not interpret an error as an empty list.
4. Scroll a many-file list, open a diff and return: same comparison and list offset. Switch to Files or History in the Worktree page and return, then another worktree and back. Added/untracked dots are green, modified amber, deleted red, renamed blue; accessible rows are named `Review <full path>, <change type>, <comparison note>, <review state>`. Reviewed names have strikethrough; unreviewed/changed-since-review names remain normal. Independently change content: live list/marks update, prior fingerprint becomes Changed since review, clean worktree says No changes. Closed/hidden navigators release their live reads; returning performs a fresh read without losing comparison/place.
5. Stop/revoke the fixture: error/unavailable state permits no old-workspace writes. Recover through Read again. Switch to Files in the Worktree page and back, then cold-launch through Metro: selected workspace stays.

### Overview and walkthrough

Precondition: `--fixture development`. Expect decisions in publication order: Keep document holds visible; Filter completed deliveries; Explain the dispatch handoff.

1. The overview is one scrolling page under the native Review title: the asked title with branch and revision, progress, agent feedback status, pull request, the briefing, The walkthrough as numbered rows (a reviewed stop shows a check), Agent summary, Comments with its open count, then Changed files. Each walkthrough row pushes its [Decision](reviews.decision.md) screen; native Back returns to the overview at the same scroll place. Agent summary (`review-summary`) pushes the [summary](reviews.summary.md).
2. Refresh review in the header retries the publication. Switch worktrees/back: the overview restores its comparison and scroll place. A new revision lists its own decisions; Branch/Uncommitted remain independent. No publication says No agent review above the changed files; no decisions says No walkthrough decisions. Loading/failure shows state/Read again.
3. Fail/hold changed-file reads: the published walkthrough remains usable, with separate loading/error and Read again under Changed files. Unknown coverage cannot look empty. Missing worktree shows saved-review diagnostics and disables code pointers.

### Phone briefing

1. Open a committed review with a verdict. The native title is Briefing; Recommendation (Merge or Hold) and every reason precede You asked and its links. Needs your decision shows the problem and opens the connected decision. Owners use the shared New, Changed and Removed classification and only linked owners are tappable.
2. Expect one Proven at the seven-character published head card, failed checks before passing checks, optional output, and a stale-check notice after edits. No checks/assets says No proof was published. Open image proof: retained bytes render; hide it and reopen. A failed asset read offers Read again. Link assets open externally; videos explicitly open the exact published revision in the browser.
3. Removed lists actual deleted paths with behavior and reason; Not proven lists every gap or says none were reported. The walkthrough lists decisions in publication order, then Not explained (including partial coverage), then Specs when present. No publication, no decisions and legacy verdict-free reviews retain their explicit empty states.
4. Repeat Merge, Hold with a question, image proof with a removed file and Not proven, and a long title in Android light/dark. Check full accessible names, many entries and larger text. Compare with v0.71.1: Asked, Recommendation, Proven, Removed and assets were absent from its worktree briefing. iOS, physical LAN and remote connections require separate proof.

### Linked pull request

1. Give the fixture repository a GitHub `origin`, put a fake `gh` in the server manifest's `bin` that answers from a state file, and link the published review to a PR for its branch with `PUT /api/reviews/:reviewId/pull-request`. The briefing (and the `/reviews/[reviewId]` screen) shows Pull request with `#n title`, Open/Draft/Merged/Closed with the checks summary, and either Same head as the review, both full SHAs when GitHub is newer, or This review is closed and remains readable.
2. Change the fake PR and select Read pull request again: the new state replaces the old one. Make `gh` fail (offline, rate limit, HTTP 404, invalid JSON, no accounts, missing `gh`, non-GitHub origin): the linked URL stays with the matching reason and Read pull request again recovers.
3. Open pull request opens the scoped native [PR document](reviews.pull-request.md), keeping the selected checkout/computer and the way back. Open on GitHub is the explicit external action inside that document.
4. Unlink pull request, including while GitHub is offline and on a closed review: the button shows busy and disables while pending, the block disappears, and the server review keeps its id, revision, branch and open/closed state without a pull request. Linking is not offered on the phone; it says to link from the web or desktop app.

Automated coverage: `workspace-selection.spec.ts`, `pointer-source.spec.ts`, `publication.spec.ts`, `decisions.spec.ts`, `walkthrough.spec.ts`.

## Gotchas

- Pointer code can differ from retained excerpts: broken pointers explain unavailability; moved snippets warn and are not highlighted as current. Changed-file diffs are separate.
- Phones and tablets push the same routes; verify tablets in landscape and portrait, and rotate with a decision open.
- The development fixture commits before publication and requires a verdict; optional proof uses pass/fail. Signed summary HTML is outside the `/api/` frontmatter format.
- Shared inventory recovery is in [Worktrees](projects.worktrees.md#driving-it-with-agent-device).

### Published progress versus live comparisons

Publish a committed eight-file review with one unrelated uncommitted file. The workspace walkthrough, bottom Continue/decision bar and Worktree page Changes must use the same selected revision files and durable marks, including removed files. Mark its first decision and independently read every owned published blob mark followed by its decision mark; no worktree reviewed-file write occurs. Commit or dirty the checkout without republishing: publication progress stays the same. Publish changed excerpt bytes: changed decision becomes unfinished, unchanged marks remain readable. Not explained and Specs render the selected revision diffs and durable file controls; live Uncommitted/Branch changed-file lists retain their separate comparison controls and marks. Respect the computer's Spec files setting for ownership allocation. Failed/pending reads never appear complete; a partial refused write retains successful marks without advancing. Leave the view before a delayed successful write: persistence completes but navigation stays where the reader went. Retained linked screens remain read-only.

## Optional handoff fields

When the publication includes verdict.tryIt, its preview button, labelled sign-in instructions and numbered click steps precede the verdict. Opening the preview uses the external-link adapter; an open failure stays readable with an error. Verdict.coverage renders Asked, Built and Left per row. Completed rows say Complete; remaining work names its ticket or teammate, or explicitly says Nobody owns this yet. A drafted message is displayed for the developer to send. Old reviews omit these blocks. Verify phone and tablet layouts with long prose, including both tablet orientations.
