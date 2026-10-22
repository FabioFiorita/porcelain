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

A pairing link whose installation id is not this server's is refused after the web reads the real server's health: the not-paired page says the link was made for a different installation, and no device is paired.

## How to get to it (user POV)

- Open a pairing link (`/pair#c=<code>&e=<installation id>`) made by another Porcelain installation.

## Driving it with browser

Preconditions: [surface baseline](README.md).

1. Navigate to `/pair#c=not-for-this-server&e=00000000-0000-4000-8000-000000000000`
   Expect: heading "This browser is not paired" and a destructive alert reading "This link was made for a different Porcelain installation."; URL `/pair` with no `#c=` fragment (the loader strips it before checking).
2. Inspect HTTP traffic
   Expect: `GET /api/health` answered 200 and NO `POST /api/pair` after it. `$C server devices` lists only "Development setup" and the "Verification browser" you paired with the card’s link.
3. Navigate to `/`
   Expect: the workspace again (region "Review content", title "Changes — repository"): the refused link did not touch this browser's existing session.

### Observable proof

Record health plus refusal with zero pairing POSTs and no new `$C server devices` entry.

Automated coverage: `access-foreign-link.e2e.ts`.

## Gotchas

- Quote URLs containing `&`/`#`. Both c/e must be nonempty; otherwise expect “That link carried no pairing code.”
- A paired browser also renders foreign-link refusal; use the alert/network/device readback, not just the not-paired heading.
- Testing the right-installation/wrong-code variant needs this fixture's environment ID from health.
