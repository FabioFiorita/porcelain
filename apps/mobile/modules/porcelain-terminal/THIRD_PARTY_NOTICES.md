# Third-Party Notices

## T3 Code mobile terminal module

This module is adapted from T3 Code’s `@t3tools/mobile-terminal-native` source at
[`apps/mobile/modules/t3-terminal`](https://github.com/pingdotgg/t3code/tree/6da92244cc2a7438703be95a0fcfaca0b73502a7/apps/mobile/modules/t3-terminal),
revision `6da92244cc2a7438703be95a0fcfaca0b73502a7` (2026-08-06).

- Source project: https://github.com/pingdotgg/t3code
- License: MIT
- Copyright: T3 Tools Inc. and T3 Code contributors

The Porcelain-specific module names, bridge boundary, provenance checks, and packaging metadata are
adaptations. Keep this source attribution whenever code or artifacts derived from that module remain.

## Ghostty / libghostty (iOS)

The iOS renderer vendors `GhosttyKit.xcframework`, built from the custom-I/O fork below. Its exact
checked-in source revision is `d36c3b8dffd0d756dd5e5f4933962f774a0e6753`, also recorded in
`Vendor/libghostty/VERSION` and enforced by `scripts/build-libghostty-ios16.sh`.

- Upstream project: https://github.com/ghostty-org/ghostty
- Custom-I/O base fork: https://github.com/wiedymi/ghostty/tree/custom-io
- Vendored source fork: https://github.com/Yash-Singh1/ghostty/tree/custom-io
- Reference integration: https://github.com/vivy-company/vvterm
- License: MIT, Copyright (c) Mitchell Hashimoto and Ghostty contributors

## Ghostty / libghostty-vt (Android)

The Android Canvas renderer vendors upstream `libghostty-vt` shared libraries. Their C headers,
`VERSION`, and MIT license live canonically at `native/libghostty-vt`; the ABI revision is
`9f62873bf195e4d8a762d768a1405a5f2f7b1697`.

- Upstream project: https://github.com/ghostty-org/ghostty
- License: MIT, Copyright (c) Mitchell Hashimoto and Ghostty contributors

## MesloLGS NF (Android terminal font)

- Files: `android/src/main/assets/fonts/MesloLGS-NF-{Regular,Bold}.ttf`
- Source: https://github.com/romkatv/powerlevel10k-media
- Upstream: Meslo LG by André Berg (a customization of Apple’s Menlo), patched by Nerd Fonts
- License: Apache License 2.0
