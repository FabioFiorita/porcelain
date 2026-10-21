---
screen: /computers
selectors:
  - 'Computers'
  - 'Add computer'
  - 'Forget computer'
  - 'No computers paired.'
  - 'Reading saved computers…'
  - 'Read saved computers again'
  - 'Manage connections'
  - 'Check updates again'
  - 'Needs trust'
tests:
  - packages/client/src/features/access/rules/settings-updates.spec.ts
  - packages/client/src/features/access/commands/settings-updates.spec.ts
api:
  - GET /api/environment
  - GET /api/session
  - GET /api/service/update
  - POST /api/service/update
---

# access.computers

Settings → Computers opens paired computers, status/version, Add computer, Forget computer and expandable Manage connections. On iPad choose the Computers category. Add computer uses a native toolbar button on phone destinations and opens a native pairing sheet; on iPad it opens the inline pairing form; Cancel leaves saved computers unchanged. The phone root only navigates here; it no longer lists computers inline.

Each computer reads the existing shared service-update atom. Eligible offers have Update to <version>; the shared owner supplies Update all (N), eligibility and sequencing. Untrusted computers show a lock and expandable Needs trust, the connection's device ID and the hint “Run porcelain trust <id> on that computer, or allow it in the Mac app → Devices”. Touch and hold to copy the ID/command; after granting trust on the host, Check updates again refreshes it. This device cannot grant itself trust.

Unmanaged computers show “This server runs outside the installed service. Update it with npm, then run porcelain service update.” They are never submitted to the service updater; the bundled Mac server updates through the Mac app. Untrusted and unmanaged computers remain visible but do not contribute to Update all (N).

## Drive it

1. Pair two disposable computers, one trusted managed service and one untrusted managed service. Independently confirm identities, credentials and offered versions. Expect name/address, Online, current version and both offers, with Needs trust only on the untrusted row. Expand its lock button and compare the displayed/pasted ID with the active route registration. Pair an alternate route with a distinct device ID and repeat after failover.
2. Add an unmanaged fixture with an available version. Expect its explanation, no Update action, and unchanged eligible N. Never POST its update endpoint.
3. Select a single eligible Update; expect shared queued/updating/progress, then confirmed completion. During the batch, queued/updating rows replace their Update action. Other update actions and Update all are disabled.
4. Run Update all with two eligible services. Independently record request order and confirmed completion before the next starts. Inject a failed update; expect its error retained and the next computer attempted. During server restart/read failure, keep queued/updating/outcome rows visible. Returning from another tab retains the batch.
5. Exercise pairing, connection management, Forget and storage-error recovery using their maps. With none paired, expect No computers paired and Add computer; unreadable storage disables mutation and offers Read saved computers again.

Drive and retain native evidence per platform; source/type checks do not prove layout, clipboard selection or network updates.
