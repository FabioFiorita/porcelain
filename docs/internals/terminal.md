# Terminal subsystem (the one place the one architecture deliberately bends)

A terminal is a live bidirectional byte stream, not request/response data.

- **`node-pty` is the one native module**, reversing the old native-module-free property — a real PTY
  has no pure-JS equivalent. Packaging consequences are owned by `docs/internals/repo.md` and the
  `releasing` procedure.
- **The terminal rides the daemon WS session, NOT tRPC and NOT a preload channel.** Create/attach ride
  the WS; list/rename ride tRPC. Lifecycle control lives here, not in a hook — a terminal isn't
  TanStack-Query data. tRPC stays for Actions *definitions*, which are data.
- **PTYs are daemon-owned and survive disconnect, reload, tab close, and repo switch.** A session has
  a *set* of attached senders (output fans out; writes/resize last-write-wins); socket close
  **detaches, never kills**, and a reconnecting or second client attaches to replay scrollback. Only
  an explicit kill, the daemon dying, or the bounds below end a PTY.
- **A terminal is a `TabKind`, so split view and tabs come for free** — no bespoke panel. Terminal tabs
  open **pinned** (a click must not replace a running shell). **One Ghostty surface = one DOM node =
  one pane:** unlike a file a terminal lives in only ONE pane, so `openTab` activates it in place and
  `openTabToSide` **moves** it; `detachTerminal` is container-scoped so the old pane can't yank the
  wrapper back and blank the new one. Don't "simplify" back to the generic clone path — that's the
  blank-pane bug.
- **Ghostty surfaces live in a module registry, NOT in React.** The viewer only mounts the active tab,
  so a `Terminal` in component state would be destroyed (losing scrollback, detaching a background dev
  server) on every tab switch. Each session's `Terminal` opens into a detached wrapper `<div>` the
  view re-parents on mount and detaches — **never disposes** — on unmount. Early PTY output is
  buffered until the instance exists.
- **Decoupled is not unbounded — three lifecycle bounds.** Without them a long-lived daemon reached
  228 sessions and an 8.7 GB peak with orphaned shells. An **exited** entry is forgotten 10 min after
  exit (final output survives a reload, not the week); a **running** one with nobody attached is killed
  after **12h** (deliberately generous — the dev server you return to tomorrow must live, the shell you
  forgot must not); `MAX_SESSIONS` (64) evicts cheapest-first and **throws** rather than kill a session
  a human is watching. **A session with an attached client is never reaped by any of the three** — that
  is what keeps the decoupling honest. The sweep is ONE lazily-started `unref`'d 60s interval, never a
  timer at import. Every path that can empty `attached` (including `fanOut` dropping a destroyed
  sender) must start the idle clock, or a session detaches invisibly and never expires. The cap's throw
  is answered as `terminal:created { id: '' }` — that message has no error channel, and an unsettled
  create would wedge the client's pending promise.
- **Nerd Font fallback, not a font swap:** Geist Mono *then* `"Symbols Nerd Font Mono"` (vendored MIT)
  so text renders in Geist Mono and powerline/devicon glyphs fill per-glyph instead of tofu.
  Terminal-only; the **Mono** variant is required (single-cell, aligns to the grid).
- **OSC 52 clipboard is write-only and host-side.** Agents and vim/tmux copy by emitting OSC 52 and
  Ghostty's web bridge deliberately handles it outside the VT engine, so without this a remote copy prints "sent N chars" and the host clipboard
  stays empty. **Deliberately no OSC 52 *read*** — that would report the system clipboard to the
  remote PTY (exfil).
- **Selection Copy chip:** `mousedown` preventDefault is load-bearing — without it, pressing the chip
  clears the selection before the click. Complementary to OSC 52 (app-driven vs user selection). We
  deliberately do not ship "Add to chat".
- **Paint path is Ghostty's canvas renderer, no Settings toggle.** It retains bounded VT state in
  WASM and paints no terminal text DOM, so e2e reads the explicit terminal test buffer rather than
  scraping rows. A lost canvas context rebuilds from retained output instead of exposing a blank pane.
- **Touch is a first-class terminal client, and the seam is `isCoarseTouch()`, NOT the phone width
  breakpoint** — an iPad sits at desktop width and still has no Ctrl key.
  - **`attachTerminal` deliberately does NOT focus Ghostty on a coarse-touch device.** Focusing the
    hidden helper textarea raises the iOS keyboard, and attach runs on every mount, so auto-focus meant
    an iPad could never just *read* scrollback. Focus is explicit (tap-vs-pan within ~10px, or the key
    bar's Keyboard button). Don't restore it.
  - **Touch scroll traps:** Ghostty's canvas scrolls through our adapter; Safari
    needs **`touch-action: none`** or it rubber-bands and ignores `preventDefault`; listeners use
    capture + Pointer Events with `setPointerCapture` so moves aren't lost; the **alternate buffer** has
    no scrollback, so `scrollLines` is a no-op there. **Never send arrow keys and never a synthetic
    `WheelEvent`** — a non-trusted wheel can fall through a terminal's no-scrollback path into CSI A/B, which
    agents reject. Correct alt-buffer path: **SGR wheel bytes** when mouse mode includes wheel, else
    PageUp/PageDown. Normal buffer: `scrollLines`.
  - **The key bar is TOUCH-ONLY, always on, no Settings opt-out** — the device decides. It sits at the
    **TOP** of the pane, because the iOS keyboard covers the bottom of the visual viewport and a bottom
    bar was hidden exactly when you were typing. Traps: (1) **sticky Ctrl rides a store keyed by session
    id** so split view can't cross-fire; it disarms on ANY key, and a lone modifier keydown is skipped so
    Shift-then-letter still works. (2) **Focus preservation is the whole trick** — each key
    preventDefaults `mousedown` and samples focus at pointer-down to restore it, but *only when the
    terminal already had it*, or Esc would raise a keyboard the human just dismissed; the Keyboard toggle
    opts out. (3) **Arrows must read the live DECCKM state** — the bar writes bytes directly, so an
    unconditional `ESC [ A` inserts a literal `[A` in vim. (4) Tests need the `touchDevice` fixture:
    Playwright's `hasTouch` reports a single point, which `isCoarseTouch` reads as a pen.
- **"This device" terminals — a remote-bound window can run a shell on the machine it's displayed on.**
  (1) **Local-only, not general multi-daemon:** the second session exists ONLY for work explicitly about
  the other machine; every repo-scoped query stays on `primary`. (2) **The cwd is a stored MAPPING, not
  a guess** — the remote repo path rarely exists locally, so the human maps it, keyed by environment AND
  repo path (two machines commonly hold the same path); it lives shell-side because it's a fact about
  THIS machine's filesystem. (3) **+ is a menu only when remote.** (4) Saved actions pick the machine via
  `where: primary|local`. (5) **Terminal ids are routed, not namespaced** — `sessionForTerminal` is the
  ONE place anything asks which daemon owns a PTY, and local ids are re-registered on every roster
  hydrate so a surviving session is routable before anything writes to it. (6) **Both rosters hydrate in
  ONE call** — `hydrate` REPLACES, so a call per daemon leaves only the last. (7) Electron-only by
  nature, so the browser client hides it rather than half-supporting it. **Verification trap: no suite
  covers this** (the browser project has no shell router; the native fixture always boots local). It was
  verified with a scratch harness seeding `remote-daemon.json` against a second standalone daemon and
  asserting the PTY exists on the LOCAL daemon with the mapped cwd. Re-verify that way.
- **`initialInput` is written after a quiet period keyed on the output's shape — NEVER at spawn, and NOT
  on the shell's first output.** Anything written before readline preps the tty is echoed but DISCARDED,
  so the command never runs. A spawn-time write failed two release gates; "first output = readline is
  up" failed a third (a shell's first chunk is its startup banner, still pre-readline on a slow runner).
  The reliable signal is the PROMPT — the only output whose tail has no trailing newline — so a
  prompt-shaped chunk arms a short debounce and a newline-terminated one a long one (also the from-spawn
  fallback for silent shells). The e2e specs obey the same law: wait for the prompt before typing.

- **Attachments are daemon-owned temporary files, not cross-device paths.** Image clipboard paste,
  browser/Electron file picking and drops, and mobile document-provider picks transfer bounded bytes
  (4 MiB images; 8 MiB generic files) into a mode-0700 scratch directory with mode-0600 files under the daemon's Porcelain
  home. The daemon sanitizes the display filename, mints the terminal-visible path, and reclaims it
  after 24 hours. A file URI/path from a browser, Electron renderer, phone, or tablet is never useful
  on a daemon host and must never be typed into the PTY.
- **One client terminal write is capped at 64 Ki UTF-16 code units.** Ordinary typing chunks before
  sending; the mobile composer uploads every attachment first, then writes its complete accepted draft
  in exactly one bounded frame. This preserves atomic insertion without turning the WS into an
  unbounded memory sink.

## The mobile client (same PTYs, a terminal-surface native exception)

`apps/mobile` is a second human client of the same daemon-owned PTYs — the roster, the WS
protocol and every lifecycle rule above are unchanged. The app remains one React Native UI path;
`apps/mobile/modules/porcelain-terminal` is the sole native exception, restricted to rendering
terminal cells and collecting terminal input. It is linked as a local Expo module and deliberately
does not own a product screen, navigation, daemon access, or PTY lifecycle.

`TerminalView` prefers the Ghostty surface in a binary that contains the module. The old
xterm-headless/React-Native-row renderer is isolated as a stale-binary fallback: an OTA bundle
running against a development client that predates the module must still offer a usable terminal,
not crash on `requireNativeView`. The small typed bridge/surface wrapper is
`features/terminal/porcelain-terminal-surface.tsx`; that containment is intentional, so adding
Ghostty does not create a second native app UI architecture.

- **The native module uses Ghostty behind a narrow event contract.** iOS links the vendored custom-I/O
  `GhosttyKit.xcframework`; Android links canonical upstream `libghostty-vt` JNI artifacts and paints
  snapshots in a Canvas. They expose only a bounded remote buffer plus local
  `onInput`/`onResize`/hardware-key events. Android pan deltas cross the same narrow bridge so JS
  can preserve the shared normal-vs-alternate-buffer scrolling law.
  `modules/porcelain-terminal/THIRD_PARTY_NOTICES.md` records the exact T3 Code source attribution,
  custom-fork revision, upstream Android revision, and licenses. Any native-artifact update must
  change those pins and move the Expo fingerprint.

- **Ghostty owns production VT state and pixels; `@xterm/headless` is a bounded companion.** The
  native surface receives at most 1,000,000 JS code units of raw stream, replacing rather than
  appending on daemon replay. xterm remains loaded for the shared key-mode encoder and replay-aware
  OSC 52 bridge, and powers the old-binary fallback only; it no longer paints production rows.
- **It is loaded with `require`, not `import()`, and it lies about being Node.** xterm decides
  at import time whether it is Node (`'title' in process`) and otherwise reads
  `navigator.userAgent`, which React Native does not define — so the module throws before a
  Terminal exists. `xterm-host.ts` sets `process.title` first, which a hoisted static import
  cannot guarantee. A dynamic `import()` gives the same ordering on paper but Metro turns it
  into an async chunk that fails on device with *Requiring unknown module* — a red screen at
  launch. This cost a release-gate-shaped afternoon; do not "modernize" it back.
- **Emulators live in a module registry, exactly as on desktop, and for the same reason.** The
  viewer mounts only the session on screen.
- **Repaints are throttled to ~30fps.** A noisy build emits hundreds of writes a second, and
  each one would otherwise be a React render.
- **Fallback input is a DIFF of a hidden `TextInput`, never a key event.** A software keyboard reports
  edits, and autocorrect, predictive text and dictation REPLACE a run of characters rather than
  appending one. The first version read the field as "the new input" and, because a controlled
  value that never changes is never pushed back to the native field, resent the whole
  accumulated line on every keystroke — the shell showed `eececheochoecho` for `echo`.
  `terminal-field.ts` owns the diff and is unit-tested.
- **The fallback uses one patched font, NOT the desktop's per-glyph fallback.** React Native takes a single
  `fontFamily` per span, so a Geist-Mono-then-Symbols stack has nothing to fall back to.
  GeistMono Nerd Font **Mono** carries the PUA glyphs inside the text face, so prompts and
  powerline fills come from one metric — and bold picks the bold FAMILY, because faux bold
  smears a monospace glyph past its cell and shears every column after it. Embedded at build
  time via the `expo-font` plugin: it moves the native fingerprint, and a font that arrives late
  would visibly reflow the grid. iOS names it by PostScript name, Android by file name.
- **The fallback grid is measured, not assumed — and measured from the CONTENT box.** An off-screen ruler
  `<Text>` divides its width by its character count; cols/rows come from that. React Native's
  `onLayout` reports the **border** box, so the pane's own `px-2 py-1` must come off before the
  divide — `terminal-metrics.ts` owns that arithmetic and the same constants place the absolutely
  positioned cursor, which RN lays out against the border box. One row too many is not a rounding
  complaint: a full-screen TUI anchors its input box to the LAST row of the grid it was told about
  (DECSTBM + CUP), so the line the human is typing on is written into a row that sits outside the
  pane's `overflow-hidden` — **real, correct, and invisible**. That shipped on an iPad.
  `terminal-view.test.ts` holds the invariant.
- **The fallback's first fit is immediate; every later one is debounced 100ms** (matching web). A re-attach
  replays scrollback the moment the view mounts and xterm never re-wraps printed lines, so a
  delayed first fit wraps the whole replay at the wrong width — while a rotation or keyboard
  animation firing layout continuously would otherwise storm SIGWINCH and make agent CLIs and
  p10k reprint their prompt per step. The measured size is remembered in the registry even before
  an emulator exists, and a **spawn carries `cols`/`rows`** so the first TUI frame is not drawn
  against the daemon's 80×24.
- **OSC 52 is honoured here too, write-only, and NOT during a replay.** Mobile re-attaches (and
  therefore re-parses its whole scrollback) on every reconnect — backgrounding the app is one — so
  an unguarded handler would hand the pasteboard a copy from an hour ago each time the app wakes.
  The decode is hand-rolled: Hermes has neither `atob` nor `TextDecoder`.
- **A paste is bracketed when the app asked for it.** The field diff turns `\n` into `\r`, which
  submits — so a multi-line paste ran a command per line. When `bracketedPasteMode` is live, a
  paste-shaped edit (multi-character, nothing deleted — a correction always deletes first) is
  wrapped in `ESC[200~`/`ESC[201~` and lands in the agent's input box as one block.
- **Native direct input and selection are first-class.** iOS uses `UIKeyCommand` plus the hidden
  native input field; Android captures hardware Esc, Tab, Ctrl+A–Z and arrows. Arrows cross to the
  shared JS encoder so DECCKM remains correct for vim/TUIs. Long-press drag selection copies through
  the iOS system Copy menu or Android's floating Copy/Select All action mode; this is separate from
  OSC 52, whose write-only JS handler remains suppressed while replay parses.
