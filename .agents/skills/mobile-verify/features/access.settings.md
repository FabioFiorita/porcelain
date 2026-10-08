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
  - GET /api/session
---

# access.settings

## What it is

Settings lists the paired environments, each with its status, and offers Add environment. With none paired it says “No environments paired.”; while it reads the saved environments it says “Reading saved environments…”, and when they cannot be read it offers “Read saved environments again”. On iPad the content column holds one section, Environments.

## How a user reaches it

- phone: the Settings tab; iPad: Settings in the sidebar
- the deep link `porcelain.dev://settings`

## Driving it

1. Select the Settings tab or sidebar row, or open porcelain.dev://settings. Expect Settings, Environments, the card's paired environment marked Online and Add environment.
2. Follow access.forget-environment for the only paired fixture. Expect No environments paired.
3. Return through Review, Files and History and reopen Settings. Expect the same environment state.
4. Reading saved environments… is transient. Read saved environments again requires a storage-error fixture; do not claim it from normal startup.

## What proves it works

- `apps/mobile/spec/e2e/destinations.e2e.ts`: the deep link opens Settings directly on a fresh install, showing “No environments paired.”.
- `apps/mobile/spec/e2e/phone-shell.e2e.ts`: the Settings tab shows Environments and the empty state.
- `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts`: the iPad keeps Settings and its Environments section through sidebar collapse and rotation.

## Gotchas

- The unreadable-storage state needs a broken Keychain entry; no test reaches it yet.
- Each environment row reads `GET /api/environment` and authenticated `GET /api/session` from its own server to show its status; `access.environment-status` covers the statuses.
