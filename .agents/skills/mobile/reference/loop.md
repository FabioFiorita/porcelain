# Development and delivery loop

Four flows, one fork: did the native fingerprint move? `eas fingerprint:compare` answers it. Guessing
is what spends the quota.

Plan limits that shape every choice: **15 iOS builds** and **60 workflow minutes** a month. A
workflow run costs ~2.4 minutes (fingerprint 65s, update 81s) before anything reaches a tester, so
the allowance is ~25 runs. EAS Update's own limits — 1,000 monthly active users, 100 GiB bandwidth —
are not a real constraint at this app's scale.

## 1. JS change, see it on the simulator — free

The dev client already installed on the Mac's simulator loads the bundle from Metro on the Linux
host over the LAN. Nothing is built, nothing is installed, no SSH is needed.

```bash
pnpm mobile:start          # Metro on the host
pnpm mobile:dev:remote     # or: check the Mac preview, start it if down, then Metro
```

Pair the app with the host's **LAN address**, never `127.0.0.1` — on the simulator that resolves to
the Mac.

## 2. Native change, see it on the simulator — free, on the Mac

A moved fingerprint needs a new dev-client binary. `sim:build` passes `--local`, so it compiles on
the machine that runs it and costs no build credit — which means it must run on the Mac, where
Xcode, fastlane and CocoaPods live.

```bash
pnpm mobile:sim:build                                                          # on the Mac
pnpm mobile:sim:install:local --path build-*.tar.gz --simulator 'iPhone 17 Pro'  # on the Mac
```

**UNVERIFIED:** no `--local` build has completed yet. It needs a Mac checkout plus that toolchain.
Until one run proves it, the fallback below is the known-good path.

```bash
pnpm mobile:sim:build:cloud                            # builds on EAS — spends one of 15
pnpm mobile:sim:install --simulator 'iPhone 17 Pro'    # on the Mac
```

Traps:

- **`--latest` means the latest *EAS* build.** `sim:install` downloads from EAS, so running it after
  a local build silently installs an older cloud artifact. Local pairs with `sim:install:local
  --path`, never with `sim:install`.
- **`--simulator` is effectively required.** Its help claims a prompt when omitted, but with a
  simulator already booted `build:run` silently installs to that one — so on a Mac running an iPhone
  and an iPad sim it lands on whichever booted first. Pass the exact name from `xcrun simctl list
  devices`. One `.app` installs on every simulator (an arm64 slice, not device-specific), so a second
  target never needs a second build.
- **`development-simulator` is a separate profile** because a simulator build is an unsigned arm64
  `.app`; the plain `development` profile produces a device `.ipa` no simulator can install.
- **A JS edit never needs this flow.** `ios.supportsTablet` is the corollary that bites: it is an
  `app.config.ts` flag, so an iPad fix cannot arrive over Fast Refresh however many times you
  reinstall.

## 3. JS change, get it to the phone — free

`eas update` bundles locally and uploads. No EAS worker, no workflow minutes, no build credit.

```bash
cd apps/mobile
eas update --channel preview --message "..."
```

**It fails silently if the fingerprint moved.** Under the fingerprint policy the update publishes
under a runtime version no installed build carries, so it succeeds and reaches nobody. Check first.

## 4. Native change, get it to the phone — one build

```bash
eas workflow:run .eas/workflows/preview.yml
```

The workflow makes the build-or-update decision itself: fingerprint matches an existing `preview`
build → EAS Update; fingerprint moved → a build, then TestFlight. Dispatch it when a session is
worth delivering — only the last commit of a session is observable to a tester anyway.

Both workflows are dispatch-only and `pnpm lint:eas` fails if an automatic trigger appears; the
reasoning is in `scripts/lint-eas-triggers.mjs`. `production.yml` adds App Store submission, off by
default while the app is out of the store.

Delivery uses `type: submit`, not `testflight` — the latter is paid-tier when given an EAS
`build_id`. Builds reach TestFlight and auto-distribute to internal groups, but carry no per-build
"What to Test" note. The submit job needs App Store Connect credentials on EAS or the run fails
there, after the build has already been spent.

## Two apps on one device

`app.config.ts` maps `APP_VARIANT` (set per profile in `eas.json`) to bundle identifier, name, scheme
and icon. The `development` profile builds **Porcelain Dev** (`…porcelain.dev`, blue icon); every
other profile builds **Porcelain** (`…porcelain`, white icon), the TestFlight identity. They install
side by side. A distinct bundle identifier only creates an App ID in the developer portal — App Store
Connect never sees it, so no dev build can disturb TestFlight. The production strings feed the
fingerprint, so changing one strands the installed app on a runtime version no update targets.

For a physical device, register it **before** building: the ad-hoc profile embeds UDIDs at build
time, so registering afterwards means building again.

```bash
pnpm mobile:dev:device   # open the link on each device, install the profile
pnpm mobile:dev:build    # device .ipa, installs over the air from the EAS page
```

## Startup metrics

`expo-observe` reports launch performance only. The root layout is wrapped in `ObserveRoot.wrap`
(cold and warm time-to-first-render) and each tab screen renders `<ObserveInteractiveMarker />`.
The `expo-router` integration and `Observe.logEvent` are **deliberately unconfigured** — their
dashboards are a paid tier. Traps: only the **first** `markInteractive` per session counts, so a
marker above loaded content silently degrades TTI into a second TTR; debug builds never dispatch
unless `dispatchInDebug: true`; and `expo-observe` is native, so adding it moved the fingerprint.
