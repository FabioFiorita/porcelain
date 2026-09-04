# Porcelain Mobile Terminal Native Module

`@porcelain/mobile-terminal-native` is the local Expo module that owns the one native terminal
surface in Porcelain mobile. It renders terminal cells and reports terminal input/size only; the
React Native feature keeps ownership of app chrome, daemon transport, PTY sessions, and navigation.

## Provenance

This module is adapted from T3 Code’s `@t3tools/mobile-terminal-native`, MIT licensed, at
[`apps/mobile/modules/t3-terminal`](https://github.com/pingdotgg/t3code/tree/6da92244cc2a7438703be95a0fcfaca0b73502a7/apps/mobile/modules/t3-terminal)
from T3 Code revision `6da92244cc2a7438703be95a0fcfaca0b73502a7` (2026-08-06).
`THIRD_PARTY_NOTICES.md` carries the exact Ghostty and font provenance for the checked-in native
artifacts; retain that attribution whenever this implementation is changed.

## Source

Read [the bridge interface](../../src/features/terminal/porcelain-terminal-native.ts) for props and
events, and the [iOS](ios/) or [Android](android/) implementations for rendering. PTY transport
remains client-owned.

## Rebuild GhosttyKit (iOS)

The checked-in framework is pinned to the custom-I/O fork/revision in `Vendor/libghostty/VERSION`.
Xcode's Metal toolchain must be installed; if `metal`
fails, run `xcodebuild -downloadComponent MetalToolchain`.

```bash
apps/mobile/modules/porcelain-terminal/scripts/build-libghostty-ios16.sh
```

## Rebuild libghostty-vt (Android)

The Android headers and shared libraries are pinned by `native/libghostty-vt/VERSION`. Set
`ANDROID_NDK_HOME` and run:

```bash
apps/mobile/modules/porcelain-terminal/scripts/build-libghostty-android.sh
```

Build inputs and flags belong in the [Android build script](scripts/build-libghostty-android.sh)
and its [patches](scripts/libghostty-android-patches/).
