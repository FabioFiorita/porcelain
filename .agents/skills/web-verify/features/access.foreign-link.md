---
route: /pair
selectors:
  - "This browser is not paired"
  - "This link was made for a different Porcelain installation."
tests:
  - apps/web/spec/e2e/access-foreign-link.e2e.ts
api:
  - GET /api/health
---

# access.foreign-link

## What it is

A pairing link whose installation id is not this server's is refused after the web reads the real server's health: the not-paired page says the link was made for a different installation, and no device is paired.

## How a user reaches it

- Open a pairing link (`/pair#c=<code>&e=<installation id>`) made by another Porcelain installation.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. The link check runs before any code is redeemed, so a hand-made link with any non-empty code and a random installation id reproduces it; no real link is needed.

### Setup

None.

1. `$C open "/pair#c=not-for-this-server&e=00000000-0000-4000-8000-000000000000"`
   Look for: heading "This browser is not paired" and a destructive alert reading "This link was made for a different Porcelain installation."; Page URL `/pair` with no `#c=` fragment (the loader strips it before checking).
2. `$C network`
   Look for: `GET /api/health` answered 200 and NO `POST /api/pair` after it.
3. `$C open /`
   Look for: the workspace again (region "Review content", Page Title "Changes — repository"): the refused link did not touch this browser's existing session.

## What proves it works

- The alert text "This link was made for a different Porcelain installation." under the not-paired heading, and `$C network` showing the health read without any `POST /api/pair`: no code was redeemed, so no device could be paired.
- Reading the device list back needs a CLI command that does not exist: `cli server devices` (no new device should appear).
- `apps/web/spec/e2e/access-foreign-link.e2e.ts`: opening a link with a random installation id shows the different-installation message and the not-paired heading, and `server.devices()` gains no device with the link's label.

## Gotchas

- Quote the route: the shell treats `&` and `#` specially.
- Both `c` and `e` must be non-empty; a link missing either shows "That link carried no pairing code." instead.
- The CLI browser is already paired; `/pair` renders the not-paired page whatever the session state, so the heading alone does not prove anything about pairing. The alert text and the network log do.
- To exercise the real-link variant with this instance's own id (which would then fail on the code instead), the CLI would need `cli pair --foreign` / a way to read `GET /api/health`; not required for this promise.
