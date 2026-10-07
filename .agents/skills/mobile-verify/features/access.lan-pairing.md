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

Use a disposable server on another LAN host and issue its LAN pairing link with `porcelain pair`. In the development app, select Settings → Add environment, paste the private link and submit through direct Maestro. Inspect the exact LAN environment Online and confirm its server lists the new native device. Cold-launch and verify reconnection. A request from the host machine is not native transport proof; never use the installed app's data.

## What proves it works

- `apps/mobile/spec/e2e/pairing.e2e.ts`: the pairing and cold-launch reconnection over a disposable loopback server. The disposable server's sandbox listens on loopback only, so the LAN transport itself stays this manual checkpoint.

## Gotchas

- A simulator proves LAN transport, not the iOS Local Network permission prompt; permission, denial and retry need a physical device.
- Prove iPhone and iPad separately (`start --device ipad`).
