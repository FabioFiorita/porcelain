---
route: /settings/$section
selectors:
  - 'Computers'
  - 'Update'
  - 'Needs trust'
  - 'Copy device ID'
  - 'Updates available'
  - 'Manage computers'
tests:
  - apps/web/spec/e2e/access-service-ahead.e2e.ts
  - apps/web/spec/e2e/access-remote-update.desktop.e2e.ts
  - apps/web/spec/e2e/access-app-update.desktop.e2e.ts
api:
  - GET /api/service/update
  - POST /api/service/update
---

# access.remote-update

The navigator footer keeps the labelled Settings button on the left, with the global text-only Update Badge followed by the Keyboard shortcuts icon together at the far right on one unwrapped row.

## How to get to it (user POV)

- Navigator footer → Update; Settings → Computers → computer update row.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Hovering or focusing the keyboard button shows the Keyboard shortcuts tooltip and its shortcut hint. The Update badge opens Updates available with one row per offered service update and a Mac app row when it has an update. Retained batch entries keep their outcomes visible. Computers and details show the same rows and batch progress. Available untrusted computers remain visible with Needs trust; unmanaged computers appear only in Computers and never create an offer badge. Only eligible computers offer Update and contribute to Update all (N).

The shared offer rule requires the server's available flag and a known latest version. A version difference alone never creates an offer. Check an installation ahead of npm latest at desktop and 414 px: no global badge or downgrade arrow, while Computers shows its installed version and Up to date. An active batch keeps the badge visible even after the last offer disappears.

Add an untrusted computer through Settings → Computers, then open its detail. Click the lock + Needs trust button. Expect the copyable active-route device ID and the exact instruction: Run porcelain trust <id> on that computer, or allow it in the Mac app → Computers → This computer → Paired devices. No Update <computer name> action exists until the host grants trust. Pair using a trusted link and expect that row's Update action to start the update on that computer.

Open the global footer Badge; its popover opens upward. Footer Manage computers opens Computers. Update all (N) uses one shared sequence; while running the Badge reads Updating… and the disabled footer button reads Updating 1 of 2…. Its progress and per-row outcomes remain visible across Settings navigation, restart read failures and the batch ending. Unmanaged services explain how to update on the host and are excluded from the count. Failures remain visible and later computers continue. The Mac app runs last through its native updater and its action reads Restart to update; it never invokes the service-update API.

Automated coverage: `access-service-ahead.e2e.ts`, `access-remote-update.desktop.e2e.ts`, `access-app-update.desktop.e2e.ts`.

## Gotchas

- A newer-looking version alone is not an offer; require available plus known latest. Keep active progress through read failures.
