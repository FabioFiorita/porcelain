# libghostty-vt provenance

`VERSION` is the sole canonical pin for Porcelain's vendored `libghostty-vt`
ABI artifacts. `LICENSE` is the corresponding upstream MIT license.

The browser build reads this file and embeds the exact full revision into
`ghostty_build_info`; `apps/web/src/terminal/ghostty/runtimeAbi.test.ts` reads
that build metadata back and rejects pin drift or an oversized artifact.

Rebuild the browser artifacts with:

```sh
pnpm --dir apps/web build:ghostty-wasm
```

Native iOS provenance is owned separately by
`apps/mobile/modules/porcelain-terminal/Vendor/libghostty/VERSION`; do not reuse this browser and
Android pin for iOS artifacts.
