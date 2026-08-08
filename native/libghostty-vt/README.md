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

This pin deliberately makes no claim about native iOS. An eventual iOS
integration may need a separately reviewed custom-I/O fork and must carry its
own pinned provenance instead of silently reusing this value.
