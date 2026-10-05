---
selectors:
  - porcelain:credentials-read
  - porcelain:credentials-write
  - porcelain:credentials-clear
  - credentials.enc
  - 'Remote computers'
  - 'Pairing link'
  - 'Saved remote computers could not be read'
  - 'Read saved environments'
tests:
  - apps/desktop/spec/e2e/bridge.e2e.ts
  - apps/desktop/spec/e2e/review-summaries.e2e.ts
api: []
---

# access.remote-credentials

## What it is

The Mac app keeps the remote computers the owner pairs, with their bearer credentials, as one opaque string the web hands to the desktop bridge. The main process encrypts it through Electron's `safeStorage`, backed by the login Keychain, into `credentials.enc` in the profile, readable only by the owner. Credentials it cannot decrypt read as unreadable and are never saved over; with encryption unavailable a write is refused; clear removes the file. Only the app's own window may call the bridge. A paired computer's review summaries then load through the app from that computer, sandboxed away from the app, Node and the bridge.

## How a user reaches it

- Settings › Remote computers › paste a pairing link › Add
- the sidebar group of a paired computer, then its worktree's Review summary

## Driving it

Start two instances, the app under test and a second computer: `.agents/skills/desktop-verify/scripts/cli start`, twice. Every command then takes `--instance <id>`.

### A paired computer is kept encrypted in the profile

Issue a pairing link on the second instance's server, with the profile its `start` printed:

```sh
pnpm --filter @porcelain/server start status --data-directory <second profile>/server
pnpm --filter @porcelain/server start pair "Desktop verification" --data-directory <second profile>/server --address <its address>
```

Then, on the first instance:

```sh
.agents/skills/desktop-verify/scripts/cli click --role button --name "Settings" --instance <first>
.agents/skills/desktop-verify/scripts/cli click --role button --name "Remote computers" --instance <first>
.agents/skills/desktop-verify/scripts/cli fill --role textbox --name "Pairing link" "<link>" --instance <first>
.agents/skills/desktop-verify/scripts/cli click --role button --name "Add" --instance <first>
.agents/skills/desktop-verify/scripts/cli snapshot --instance <first>
ls -l <first profile>/credentials.enc
```

After the snapshot, look for: the second computer's name in the Remote computers list. `ls` shows `credentials.enc` with mode `-rw-------`; its bytes are ciphertext, never the pairing link or a bearer. The evidence records the link as `[redacted]`.

### The paired computer's summary stays sandboxed

Open the second computer's worktree from its sidebar group, then its Review summary, and `screenshot`. Publishing a review there is part of the e2e test; driving it needs a published review on the second computer.

## What proves it works

- `apps/desktop/spec/e2e/bridge.e2e.ts` (Playwright Electron): one opaque string kept encrypted with mode 0600 and restored after a restart; undecryptable credentials read as unreadable, are never saved over, and Settings says so; unavailable encryption refuses a write and keeps the ciphertext; clear removes it; a window the app did not open is refused every credential and app update request; the bridge reports the version and that the local build has no update feed.
- `apps/desktop/spec/e2e/review-summaries.e2e.ts` (Playwright Electron): local and remote summaries render through the app origin in their sandbox with theme and layer links, cannot reach the app, Node or the bridge, and cannot show a website.

## Gotchas

- `safeStorage` needs the Keychain of the logged-in session. Over SSH every credential write fails with “User interaction is not allowed”; run the instance or the tests in a Terminal window of the logged-in session (see the skill).
- Each `start` has a fresh profile, so persistence across a restart is proven by the e2e test, not by driving.
- The remote-summary test closes the second app's setup window while keeping its server, establishes the primary app's focus, waits for the loaded summary and focuses the intended link. A parent observer requires its trusted activation because the transition can replace the iframe. Release Enter only after the layer tab takes focus or the blocked website's error document loads.
- Require the actual layer opening, or an enforced `frame-src` violation in the app document with zero website requests at Electron's network port. The request observer cancels any unexpected request to keep the test off the public network, and that request still fails the assertion.
