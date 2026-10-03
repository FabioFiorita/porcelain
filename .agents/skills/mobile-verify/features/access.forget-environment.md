---
screen: /settings
selectors:
  - "Forget environment"
  - "No environments paired."
tests:
  - apps/mobile/spec/e2e/pairing.e2e.ts
api: []
---

# access.forget-environment

## What it is

Holding an environment row in Settings opens its native context menu with “Forget environment”, which removes the environment, its Keychain credential and its remembered workspace from this device. The server keeps the device; forgetting is local. The removal survives a cold launch, and forgetting one environment keeps the others.

## How a user reaches it

- Settings → hold an environment row → Forget environment

## Driving it

Start an instance first: `.agents/skills/mobile-verify/scripts/cli start`.

```sh
.agents/skills/mobile-verify/scripts/cli open /settings
.agents/skills/mobile-verify/scripts/cli snapshot
```

Look for: the environment row; its name starts with “Mobile Verification”. Hold it by that label:

```sh
.agents/skills/mobile-verify/scripts/cli tap --long --label "Mobile Verification <id from the snapshot>"
.agents/skills/mobile-verify/scripts/cli tap --label "Forget environment"
.agents/skills/mobile-verify/scripts/cli snapshot
```

Look for: the row is gone and “No environments paired.” shows.

## What proves it works

- `apps/mobile/spec/e2e/pairing.e2e.ts`: forgets the first of two environments through the SwiftUI context menu, proves after a cold launch that only the second remains, forgets it too and proves after another cold launch that neither returns.

## Gotchas

- The context menu is SwiftUI's on iOS and a Compose dropdown on Android; only iOS is proven.
