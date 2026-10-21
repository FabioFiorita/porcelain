---
screen: /computers
selectors:
  - 'Forget computer'
  - 'No computers paired.'
tests: []
api: []
---

# access.forget-environment

## What it is

Each computer row in Settings → Computers has a visible trash button labelled “Forget computer”, which removes the environment, its Keychain credential and its remembered workspace from this device. Forget is disabled while saved environments cannot be read or the removal is pending. A removal error appears in the row. The server keeps the device; forgetting is local. The removal survives a cold launch, and forgetting one environment keeps the others.

## How a user reaches it

- Settings → Computers → the environment's Forget computer button

## Driving it

1. Select Settings → Computers and locate the full environment name from the card.
2. Expect a status badge and a trash button labelled Forget computer beside the environment.
3. Select Forget computer. Expect the row to disappear and No computers paired. if it was the last one.
4. Cold-launch. Expect the forgotten environment and workspace selection to remain absent.
5. With two disposable environments, forget one and expect the other to remain. The server retains its registered device; forgetting is a local action.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- The visible buttons share the mobile UI primitives on iPad, iPhone and Android; each platform needs its own native walkthrough.
