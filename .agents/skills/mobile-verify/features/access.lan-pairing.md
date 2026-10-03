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

This is a checkpoint against a real LAN server, not a disposable one. Start an instance: `.agents/skills/mobile-verify/scripts/cli start`. On the LAN server, issue a link with `porcelain pair` for its LAN address and keep it out of any file you share.

```sh
.agents/skills/mobile-verify/scripts/cli open /settings
.agents/skills/mobile-verify/scripts/cli tap --id add-environment
.agents/skills/mobile-verify/scripts/cli fill '<the LAN link>' --id pairing-link
.agents/skills/mobile-verify/scripts/cli tap --id pair-environment
.agents/skills/mobile-verify/scripts/cli snapshot
```

Look for: the LAN environment marked “Online”. Then on that server, `porcelain devices` lists the new device labelled as issued, platform `iOS` or `iPadOS`, over lan. An HTTP request from the Mac alone is not proof of the native transport. The CLI redacts the link's pairing code from the evidence.

## What proves it works

- `apps/mobile/spec/e2e/pairing.e2e.ts`: the pairing and cold-launch reconnection over a disposable loopback server. The disposable server's sandbox listens on loopback only, so the LAN transport itself stays this manual checkpoint.

## Gotchas

- A simulator proves LAN transport, not the iOS Local Network permission prompt; permission, denial and retry need a physical device.
- Prove iPhone and iPad separately (`start --device ipad`).
