---
screen: /settings
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

## What it is

One saved environment can keep multiple independently paired connections. Adding another address for the same environment retains the existing address and credential. Metadata stays in SQLite and each route credential stays in secure storage. Existing single-address environments remain readable.

Manage connections expands the environment row. It lists connections in preference order, shows the preferred connection and the active workspace connection, and offers Add connection, Prefer and Remove connection. The last connection cannot be removed here; Forget environment removes the whole environment with the existing draft guard.

Each connection attempt checks the public health installation ID without a credential, then reads the descriptor and authorizes that route with its own credential. The environment name and version remain unavailable to anonymous cross-origin pages. An unavailable or unauthorized preferred route can fall back. Each route probe has a 2.5-second deadline. A healthy route stays selected until reconnect or foreground. Foreground replaces the live session and reconsiders preference. A failed read can retry once on an authorized fallback. A failed write is returned to its caller without replay on another route. Route preference and removal preserve the environment’s existing pending Git journal.

## How a user reaches it

Settings → Environments → Manage connections → Add connection. The same controls render in the phone settings and iPad Environments destination.

## Driving it

1. Start with one independently paired LAN connection to a disposable server. Record its device ID through the owner readback.
2. Open Manage connections and Add connection. Paste a fresh Tailscale pairing link issued by the same server, then Pair. Expect one environment and two connections. Independently confirm the original device still exists and a different device was created for Tailscale.
3. Open a project and its review. With LAN unavailable, expect the usable Tailscale connection to load that same project and review. Return to Settings and expect Tailscale to show Active while LAN remains Preferred.
4. Restore LAN while the current connection is healthy. Expect it to stay in use. Background and foreground, then expect preference to be reconsidered without losing the selected environment or review.
5. Prefer Tailscale. Cold-launch the app and confirm both connections and that preference survive. Open a review and read a file.
6. Remove the active connection. Expect the remaining connection to load the same environment. Expect removal disabled for the last connection and Forget environment still available.
7. Add connection with a pairing link from another disposable server. Expect a different-computer explanation and no change to either saved connection. Invalid, expired and unreachable links keep the form open with its error and a working Cancel.
8. Exercise a lost write acknowledgement through the shared-client regression: no automatic replay occurs. Real Tailscale requires an authorized endpoint for the disposable server; a loopback proxy proves fallback mechanics only.

## What proves it works

Retain native screenshots, independent device readbacks, a cold-launch journey, and actual route request/readback evidence. Report Android separately from iPhone and iPad. Emulator reachability does not prove physical-device LAN permission or Preview delivery.
