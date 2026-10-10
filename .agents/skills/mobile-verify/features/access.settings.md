---
screen: /settings
selectors:
  - "Settings"
  - "Environments"
  - "Appearance"
  - "add-environment"
  - "No environments paired."
  - "Add environment"
  - "Reading saved environments…"
  - "Read saved environments again"
tests: []
api:
  - GET /api/environment
  - GET /api/session
---

# access.settings

## What it is

Settings lists the paired environments, each with its status, and offers Add environment. With none paired it says “No environments paired.”; while it reads the saved environments it says “Reading saved environments…”, and when they cannot be read it offers “Read saved environments again”. Appearance opens a native stack destination for this app's theme, code and document defaults. On iPhone, Add environment is a native navigation-toolbar action; other layouts retain the content action.

## How a user reaches it

- phone: the Settings tab; iPad: Settings in the sidebar
- the deep link `porcelain.dev://settings`

## Driving it

1. Select the Settings tab or sidebar row, or open porcelain.dev://settings. Expect Settings, Environments, the card's paired environment marked Online and Add environment.
2. Open Appearance, follow preferences.appearance, and return through native Back. Expect the same environments and Add environment.
3. Follow access.forget-environment for the only paired fixture. Expect No environments paired.
4. Return through Review, Files and History and reopen Settings. Expect the same environment state.
5. Reading saved environments… is transient. Read saved environments again requires a storage-error fixture; do not claim it from normal startup.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- The unreadable-storage state needs a broken Keychain entry; no test reaches it yet.
- Each environment row reads `GET /api/environment` and authenticated `GET /api/session` from its own server to show its status; `access.environment-status` covers the statuses.
