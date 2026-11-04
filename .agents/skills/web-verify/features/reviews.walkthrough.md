---
route: /
selectors:
  - 'Review walkthrough'
  - 'Walkthrough progress'
  - 'Open the briefing'
  - 'Briefing'
  - 'Needs your decision'
  - 'Answer the agent'
  - 'Continue at decision '
  - 'What this adds to the system'
  - 'The walkthrough'
  - 'Not explained'
  - 'Code slices'
  - 'Ask for a guard'
  - 'Mark decision reviewed'
  - 'Decision details'
  - 'Walkthrough dock'
  - 'Review completion'
  - 'Links in this page'
  - 'All changes in this revision'
  - 'Open all changes'
  - 'Back to the walkthrough'
  - 'Expand all files'
  - 'Collapse all files'
tests:
  - apps/web/spec/e2e/reviews-diff-section-layout.e2e.ts
  - apps/web/spec/e2e/reviews-header-alignment.e2e.ts
  - apps/web/spec/integration/reviews-page.test.tsx
  - apps/web/spec/integration/reviews-code-moved.test.tsx
  - apps/web/spec/integration/reviews-walkthrough.test.tsx
  - apps/web/spec/integration/reviews-briefing.test.tsx
  - apps/web/spec/integration/reviews-walkthrough-shortcuts.test.tsx
  - apps/web/spec/integration/reviews-unavailable-completion.test.tsx
  - apps/web/spec/integration/reviews-decision-pages.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
  - GET /api/reviews/:reviewId
  - GET /api/reviews/:reviewId/revisions/:revision/file
  - POST /api/reviews/:reviewId/revisions/:revision/diffs
  - GET /api/reviews/:reviewId/marks
  - PUT /api/reviews/:reviewId/marks
---

# reviews.walkthrough

The briefing walkthrough rows expose their complete lane route in the keyboard tooltip and action name.

The briefing is the first stop and the only view with the verdict. Its two-tone title uses the navigator name and the decision count sentence. A vertical spine follows published decision order, then Not explained and Specs when present; a nine-decision review with both closing stops has twelve stops. The briefing retains Git-derived file changes grouped by folder, the agent’s annotated system claims, Needs your decision, decision order and Not explained. Each decision reads code from its immutable revision. Context files and their stored excerpts remain available after worktree removal.

## How to get to it (user POV)

- Worktree Review tab → decision row; review page → Continue at decision n or a decision.
- N / P move between stops; Open the briefing returns to the overview.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Follow [reviews.page](reviews.page.md) for setup, widths, themes and lifecycle. In the worktree Review tab the sidebar decision rows open this same page. In the page, select a decision or Continue at decision n; N and P move between stops. On the latest route (`/reviews/<reviewId>`) every stop stays on that route, a decision is named by `?decision=<layerId>`, and the page never shows Loading review… between stops, even for N then P pressed at once; a revision route keeps `/reviews/<reviewId>/<revision>/decisions/<layerId>`. Open the briefing returns to owners, proof and progress; browser Back to a URL without a decision still restores the saved walkthrough place. On the briefing, a Needs your decision card's Answer the agent opens an answer box; on its decision the margin card shows the box directly, labelled Answer the agent, with "via MCP" and Send answer. Blank answers cannot be sent, posting disables submission, and the saved whole-change comment quotes the complete question and names the selected revision. The briefing collects proof; each decision also shows its own media and checks. Comments remains available in the Review panel. No floating dock appears on the briefing. A decision records its available files before its decision mark; unmarking the decision leaves file marks. Worktree edits do not change retained code or its marks. Branch commits ahead of the latest revision are reported separately.

A decision page reads "Decision n of N", the numbered title and explanation, its annotated map, decision media and the route table (lane, step, path; the path moves under the title in a narrow pane). Its margin, "Decision details", holds the Needs your decision card and compact proof checks. Each route step has one bounded code slice below the decision. Changed ranges show focused diffs; context and unavailable diffs show saved excerpts. Whole-file comments and line threads live in the retained file tab opened from the slice header.

The route begins at its first step: only that row has `aria-current="step"` and a brand-coloured, semibold number. Other changed-step numbers have a neutral outline and medium weight; context steps keep a dashed outline. Select a route row to scroll to its slice, then use the slice's Open <path> at line <n> header action to open the retained full file. Return through Back to the walkthrough. The floating "Walkthrough dock" keeps previous/next (P/N), the stop name and Mark decision reviewed. Click or focus a changed slice, then R toggles that file’s reviewed mark without clearing the decision mark. Only the active pane registers R; opening All changes or a file transfers shortcuts to that document. Retained files keep their code navigation and comment shortcuts.

Not explained and Specs form one closing page. Its "Review completion" card shows Decisions reviewed independently of Agent recommendation (Merge or Hold for the selected revision), Published proof (passing/failing check counts and Not proven), and remaining files. It never derives merge approval from marks or the agent recommendation. The review list groups complete decision marks as Decisions reviewed regardless of the recommendation or proof, while retaining those badges separately. It lists what is still open (its Comments row counts every open thread, waiting on the agent or on you, from the same list as the Review panel beside it: the worktree's in the branch Review tab, the review's on `/reviews/<reviewId>`), and offers Ask the agent (a whole-change comment), Merge on GitHub while the linked pull request is open and Archive once it is merged or closed. The dock reads "Mark n files reviewed" for the current section's unreviewed files.

The Agent summary view shows a credit line with the revision, a Sandboxed chip and the sandboxed frame; its margin explains the sandbox and lists "Links in this page" (each `#layer-N` link, a missing decision disabled). Opening it after the signed link has expired fetches a fresh link first (the frame shows a loading state meanwhile), so the page never goes blank; if the fresh read fails, the view shows Could not display with Try again. Branch moved and proof stale share one notice shape; code moved shows as a chip beside "Decision n of N". A missing revision offers "Open rN, the latest".

Automated coverage: `reviews-walkthrough.test.tsx`, `reviews-walkthrough-shortcuts.test.tsx`, `reviews-page.test.tsx`, `reviews-unavailable-completion.test.tsx`, `reviews-decision-pages.test.tsx`.

Publish a review, then edit a line its decision explains in the live worktree. The latest review shows the soft amber "Code moved since it was explained" Badge on that decision and "1 decision has code moved" in the briefing (plural for several). The sidebar decision row also says "code moved". Restoring the explained text clears the warning. Retained code, locations and fingerprints stay at publication; older revisions and a latest review whose worktree changed branches omit the comparison. Deleting the explained file counts as moved. Merely shifting unchanged explained lines does not.

## Flat published changes and return

The presentation tabs always offer Walkthrough and All changes; Agent summary appears only when published. In the standalone Review sidebar, the Changed files chevron still expands the complete file list. Its adjacent Open all changes button opens the same flat presentation, replacing that group's redundant expand/collapse menu. Other sidebar groups retain their menus.

1. Open an older revision, enter a decision and scroll its code. Choose tab All changes, or open the standalone Review panel and use Open all changes.
2. Expect region All changes in this revision with the selected revision number/head, every published file including specs/deletions (Read more files pages the list), retained file marks and comments. Decision explanations are omitted. Later worktree edits and newer publications must not replace these diffs. Repeat after removing the disposable publishing checkout.
3. Use Back to the walkthrough or tab Walkthrough. The same decision and scroll position return. A retained file tab still returns by its banner, Review tab, Alt+Left or closing the file. Flat view keyboard shortcuts act on its visible diff only.
4. The flat document retains per-file Comment, change counts and reviewed controls. Expand all files / Collapse all files sits above the document, outside any individual file header. Long paths truncate without hiding controls. Cold code reads show a labelled placeholder without hiding the decision title. Return to a decision to check its slice headers separately: all seven open-file actions and six changed-file marks fit their cards at 800, 1440, 1080, 721, 720, 414 and 320 px.
5. At desktop width, standalone reviews use the right rail for Review; the duplicate pane-bar toggle is absent. At phone width the pane-bar Review button opens the sheet. Check Escape/focus return and all tabs at 414 in light/dark.

## Gotchas

- Retained published code intentionally differs from later worktree edits; compare against the selected revision.

### Independent completion meanings

Finish every decision in a publication whose agent recommends Merge but has a failed check and an unexplained file. The completion header says Decisions reviewed and the review list group says Decisions reviewed; the Agent recommendation section says Merge, Published proof retains the failure, and Still open retains the remaining file. No Ready to merge label appears. Repeat Hold, missing proof and a changed revision; none becomes an approval. GitHub checks in the PR document remain separate from agent-published proof.

## Code slice layout

With Unified and Wrap selected in General settings, open a multi-step decision with long paths and wrapped code. Each slice has its own card and bounded code viewport; cards remain separate at 1080, 800, 1440 and 414 px. The saved context excerpt remains readable after checkout removal. Open a slice header and verify the retained file tab, then return to the same decision. Use Ask for a guard to save a quoted path/range request through the standard feedback batch.

## Closing page layout

Publish a review with long explained paths and short and long lists of uncovered ranges. In Not explained, each path in Unexplained lines in explained files stays on one line, truncates with an ellipsis when needed, and retains its complete title. Ranges and Read in links occupy subsequent rows. Drive 1440, 1080, 768 and 414 widths; follow Read in to its decision and return. Scroll to the end: the final file control and completion actions must clear the Walkthrough dock and remain clickable. The sibling unexplained-files and Specs code lists retain their own file headers and controls.

Automated coverage: `apps/web/spec/e2e/reviews-closing-layout.e2e.ts`.
