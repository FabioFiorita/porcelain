---
route: /settings/$section
selectors:
  - 'Computers'
  - 'Open This computer'
  - 'Update'
  - 'Up to date'
  - 'Reload'
tests:
  - apps/web/spec/e2e/access-service-update.e2e.ts
api:
  - GET /api/service/update
  - POST /api/service/update
---

# access.service-update

Browser Settings → Computers → Open This computer shows the current service version, latest offer and Update action. These controls and global Update all use the same shared update owner. A Mac app host uses its app updater instead of this API. Unmanaged services remain visible with the explanatory text and are excluded from Update all.

## Driving it

Use the sandbox's scripted updater: 1.0.0 → 1.1.0, with the first attempt failing and the next succeeding. Open This computer, verify the installed/latest versions, and click Update <computer name>. Progress and then the literal failure reason appear while the installed version remains unchanged. Retry. Wait for Updated to 1.1.0., installed version 1.1.0, Up to date and Reload. Reload is offered for the current browser after a successful update.

## What proves it works

The named E2E checks the failed attempt, retry, confirmed installed version and reload. Running it is parent-owned; do not run a real installed service updater during verification.
