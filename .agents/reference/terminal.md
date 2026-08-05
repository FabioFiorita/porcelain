# Terminal subsystem (the one place the one architecture deliberately bends)

A terminal is a live bidirectional byte stream, not request/response data.

- **`node-pty` is the one native module**, reversing the old native-module-free property — a real PTY
  has no pure-JS equivalent. Packaging consequences are `audit` invariants.
- **The terminal rides the daemon WS session, NOT tRPC and NOT a preload channel.** Create/attach ride
  the WS; list/rename ride tRPC. Lifecycle control lives here, not in a hook — a terminal isn't
  TanStack-Query data. tRPC stays for Actions *definitions*, which are data.
- **PTYs are daemon-owned and survive disconnect, reload, tab close, and repo switch.** A session has
  a *set* of attached senders (output fans out; writes/resize last-write-wins); socket close
  **detaches, never kills**, and a reconnecting or second client attaches to replay scrollback. Only
  an explicit kill, the daemon dying, or the bounds below end a PTY.
- **A terminal is a `TabKind`, so split view and tabs come for free** — no bespoke panel. Terminal tabs
  open **pinned** (a click must not replace a running shell). **One xterm instance = one DOM node =
  one pane:** unlike a file a terminal lives in only ONE pane, so `openTab` activates it in place and
  `openTabToSide` **moves** it; `detachTerminal` is container-scoped so the old pane can't yank the
  wrapper back and blank the new one. Don't "simplify" back to the generic clone path — that's the
  blank-pane bug.
- **xterm instances live in a module registry, NOT in React.** The viewer only mounts the active tab,
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
  xterm doesn't handle it, so without this a remote copy prints "sent N chars" and the host clipboard
  stays empty. **Deliberately no OSC 52 *read*** — that would report the system clipboard to the
  remote PTY (exfil).
- **Selection Copy chip:** `mousedown` preventDefault is load-bearing — without it, pressing the chip
  clears the selection before the click. Complementary to OSC 52 (app-driven vs user selection). We
  deliberately do not ship "Add to chat".
- **Paint path is one decision: WebGL with automatic DOM fallback, no Settings toggle.** The DOM
  renderer snaps the font to the grid with a computed `letter-spacing`, which shows as a hairline
  **vertical gap between every column** for contiguous block/box-drawing glyphs (agent startup logos,
  powerline fills); `lineHeight > 1` adds the horizontal twin, so keep `lineHeight: 1.0`. Only GPU
  renderers get `customGlyphs`, and the WebGL atlas still does per-glyph font fallback so Nerd Font
  glyphs survive. Load it best-effort *after* `term.open()`, in a try/catch, with
  `onContextLoss → dispose`, so no-WebGL or a lost context degrades to DOM rather than a blank pane;
  multi-touch **force-DOMs**, because WebGL contexts die under memory pressure. **e2e trap:** WebGL
  paints to a `<canvas>` and leaves `.xterm-rows` empty — specs use the buffer-model helper.
- **Touch is a first-class terminal client, and the seam is `isCoarseTouch()`, NOT the phone width
  breakpoint** — an iPad sits at desktop width and still has no Ctrl key.
  - **`attachTerminal` deliberately does NOT focus xterm on a coarse-touch device.** Focusing the
    hidden helper textarea raises the iOS keyboard, and attach runs on every mount, so auto-focus meant
    an iPad could never just *read* scrollback. Focus is explicit (tap-vs-pan within ~10px, or the key
    bar's Keyboard button). Don't restore it.
  - **Touch scroll traps:** xterm only scrolls on **wheel**, so finger pans need our adapter; Safari
    needs **`touch-action: none`** or it rubber-bands and ignores `preventDefault`; listeners use
    capture + Pointer Events with `setPointerCapture` so moves aren't lost; the **alternate buffer** has
    no scrollback, so `scrollLines` is a no-op there. **Never send arrow keys and never a synthetic
    `WheelEvent`** — a non-trusted wheel falls through xterm's no-scrollback path into CSI A/B, which
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

## The mobile client (same PTYs, a different renderer)

`apps/mobile` is a second human client of the same daemon-owned PTYs — the roster, the WS
protocol and every lifecycle rule above are unchanged. What differs is everything below
`term.write`, because React Native has no DOM to hand xterm.

- **`@xterm/headless` is the emulator; the painting is ours.** xterm.js needs a DOM, and a DOM
  bridge is banned on mobile (`apps/mobile/AGENTS.md`), so the headless build keeps the VT state
  machine — alt buffer, DECCKM, 256/truecolor, wrapping — and `terminal-cells.ts` turns its
  buffer into `<Text>` runs. Adjacent cells sharing every attribute collapse into ONE span,
  because on this renderer the cost is span count, not cell count.
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
- **Input is a DIFF of a hidden `TextInput`, never a key event.** A software keyboard reports
  edits, and autocorrect, predictive text and dictation REPLACE a run of characters rather than
  appending one. The first version read the field as "the new input" and, because a controlled
  value that never changes is never pushed back to the native field, resent the whole
  accumulated line on every keystroke — the shell showed `eececheochoecho` for `echo`.
  `terminal-field.ts` owns the diff and is unit-tested.
- **One patched font, NOT the desktop's per-glyph fallback.** React Native takes a single
  `fontFamily` per span, so a Geist-Mono-then-Symbols stack has nothing to fall back to.
  GeistMono Nerd Font **Mono** carries the PUA glyphs inside the text face, so prompts and
  powerline fills come from one metric — and bold picks the bold FAMILY, because faux bold
  smears a monospace glyph past its cell and shears every column after it. Embedded at build
  time via the `expo-font` plugin: it moves the native fingerprint, and a font that arrives late
  would visibly reflow the grid. iOS names it by PostScript name, Android by file name.
- **The grid is measured, not assumed.** An off-screen ruler `<Text>` divides its width by its
  character count; cols/rows come from that. The measured size is remembered in the registry
  even before an emulator exists, because output that arrives first must wrap at the width it
  will be read at.
