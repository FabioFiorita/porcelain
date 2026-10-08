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
  - 'Architecture overview'
  - 'Agent summary'
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
- the sidebar group of a paired computer, then its worktree's Review → Agent summary

## Driving it

Start two disposable desktop instances and read their connection files. Run the second card's exact `pairing.command` to issue a one-time link. In the first app, use renderer browser tools or Computer Use to open Settings › Remote computers, enter the link and choose Add.

Observe the second environment in the list. Inspect the first card's `credentialFiles.remoteEncrypted`: it must have mode 0600 and contain ciphertext. Do not retain the pairing code or decrypted credentials in screenshots or logs.

For direct bridge proof, import the shared lifecycle and use `electron.firstWindow()` with the app's public `porcelainDesktop.credentials` bridge. Verify write/read/clear against the disposable profile; never expose that bridge through a helper RPC. Keychain writes require a macOS logged-in session.

Open the paired computer's worktree, then select Agent summary in the published review. Architecture is the initial presentation. Inspect theme and layer navigation, and verify the summary cannot reach Node or the app bridge. Returning from a layer uses the document tab titled Architecture overview, then Agent summary again. The named e2e test supplies the remote review and checks network isolation.

## What proves it works

- `apps/desktop/spec/e2e/bridge.e2e.ts` (Playwright Electron): one opaque string kept encrypted with mode 0600 and restored after a restart; undecryptable credentials read as unreadable, are never saved over, and Settings says so; unavailable encryption refuses a write and keeps the ciphertext; clear removes it; a window the app did not open is refused every credential and app update request; the bridge reports the version and that the local build has no update feed.
- `apps/desktop/spec/e2e/review-summaries.e2e.ts` (Playwright Electron): local and remote summaries render through the app origin in their sandbox with theme and layer links, cannot reach the app, Node or the bridge, and cannot show a website.

## Gotchas

- `safeStorage` needs the Keychain of the logged-in session. Over SSH every credential write fails with “User interaction is not allowed”; run the instance or the tests in a Terminal window of the logged-in session (see the skill).
- Each `start` has a fresh profile, so persistence across a restart is proven by the e2e test, not by driving.
- The remote-summary test closes the second app's setup window while keeping its server, establishes the primary app's focus, waits for the loaded summary and focuses the intended link. A parent observer requires its trusted activation because the transition can replace the iframe. Release Enter only after the layer tab takes focus or the blocked website's error document loads.
- Require the actual layer opening, or an enforced `frame-src` violation in the app document with zero website requests at Electron's network port. The request observer cancels any unexpected request to keep the test off the public network, and that request still fails the assertion.
