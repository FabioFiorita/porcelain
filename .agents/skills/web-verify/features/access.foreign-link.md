# access.foreign-link

## What it is

A pairing link whose installation id is not this server's is refused after the web reads the real server's health: the not-paired page says the link was made for a different installation, and no device is paired.

## How a user reaches it

- Open a pairing link (`/pair#c=<code>&e=<installation id>`) made by another Porcelain installation.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. The link check runs before any code is redeemed, so a hand-made link with any non-empty code and a random installation id reproduces it; no real link is needed.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

None.

1. Open `/pair#c=not-for-this-server&e=00000000-0000-4000-8000-000000000000` on the instance web URL
   Look for: heading "This browser is not paired" and a destructive alert reading "This link was made for a different Porcelain installation."; Page URL `/pair` with no `#c=` fragment (the loader strips it before checking).
2. Inspect browser network evidence
   Look for: `GET /api/health` answered 200 and NO `POST /api/pair` after it. `$C server devices` lists only "Development setup" and the "Verification browser" paired by following "Open workspace" from the startup attachment page.
3. Open `/` on the instance web URL
   Look for: the workspace again (region "Review content", Page Title "Changes — repository"): the refused link did not touch this browser's existing session.

## What proves it works

- The alert text "This link was made for a different Porcelain installation." under the not-paired heading, and browser network evidence showing the health read without any `POST /api/pair`: no code was redeemed, so no device could be paired.
- `$C server devices` gains no device from the refused link.
- `apps/web/spec/e2e/access-foreign-link.e2e.ts`: opening a link with a random installation id shows the different-installation message and the not-paired heading, and `server.devices()` gains no device with the link's label.

## Gotchas

- Quote the route: the shell treats `&` and `#` specially.
- Both `c` and `e` must be non-empty; a link missing either shows "That link carried no pairing code." instead.
- The verification browser is already paired; `/pair` renders the not-paired page whatever the session state, so the heading alone does not prove anything about pairing. The alert text and the network log do.
- The real-link variant with this instance's own id (which fails on the code instead) needs the environment id from `GET /api/health` (`curl -s "<web URL>/api/health"`); not required for this promise.
