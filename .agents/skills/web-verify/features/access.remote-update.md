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
  - apps/web/spec/e2e/access-remote-update.desktop.e2e.ts
  - apps/web/spec/e2e/access-app-update.desktop.e2e.ts
api:
  - GET /api/service/update
  - POST /api/service/update
---

# access.remote-update

The global text-only Update Badge sits at the right end of the navigator footer, beside Settings, the keyboard button and the Computers button. It opens Updates available with one row per offered service update and a Mac app row when it has an update. Retained batch entries keep their outcomes visible. Computers and details reuse the same rows and shared batch owner. Available untrusted and unmanaged computers remain visible; only the shared eligibility helper controls Update and the Update all (N) count.

## Driving it

Add an untrusted computer through Settings → Computers, then open its detail. Click the lock + Needs trust button. Expect the copyable active-route device ID and the exact instruction: Run porcelain trust <id> on that computer, or allow it in the Mac app → Devices. No Update <computer name> action exists until the host grants trust. Pair using a trusted link and expect that row's Update action to start the update on that computer.

Open the global footer Badge; its popover opens upward. Footer Manage computers opens Computers. Update all (N) uses one shared sequence; while running the Badge reads Updating… and the disabled footer button reads Updating 1 of 2…. Its progress and per-row outcomes remain visible across Settings navigation, restart read failures and the batch ending. Unmanaged services explain how to update on the host and are excluded from the count. Failures remain visible and later computers continue. The Mac app runs last through its native updater and its action reads Restart to update; it never invokes the service-update API.

## What proves it works

The remote E2E covers the trust expansion and trusted update. The app E2E uses the existing DesktopBridge fixture, checks literal Mac app versions in the global footer popover and zero service-update POSTs. Shared-client tests own sequencing, eligibility and progress rules; the parent owns the final combined real-surface proof.
