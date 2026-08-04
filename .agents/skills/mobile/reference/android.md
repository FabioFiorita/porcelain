# Android emulator control

Use the bundled [`scripts/android-loop.sh`](../scripts/android-loop.sh) for local Android runtime
proof. It is the Porcelain equivalent of Soap Health's label-driven loop and follows T3 Code's
emulator discipline: resolve the actual dev client, inspect the live accessibility tree, derive
coordinates from that tree, and capture screenshots only as evidence.

## Quick loop

Run from the repository root:

```bash
S=.agents/skills/mobile/scripts/android-loop.sh

$S preflight
$S up
$S ui
$S tap porcelain-files-refresh
$S wait porcelain-changes-screen
$S shot scripts/agent-scratch/android-proof/android.png
$S fg
$S down
```

`up` expects Metro on `METRO_PORT` (default `8081`) and an installed development client. It reads
the package name and URL scheme from the resolved Expo config, defaulting to
`APP_VARIANT=development`. Build a missing native client with:

```bash
APP_VARIANT=development pnpm --dir apps/mobile android:build
```

The loop uses `adb reverse` so the emulator reaches Metro through `127.0.0.1`. It reuses a ready
emulator when one exists. If it boots one itself, `down` stops only that emulator; if the emulator
was already running, `down` removes only the reverse created by this loop and leaves the emulator
running.

## Targeting controls

Use this order:

1. Give every new or materially changed actionable React Native control a stable `testID`, then
   call `ui` and `tap <testID>`.
2. Give the same control a meaningful `accessibilityRole` and `accessibilityLabel`; use the label
   or visible text when a native primitive cannot accept `testID`.
3. Use a registered deep link for navigation that is not exposed as a visible action.
4. Use `swipe` for gestures and `xy`-style coordinates only as an explicit last-resort addition to
   this script. Never read tap coordinates from a screenshot.

React Native 0.86 on Android exposes `testID` through the accessibility framework as a
`resource-id`, so the loop prints both the shortened ID and the accessible label. Keep IDs stable,
lower-kebab-case, and semantic:

```tsx
<Pressable
  accessibilityLabel="Refresh files"
  accessibilityRole="button"
  testID="porcelain-files-refresh"
  onPress={refresh}
>
  …
</Pressable>
```

Prefer `porcelain-<surface>-<target>` names. Dynamic suffixes are acceptable only for stable domain
identifiers, for example `porcelain-files-entry-${entry.id}`. Do not encode translated copy,
array indexes, timestamps, random values, or pixel coordinates in IDs. Add IDs to route roots,
primary navigation, form fields, submit/dismiss actions, list row actions, modal roots, and stable
loading/error/empty states; do not mark decorative wrappers indiscriminately.

`ui` refreshes the hierarchy on every call. `tap` requires one unambiguous clickable match and
fails when a selector is missing or ambiguous. After navigation, state changes, keyboard dismissal,
or a WebView transition, run `ui` again instead of reusing an old result.

## Evidence and traps

- Verify the foreground activity and package before trusting a screenshot. The development package
  is the default; do not launch the production package by accident.
- Read every final screenshot and judge layout, safe areas, keyboard overlap, loading state, and
  the actual changed behavior. A successful `adb` command is not runtime evidence.
- After `text`, send `key BACK` before selecting another control; the keyboard contributes its own
  accessibility nodes and can make a label resolve to the wrong target.
- Do not clear or reconfigure an emulator owned by another task. Set `ANDROID_LOOP_SERIAL` when
  multiple emulators are running.
- For Android tablet checks, use an explicitly selected tablet AVD or a documented temporary
  viewport override. Report a resized phone AVD as viewport evidence, not physical tablet coverage.
- Keep pairing tokens, daemon credentials, and other secrets out of screenshots, logs, and final
  responses.
