---
route: /
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Updates"
  - "This is the newest version."
  - "Reload"
tests:
  - apps/web/spec/e2e/access-service-update.e2e.ts
api:
  - GET /api/service/update
  - POST /api/service/update
---

# access.service-update

## What it is

Settings shows the running version and the newer one the server offers; updating shows its progress, a failed update says why and that Porcelain still runs the version it had, and a successful one ends on the new version with an offer to reload.

## How a user reaches it

- Settings → Updates → Update to <version>

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### The owner updates Porcelain from Settings, sees a failed update keep the running version and why, then updates to the new version

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Updates"`
   Look for: the text “Porcelain <from>” shows; the text “Porcelain <to> is available.” shows.
4. `.agents/skills/web-verify/scripts/cli click --role main --name "Settings"`
   Look for: the text shows; the main “Settings” shows; the text shows.
5. `.agents/skills/web-verify/scripts/cli click --role main --name "Settings"`
   Look for: the text shows; the main “Settings” shows; the text “Porcelain <to>” shows; the text “This is the newest version.” shows; the button “Reload” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-service-update.e2e.ts` (Playwright e2e): the owner updates Porcelain from Settings, sees a failed update keep the running version and why, then updates to the new version.
- The tests read back what the server kept through the kit: `server.serviceUpdate()`.

## Gotchas

- None known.
