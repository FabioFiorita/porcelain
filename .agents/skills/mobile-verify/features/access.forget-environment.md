---
screen: /settings
selectors:
  - "Forget environment"
  - "No environments paired."
tests: []
api: []
---

# access.forget-environment

## What it is

Holding an environment row in Settings opens its native context menu with “Forget environment”, which removes the environment, its Keychain credential and its remembered workspace from this device. Forget is disabled while saved environments cannot be read or the removal is pending. A removal error appears in the row. The server keeps the device; forgetting is local. The removal survives a cold launch, and forgetting one environment keeps the others.

## How a user reaches it

- Settings → hold an environment row → Forget environment

## Driving it

1. Select Settings and locate the full environment name from the card.
2. Hold that environment row. Expect a native menu containing Forget environment.
3. Select Forget environment. Expect the row to disappear and No environments paired. if it was the last one.
4. Cold-launch. Expect the forgotten environment and workspace selection to remain absent.
5. With two disposable environments, forget one and expect the other to remain. The server retains its registered device; forgetting is a local action.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- The context menu is SwiftUI's on iOS and a Compose dropdown on Android; only iOS is proven.
