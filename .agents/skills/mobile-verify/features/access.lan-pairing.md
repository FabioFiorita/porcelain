---
screen: /computers
selectors:
  - "add-environment"
  - "pairing-link"
  - "pair-environment"
  - "Online"
tests: []
api:
  - POST /api/pair
  - GET /api/environment
  - GET /api/session
---

# access.lan-pairing

Pair a disposable computer through its LAN address, then reconnect to it after a cold launch.

## How to get to it (user POV)

- on the other computer: `porcelain pair` for its LAN address; on the device: Settings → Computers → Add computer → paste the link → Pair

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Prepare a separate disposable server reachable by LAN and mint its LAN pairing link.
2. Computers → Add computer (iOS + toolbar; `add-environment` where a content button). Fill `pairing-link` and press `pair-environment`.
3. Expect Online. Independently confirm the native device registration and successful requests on that LAN server.
4. Cold-launch; confirm the same environment reconnects over its LAN address. On physical iOS separately drive Local Network permission, denial and retry.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Simulator LAN transport does not prove physical iOS permissions. Use only a separate disposable server, never the installed service.
