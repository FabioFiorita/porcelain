# access.remote-credentials

## What it is

The Mac app keeps the remote computers the owner pairs, with their bearer credentials, as one opaque string the web hands to the desktop bridge. The main process encrypts it through Electron's `safeStorage`, backed by the login Keychain, into `credentials.enc` in the profile, readable only by the owner. Credentials it cannot decrypt read as unreadable and are never saved over; with encryption unavailable a write is refused; clear removes the file. Only the app's own window may call the bridge. A paired computer's review summaries then load through the app from that computer, sandboxed away from the app, Node and the bridge.

## How a user reaches it

- Settings › Remote computers › paste a pairing link › Add
- the sidebar group of a paired computer, then its worktree's Review summary

## Driving it

This is a separate pairing/security journey; the local folder-picker and window journey does not certify it. Start two disposable instances with `.agents/skills/desktop-verify/scripts/cli start`, one app under test and one loopback fixture representing another computer. Select launcher commands by `--instance <id>` and bind CUA to each reported running bundle/PID. A loopback fixture does not establish LAN or remote-network behavior.

### A paired computer is kept encrypted in the profile

Read the second server's address and issue a pairing link using the profile its `start` printed:

```sh
pnpm --filter @porcelain/server start status --data-directory "<second profile>/server"
pnpm --filter @porcelain/server start pair "Desktop verification" --data-directory "<second profile>/server" --address "<its address>"
```

On the first app, use CUA or the skill's optional exact-CDP renderer recipe:

1. Open Settings, then Remote computers. Paste the fresh link into Pairing link and choose Add.
2. Wait for the second computer's name to appear once with Online status and its expected address. Record the visible result without exposing the pairing link or bearer credential. Return with Back and confirm its sidebar group appears.
3. Inspect `<first profile>/credentials.enc` metadata without printing its contents: require owner-only mode `-rw-------`. The bridge regression separately proves encrypted contents rather than plaintext; existence or mode alone does not prove encryption.
4. Return to Remote computers and choose Remove for this fixture after any summary checks. Require its row and sidebar group to disappear. Finish by stopping both exact launcher instances and reading their evidence.

Tool transcripts and screenshots may contain the pasted one-time link. Keep them private and redact secrets before sharing; direct CUA/CDP interaction has no launcher-wide redaction guarantee. Do not dump the encrypted store, decrypt credentials or use an installed app's profile.

### The paired computer's summary stays sandboxed

With a review published on the second disposable fixture, open its worktree from the first app's remote sidebar group and then its Review summary. Capture the rendered summary and follow a layer link through CUA or exact-CDP interaction. Require the expected layer to open. A summary screenshot does not prove the security boundary; the named regression checks sandboxing, bridge/Node/app access refusal and blocked website requests. If no published fixture review is available, report that summary case as unattempted.

## What proves it works

- `apps/desktop/spec/e2e/bridge.e2e.ts` (Playwright Electron): one opaque string kept encrypted with mode 0600 and restored after a restart; undecryptable credentials read as unreadable, are never saved over, and Settings says so; unavailable encryption refuses a write and keeps the ciphertext; clear removes it; a window the app did not open is refused every credential and app update request; the bridge reports the version and that the local build has no update feed.
- `apps/desktop/spec/e2e/review-summaries.e2e.ts` (Playwright Electron): local and remote summaries render through the app origin in their sandbox with theme and layer links, cannot reach the app, Node or the bridge, and cannot show a website.

Run only the relevant focused regression when its promise changes:

```sh
pnpm --filter @porcelain/desktop exec playwright test spec/e2e/bridge.e2e.ts
pnpm --filter @porcelain/desktop exec playwright test spec/e2e/review-summaries.e2e.ts
```

## Gotchas

- `safeStorage` needs the Keychain of the logged-in session. An SSH credential write can fail with “User interaction is not allowed”; run native work with direct UI access in the logged-in session. Record refused storage as a failed or blocked case.
- Each `start` has a fresh profile, so persistence across a restart is proven by the e2e test, not by driving.
- The remote-summary test closes the second app's setup window while keeping its server, establishes the primary app's focus, waits for the loaded summary and focuses the intended link. A parent observer requires its trusted activation because the transition can replace the iframe. Release Enter only after the layer tab takes focus or the blocked website's error document loads.
- Require the actual layer opening, or an enforced `frame-src` violation in the app document with zero website requests at Electron's network port. The request observer cancels any unexpected request to keep the test off the public network, and that request still fails the assertion.
