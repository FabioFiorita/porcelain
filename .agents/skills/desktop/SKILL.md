---
name: desktop
metadata:
  internal: true
description: "Build, run, and prove Electron-specific behavior in apps/desktop: shell lifecycle, preload/IPC, menus, windows, native integrations, and Mac packaging. Load only for an Electron shell task; use web-e2e for renderer/browser proof."
---

# Desktop shell

Read `docs/development.md` first for the shared development loop, worktree, daemon, Playground,
and process-ownership flow. This skill owns only Electron-specific commands and evidence. Use the
`web-e2e` skill for browser-renderer behavior; these are sibling proof branches.

## Local loop

Run commands from the repository root unless a command says otherwise:

```bash
pnpm --dir apps/desktop typecheck:node
pnpm --dir apps/desktop test -- src/preload/bridge.test.ts
pnpm --dir apps/desktop dev
```

Use the focused node typecheck and relevant Vitest files while iterating. `pnpm --dir apps/desktop
dev` launches the Electron shell and its renderer; stop only the process you started when the proof
ends.

## Native Electron proof

Native Playwright runs are Mac-local because they launch a real Electron binary:

```bash
pnpm --dir apps/desktop test:e2e:native:prebuilt
pnpm --dir apps/desktop test:e2e:native
pnpm --dir apps/desktop test:e2e:native:update
```

Use `:prebuilt` only when the current desktop output is fresh. The non-prebuilt command rebuilds
first. Use this branch for shell lifecycle, preload/IPC, terminal-native behavior, menus, windows,
and other Electron-only paths. Do not run it for a web-only change.

When writing a native regression, keep selectors and assertions in the existing
`apps/desktop/e2e/` helpers. Keep daemon and repository fixtures isolated, and inspect the final
window state rather than treating a clean process exit as proof.

## Packaging smoke

For packaging or updater changes, build the Mac artifact without publishing:

```bash
pnpm --dir apps/desktop package:mac
```

Then perform the release-specific smoke required by `releasing`: launch the installed app, confirm
the daemon starts, exercise a terminal PTY when relevant, and verify that Electron does not enter
Node mode unexpectedly. Never publish from this skill.

## Completion

Desktop proof is complete when the affected Electron-only path was exercised on the appropriate
Mac runtime or the focused native test ran, the final behavior was inspected, and the command/result
is reported. Renderer-only behavior belongs to `web-e2e`; shared setup belongs to
`docs/development.md`.
