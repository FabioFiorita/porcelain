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

Select Settings, inspect the full environment label, then use direct Maestro to long-press that row and choose Forget environment. Verify the row disappears and the empty state appears when it was the last environment. Cold-launch through the printed development link and confirm removal persists; with two environments, also verify the other remains.

## What proves it works

- `apps/mobile/spec/e2e/pairing.e2e.ts`: forgets the first of two environments through the SwiftUI context menu, proves after a cold launch that only the second remains, forgets it too and proves after another cold launch that neither returns.

## Gotchas

- The context menu is SwiftUI's on iOS and a Compose dropdown on Android; only iOS is proven.
