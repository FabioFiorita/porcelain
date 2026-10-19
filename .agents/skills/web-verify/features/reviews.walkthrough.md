---
route: /
selectors:
  - "Review"
  - "Worktree review"
  - "Review walkthrough"
  - "Walkthrough"
  - "Agent summary"
  - "Review summary"
  - "Walkthrough progress"
  - "Open the briefing"
  - "Briefing"
  - "Files reviewed"
  - "Decisions reviewed"
  - "Needs attention"
  - "Start with"
  - "Continue with"
  - "What this adds to the system"
  - "Needs your decision · "
  - "The walkthrough"
  - "Evidence"
  - "Open proof"
  - "Walkthrough stop"
  - "Previous: "
  - "Next: "
  - "Collapse all"
  - "Route through the system"
  - "Connections"
  - "Go to step "
  - "Agent note"
  - "Not explained"
  - "Also changes"
  - "Existing code it relies on"
  - "Unexplained lines in explained files"
  - "Read in "
  - "Mark reviewed and continue"
  - "Mark reviewed and finish"
  - "Mark available files reviewed"
  - "Review unavailable"
  - "Continue"
  - "Back to the briefing"
  - "Changed files"
tests:
  - apps/web/spec/integration/reviews-walkthrough.test.tsx
  - apps/web/spec/integration/reviews-walkthrough-shortcuts.test.tsx
  - apps/web/spec/integration/reviews-unavailable-completion.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/reviewed
  - GET /api/worktrees/:worktreeId/reviewed-layers
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
  - PUT /api/worktrees/:worktreeId/reviewed-layers
---

# reviews.walkthrough

## What it is

Once the agent publishes a review, the handoff tab "Review" shows one document, the walkthrough. It starts with a briefing, then has one stop per decision, then "Not explained" (only when something is unexplained), then "Specs" (only when the Spec files setting is on). Every changed file belongs to exactly one stop. A file that several decisions point at is shown in the first of them; later decisions list it under "Also changes … · shown in decision m". Each decision stop shows the complete diffs of its files with the agent's numbered notes and amber notes on lines no step explains, then the existing code the decision relies on.

## How a user reaches it

- The handoff tab "Review" (hint and tab title "Walkthrough of the decisions"), or the empty pane's "Open review".
- Review (sheet at phone width, dialog "Worktree review") → tab "Review" → "Explore" → nav "Walkthrough": rows "Briefing", one per decision (its number or a green check, title, `x/y` files), "Not explained · <label>", "Specs", "Proof · <label>" and "All changes · N files", then "Changed files". A decision row's accessible name reads like "3 Publish an immutable note".
- Inside the document: nav "Walkthrough progress" (button "Open the briefing", then one segment per stop), the briefing's buttons, each stop's Previous/Next buttons and its closing card.
- Keyboard while the walkthrough is shown: `N` next stop, `P` previous stop (the Previous/Next buttons' tooltips name the key); `J`, `K`, `R` and `C` still act on the files of the stop being read.
- Toolbar tab "Agent summary" shows the agent's HTML in frame "Review summary"; its `#layer-N` links open decision N in the walkthrough; any sidebar row or readiness line that names a stop returns to "Walkthrough".
- If the decision marks cannot be read, an alert says none are shown as reviewed, with "Try again".

## Driving it

`$C start --review-sample` (also `pnpm dev:review`) publishes a synthetic review with `$C agent publish-architecture`: 55 committed changed files, nine decisions, unexplained files and lines, and a diagram question. The first two decisions are marked reviewed. Three follow-up edits stay uncommitted; the existing Uncommitted view counts those live files while the authored notes retain the committed snapshot. Branch comparison shows the committed changes. Pair your browser using the card. Drive at 1440 × 1000, then repeat at 414 × 896, in light and dark themes.

1. Navigate to `/` on the card's web URL (full page load), open Review → tab "Review" → button "Briefing".
   Look for: tab "Review Close Review" selected; region "Review walkthrough" with tab "Walkthrough" selected; nav "Walkthrough progress" whose status reads "0 of 3 files reviewed" and "· 1 of 9 decisions" (the decision count hides at phone width); region "Briefing" with heading "9 decisions shape this change", stats "Files reviewed 0 / 3", "Decisions reviewed 1 / 9" and "Needs attention", whose caption names what needs it (for example "1 to decide · unexplained changes").
2. Read the briefing.
   Look for: under "What this adds to the system", the callout "Needs your decision · Delivery outbox" with a "Decision N" link, and New/Changed/Removed groups (Removed lists "Page-owned writes" struck through); "The walkthrough" lists nine decisions , then "Not explained"; "Evidence" reads "Checks the agent ran · …" with button "Open proof".
3. Click button named `Continue with 2. Revoke access across devices`.
   Look for: region "2. Revoke access across devices" with nav "Walkthrough stop" (buttons "Previous: 1. Invite a teammate" and "Next: 3. Publish an immutable note", "x of y files reviewed here", "Collapse all", "Mark decision reviewed"); the brief reads "Decision 2 of 9" with the retained committed text, list "Route through the system" and list "Connections".
4. Click button named `Go to step 3: Revoke through the session owner`.
   Look for: the document scrolls to the server file's lines with complementary "Agent note · Revoke through the session owner" beside them.
5. Scroll to the end of the stop.
   Look for: section "Existing code it relies on" with article "Step Reuse the workspace actor" (existing code retained at the published commit with its numbered note, button "Open file"); then the closing band "Done with this decision?" with button "Mark reviewed and continue". Do not press it here unless you want marks on the server.
6. Press `N`, then `P`.
   Look for: region "3. Publish an immutable note", then region "2. Revoke access across devices" again. The progress segment of the current stop is marked `aria-current="step"`.
7. Open Review → in nav "Walkthrough" click the button whose name starts with `Not explained · ` (in the sample "Not explained · 3 lines in 3 files 0/1").
   Look for: region "Not explained" with a lead sentence, list "Unexplained lines in explained files" with buttons like "Read in 9. Establish the shared mutation boundary", and, scrolled below the brief, the complete diffs of the files no decision points at, among them scripts/migrate-workspaces.ts.
8. Click button named `Read in 9. Establish the shared mutation boundary`.
   Look for: region "9. Establish the shared mutation boundary"; the unexplained lines of its files carry an amber complementary "Not explained · Not explained" note saying which lines changed without an explanation.
9. Click tab named `Agent summary`.
   Look for: frame "Review summary" with heading "A workspace grows shared owners". Clicking its link "Shared mutation boundary" returns to tab "Walkthrough" on region "9. Establish the shared mutation boundary".
10. Reload the page and repeat steps 1, 3 and 7 at 414 × 896, then switch the theme in Settings and look again.
    Look for: the walkthrough reopens on the stop you left; the progress bar, stop toolbar, step grid and closing card stay reachable without horizontal clipping; notes and badges read in both themes.
11. `$C server published-review` and `$C server reviewed-layers`.
    Look for: nine layers; two fresh decision marks; the live follow-up edits do not change the published decision fingerprints.

## What proves it works

- Steps 1 to 9 show the briefing counts, the stop order, the step reveal with its numbered note, the "Not explained" stop with its way back into a decision, and the summary link into a decision. Inspect HTTP requests: `GET /api/worktrees/<id>/review`, `…/changes`, `…/reviewed` and `…/reviewed-layers` answer 200; selecting "Agent summary" reads the review again.
- `apps/web/spec/integration/reviews-walkthrough.test.tsx`: with the sample, the briefing shows "9 decisions shape this change", "0 of 3 files reviewed", "Needs your decision · Delivery outbox" and "Page-owned writes"; "Continue with 2. Revoke access across devices" opens that stop with its retained notes; "Go to step 3: Revoke through the session owner" shows its agent note; the "Not explained · 3 lines in 3 files 0/1" row, scrolled past its brief, shows scripts/migrate-workspaces.ts, "Read in 9. Establish the shared mutation boundary" opens decision 9; with "Agent summary" shown, the sidebar row "3 Publish an immutable note" opens that stop and selects "Walkthrough" again.
- `apps/web/spec/integration/reviews-walkthrough-shortcuts.test.tsx`: `N` and `P` move between stops 3 and 4; `J` then `R` marks only packages/client/src/publish-note.ts on the server; no shortcut is registered twice.

## Gotchas

- Completion copy counts only files with available fingerprints as markable. With a real 66 MiB untracked file, the closing card names the unavailable path and explicitly says the stop stays open. After marking its readable peers, "Review unavailable" is disabled; shrinking that file below the read limit restores completion without discarding successful marks.

- The current stop is kept per worktree in browser storage, not in the URL: the address stays `?entry=handoff`, and a reload returns to the last stop. Click "Open the briefing" or the sidebar row "Briefing" to start over.
- `N` and `P` only act while tab "Walkthrough" is selected and the pane is active; they ignore typing in inputs.
- The first two decision marks belong to the committed snapshot. Live edits do not stale those marks; a later publication with a changed decision fingerprint does.
- Summary links expire two seconds after the review read. A frame mounted later stays blank until "Agent summary" is selected again or the page is reloaded.
- A sidebar row's accessible name joins the number, title and `x/y` without separators; match it with a regex if the counts may change.

Publications are committed branch snapshots with a required verdict. The fixture commands commit before publishing and use only pass/fail checks. The existing worktree endpoint serves the branch latest revision; durable revision links are produced here, with their routes delivered in U2.
