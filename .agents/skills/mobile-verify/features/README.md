# Mobile feature map

Read [mobile verification](../SKILL.md) for lifecycle and device setup, then choose a feature below.

## Baseline preconditions

- From the repository root set `C=.agents/skills/mobile-verify/scripts/cli`. Run `$C doctor` and `$C start --fixture focused` with the owned device flags. Android uses `--device android --serial <serial>` on a booted emulator. A missing matching native build must be resolved before startup.
- Read the card and private `connection.json`; set `REPO` to `fixtures.repositoryPath`. The focused fixture has a small README repository. Use the map's setup commands when needed; restart to reset. The development fixture is a separate richer sample.
- Startup waits for the loaded app, pairs through Settings → Computers → Add computer → Use development server → enabled Pair without typing a long link, independently checks registration and closes setup. For a manual pairing journey use `--manual-pairing`; otherwise reuse the paired development client. Never use installed app data or a physical Android device.

## Driving conventions

- Preserve the card's complete agent-device invocation, including config, session, platform and device flags, on every command. Open `mobile.bundleIdentifier` with `--foreground`; iOS then needs `prepare ios-runner`. Refresh `snapshot -i` before pressing refs; use a full snapshot without `-i` for static text and counters. Use screenshots to confirm native tabs whose selected trait is absent.
- For deep links and cold launches follow [driving](../references/driving.md): keep the development flags and reconnect to `mobile.metroUrl`. Pairing links expire and work once; wait for keyboard animation before Pair.
- Phones use a native tab bar (Walkthrough, Changes, Files, History); tablets show the same sections in a sidebar (the iPad's native tab sidebar; on Android tablets a pinned sidebar in landscape and a rail in portrait). Each section has a stack and platform Back/swipe; a worktree drawer (swipe right, the header sidebar button or the worktree title) holds the worktree list with Settings as its last row. Shared tablet journeys use a proper Android tablet in landscape and portrait; see [profile requirements](../references/android.md#phone-and-tablet-profiles). Verify entry and return paths, retained selection and draft protection. Native iPad tab sidebars and other explicitly iOS-specific behavior retain their separate iOS journeys.
- Quiet feedback: a slow read shows nothing, then one `spinner` after a short delay; no loading words. A failed background read keeps its last content without text. An error appears where the person acted, with one action. Empty states are one line with at most one button.
- Run fixture operations through `$C agent …` and independent readbacks through `$C server …`; run shell/Git setup in `REPO`. Selected-workspace loading, unavailable and retry journeys are shared in [Worktrees](projects.worktrees.md).
- Preference storage readbacks use the owned development app's `porcelain-preferences.db`. Keep tokens, pairing links and driver configuration private.
- Mobile has no E2E suite. Choose Android phone/tablet for shared behavior and iOS for affected iOS-specific behavior. Report Android phone, Android tablet, iPhone and iPad evidence separately; a loopback emulator run establishes only that platform/connection. Physical-device LAN permissions and remote routing need their own journeys. See [Android setup](../references/android.md).

## Feature entry contract

Each map has one short behavior paragraph, then three sections: How to get to it (user POV), Driving it with the surface harness, and Gotchas. Keep user paths, stable handles, required state, commands and observable proof. Frontmatter keeps the route/screen, selectors, tests, API and optional desktop shell tag for `pnpm features:check`; it is not evidence that a journey passed.

## Evidence

Use the [shared evidence reference](../../verify-core/evidence.md) for screenshots, readbacks, measurements and gaps.

## Features

- [access.demo](access.demo.md) — Explore the bundled sample project without pairing or a server.
- [access.computer](access.computer.md) — A saved computer's page: ways in, devices and pairing guidance.
- [access.computers](access.computers.md) — Computer management, trust and batch updates.
- [access.connections](access.connections.md) — Connection preference, fallback and removal.
- [access.environment-status](access.environment-status.md) — Connection status, revoked devices and recovery.
- [access.forget-environment](access.forget-environment.md) — Forget a saved computer locally and retain the others.
- [access.lan-pairing](access.lan-pairing.md) — Local-network pairing and reconnection.
- [access.pairing](access.pairing.md) — Scan or paste links, pair multiple computers and restore after launch.
- [access.pairing-link](access.pairing-link.md) — A pairing link from the Camera opens the pairing form filled in.
- [access.scan-pairing](access.scan-pairing.md) — Scan a computer's pairing QR code, camera permission and return.
- [access.settings](access.settings.md) — Settings categories and version.
- [access.updates](access.updates.md) — Update offers, per-computer and batch updates in Settings → Computers.
- [app.catalog-button](app.catalog-button.md) — Button variants, actions, disabled and pending states.
- [app.catalog-library](app.catalog-library.md) — Catalog entry, sample selection and return.
- [app.catalog-preview](app.catalog-preview.md) — Primitive previews, interactions and failures.
- [app.catalog-text](app.catalog-text.md) — Text styles, wrapping and native selection.
- [app.deep-links](app.deep-links.md) — Warm, cold and unpaired destinations.
- [app.keyboard-shortcuts](app.keyboard-shortcuts.md) — Hardware keyboard shortcuts in the ⌘ overlay, list highlight and the Keyboard Shortcuts sheet.
- [app.shell](app.shell.md) — Tab bar, worktree drawer with Settings, and startup navigation.
- [files.file-action](files.file-action.md) — New file, New folder and Rename sheets; Move to trash alert.
- [files.files](files.files.md) — Browse, search, create, rename, trash and preferences.
- [files.preview](files.preview.md) — Source, document and image previews.
- [history.commit](history.commit.md) — Commit metadata, merge parents and every file's diff as one page.
- [history.diff](history.diff.md) — Commit comparisons and unavailable patches.
- [history.history](history.history.md) — Commit browsing, pagination and live updates.
- [preferences.appearance](preferences.appearance.md) — Theme, long lines, document defaults and persistence.
- [preferences.reviews-git](preferences.reviews-git.md) — Each computer's archive, spec and pull settings, and this app's commit model.
- [projects.archive-pull-request](projects.archive-pull-request.md) — Archive a merged or closed review from its pull request.
- [projects.rename-project](projects.rename-project.md) — Rename a project; remove it with a platform alert.
- [projects.worktree](projects.worktree.md) — A selected worktree's Walkthrough, Changes, Files and History tabs and the worktree title button.
- [projects.worktree-actions](projects.worktree-actions.md) — A worktree's long-press actions: copy path, switch branch, delete.
- [projects.worktrees](projects.worktrees.md) — Projects, worktrees, review progress, search and filters.
- [reviews.all-changes](reviews.all-changes.md) — Every changed file of a comparison as one scrolling page.
- [reviews.file](reviews.file.md) — Review diffs, source selection and feedback.
- [reviews.pull-request](reviews.pull-request.md) — Pull request page: merge blockers, live checks with steps and logs, re-run, conversation and comment.
- [reviews.merge-pull-request](reviews.merge-pull-request.md) — Merge sheet: allowed methods, the same blockers, pinned head, archive offer.
- [reviews.walkthrough-page](reviews.walkthrough-page.md) — The Walkthrough a fresh agent wrote: the briefing, calls and decisions, diagrams, steps, questions, draft comments and merge.
- [reviews.comment](reviews.comment.md) — Add, edit or delete one draft comment on a step, node, file or lines.
- [reviews.publish-comments](reviews.publish-comments.md) — Post the drafts as one pull request review or copy them for an agent.
- [reviews.walkthrough-writer](reviews.walkthrough-writer.md) — Choose the writer, model and effort for the next Walkthrough run.
- [reviews.walkthrough-step](reviews.walkthrough-step.md) — One step's files as a page of diffs, with previous and next step in the top bar.
- [reviews.walkthrough-screenshot](reviews.walkthrough-screenshot.md) — A step's screenshot larger in a sheet.
- [history.timeline](history.timeline.md) — file timeline, older commits and return context.
- [history.timeline-commit](history.timeline-commit.md) — timeline commit in the Files stack.
- [history.timeline-diff](history.timeline-diff.md) — parent-specific timeline diff and Back.

For review documents, follow the bounded document gesture in [driving](../references/driving.md#scroll-the-review-document). Verify tablets in landscape and portrait, with fresh geometry and refs; restore the original orientation. Verify a named lower section and the return to the first card rather than treating a successful gesture as movement.

- [git-actions.menu](git-actions.menu.md) — History Fetch/Pull availability, progress, results and recovery.
