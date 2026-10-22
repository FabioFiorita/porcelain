---
screen: /component-library
selectors:
  - "Component library"
  - "Explore Text"
tests: []
api: []
---

# app.catalog-library

The development catalog lets a user explore mobile controls and return to Settings.

## How to get to it (user POV)

- Phone: Settings → Development → Component library.
- iPad: Settings → Development → component selector.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Phone: Settings → Development → Component library opens the directory; Explore Text opens its samples; native Back returns to directory then Settings.
2. iPad: Settings → Development shows component selector/Text immediately. Choose Explore Badge then Explore Button: detail replaces without a push; selector stays. Narrow layout stacks selector above preview. Another Settings category leaves the explorer; app sidebar control remains.
3. Exercise Button interaction and file context actions through their sample maps. In an isolated development run disable the development guard: Settings entry/active route disappear and direct links return to Settings. Restore the guard afterward.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Catalog routes are development-only; release builds must not expose them. Phone directory and iPad inline explorer have different entry paths.
