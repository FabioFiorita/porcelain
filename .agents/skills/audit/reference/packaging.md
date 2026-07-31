# Packaging

- **Main/preload deps stay in `dependencies`; renderer-only libs in `devDependencies`.** electron-vite
  externalizes main/preload imports and electron-builder copies them *whole* into `app.asar`; Vite
  bundles renderer libs regardless of section. Misplacing a dep either bloats the bundle (a ~100 MB
  regression) or breaks the packaged app at runtime.
- **Never map an empty `CSC_LINK` into the release env.** A defined-but-empty value makes
  electron-builder attempt signing and die with `<projectDir> not a file` — set it real or omit it.
- **`node-pty` is the lone native module — keep it unpacked, rebuilt, and signed.** It loads in the main
  process, so it stays in `dependencies`, is rebuilt for Electron's ABI by
  `electron-builder install-app-deps` (and listed in `onlyBuiltDependencies` so pnpm allows its build),
  and is `asarUnpack`ed. **Both `pty.node` AND the `spawn-helper` binary it `exec`s** must live on disk
  outside `app.asar` and be code-signed/notarized, or the packaged terminal can't spawn (a PTY fails, or
  notarization rejects an unsigned Mach-O). *Verify:* a packaged build's
  `Resources/app.asar.unpacked/node_modules/node-pty` exists and the terminal opens.
- **`trash` joins node-pty in `asarUnpack` AND patches its helper URL.** It `exec`s platform helper
  binaries, and a helper packed inside `app.asar` can't be executed. Unpacking alone is insufficient:
  `trash` derives the helper URL from its module inside `app.asar` and `execFile` fails with
  `spawn ENOTDIR` unless that URL is redirected to the sibling `app.asar.unpacked` — the pinned pnpm
  patch performs only that segment rewrite, leaving plain-Node and non-ASAR installs unchanged. The main
  bundles are CJS while `trash` is ESM-only, so `electron.vite.config.ts` sets `output.interop: 'auto'`;
  without it the `require` returns a namespace object and every daemon trash call throws "trash is not a
  function" — it slipped through the unit gate because only e2e exercises a real daemon trash. **Don't
  drop the interop setting.** *Verify:* `node_modules/trash/**` is in `asarUnpack` and
  `trash-packaging.test.ts` passes.

