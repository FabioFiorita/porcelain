---
screen: /settings
selectors:
  - "Online"
  - "Offline"
  - "Needs pairing"
  - "Another server"
  - "Update needed"
  - "Checking"
tests:
  - apps/mobile/spec/e2e/environment-states.e2e.ts
api:
  - GET /api/environment
---

# access.environment-status

## What it is

Each environment row in Settings says what its server answered: “Checking” until it answers, “Online”, “Offline” when it cannot be reached, “Needs pairing” when the server no longer accepts this device, “Another server” when a different environment answers at that address, and “Update needed” when the server speaks another protocol.

## How a user reaches it

- Settings, or the deep link `porcelain.dev://settings`, with environments paired

## Driving it

Start an instance first: `.agents/skills/mobile-verify/scripts/cli start`.

```sh
.agents/skills/mobile-verify/scripts/cli open /settings
.agents/skills/mobile-verify/scripts/cli snapshot
```

Look for: the environment “Mobile Verification …” marked “Online”. The other states need the server changed under the app (revoked, stopped); the e2e test sets them up, since the CLI keeps its server running for the whole session.

## What proves it works

- `apps/mobile/spec/e2e/environment-states.e2e.ts`: two real environments pair online; one server then revokes the device (it lists no device) and the other stops; a cold launch deep-linked straight into Settings shows “Needs pairing” and “Offline” and no environment “Online”.

## Gotchas

- “Another server” and “Update needed” need a different server at the same address or another protocol version; no real disposable server is in either state, so no test reaches them yet.
