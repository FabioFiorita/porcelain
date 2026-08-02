# Porcelain mobile client

These instructions apply to files under `apps/mobile/`. They describe the client architecture;
host-specific simulator access is in the ignored `AGENTS.local.md` beside this file and is only
needed for runtime, build, or evidence work.

## Architecture

- This is an iOS-only Expo SDK 57 client using Expo Router and the EAS development client. Do not
  add Android branches, Expo Go assumptions, or a second native client architecture.
- Use `@expo/ui/swift-ui` and its modifiers. Never import the universal `@expo/ui` root or `Host`.
- Keep feature code in `src/features/<feature>/`; routes under `src/app/` stay thin re-exports and
  layout declarations.
- `src/lib/daemon/` is the only daemon seam. Procedures are hand-declared and zod-parsed; never
  import the desktop daemon's `AppRouter` into the mobile TypeScript program.
- Use the existing React Query + zustand seams and the app-event invalidation path. Do not create a
  second transport, query client, or mobile-only daemon protocol.
- iPhone uses the native tab presentation. The eventual iPad root SplitView belongs in the root
  layout and shares the route table; do not create a separate iPad navigation tree.
- Pure JS/TS changes use Metro Fast Refresh. Native dependency, SDK, app-config, or device-family
  changes require a new EAS simulator build and Mac-side installation.

## Normal development

From the repository root:

```bash
pnpm mobile:start
pnpm typecheck:mobile
```

The ordinary app/daemon implementation loop does not require the simulator runbook. When runtime
proof or a native simulator build is actually needed, read `apps/mobile/AGENTS.local.md` first.

## Product boundaries

- Mobile is a separate native client of the same daemon, not a renderer port. Do not reuse desktop
  DOM components, Tailwind, shadcn primitives, or desktop shell state in SwiftUI-backed screens.
- Keep Changes as the home for diffs, staging, commit, contextual Read/Review, and History. Keep
  Settings as its own tab and preserve the five-tab ceiling unless the product direction changes.
- Treat every iPad presentation claim as unproven until it has runtime evidence from an iPad.

## Verification

- Static gate from the repository root: `pnpm verify`.
- Use the dev daemon on `43118`, never production `43117`; worktrees use their assigned
  `43200–43999` port.
- For mobile runtime/build/evidence steps, the local runbook supplies the Linux/Mac ownership,
  SSH alias, Metro LAN rule, serve-sim endpoints, and native-install limits.
