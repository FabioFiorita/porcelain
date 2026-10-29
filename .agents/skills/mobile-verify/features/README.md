# Mobile feature map

Read [mobile verification](../SKILL.md) for lifecycle and device setup, then choose a feature below.

## Baseline preconditions

- From the repository root set `C=.agents/skills/mobile-verify/scripts/cli`. Run `$C doctor` and `$C start --fixture focused` with the owned device flags. Android uses `--device android --serial <serial>` on a booted emulator. A missing matching native build must be resolved before startup.
- Read the card and private `connection.json`; set `REPO` to `fixtures.repositoryPath`. The focused fixture has a small README repository without published reviews/comments. Use the map's publication/setup commands when needed; restart to reset. The development fixture is a separate richer sample.
- Startup waits for the fresh unpaired app’s Add computer control before opening Settings, so its deep link is handled by the loaded app. It pairs through Settings → Computers → Add computer → Use development server → Pair, waits for the Pair control to become enabled, independently checks the registered device and closes its setup session. The app obtains its link directly from Metro; the driver never types the long link. For a manual pairing journey use `--manual-pairing`; otherwise reuse the paired development client. Never use installed app data or a physical Android device.

## Driving conventions

- Preserve the card's complete agent-device invocation, including config, session, platform and device flags, on every command. Open `mobile.bundleIdentifier` with `--foreground`; iOS then needs `prepare ios-runner`. Refresh `snapshot -i` before pressing refs; use a full snapshot without `-i` for static text and counters. Use screenshots to confirm native tabs whose selected trait is absent.
- For deep links and cold launches follow [driving](../references/driving.md): keep the development flags and reconnect to `mobile.metroUrl`. Pairing links expire and work once; wait for keyboard animation before Pair.
- Rotate with the complete card invocation followed by `orientation landscape-left` or `orientation portrait` (no `--settle`). On iPad drive landscape first, then portrait; take a fresh snapshot and screenshot after rotation because geometry and refs change. Restore the original orientation before stopping a borrowed device.
- For review scrolling, use the [document gesture](../references/driving.md#scroll-the-review-document) rather than a viewport-wide `scroll down`: the outer screen, sidebar or a nested horizontal strip can receive that gesture. Confirm a named lower section and the return to the first card.
- Phones use tabs and native Back/swipe. iPad uses worktree navigation, central document tabs and a right panel: drive landscape first, then portrait/narrow panes. Verify entry and return paths, retained selection and draft protection.
- Run fixture operations through `$C agent …` and independent readbacks through `$C server …`; run shell/Git setup in `REPO`. Selected-workspace loading, unavailable and retry journeys are shared in [Worktrees](projects.workspace-picker.md#driving-it-with-agent-device).
- Preference storage readbacks use the owned development app's `porcelain-preferences.db`. Keep tokens, pairing links and driver configuration private.
- Mobile has no E2E suite. Android, iPhone, iPad, physical-device LAN permissions and remote routing require separate proof; a loopback emulator run establishes only that platform/connection. See [Android setup](../references/android.md).

## Feature entry contract

Each map has one short behavior paragraph, then three sections: How to get to it (user POV), Driving it with the surface harness, and Gotchas. Keep user paths, stable handles, required state, commands and observable proof. Frontmatter keeps the route/screen, selectors, tests, API and optional desktop shell tag for `pnpm features:check`; it is not evidence that a journey passed.

## Proof and skip reporting

- Capture the action and result, with a fresh interactive snapshot and screenshot identifying the app and destination. Store driver actions, URL/title and diagnostics in the card's evidence directory; redact pairing fragments and credentials.
- Verify mutations independently through the filesystem, Git, storage or the card's typed `$C server …` readbacks. A success toast alone is insufficient.
- Report the map, entry points, platform, width and connection actually driven. Named automated tests, source review and live proof are separate results. An unmet precondition is a reported gap, never a reason to weaken the journey.
- Restore mutated fixtures or restart the disposable instance before repeating. Stop with the card's command; retain evidence after cleanup.

## Features

- [access.computers](access.computers.md) — Computer management, trust and batch updates.
- [access.connections](access.connections.md) — Connection preference, fallback and removal.
- [access.environment-status](access.environment-status.md) — Connection status, revoked devices and recovery.
- [access.forget-environment](access.forget-environment.md) — Forget a saved computer locally and retain the others.
- [access.lan-pairing](access.lan-pairing.md) — Local-network pairing and reconnection.
- [access.pairing](access.pairing.md) — Paste links, pair multiple computers and restore after launch.
- [access.settings](access.settings.md) — Settings categories, version and This computer.
- [access.updates](access.updates.md) — Update visibility, sheet navigation and batch outcomes.
- [app.catalog-button](app.catalog-button.md) — Button variants, actions, disabled and pending states.
- [app.catalog-library](app.catalog-library.md) — Catalog entry, sample selection and return.
- [app.catalog-preview](app.catalog-preview.md) — Primitive previews, interactions and failures.
- [app.catalog-text](app.catalog-text.md) — Text styles, wrapping and native selection.
- [app.deep-links](app.deep-links.md) — Warm, cold and unpaired destinations.
- [app.phone-shell](app.phone-shell.md) — Native tabs and startup navigation.
- [app.tablet-shell](app.tablet-shell.md) — Sidebar, panel and central documents.
- [app.workspace](app.workspace.md) — Per-worktree document tabs and panel state.
- [files.files](files.files.md) — Browse, search, create, rename, trash and preferences.
- [files.preview](files.preview.md) — Source, document and image previews.
- [history.commit](history.commit.md) — Commit metadata, merge parents and file navigation.
- [history.diff](history.diff.md) — Commit comparisons, unavailable patches and comments.
- [history.history](history.history.md) — Commit browsing, pagination and live updates.
- [preferences.appearance](preferences.appearance.md) — Theme, long lines, document defaults and persistence.
- [preferences.reviews-git](preferences.reviews-git.md) — Each computer's archive, spec and pull settings, and this app's commit model.
- [projects.workspace-picker](projects.workspace-picker.md) — Worktree selection, filters, status and archive.
- [reviews.comments](reviews.comments.md) — Post, reply, resolve, reopen and retain drafts.
- [reviews.file](reviews.file.md) — Review diffs, source selection and feedback.
- [reviews.linked-review](reviews.linked-review.md) — Published verdicts, decisions and retained excerpts.
- [reviews.retained-review](reviews.retained-review.md) — Closed reviews that return to Files or History Worktrees.
- [reviews.review](reviews.review.md) — Changed files, agent decisions and completion.
