# Porcelain mobile client

These instructions apply to files under `apps/mobile/`. Read the **`mobile` skill** before changing
anything here — it carries the platform decisions, the fingerprint-gated development and delivery
loop, and the traps. This file is only what must be true without loading it.

## Non-negotiable

- iOS-only Expo SDK 57, Expo Router, EAS development client. Never add Android branches, Expo Go
  assumptions, or a second native client architecture.
- Use `@expo/ui/swift-ui` and its modifiers. Never import the universal `@expo/ui` root or `Host`.
- Feature code lives in `src/features/<feature>/`; `src/app/` stays thin re-exports and layouts.
- `src/lib/daemon/` is the only daemon seam. Procedures are hand-declared and zod-parsed; never
  import the desktop daemon's `AppRouter`. Use the existing React Query + zustand seams and the
  app-event invalidation path — no second transport, query client, or mobile-only protocol.
- Mobile is a separate native client of the same daemon, not a renderer port. Do not reuse desktop
  DOM components, Tailwind, shadcn primitives, or desktop shell state.
- Treat every iPad presentation claim as unproven until it has runtime evidence from an iPad.

## Before you build or deliver

**Ask whether the native fingerprint moved** — `eas fingerprint:compare`. A JS/TS change reaches the
simulator through Metro Fast Refresh and the phone through `eas update`, both free and neither
needing a build or a workflow run. Only a moved fingerprint justifies either. The four flows and
their costs are in the `mobile` skill's `reference/loop.md`; guessing here is what spends the
monthly quota.

## Normal development

```bash
pnpm mobile:start
pnpm typecheck:mobile
pnpm verify          # from the repository root, before any commit
```

Use the dev daemon on `43118`, never production `43117`; worktrees use their assigned `43200–43999`
port.

Host-specific simulator access — SSH alias, Metro LAN rule, serve-sim endpoints, native-install
limits — is in the ignored `AGENTS.local.md` beside this file, needed only for runtime or evidence
work.
