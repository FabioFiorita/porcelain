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

- Settings gear → Development → Component library (phone and iPad).

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Settings → Development → Component library opens the directory, one list row per primitive; Explore Text opens its samples; native Back returns to directory then Settings.
2. iPad: the same directory and pushed samples; verify landscape and portrait. Close Settings leaves the catalog and returns to the tabs.
3. Exercise Button interaction and file context actions through their sample maps. In an isolated development run disable the development guard: Settings entry/active route disappear and direct links return to Settings. Restore the guard afterward.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Catalog routes are development-only; release builds must not expose them. Phone and iPad share the same directory and routes.
