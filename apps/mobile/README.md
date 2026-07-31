# Porcelain mobile

The native Porcelain client is an Expo SDK 57 app. Its starter shell uses Expo
Router native tabs and universal `@expo/ui` components.

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
| Settings | a root-level route presented as a form sheet on iOS (full screen on Android), reachable from every tab's header gear |

Settings itself is a nested stack: root list → Environments (daemons paired
with this device over LAN or Tailscale) · Appearance · About.

The same four triggers drive both presentations: iPhone gets the bottom tab
bar, and `sidebarAdaptable` lets iPadOS/macOS promote them to the system side
tab bar and sidebar. There is one tab list, never a second iPad-only one.

## Delivery

Two EAS workflows in `.eas/workflows/`, both iOS-only (Android runs through the
local emulator loop):

| File | Trigger | What it does |
| --- | --- | --- |
| `preview.yml` | mobile PRs into `main`, mobile pushes to `main` | Fingerprint matches an existing `preview` build → EAS Update (free). Fingerprint moved → new build → TestFlight. |
| `production.yml` | manual `eas workflow:run` only | The same build-or-update shape plus App Store submission, deliberately not automatic while the app is out of the store. |

The TestFlight job needs App Store Connect credentials configured on EAS before
it can run non-interactively; until then a native change builds but stops there.

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

UI primitives are universal `@expo/ui` (`Host`, `List`, `Column`, `Text`, …)
and Expo Router navigation — no shadcn, Tailwind, or DOM components here.
