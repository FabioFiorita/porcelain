---
screen: /settings
selectors:
  - "Settings"
  - "Environments"
  - "No environments paired."
  - "Add environment"
  - "Reading saved environments…"
  - "Read saved environments again"
tests:
  - apps/mobile/spec/e2e/destinations.e2e.ts
  - apps/mobile/spec/e2e/phone-shell.e2e.ts
  - apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts
api:
  - GET /api/environment
---

# access.settings

## What it is

Settings lists the paired environments, each with its status, and offers Add environment. With none paired it says “No environments paired.”; while it reads the saved environments it says “Reading saved environments…”, and when they cannot be read it offers “Read saved environments again”. On iPad the content column holds one section, Environments.

## How a user reaches it

- phone: the Settings tab; iPad: Settings in the sidebar
- the deep link `porcelain.dev://settings` (the CLI opens it as `/settings`)

## Driving it

Start an instance first: `.agents/skills/mobile-verify/scripts/cli start`. Start pairs the app with its server, so Settings lists one environment.

```sh
.agents/skills/mobile-verify/scripts/cli open /settings
.agents/skills/mobile-verify/scripts/cli snapshot
```

Look for: “Settings”, “Environments”, one environment named “Mobile Verification …” marked “Online”, and “Add environment”.

To see the empty state, forget that environment (`access.forget-environment`) and take another snapshot: “No environments paired.” shows.

## What proves it works

- `apps/mobile/spec/e2e/destinations.e2e.ts`: the deep link opens Settings directly on a fresh install, showing “No environments paired.”.
- `apps/mobile/spec/e2e/phone-shell.e2e.ts`: the Settings tab shows Environments and the empty state.
- `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts`: the iPad keeps Settings and its Environments section through sidebar collapse and rotation.

## Gotchas

- The unreadable-storage state needs a broken Keychain entry; no test reaches it yet.
- Each environment row reads `GET /api/environment` from its own server to show its status; `access.environment-status` covers the statuses.
