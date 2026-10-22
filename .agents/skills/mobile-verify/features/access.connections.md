---
screen: /computers
selectors:
  - "Manage connections"
  - "Hide connections"
  - "Add connection"
  - "Add a connection"
  - "Preferred"
  - "Active"
  - "Prefer"
  - "Remove connection"
tests:
  - packages/client/src/features/access/rules/remotes.spec.ts
  - packages/client/src/features/access/store.spec.ts
  - packages/client/src/features/access/store/route-transport.spec.ts
  - packages/client/src/features/live/commands/live-updates.spec.ts
api:
  - GET /api/health
  - POST /api/pair
  - GET /api/environment
  - GET /api/session
---

# access.connections

A computer can retain several independently paired addresses, choose a preferred route and fall back without losing the selected workspace.

## How to get to it (user POV)

Settings → Computers → Manage connections → Add connection. The same controls render in the phone settings and iPad Computers destination.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Start with a paired disposable LAN connection and record its device ID. Manage connections → Add connection; paste a fresh Tailscale link from the same server and Pair. Expect one computer/two routes; independent server reads show the original device plus a distinct new device.
2. Keep preferred HTTP healthy but reject/close its WebSocket. An independently changed open file must update through the alternate route without navigation/foreground. Separately fail a read with healthy probes: it retries once on an authorized fallback.
3. Make LAN unavailable and open the same project/review through Tailscale. Computers shows Tailscale Active, LAN Preferred. Restore LAN: the healthy active route stays until reconnect/foreground, then preference is reconsidered without losing selection.
4. Prefer Tailscale; cold-launch and confirm routes/preference survive. Open a review/file. Remove the active route: the remaining route loads that computer. Last-route removal is disabled; Forget computer remains available with draft protection.
5. Try another server's link: different-computer explanation, no saved-route change. Invalid, expired and unreachable links leave the form open with error and Cancel.
6. Revoke active LAN while Tailscale is unreachable. Restore Tailscale without foreground/navigation, independently change the open file, and confirm recovery. Only confirmed rejection of every route ends recovery; an unreachable alternative stays retryable.
7. Exercise a lost write acknowledgement with the named regression: no write replay on another route. Preference/removal must retain pending Git operations.

Automated coverage: `remotes.spec.ts`, `store.spec.ts`, `route-transport.spec.ts`, `live-updates.spec.ts`.

## Gotchas

- Route probes have a 2.5-second deadline. Cancelling a read must keep a healthy active route; failed HTTP/live routes advance before retrying, and an exhausted cycle may retry all.
- Real Tailscale needs an authorized disposable endpoint. A loopback proxy proves fallback mechanics only. Save route requests, device readbacks and cold-launch evidence.
