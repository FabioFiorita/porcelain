---
screen: /settings
selectors:
  - "add-environment"
  - "pairing-link"
  - "pair-environment"
  - "Online"
tests:
  - apps/mobile/spec/e2e/pairing.e2e.ts
api:
  - POST /api/pair
  - GET /api/environment
  - GET /api/session
---

# access.lan-pairing

## What it is

Pairing with a Porcelain that runs on another computer on the local network, through the link `porcelain pair` prints for its LAN address, and reconnecting to it after a cold launch. It is the same flow as `access.pairing` over a LAN address instead of loopback.

## How a user reaches it

- on the other computer: `porcelain pair` for its LAN address; on the device: Settings → Add environment → paste the link → Pair

## Driving it

1. Prepare a separate disposable server reachable through its LAN address. Issue a pairing link for that address; never use the installed service or its data.
2. In Settings select Add environment (test id add-environment), paste the link into pairing-link and select Pair (test id pair-environment).
3. Expect the LAN environment to show Online. Independently read its native device registration and successful app requests from that disposable server.
4. Cold-launch and expect the same environment to reconnect over the LAN address.
5. On a physical iOS device, separately check Local Network permission, denial and retry. A simulator does not prove those permission paths.

## What proves it works

- `apps/mobile/spec/e2e/pairing.e2e.ts`: the pairing and cold-launch reconnection over a disposable loopback server. The disposable server's sandbox listens on loopback only, so the LAN transport itself stays this manual checkpoint.

## Gotchas

- A simulator proves LAN transport, not the iOS Local Network permission prompt; permission, denial and retry need a physical device.
- Prove iPhone and iPad separately (`start --device ipad`).
