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

## Delivery

Two EAS workflows in `.eas/workflows/`:

| File | Trigger | What it does |
| --- | --- | --- |
| `preview.yml` | mobile PRs into `main`, mobile pushes to `main` | Fingerprint matches an existing `preview` build → EAS Update (free). Fingerprint moved → new build → TestFlight. |
| `production.yml` | manual `eas workflow:run` only | The same build-or-update shape plus App Store submission, deliberately not automatic while the app is out of the store. |

The TestFlight job needs App Store Connect credentials configured on EAS before
it can run non-interactively; until then a native change builds but stops there.

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
