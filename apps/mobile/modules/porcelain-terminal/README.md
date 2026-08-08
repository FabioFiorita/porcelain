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

## Bridge contract

- Native keyboard input is emitted as `{ data: string }` through `onInput`.
- Measured grid size is emitted as `{ cols: number, rows: number }` through `onResize`.
- Remote PTY bytes enter as `initialBuffer`; the existing Porcelain terminal transport is the only
  owner of the network connection.

On iOS, the module links the vendored custom-I/O `GhosttyKit.xcframework`. On Android, it uses the
canonical upstream `native/libghostty-vt` headers plus checked-in `libghostty-vt.so` artifacts and a
JNI/Canvas renderer. Neither implementation is a general native UI framework.

## Rebuild GhosttyKit (iOS)

The checked-in framework is pinned to the custom-I/O fork/revision in `Vendor/libghostty/VERSION`.
The script checks out that exact revision, builds with Zig 0.15.2, strips the archives, and replaces
only the iOS device and simulator slices. Xcode’s Metal toolchain must be installed; if `metal`
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

The script checks out the exact upstream Ghostty revision, applies the tracked Android patches, and
rebuilds all four ABIs with 16 KB page-size linker support.
