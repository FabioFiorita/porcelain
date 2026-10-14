---
screen: /settings
selectors:
  - 'Forget environment'
  - 'No environments paired.'
tests: []
api: []
---

# access.forget-environment

## What it is

Each environment row in Settings has a visible trash button labelled “Forget environment”, which removes the environment, its Keychain credential and its remembered workspace from this device. Forget is disabled while saved environments cannot be read or the removal is pending. A removal error appears in the row. The server keeps the device; forgetting is local. The removal survives a cold launch, and forgetting one environment keeps the others.

## How a user reaches it

- Settings → Environments on iPad → the environment's Forget environment button

## Driving it

1. Select Settings and locate the full environment name from the card.
2. Expect a refresh button labelled Check connection and a trash button labelled Forget environment beside the environment.
3. Select Forget environment. Expect the row to disappear and No environments paired. if it was the last one.
4. Cold-launch. Expect the forgotten environment and workspace selection to remain absent.
5. With two disposable environments, forget one and expect the other to remain. The server retains its registered device; forgetting is a local action.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- The visible buttons share the mobile UI primitives on iPad, iPhone and Android; each platform needs its own native walkthrough.
