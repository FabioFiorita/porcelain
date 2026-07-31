# Porcelain mobile

The native Porcelain client is an **iOS-only** Expo SDK 57 app. Its starter
shell uses Expo Router native tabs and `@expo/ui/swift-ui` components.

`app.json` declares `"platforms": ["ios"]`, so prebuild, EAS, and Metro only
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
  module, an `app.json` change, an SDK bump. Pure JS/TS edits reach the running
  app through Fast Refresh, and step 2 would just reinstall the same binary. The
  corollary bites: `ios.supportsTablet` is an `app.json` flag, so an iPad fix
  cannot arrive over Fast Refresh no matter how many times you reinstall.

To pair the app with the dev daemon, use the host's **LAN address**, never
`127.0.0.1` — on the simulator that resolves to the Mac. See
`docs/plans/README.md` → *Shared verification recipe*.

## Shell: four tabs

The client has four stable native tabs — **Files · Changes · Review ·
Terminal** — and each owns its own stack, so deeper screens are pushed instead
of becoming tabs. Mobile deliberately carries fewer tabs than the desktop app:

| Desktop surface | Where it lives on mobile |
| --- | --- |
| History | pushed from the **Changes** header (commit history reads as part of the working tree story) |
| Board | pushed from the **Review** header (a board card starts a review; the two are coupled) |
| Search | the **Files** header search bar, not a tab |
| Settings | a root-level route presented as a form sheet, reachable from every tab's header gear |

Settings itself is a nested stack: root list → Environments (daemons paired
with this device over LAN or Tailscale) · Appearance · About.

The same four triggers drive both presentations: iPhone gets the bottom tab
bar, and `sidebarAdaptable` lets iPadOS/macOS promote them to the system side
tab bar and sidebar. There is one tab list, never a second iPad-only one.

That promotion needs **`ios.supportsTablet: true`** (`app.json`), which was
missing until 2026-07-31. Without it Expo emits `UIDeviceFamily = [1]` and the
app runs on iPad in iPhone **compatibility mode** — a fixed portrait window that
will not rotate and never reaches the regular horizontal size class the sidebar
depends on. If iPad looks like a scaled phone, check that flag first, and
remember it is native: it needs a rebuild, not a reload.

## Delivery

Two EAS workflows in `.eas/workflows/`:

| File | Trigger | What it does |
| --- | --- | --- |
| `preview.yml` | mobile PRs into `main`, mobile pushes to `main` | Fingerprint matches an existing `preview` build → EAS Update (free). Fingerprint moved → new build → TestFlight. |
| `production.yml` | manual `eas workflow:run` only | The same build-or-update shape plus App Store submission, deliberately not automatic while the app is out of the store. |

The submit job needs App Store Connect credentials configured on EAS before it
can run non-interactively; until then a native change builds but stops there.

Delivery uses the `submit` job, not the richer `testflight` one: a `testflight`
job that takes an EAS `build_id` is paid-plan only, so on the current plan it
fails to start (seen 2026-07-31). The build still reaches TestFlight and
auto-distributes to internal groups that have auto-distribute enabled — what is
deliberately absent is the per-build **"What to Test" note**, along with explicit
group targeting and Beta App Review submission. The free way to get notes back is
to connect App Store Connect under Project settings > Connections and add a
second workflow triggered on `app_store_connect.build_upload` that runs
`testflight` with `asc_build_id`; that variant is not plan-gated.

## Startup metrics

`expo-observe` reports launch performance to EAS Observe. The root layout is
wrapped in `ObserveRoot.wrap` (cold and warm time-to-first-render) and each of
the four tab screens renders `<ObserveInteractiveMarker />`, which marks
time-to-interactive for the launch — only the first mark in a session counts, so
whichever tab the app restores into supplies it.

Per-route navigation metrics (`Observe.configure({ integrations: … })`) and
custom `Observe.logEvent` calls are deliberately absent: their dashboards start
at the Production plan, so on the current plan they would ship data that cannot
be read. Two things to know when reading the numbers:

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
