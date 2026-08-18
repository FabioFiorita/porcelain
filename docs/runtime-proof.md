# Runtime proof

Use runtime proof when the affected behavior must be observed in a real browser, Electron, or
iOS/Android client, or when the deliverable is an automated runtime regression. The shared task,
worktree, daemon, and process-ownership loop remains in [development.md](development.md).

Choose only the affected client branch. If a change spans clients, prove each branch separately
and report the clients that remain unproved.

## Browser

Use the in-app Browser for interactive proof when available. Use Playwright when the deliverable is
an automated regression or interactive Browser control is unavailable. Proof stays on the
development daemon and an isolated Playground; test-owned daemons use the E2E helpers' isolated
home, token, and fixture repository.

```bash
pnpm test:e2e
pnpm --dir apps/desktop test:e2e:prebuilt
pnpm --dir apps/desktop test:e2e:update
```

The first command rebuilds. Use `:prebuilt` only with fresh renderer output. Prefer the existing
fixtures, `loc.*`, and `TestIds` helpers in `apps/desktop/e2e/helpers/app.ts`. Restore repository
state mutated by a fixture, keep screenshot-sensitive suites at one worker, and inspect screenshot
differences before changing a baseline.

## Electron

Use this branch for shell lifecycle, preload/IPC, menus, windows, native integrations, or another
path a daemon-served browser cannot exercise. Renderer-only behavior uses the browser branch.

```bash
pnpm --dir apps/desktop typecheck:node
pnpm --dir apps/desktop test -- <focused-test>
pnpm --dir apps/desktop dev
```

For a native Electron regression on a Mac:

```bash
pnpm --dir apps/desktop test:e2e:native
pnpm --dir apps/desktop test:e2e:native:prebuilt
pnpm --dir apps/desktop test:e2e:native:update
```

Use `:prebuilt` only with fresh desktop output. Keep selectors and assertions in the existing E2E
helpers, preserve isolated daemon/repository fixtures, and inspect the actual window state. A clean
Electron exit is not evidence of the changed behavior. Packaging continues through
[release.md](release.md) after runtime proof supplies the client evidence.

## Mobile

First decide whether the native fingerprint moved:

```bash
eas fingerprint:compare
```

| Change | Simulator or emulator | Phone |
| --- | --- | --- |
| Fingerprint unchanged | Metro Fast Refresh | `eas update` |
| Fingerprint moved | Matching local native build, or EAS when local tooling is unavailable | EAS workflow for iOS; local Android development build |

For an iOS simulator, start Metro for a JavaScript-only change. A native change needs a new dev
client built on a Mac or through EAS:

```bash
pnpm --dir apps/mobile start
pnpm --dir apps/mobile sim:build
pnpm --dir apps/mobile sim:install:local --path <artifact> --simulator '<exact name>'
```

Pair a local build with `sim:install:local`; `sim:install` downloads the latest EAS artifact and
can silently replace it with an older build. Use the exact simulator name from `xcrun simctl list
devices`. The `development-simulator` profile produces a simulator app; the `development` profile
produces a device IPA.

For Android, use the semantic emulator loop:

```bash
S=scripts/mobile-android-loop.sh
$S preflight
$S up
$S ui
$S tap <testID-or-accessibility-label>
$S shot /tmp/porcelain-mobile-proof/android.png
$S fg
$S down
```

Check `adb devices` before `up`. An existing emulator belongs to another session unless ownership
is known; address a session-owned emulator explicitly. The script resolves controls from the live
accessibility tree, preferring stable React Native `testID` values and labels over coordinates.
Refresh the tree after navigation or keyboard changes, inspect the final screenshot and foreground
package, and stop only an emulator owned by the task.

For delivery, use `eas update` only when the installed runtime fingerprint matches. A native phone
change uses the appropriate EAS workflow after device registration and credential checks.

## Completion

Runtime proof is complete when the changed behavior—not merely startup, a build, or a successful
command—was observed in the selected client, the final state was inspected, owned processes and
fixtures were cleaned up, and the command plus result is recorded.
