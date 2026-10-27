# Web feature map

Read [web verification](../SKILL.md) for lifecycle, pairing and failure injection, then choose a feature below.

## Baseline preconditions

- From the repository root set `C=.agents/skills/web-verify/scripts/cli`; run `$C doctor`, then `$C start`. Read its card and private `connection.json`. Set `REPO` to `fixtures.repositoryPath`, `HOME_DIR` to `fixtures.projectHome`, and `WEB` to `webUrl`.
- Open a fresh browser context and redeem the card's fresh pairing link, except when a map starts unpaired. Links work once; startup opens no browser. Reloads keep this context/session.
- The default recipe viewport is phone width, 414 × 896; use 1280 × 800 for desktop proof unless the map specifies another size. At phone width: `Toggle Sidebar` opens the navigator; `Review` or `Alt+Shift+R` opens the `Worktree review` sheet. Opening a document closes that sheet; reopen it for the next tree action. Actions that open no document leave it open, so do not click the covered Review button.
- At 1280px and wider the rail (navigation "Side panel" of toggle buttons) switches the docked panel; clicking its pressed button hides the panel, so choose a different view or use the keys. Files is the default view without a `surface` selection. Choose Changes/Review before using its controls. `Alt+1`, `Alt+2`, `Alt+3` open Files, Changes/Review and History (and the sheet at phone width). Explicit surface/document URL selections survive this default.
- A `shell: desktop` map needs `$C start --desktop` for desktop-mode views. Native bridge, menu and sheet proof requires desktop verification. Drafting maps need `$C start --coding-tool`.

## Driving conventions

- Routes are full loads at `WEB`; wait for settled URL/title and expected content, not just the toolbar. Prefer roles and exact quoted names. Slash-delimited patterns are regexes. Scope repeated handles by region, dialog or tablist; inspect a fresh accessibility tree when a step differs.
- Snapshots may omit editor, iframe or selected-option contents. Inspect the frame, screenshot, select value or real file. For contenteditable, select all and insert text without an unintended blur.
- Shell/Git setup runs in `REPO`, whose commits use Porcelain Development. Agent publications use `$C agent …`; review fixtures commit before publishing, require a verdict and use pass/fail checks. Republishing appends a revision.
- `$C remote start` owns a second disposable server; `$C remote pairing-link` mints its link (`--trusted` grants update permission). Cross-origin desktop-mode views use that computer's credential.
- For refusal, held-read and live-outage journeys, use [failure injection](../SKILL.md#inject-browser-failures), install routes before navigation and restore them in `finally`. Record HTTP method/path/status/content type/payload; distinguish cancelled requests from failed responses. The CLI has no browser commands.
- Summary links expire two seconds after reading a disposable review. If its frame mounts later, reload fully to obtain a fresh link.

## Feature entry contract

Each map has one short behavior paragraph, then three sections: How to get to it (user POV), Driving it with the surface harness, and Gotchas. Keep user paths, stable handles, required state, commands and observable proof. Frontmatter keeps the route/screen, selectors, tests, API and optional desktop shell tag for `pnpm features:check`; it is not evidence that a journey passed.

## Proof and skip reporting

- When a map's route is the view itself (a page such as `/settings/$section` or `/reviews/$reviewId`, not `/` with a sheet or dialog on top), run [the sweep](../SKILL.md#sweep-the-standard-states) on it (`$C sweep <map> [--board <png>]`) for long text, many items, the three widths and both themes; its `index.md` is the proof for those states. Views reached by interaction still need those states driven by hand.
- Capture the action and result, with a fresh interactive snapshot and screenshot identifying the app and destination. Store driver actions, URL/title and diagnostics in the card's evidence directory; redact pairing fragments and credentials.
- Verify mutations independently through the filesystem, Git, storage or the card's typed `$C server …` readbacks. A success toast alone is insufficient.
- Report the map, entry points, platform, width and connection actually driven. Named automated tests, source review and live proof are separate results. An unmet precondition is a reported gap, never a reason to weaken the journey.
- Restore mutated fixtures or restart the disposable instance before repeating. Stop with the card's command; retain evidence after cleanup.

## Features

- [access.device-trust](access.device-trust.md) (desktop) — Trust grants, revocation and trusted pairing links.
- [access.disconnect](access.disconnect.md) — Session disconnect, draft refusal and return to pairing.
- [access.environment-name](access.environment-name.md) (desktop) — Computer naming and persistence.
- [access.foreign-link](access.foreign-link.md) — Refuse links for another installation without pairing a device.
- [access.pair-open-page](access.pair-open-page.md) — Pairing-page entry and return destination.
- [access.pairing](access.pairing.md) — Pairing, invalid links and session restoration.
- [access.remote-access](access.remote-access.md) (desktop) — Network routes, addresses, failures and recovery.
- [access.remote-computers](access.remote-computers.md) — Pair, list and forget remote computers.
- [access.remote-detail](access.remote-detail.md) — Computer details, stale state and safe return.
- [access.remote-update](access.remote-update.md) — Remote update offers, trust and execution.
- [access.restore-outage](access.restore-outage.md) — Session restore failures and reconnection.
- [access.service-update](access.service-update.md) — Version offers, progress, failures and recovery.
- [access.share](access.share.md) (desktop) — Pairing links, devices and revocation.
- [app.not-found](app.not-found.md) — Unknown routes, invalid worktrees and recovery.
- [app.settings-entry](app.settings-entry.md) — Default and unknown Settings sections.
- [app.settings-page](app.settings-page.md) (desktop) — Settings sections, keyboard entry and return.
- [app.settings-scope](app.settings-scope.md) (desktop) — Settings categories in each shell.
- [app.settings-without-sharing](app.settings-without-sharing.md) — Browser Settings, paired computers and permission-gated device controls.
- [app.shell](app.shell.md) — Unpaired routes and pairing instructions.
- [app.tab-title](app.tab-title.md) — File, commit, review and Settings titles.
- [changes.branch-base](changes.branch-base.md) — Base selection and URL persistence.
- [changes.branch-comment-reveal](changes.branch-comment-reveal.md) — Branch comment navigation.
- [changes.branch-marks](changes.branch-marks.md) — Branch-scoped reviewed marks.
- [changes.branch-read-more](changes.branch-read-more.md) — Diff pagination and retained content.
- [changes.diff-recovery](changes.diff-recovery.md) — Changed-worktree recovery during diff loading.
- [changes.live-update](changes.live-update.md) — External writes, additions and removals.
- [changes.many-diffs](changes.many-diffs.md) — Large change lists and complete diff loading.
- [changes.review-branch](changes.review-branch.md) — Uncommitted and branch comparisons.
- [changes.step-lines](changes.step-lines.md) — Retained context excerpts stay unchanged after worktree edits.
- [files.create](files.create.md) — Create files and folders, cancel and validate names.
- [files.duplicate](files.duplicate.md) — Duplicate files beside the original and open the copy.
- [files.edit-conflict](files.edit-conflict.md) — Concurrent changes and conflict recovery.
- [files.edit](files.edit.md) — Edit, save, autosave and return.
- [files.editor-reopen](files.editor-reopen.md) — Editor reopening and restored state.
- [files.find-refresh](files.find-refresh.md) — Search refresh after filesystem changes.
- [files.find](files.find.md) — Find text within a file and navigate matches in reader or editor.
- [files.html-preview](files.html-preview.md) — HTML preview, source and sandbox limits.
- [files.image-preview](files.image-preview.md) — Image loading and unsupported content.
- [files.markdown-preview](files.markdown-preview.md) — Markdown reading, links and source.
- [files.move](files.move.md) — Move entries and verify their destinations.
- [files.pin](files.pin.md) — Pin, open and unpin files.
- [files.quick-open](files.quick-open.md) — Keyboard file search and opening.
- [files.rename](files.rename.md) — Rename entries and preserve navigation.
- [files.timeline](files.timeline.md) — Per-file history and commit navigation.
- [files.trash](files.trash.md) — Trash confirmation, persistence and missing-path refusal.
- [files.tree-expansion](files.tree-expansion.md) — Folder expansion, collapse and refresh.
- [git-actions.commit-branch-moved](git-actions.commit-branch-moved.md) — Moved-branch refusal and recovery.
- [git-actions.commit-draft](git-actions.commit-draft.md) — Commit a typed message when no coding CLI is available.
- [git-actions.commit](git-actions.commit.md) — Commit entry, message, submission and receipt.
- [git-actions.discard](git-actions.discard.md) — Discard confirmation and resulting files.
- [git-actions.dismiss-interrupted](git-actions.dismiss-interrupted.md) — Interrupted operation dismissal.
- [git-actions.draft-commit](git-actions.draft-commit.md) — Draft generation, editing and commit.
- [git-actions.follow-receipt](git-actions.follow-receipt.md) — Receipt progress and terminal outcomes.
- [git-actions.push](git-actions.push.md) — Refuse an unusable remote URL without setting an upstream.
- [git-actions.reload-running](git-actions.reload-running.md) — Reload during an active operation.
- [git-actions.stale-draft](git-actions.stale-draft.md) — Stale file selection and refresh.
- [git-actions.stash](git-actions.stash.md) — Stash creation and working-tree readback.
- [git-actions.suggested-step](git-actions.suggested-step.md) — Suggested next Git action.
- [history.browse](history.browse.md) — History entry, loading and navigation.
- [history.copy-commit](history.copy-commit.md) — Copy full commit IDs and messages.
- [history.graph](history.graph.md) — Branch graph and commit selection.
- [history.list](history.list.md) — Commit rows with metadata, ref labels and merge markers.
- [history.open-commit](history.open-commit.md) — Commit details and file comparisons.
- [projects.hide-file](projects.hide-file.md) — Hide, show and restore file preferences.
- [projects.manual-selection](projects.manual-selection.md) — Register only explicitly opened repositories, without automatic discovery.
- [projects.open-folder](projects.open-folder.md) — Open project and folder selection.
- [projects.open-linked-worktree](projects.open-linked-worktree.md) — Linked worktree entry and selection.
- [projects.open-remote](projects.open-remote.md) (desktop) — Remote computer and workspace selection.
- [projects.remote-workspace](projects.remote-workspace.md) (desktop) — Remote routes, reviews and recovery.
- [projects.remove](projects.remove.md) — Project removal and cancellation.
- [projects.rename](projects.rename.md) — Project naming and persistence.
- [preferences.reviews-git](preferences.reviews-git.md) — Reviews & Git settings each computer keeps, the first import and the computer picker.
- [projects.search](projects.search.md) — Search, status filters, checkout selection and archive.
- [reviews.all-changes](reviews.all-changes.md) — Review-wide changes and file selection.
- [reviews.change-comment-draft](reviews.change-comment-draft.md) — Preserve whole-branch comment drafts across new commits.
- [reviews.change-comment](reviews.change-comment.md) — Comment on the whole uncommitted change or the whole branch.
- [reviews.changed-file-menu](reviews.changed-file-menu.md) — File menus, marking, comments and timeline.
- [reviews.comment](reviews.comment.md) — Comment entry, validation and persistence.
- [reviews.comments-seen](reviews.comments-seen.md) — Seen state and unread comments.
- [reviews.decision-link](reviews.decision-link.md) — Direct decisions, pairing and unknown targets.
- [reviews.delete-resolved-race](reviews.delete-resolved-race.md) — Concurrent changes during deletion.
- [reviews.delete-resolved](reviews.delete-resolved.md) — Resolved-thread deletion and cancellation.
- [reviews.delete-review](reviews.delete-review.md) — Review deletion, cancellation and retained worktree data.
- [reviews.edit-comment](reviews.edit-comment.md) — Comment editing and saved text.
- [reviews.mark-all](reviews.mark-all.md) — Batch file marking and completion.
- [reviews.mark-decision](reviews.mark-decision.md) — Decision and file marks, failure and unmarking.
- [reviews.mark-file](reviews.mark-file.md) — File marking, unmarking and changed content.
- [reviews.open-to-side](reviews.open-to-side.md) — Open files and commits in the other document pane.
- [reviews.pane-bar](reviews.pane-bar.md) — Pane bars, permanent tabs, controls and Git placement.
- [reviews.page](reviews.page.md) — Durable revisions, verdict, comments and lifecycle.
- [reviews.proof](reviews.proof.md) — Published check results and image attachments.
- [reviews.read-retry](reviews.read-retry.md) — Review loading, failure and retry.
- [reviews.readiness-outdated](reviews.readiness-outdated.md) — Outdated proof and current readiness.
- [reviews.readiness](reviews.readiness.md) — Review readiness and reasons.
- [reviews.reload-layout](reviews.reload-layout.md) — Reload and retained document layout.
- [reviews.reply](reviews.reply.md) — Replies and live thread updates.
- [reviews.resolve](reviews.resolve.md) — Resolve and reopen threads.
- [reviews.revision](reviews.revision.md) — Numbered revisions and retained content.
- [reviews.side-panel](reviews.side-panel.md) — The rail and its docked Files, Review and History panel.
- [reviews.sidebar-actions](reviews.sidebar-actions.md) — Review actions from the sidebar.
- [reviews.spec-files](reviews.spec-files.md) — Group specs and tests apart from other changed files.
- [reviews.split-shortcuts](reviews.split-shortcuts.md) — Split views and keyboard controls.
- [reviews.walkthrough](reviews.walkthrough.md) — Briefing, decision navigation and completion.
