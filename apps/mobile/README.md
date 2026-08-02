# Porcelain mobile

The native Porcelain client is an **iOS-only** Expo SDK 57 app. Its starter
shell uses Expo Router native tabs and `@expo/ui/swift-ui` components.

The Files tab is a read-only, daemon-backed repository browser: drill through
folders, search filenames, and open text, image, binary, or oversized-file
states without copying repository contents onto the phone.

`app.config.ts` declares `"platforms": ["ios"]`, so prebuild, EAS, and Metro only
ever consider iOS. There is no Android target and no Play Store account behind
one — write iOS code directly and never add a `Platform.OS` branch, an
`.android.tsx` twin, or a raster twin of an SF Symbol.

From the repository root:

```bash
pnpm install
pnpm mobile:start
```

Or start Expo directly:

```bash
cd apps/mobile
npx expo start
```

To expose Expo's local development MCP server while Metro is running:

```bash
pnpm mobile:start:mcp
```

## Two apps on one device

`app.config.ts` maps `APP_VARIANT` (set per profile in `eas.json`) to a bundle
identifier, name, scheme, and icon. The `development` profile builds **Porcelain
Dev** (`…porcelain.dev`, blue icon); every other profile builds **Porcelain**
(`…porcelain`, white icon), the TestFlight identity. The two install side by side.

A distinct bundle identifier only creates an App ID in the developer portal —
App Store Connect never sees it, so no dev build can disturb TestFlight. The
production strings feed the native fingerprint, so changing one strands the
installed app on a runtime version no update targets.

Register a device **before** building for it: the ad-hoc profile embeds UDIDs at
build time, so registering afterwards means building again.

```bash
pnpm mobile:dev:device   # open the link on each iPhone/iPad, install the profile
pnpm mobile:dev:build    # device .ipa, installs over the air from the EAS page
```

## Running it on the Mac's iOS simulator

The repo lives on the Linux host; the simulator lives on the Mac. Metro runs on
the host and the simulator loads the bundle over the LAN, so the only Mac-side
step is installing the dev client — and only when the native fingerprint moved.

All three steps are repo-root scripts, so nothing here is a command to remember:

```bash
# 1. On the host — build a SIMULATOR dev client (arm64 .app, not an .ipa).
pnpm mobile:sim:build

# 2. On the Mac, from its checkout — download, install, and launch it.
#    `build:run` does the tarball + `simctl install` dance for you.
#    ALWAYS name the target; see below.
pnpm mobile:sim:install --simulator 'iPhone 17 Pro'

# 3. Back on the host — Metro. Repeat only this for JS changes.
pnpm mobile:start
```

For the usual Linux host → Mac simulator loop, one command checks the Mac
preview and starts it when needed before starting Metro:

```bash
pnpm mobile:dev:remote
```

Metro stays on this checkout and serves the bundle over LAN; the Mac-side
`serve-sim` preview is available at `http://<sim-host>:3200`. The command uses
the SSH alias `mac` and preview host `macbook.local` by default. Override them
with `--ssh-alias` / `--sim-host` when a machine uses different names. Extra
arguments are passed to Expo, for example
`pnpm mobile:dev:remote -- --clear`. Ctrl-C stops Metro and leaves the preview
running for the next session; stop it explicitly with
`pnpm mobile:dev:remote -- --stop-sim`.

The preview exposes simulator control endpoints, so use it only on a trusted
LAN. An SSH tunnel can be used instead when the Mac should not bind the preview
to the LAN.

Extra flags pass through both delegation hops (root → `apps/mobile` → `eas-cli`),
which is why the simulator name is an **argument** and not baked into the script:
device names are per-machine, and the repo should not carry one maintainer's
simulator list.

All of these are saved **Porcelain actions** on this repo — *iOS sim: build dev
client (EAS)*, *iPhone sim: install on this Mac*, *iPad sim: install on this Mac*,
*Metro (mobile dev server)*, *Metro + Expo MCP* — each running the script above
rather than a pasted command, so editing the script updates every button. The two
install actions are `where: local`, so they run on the Mac even though the window
is bound to the host daemon; the build and Metro actions run on the host, where
the repo is.

Three things that bite:

- **`development-simulator` is a separate profile** (`eas.json`) because a
  simulator build is an unsigned arm64 `.app`; the plain `development` profile
  produces a device `.ipa` the simulator cannot install.
- **`--simulator` is effectively required.** The flag's help says you are
  prompted when it is omitted, but with a simulator already booted `build:run`
  silently installs to that one — so omitting it on a Mac running both an iPhone
  and an iPad sim always lands on whichever booted first. Pass the exact name
  from `xcrun simctl list devices`. One `.app` installs on every simulator (it is
  an arm64 simulator slice, not device-specific), so targeting a second one never
  needs a second build.
- **Step 1 is only needed when the native fingerprint changes** — a new native
  module, an `app.config.ts` change, an SDK bump. Pure JS/TS edits reach the running
  app through Fast Refresh, and step 2 would just reinstall the same binary. The
  corollary bites: `ios.supportsTablet` is an `app.config.ts` flag, so an iPad fix
  cannot arrive over Fast Refresh no matter how many times you reinstall.

To pair the app with the dev daemon, use the host's **LAN address**, never
`127.0.0.1` — on the simulator that resolves to the Mac. See
`docs/plans/README.md` → *Shared verification recipe*.

## Shell: five tabs

The client has five stable native tabs — **Files · Changes · Board · Terminal ·
Settings** — and each owns its own stack, so deeper screens are pushed instead
of becoming tabs. Review and Read are contextual destinations inside Changes:
they appear only when there is a changed tree or an agent-published Review.
Mobile deliberately carries fewer tabs than the desktop app:

| Desktop surface | Where it lives on mobile |
| --- | --- |
| History | pushed from the **Changes** header (commit history reads as part of the working tree story) |
| Read | a contextual row in **Changes**, only when there are changed files |
| Review | a contextual row in **Changes**, only when the agent published one |
| Search | the **Files** header search bar, not a tab |
| Settings | its own tab; environment groups push a detail screen |

**Five is the ceiling.** iOS collapses a sixth tab into a system "More" tab, so
anything else earns its place by displacing one of these, not by being added.

The bolt remains the shared companion affordance. Changes opens its existing
form sheet, now with the desktop command set (`status`, `pull`, `push`, `fetch`,
`stash`, and `stash pop`) alongside staging and commit actions. Settings keeps
the environment list, connection detail, pairing, reading preferences, and
pull behavior in one tab.

iPhone currently uses the bottom `NativeTabs` presentation. The iPad root
presentation belongs to the SplitView work in `docs/plans/01-files.md §2.7`;
this shell change does not claim that root split presentation. `ios.supportsTablet: true`
stays enabled because the eventual root SplitView requires the app binary to
include the iPad device family.

## Connection

`src/lib/daemon/` is the only way this app talks to a daemon: `DaemonProvider`
(root layout) owns the query client, hydration, the bootstrap sequence and the
`/session` socket; screens call `useDaemonQuery` / `useDaemonMutation` with a
descriptor from `procedures/*.ts` and wrap their body in `DaemonGate`.

Four rules hold that seam together:

- **Import the exact module — there is no barrel.** A tab slice adds
  `procedures/<tab>.ts` and appends to `app-events.ts`; it edits nothing else here.
- **Never import the daemon's `AppRouter`.** Procedures are hand-declared zod
  descriptors, and every response is parsed — contract drift has to fail as
  `invalid-response`, not as an undefined property three renders later.
- **WS frames come from `@porcelain/contracts`.** One definition of the protocol
  in the repo; re-declaring a schema locally is drift by construction.
- **Credentials live in `expo-secure-store`, one key per environment**
  (`porcelain.token.<id>`); the `porcelain.environments` index carries no token, so
  renaming an environment never rewrites one. An index that will not parse is kept
  under `porcelain.environments.corrupt` and reported, never silently dropped.

Query keys are `['daemon', envId, procedureName, input ?? null]` — the
environment id is in the key so switching daemons can never serve another one's
cache.

## Delivery

Two EAS workflows in `.eas/workflows/`:

| File | Trigger | What it does |
| --- | --- | --- |
| `preview.yml` | mobile PRs into `main`, mobile pushes to `main` | Fingerprint matches an existing `preview` build → EAS Update (free). Fingerprint moved → new build → TestFlight. |
| `production.yml` | manual `eas workflow:run` only | The same build-or-update shape plus App Store submission, deliberately not automatic while the app is out of the store. |

The submit job needs App Store Connect credentials configured on EAS before it
can run non-interactively; until then a native change builds but stops there.
Delivery uses `submit` rather than `testflight`, which is paid-tier when given an
EAS `build_id` — so builds reach TestFlight and auto-distribute to internal
groups, but carry no per-build "What to Test" note.

## Startup metrics

`expo-observe` reports launch performance to EAS Observe. The root layout is
wrapped in `ObserveRoot.wrap` (cold and warm time-to-first-render) and each of
the four tab screens renders `<ObserveInteractiveMarker />`, which marks
time-to-interactive for the launch — only the first mark in a session counts, so
whichever tab the app restores into supplies it.

Per-route navigation metrics (`Observe.configure({ integrations: … })`) and
custom `Observe.logEvent` calls are deliberately absent — their dashboards are a
paid EAS tier. Two things to know when reading the numbers:

- Debug builds do not dispatch. A dev-client run reports nothing unless
  `dispatchInDebug: true` is set temporarily.
- The marker fires on mount. Once a tab screen fetches real daemon data, move it
  below the loaded content or time-to-interactive just repeats
  time-to-first-render.

## Where code goes

```
src/app/        route table only — thin files that re-export a feature screen
src/features/   one folder per feature (files, changes, review, terminal, settings)
src/components/ shared presentational components (placeholder-screen, settings-toolbar)
src/theme/      shared design values (colors.tint is the single accent)
```

Never co-locate components, types, or utilities under `src/app` — that
directory holds routes and `_layout` files and nothing else. A new screen means
a file in `src/features/<feature>/<name>-screen.tsx` plus a one-line route file
that default-exports it. File names are kebab-case.

UI primitives are `@expo/ui/swift-ui` (`Host`, `List`, `Section`, `VStack`,
`Text`, …) with styling from `@expo/ui/swift-ui/modifiers`, plus Expo Router
navigation. The **universal `@expo/ui` root is banned** and `pnpm lint` fails on
it (`scripts/lint-escapes.mjs`): the app is iOS-only, so the portability layer
buys nothing and costs components — universal has 19 to SwiftUI's 51, and its
`Text` takes a plain string, which is what blocked syntax highlighting in the
diff reader. No shadcn, Tailwind, or DOM components here either.
