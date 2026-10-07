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
  - GET /api/session
---

# access.environment-status

## What it is

Each environment row in Settings says what its server answered: “Checking” until it answers, “Online”, “Offline” when it cannot be reached, “Needs pairing” when the server no longer accepts this device, “Another server” when a different environment answers at that address, and “Update needed” when the server speaks another protocol.

## How a user reaches it

- Settings, or the deep link `porcelain.dev://settings`, with environments paired

## Driving it

Select Settings with direct Maestro and establish the exact disposable environment Online. Change only its owned server, use a bounded native wait for Offline, inspect and capture it, resume the server, then wait for Online without reload first. Retain controller and observation timestamps: a missed sampling deadline does not prove a late product transition. Revocation and protocol/identity mismatches are separate cases.

## What proves it works

- `apps/mobile/spec/e2e/environment-states.e2e.ts`: two real environments pair online and each server holds one device labelled “Native mobile proof”; one server then stops, and a cold launch deep-linked straight into Settings shows the running one “Online” and the stopped one “Offline”.

## Gotchas

- The shared client reads the public `GET /api/environment` for identity and protocol, then authenticated `GET /api/session` before calling it online. A 401 shows “Needs pairing”.
- `apps/web/spec/e2e/access-remote-computers.desktop.e2e.ts` pairs a real remote, revokes its device, and checks the shared status read shows “Needs pairing”. On iPhone, revoking the instance's “Verification simulator” device through the server's owner socket (`POST /access/revoke`) and reloading the app shows “Needs pairing”; the shared query polls status every 30 seconds, with a 5-second request timeout; observe the transition before reloading.
- “Another server” and “Update needed” need a different server at the same address or another protocol version; no real disposable server is in either state, so no test reaches them yet.
