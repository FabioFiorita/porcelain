---
selectors:
  - 'Porcelain refuses to start with the debugging switch'
  - 'Porcelain refuses to start with'
tests:
  - apps/desktop/src/rules/launch-refusal.spec.ts
api: []
---

# app.installed-lock

## What it is

The installed app, `/Applications/Porcelain.app`, is locked against debugging, because anyone running as the owner could otherwise start it under a debugger and read the credentials it keeps in the Keychain. The build flips its Electron fuses (no run as Node, no `NODE_OPTIONS`, no Node inspect arguments, embedded ASAR integrity validation, the app loaded only from its ASAR, encrypted cookies, no extra `file://` privileges), and the packaged host refuses to start, before it takes its single-instance lock or creates a profile, when launched with a debugging switch or with `ELECTRON_RUN_AS_NODE` or `NODE_OPTIONS` set. `NODE_OPTIONS` never reaches the app once its fuse is off, so that launch starts as usual.

## How a user reaches it

- nobody does: the lock refuses an attacker's launch, and the owner sees the app start as usual

## Driving it

This is outside the disposable interactive journey. Run it only when explicitly requested after a build changing the lock has been installed: it launches the installed app. It needs no launcher instance and runs over SSH. A successful local development journey or an unrun recipe does not certify this lock.

```sh
.agents/skills/desktop-verify/scripts/cli installed-check
```

Look for, in the printed report and `installed-check.json` in its evidence folder:

- every fuse's `state` equal to its `locked` value;
- `inspect`, `remote-debugging-port` and `run-as-node` exit with a non-zero code and no signal, their output says “Porcelain refuses to start with …”, and `profileCreated` is false;
- `node-options` has `serverStarted` true and exit code 0;
- every launch has `debuggingEndpointOpened` and `nodeCodeRan` false;
- `runningCopies.before` equals `runningCopies.after`, and `ownerProfileUnchanged` is true.

## What proves it works

- `apps/desktop/src/rules/launch-refusal.spec.ts` (unit): the packaged host refuses each debugging switch and Node variable, and an unpackaged one starts.
- `installed-check` above, on the installed build; the fuses are flipped by `pnpm desktop:build` and exist only in the packaged app, so no test of a change can reach them.

The refusal rule has a focused source regression that does not access the installed app:

```sh
pnpm exec vitest run --project @porcelain/desktop apps/desktop/src/rules/launch-refusal.spec.ts
```

## Gotchas

- A freshly signed build asks for the Keychain before its first use in the logged-in session; the `node-options` launch starts the app, so run the check over SSH or answer that prompt.
- Playwright cannot drive the installed app, by design of this lock.
