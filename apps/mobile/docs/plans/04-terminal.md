# 04 — Terminal tab (native client)

Status: plan. Owner: one worktree (`mobile-terminal`). Depends on **00-connection** (daemon
client, environment/token storage, `/session` WS manager). Read
`apps/mobile/docs/daemon-api.md` → *Terminal tab* before writing a line; it is the contract.

---

## 1. Mission

Attach to the daemon's PTYs from the phone. The use-case is not "a shell on my phone" — it
is **the agent CLI already running in tmux on the box across the tailnet**: glance at what
`claude`/`codex` is printing, hit Esc or ^C when it goes sideways, type a one-line nudge,
kick off a saved Action. Everything runs daemon-side; the phone is a viewport plus a
keyboard.

Consequences that drive every decision below:

- **PTYs are daemon-owned and outlive sockets.** Detach ≠ kill. The phone can be killed by
  iOS mid-`pnpm build` and nothing is lost — re-attach replays scrollback.
- **The workloads are TUI-ish.** `claude`, `codex`, `htop`, `vim`, `git log` pagers all use
  the alternate screen, cursor addressing, and reflow. A read-only ANSI-to-text renderer is
  a demo, not this product.
- **One canonical home.** Terminal/Actions is the execution home (hard rule 10). No other
  mobile surface gets a shell or an "attach" affordance; they hand off here.

Non-mission: authoring Actions (agent curates via CLI), running anything on the phone
itself, being an SSH client.

---

## 2. UX shape

### 2.1 The rendering decision — **xterm.js inside `react-native-webview`**

**Decision: option (a) — APPROVED by the human 2026-07-31** (the rule-5 exception is
granted; no need to re-ask). One `WebView` per visible session, hosting the same xterm.js
the desktop renderer uses, driven entirely over the RN↔WebView bridge. The WebView never
opens a socket, never sees the daemon token, never navigates.

Why, honestly:

> The phone's job is watching an agent CLI, and those CLIs are TUIs. `claude` repaints a
> boxed prompt in place, uses the alternate screen for pickers, and re-renders spinners
> with cursor-up + erase-line; `codex` is the same family. Option (c) — parse ANSI into
> styled `Text` — is genuinely cheaper and would look fine for `ls` and `pnpm test`, and
> then be **wrong exactly where the product lives**: the agent's live prompt would smear
> into a scrolling transcript of every repaint, and there is no honest fix short of
> implementing a screen buffer, at which point you have written a terminal emulator with
> none of xterm's decade of edge cases. Option (b) — a native emulator — means a custom
> native module (t3code vendored libghostty for this), which v1 has ruled out: it costs the
> Expo dev-client/EAS simplicity that makes this app shippable by one person. So the real
> choice is "xterm in a WebView" vs "a terminal that breaks on the only two programs anyone
> will point it at". The WebView's costs are real and bounded: ~40–60 MB resident, a
> serialize-per-burst bridge, and soft-keyboard/IME behaviour we control less directly than
> a native `TextInput`. We buy them down with output coalescing (§3.3), an RN-side key bar
> for the keys a soft keyboard lacks, and an RN-side composer for anything longer than a
> few words. The decisive tiebreaker is that it is **the same emulator as the desktop
> client** — key bytes, OSC-52, DECCKM arrows, resize behaviour are one behaviour with one
> set of bugs, and `src/renderer/src/lib/terminal-keys.ts` ports as pure functions.

**How xterm gets into the app.** No new runtime dependency: the repo root already has
`@xterm/xterm` and `@xterm/addon-fit`. A generator script inlines `xterm.js` + `xterm.css`
+ our bridge glue into a single self-contained HTML document, emitted as a committed
`terminal-html.generated.ts` (`export const TERMINAL_HTML = "<!doctype html>…"`, produced
with `JSON.stringify`). Rendered via `source={{ html: TERMINAL_HTML }}` — no asset
resolution, no `file://` origin differences between dev and EAS builds, no Metro
`assetExts` surgery. The script is re-run on an xterm bump; `--check` mode keeps it from
going stale (§4.3).

**Fallback notes** (do not build these now; build them only if the named symptom appears):

- *Keyboard focus or IME proves unreliable in WKWebView* → flip the default input
  path to the RN composer (§2.4) and treat WebView focus as opt-in ("Raw keys" toggle).
  The composer already exists for long text, so this is a default change, not new code.
- *WebView is OOM-killed under long output* → lower xterm `scrollback` (start at 5 000
  lines) and the pending-buffer cap before considering anything structural.
- *xterm-in-WebView proves unusable outright* → the escape hatch is option (c)
  as a **read-only fallback view** for exited sessions only, never as the primary renderer.
- WebGL/canvas addons are **not** used — DOM renderer only (§5).

### 2.2 Screen 1 — the roster (`(terminal)/index.tsx`)

Large-title "Terminal", `@expo/ui` `Host` + `List`.

- **Sessions section** — one row per `terminalSessions` entry whose `cwd` is the open repo
  path or under it (same filter as desktop `use-terminal-channel`). Row: name (title),
  `cwd` relative to the repo + status (subtitle). Status glyph: running = tinted
  `terminal.fill`; exited = muted with `exit N`. Tap → push the session screen. Swipe /
  context menu → Rename, Kill.
  - Header menu also carries **Show all sessions** (drop the repo filter) for the case
    where the agent's tmux shell was started elsewhere on the daemon.
- **Actions section** — `actions` query for the repo, one row each: title + the command in
  a monospace subtitle. Tap = run (§2.5). Actions with `where: 'local'` ("This device" on
  desktop) render disabled with the subtitle *Runs on the desktop app's machine* — the
  phone is not a daemon host and must never pretend to be.
- **`+` header button** → the create sheet.
- Connection-shaped states are **not this slice's**: wrap the roster body in
  `<DaemonGate requires="repo">` (00 §2) and it renders the pair / re-pair /
  unreachable / choose-a-repo states with their buttons. Do not read
  `useConnectionState` here or write a second empty-state component.
- The states that *are* ours, each a plain centered `Column`, never a spinner-forever:
  - reachable, zero sessions → "No shells running" + a `Start a shell` button;
  - WS disconnected → an inline banner ("Reconnecting…"), roster stays readable from cache;
  - daemon too old — `terminalSessions` fails with `DaemonError.kind === 'unsupported'`
    (00 §4's taxonomy; a pre-0.30 daemon also reads as `ready` with `daemonVersion: null`)
    → "This daemon is too old for terminals."

### 2.3 Screen 2 — the session (`(terminal)/session/[id].tsx`)

Top to bottom:

1. **Native header** — title = session name; right menu: Rename, Font size (S/M/L), Kill.
   Kill confirms with `Alert.alert` ("Kill <name>? The process ends.") — destructive style.
2. **Key bar** (RN, `ScrollView horizontal`) — **above** the terminal, not below: the soft
   keyboard covers the bottom, and the desktop learned this the hard way on iPad. Keys:
   `Esc` · `Tab` · `Ctrl` (sticky, armed state highlighted) · `^C` (its own key — two taps
   is one too many while something runs away) · `←` `↓` `↑` `→` · keyboard show/dismiss.
   Bytes come from the ported pure helpers (§2.4).
3. **The terminal** — the WebView, `flex: 1`, `minHeight: 0`, background matching the xterm
   theme so no flash on mount.
4. **Composer** (collapsed by default, toggled from the key bar's rightmost control) — an
   RN `TextInput` + Send. Sends the text as one `terminal:write`, then `\r` unless the user
   toggles "no newline". This is the sane way to type a paragraph-long nudge to an agent on
   a phone, and it doubles as the keyboard fallback (§2.1).

Status footer when the session has exited: `— exited (code N) —`, kill/rename replaced by a
single **Close** (kill removes it from the roster).

### 2.4 Keyboard, keys, fonts, resize

- **Typing** goes into xterm's own hidden textarea inside the WebView; tap-to-focus with a
  10 px tap-vs-pan slop check so scrolling the scrollback doesn't raise the keyboard. The
  glue sets `autocapitalize=off autocorrect=off autocomplete=off spellcheck=false` on that
  textarea — without it iOS autocapitalizes shell input, which is silently maddening.
- **Focus preservation** in the key bar: sample focus on `pressIn`, restore after the byte
  is sent (RN `Pressable` with `onPressIn`), except the keyboard toggle. Same rule as the
  desktop bar: a naive bar dismisses the keyboard on its own first tap.
- **Special keys** — port `controlByte`, `terminalArrowBytes`, and the chord table from
  `src/renderer/src/lib/terminal-keys.ts` into `src/features/terminal/terminal-keys.ts` as
  pure functions (copy, don't import across packages; note the shared origin in a comment).
  Arrows must honour **DECCKM**: the WebView reports xterm's
  `modes.applicationCursorKeysMode` up to RN on every mode change (or RN asks for it in the
  key press round-trip); sending `ESC [ A` unconditionally inserts a literal `[A` in vim.
  `Esc` = `\x1b`, `Tab` = `\t`, `^C` = `\x03`, sticky Ctrl = `controlByte(nextKey)`.
- **IME / composition** — xterm's composition helper handles CJK and dictation inside the
  WebView; the key bar never intercepts printable keys, so composition is untouched.
- **Font sizing** — xterm `fontFamily: 'ui-monospace, Menlo, monospace'`,
  `fontSize` from a 3-step preference (10 / 12 / 14, default 12)
  persisted per device through 00's preference seam
  (`usePreference('terminal.fontSize', …)` in `src/lib/daemon/preferences.ts`, 00 §2 — not
  secure-store, this isn't a secret). Changing it re-fits and re-sends resize.
- **Resize semantics** — `@xterm/addon-fit` computes cols/rows **from the rendered
  viewport**; RN never guesses. Fit on: first paint, WebView layout change, orientation
  change, keyboard show/hide, font-size change. Debounce 100–150 ms and send
  `terminal:resize` **only when cols/rows actually changed** — an undebounced storm makes
  p10k-style prompts reprint per step and stacks copies up the scrollback (a desktop
  regression, already paid for once).
- **Cols reality check.** Portrait at 12 px is ~45 cols; a lot of CLI output assumes 80.
  We send the true size — lying to the PTY breaks wrapping worse than a narrow terminal
  does. Mitigations available to the human: font size S, and landscape. **Resolved
  2026-07-31:** `app.json` is now `"orientation": "default"` app-wide — the shell-level
  change was made and approved (terminal columns and landscape diff reading motivated it),
  so nothing to propose and no portrait-only v1. Rotation is unlocked on every tab: this
  screen must re-fit on orientation change, and no screen may assume portrait.

### 2.5 Creating and running

- **Create** (`(terminal)/new.tsx`, `presentation: 'formSheet'`): Name (prefilled
  `Terminal N` via a ported `nextTerminalNumber` — count-based, monotonic floor, so closing
  Terminal 1 doesn't hand out a second Terminal 2) and Cwd (prefilled with the **open
  repo's daemon path**; free-text, daemon-side path — no directory browser in v1). Submit →
  `terminal:create` → push the session screen on `terminal:created`.
- **Run an Action** — exactly the desktop semantics, deliberately: create a **new** terminal
  named after the action, `cwd` = repo root, `initialInput` = `action.command`, then push
  its screen. The daemon types the command into the live shell once its readline is up (see
  `src/backend/initial-input.ts`) and the shell **stays live** afterwards, so you can ^C it,
  re-run it, keep working. The daemon never executes an action itself — a human tap is the
  only path, and that stays true on mobile. Always a new session (no "reuse a matching
  one"), matching desktop.
- **Refusal** — `terminal:created` with `id: ''` means the daemon refused (64-session cap
  after eviction). Surface it as an alert: "The daemon is at its 64-terminal limit. Kill one
  and try again." Never silently no-op.
- **Rename** — `renameTerminal` mutation with optimistic cache update; empty/whitespace is
  rejected client-side.
- **Kill** — `terminal:kill` + confirm; roster row goes to `exited` on `terminal:exit`, then
  disappears at the next roster refetch.

### 2.6 Attachment lifecycle (battery + correctness)

**Attach only what is visible.** At most one session is attached at a time.

| Event | Behaviour |
|---|---|
| Session screen focused | `terminal:attach` → `reset()` the xterm, write `scrollback`, then live data |
| Session screen blurred / popped | `terminal:detach` (PTY keeps running; nothing is lost) |
| `AppState` → `background`/`inactive` | detach immediately; stop the roster poll |
| `AppState` → `active` | re-attach the visible session; refetch the roster once |
| WS reconnect (`useDaemonSession().onReconnect`, 00 §2) | re-send `terminal:attach` for the visible session — server-side attachment dies with the socket. 00 re-sends `session:hello` and the file watches; **terminal re-attach is this feature's job**, stated in both plans |
| `attached.found === false` | the id is gone (killed or swept by the 12 h TTL): show "This session is no longer on the daemon", offer Start a new one, pop on dismiss |
| WebView remount (OS memory pressure) | treat as a fresh attach — reset + replay |

Detaching is free because the PTY is daemon-owned, so there is no "stay attached for
snappiness" tradeoff worth the radio time. The roster query uses `backstopMs: 10_000`
(desktop's 5 s is a plugged-in-Mac number) with `enabled` gated on tab focus — 00's
`backstopMs` only polls while foregrounded **and** the socket is down, which is right here
too. Plus an immediate refetch on focus. There is **no** `app-event` for the terminal roster:
session lifecycle arrives as `terminal:exit` / `terminal:created` frames, and the `actions`
app-event (seeded in `APP_EVENT_INVALIDATIONS`) covers the Actions section only.

---

## 3. Data layer

### 3.1 Roster (tRPC + React Query)

`terminalSessions` (query) and `renameTerminal` (mutation) are declared once with
`defineQuery` / `defineMutation` in **`src/lib/daemon/procedures/terminal.ts`** (this
slice's own file — never edit `procedures/connection.ts`, and there is no barrel), and
called through `useDaemonQuery` / `useDaemonMutation` from `src/lib/daemon/queries.ts`, in
`use-terminal-sessions.ts`. The query key is 00's
`['daemon', envId, procedureName, input ?? null]` via `daemonKeys` — the environment id is
already in it, so switching daemons can never show a stale roster; never hand-roll a key.
Invalidate by procedure name with `useDaemonInvalidate()`. `actions` lives in
`use-terminal-actions.ts`, same shape. The active repo comes from `useActiveRepo()`. Both
queries are screen-focused (`enabled` on focus) per the daemon-api doc's "poll more lazily"
note. Every descriptor carries a zod schema for its output.

### 3.2 The stream (WS)

`use-terminal-stream.ts` owns one attached session, over `useDaemonSession()` (00 §2):
`send` / `subscribe` / `onReconnect` / `request`. It never touches the raw socket.

- `create({name, cwd, initialInput})` / `attach(id)` — both go through
  `session.request(message, match, { timeoutMs: 10_000 })`, 00's `reqId` correlation helper,
  which mints the `reqId` and rejects with a `DaemonError` on timeout ("The daemon didn't
  answer").
- `write(id, data)` — chunk at 8 KB so a big paste can't produce one enormous frame.
- `resize(id, cols, rows)` — change-gated (§2.4).
- `detach(id)` / `kill(id)`.
- Inbound: `terminal:data` → the coalescer; `terminal:exit` → footer + roster patch;
  `terminal:attached` → reset + scrollback.

Frames arrive already validated: 00's `ws-protocol.ts` zod-parses every inbound `/session`
frame against `serverMessageSchema` before it reaches a subscriber, so this hook narrows on
the discriminant — never a cast. Hard rule 6, and `as unknown as` is lint-blocked in
`apps/mobile/src` by `scripts/lint-escapes.mjs`. State lives in the hook + React Query;
00 lands zustand for connection state, but **do not introduce a global store** for this
feature — one attached session is hook-local by nature.

### 3.3 Buffering and backpressure across the RN bridge

The failure mode is a `pnpm build` or a `cat` of a big file: hundreds of small
`terminal:data` frames per second, one bridge crossing each, and the JS thread stops
answering touches.

Per attached session, in `terminal-output-buffer.ts` (pure, unit-testable):

1. Append each `data` string to a pending array with a running length.
2. On the first chunk, schedule a flush in **16 ms**; subsequent chunks join that window.
3. Flush = one bridge crossing with the joined string.
4. **Cap** the pending buffer at 256 KB: on overflow drop from the *head* and prefix the
   flush with `\r\n[porcelain: output truncated]\r\n`. The tail is what the human wants;
   xterm would have scrolled the head away anyway.
5. xterm's own `scrollback: 5000` bounds WebView memory independently.

Transport RN→WebView: `webViewRef.current.injectJavaScript(...)` with the payload embedded
as `JSON.stringify(chunk)`. **Trap:** `JSON.stringify` escapes C0 controls but leaves
U+2028/U+2029 raw, and those are line terminators in a script context — post-escape them or
the injection throws on some output. (`postMessage` into a `message` listener is the
documented fallback if injection ever proves slower; keep the write path behind one
function so swapping is a one-file change.)

WebView→RN: `window.ReactNativeWebView.postMessage(JSON.stringify(msg))` with
`{t:'ready'} | {t:'input',data} | {t:'resize',cols,rows} | {t:'cursor-mode',application} |
{t:'link',url}`, parsed by a narrowing guard in `bridge-protocol.ts`; unknown messages are
ignored, not thrown on.

**There is no flow control in the WS protocol** — the daemon will not slow down for us.
Coalescing plus the cap is the whole defense, and that is an accepted limitation worth
stating rather than pretending otherwise.

### 3.4 WebView hardening (audit-flavored, non-negotiable)

- No token, no base URL, no credential ever crosses into the WebView. It receives bytes.
- `onShouldStartLoadWithRequest` returns **false for everything** after the initial
  document — a terminal renders untrusted bytes, and OSC 8 hyperlinks are attacker-supplied.
- Link taps: xterm's link handler posts `{t:'link',url}`; RN opens it with `Linking.openURL`
  **only** after an http/https-scheme check mirroring the desktop's `isSafeExternalUrl`
  gate. Anything else is dropped.
- `allowFileAccess={false}`, `setSupportMultipleWindows={false}`,
  `allowsLinkPreview={false}`, `mediaPlaybackRequiresUserAction`, no `originWhitelist='*'`
  navigation, no third-party script tags (the document is fully inlined and offline).

---

## 4. Files

### 4.1 New — feature slice `apps/mobile/src/features/terminal/`

| File | Role |
|---|---|
| `terminal-screen.tsx` | roster + actions sections, `+` button, empty states (replaces today's placeholder) |
| `terminal-session-screen.tsx` | key bar + WebView + composer + header menu, owns the attach lifecycle |
| `new-terminal-screen.tsx` | create form sheet (name, cwd) |
| `terminal-webview.tsx` | `WebView` host, bridge wiring, hardening props |
| `terminal-key-bar.tsx` | RN key row (Esc/Tab/Ctrl/^C/arrows/keyboard/composer toggle) |
| `terminal-composer.tsx` | send-a-line input |
| `terminal-session-row.tsx` | one roster row (status, exit code, menu) |
| `terminal-actions-section.tsx` | Actions rows + run |
| `use-terminal-sessions.ts` | roster query, rename/kill, repo filter |
| `use-terminal-actions.ts` | `actions` query + `runAction` |
| `use-terminal-stream.ts` | attach/detach/write/resize/create over 00's WS manager |
| `terminal-output-buffer.ts` | coalescer + cap (pure) |
| `terminal-keys.ts` | `controlByte`, `terminalArrowBytes`, chord bytes (pure, ported) |
| `terminal-naming.ts` | `nextTerminalNumber` (pure, ported) |
| `webview/bridge-protocol.ts` | both-direction message types + narrowing parse |
| `webview/terminal-html.generated.ts` | generated, committed xterm bundle |

### 4.2 New — routes (thin re-exports only)

- `src/app/(tabs)/(terminal)/session/[id].tsx`
- `src/app/(tabs)/(terminal)/new.tsx`

Changed: `src/app/(tabs)/(terminal)/_layout.tsx` (exists today with the `index` screen) —
add the two `Stack.Screen`s (`new` as `presentation: 'formSheet'`, `sheetGrabberVisible`,
matching the root layout's sheet options).

### 4.3 Changed — shared merge points (touch narrowly, expect conflicts)

- `apps/mobile/src/app/(tabs)/(terminal)/index.tsx` — already re-exports `TerminalScreen`; unchanged if the export name holds.
- `apps/mobile/src/components/toolbar-icon.ts` — the roster's `+` button needs an `add` icon name
  with an SF Symbol (`plus`). iOS-only, so that is the whole entry. `03-review` wants the same
  `add` name — first worktree in adds it, the second reuses it rather than introducing
  `plus`/`new`.
- `scripts/build-terminal-webview.mjs` **(new, repo root)** — inlines root
  `@xterm/xterm` + `@xterm/addon-fit` dist + glue → the generated module. `--check` mode
  exits non-zero when the committed output is stale.
- `package.json` (root) — `"mobile:terminal:html": "node scripts/build-terminal-webview.mjs"`;
  **recommended**: append `node scripts/build-terminal-webview.mjs --check` to `lint`, so an
  xterm bump can't leave a stale vendored bundle in the app. Call this out in the PR.
- `biome.json` — add `"!apps/mobile/src/features/terminal/webview/*.generated.ts"` to
  `files.includes` (a one-line 1 MB string literal must not be linted or formatted).
- `.agents/skills/architecture/SKILL.md` → *Native mobile client* — add one bullet: the
  terminal renders through xterm.js in a WebView, why the two alternatives lost, and that
  the WebView is a dumb renderer holding no credentials. Same commit as the code (rule 4).
- `apps/mobile/README.md` — one line under the tab table pointing at this doc.
- **Do not** add `zod` here on your own — 00-connection lands it as an `apps/mobile`
  dependency. Use it for the bridge parses (`webview/bridge-protocol.ts`); the `/session`
  frames are already parsed by 00's `ws-protocol.ts`.
- `apps/mobile/src/lib/daemon/procedures/terminal.ts` **(new)** — this slice's descriptors
  (`terminalSessions`, `renameTerminal`, `actions`). Its own file, so it isn't a merge point.
- `apps/mobile/src/lib/daemon/app-events.ts` — nothing to append: 00 seeds `actions`, and
  the roster has no app-event (§2.6).

### 4.4 Cross-plan contract — what 00-connection exposes

These five are the only coupling. All five are in `00-connection.md` §2 (`session.ts`,
`environments-store.ts`, `repo.ts`, `preferences.ts`) — verified, not assumed:

1. `useDaemonSession().send(message)`, typed against the daemon's `ClientMessage` shapes
   (00's `ws-protocol.ts` re-declares the zod schemas locally and pins them to the shared
   types — one copy, in the connection layer).
2. `useDaemonSession().subscribe(listener)` for inbound frames, returning an unsubscribe;
   frames are `serverMessageSchema`-parsed before they arrive. Feature code must not reach
   into the raw socket, and there are no per-kind callbacks by design.
3. `useDaemonSession().request(message, match, { timeoutMs })` — `reqId` correlation with a
   timeout, returning a promise. Used by `create` and `attach`.
4. `useDaemonSession().onReconnect(handler)` — fires after every successful reconnect, once
   `session:hello` has been re-sent. 00 owns re-sending hello and the file watches;
   **terminal re-attach is this feature's job**, and both plans say so.
5. `useActiveEnvironment()` / `useActiveRepo()`, and `usePreference` for the font size.

The WS manager stays terminal-agnostic: no terminal state, no attachment bookkeeping in it.

---

## 5. Out of scope (v1)

- More than one visible terminal (no split, no tab strip, no background WebViews).
- Shells on the phone itself, and running `where: 'local'` Actions — daemon-side only.
- Creating/editing/reordering/deleting Actions (agent curates via the porcelain CLI).
- WebGL/canvas xterm renderers, ligatures, custom themes beyond light/dark.
- Text selection/copy toolbar, OSC-52 clipboard, search-in-scrollback, link previews.
- A daemon directory browser in the create sheet (`browseDirs`), unless 00 already ships one.
- Push/background notifications for "your agent finished".
- Landscape-*specific* layout. (The app-wide orientation unlock already shipped — §2.4 — so
  the screen must tolerate rotation and re-fit; it just doesn't get a bespoke landscape UI.)
- Any change to the daemon, the WS protocol, or the desktop renderer. If you think the
  protocol needs a change (e.g. flow control), stop and raise it — don't fork it.

---

## 6. Verification

Gate (rule 3) is `pnpm verify` from the repo root; the mobile-relevant parts:

```bash
pnpm --dir apps/mobile typecheck        # tsc, also run as part of root typecheck
pnpm exec biome check apps/mobile       # noDefaultExport is off only under src/app
node scripts/lint-escapes.mjs           # scans apps/mobile/src: no `as unknown as`, no `void` on promises
node scripts/build-terminal-webview.mjs --check
pnpm verify                             # full gate before any commit
```

Unit-test the pure modules (`terminal-output-buffer`, `terminal-keys`, `terminal-naming`).
00-connection widens the root Vitest `include` to `apps/mobile/src/**/*.test.ts`, so these
run under the root runner — keep react-native and `expo-*` imports out of them, and do not
add a test runner to the `apps/mobile` package. (If for any reason the widening didn't land,
add the `include` entry in this PR and note it in the body.)

**Runtime proof — iOS simulator on the Mac against the DEV daemon** (`serve-sim-remote` skill;
full recipe and traps in `README.md` → *Shared verification recipe*).

```bash
pnpm build && pnpm dev:daemon                      # dev daemon on 43118, LAN-bound by default
PORCELAIN_HOME=~/.porcelain-dev PORCELAIN_DAEMON_PORT=43118 \
  node scripts/daemon-cli.js access issue --name "Simulator" \
    --base-url http://<this-host>.local:43118      # LAN URL — the sim is on the Mac, not here
pnpm mobile:start                                  # Metro here; the sim loads the bundle over the LAN
```

Pair the simulator against `http://<this-host>.local:43118` with the link that command prints —
**not** `127.0.0.1`, which on the simulator means the Mac — then open a **playground** repo, never a
real worktree, never the production daemon. The `PORCELAIN_HOME` / `PORCELAIN_DAEMON_PORT` prefix is
not optional: without it `daemon-cli.js` reads `~/.porcelain/admin-token` and issues the link against
43117. First run on a fresh simulator needs the dev client installed once from the Mac
(`eas build -p ios --profile development-simulator`, then `xcrun simctl install booted <App>.app`).

**This tab is the one the remote-simulator route serves worst.** `serve-sim-remote` cannot send
⌘/⌃ chords, so a ^C typed by the driver never arrives — exercise the key bar's own sticky-Ctrl path
instead (which is the thing under test anyway), and hand the soft-keyboard and IME checks to the
human on a real device. Say in the Review which journeys were driven and which were done by hand.

Journeys (each is loop evidence; screenshot or screen-record the ones marked ★):

1. ★ Create a shell in the playground repo → prompt appears → run `ls` → output renders
   with colour and correct wrapping.
2. Font size S/M/L → the terminal re-fits, and `tput cols` reports what the viewport shows.
3. ★ Run something long (`while true; do date; sleep 0.2; done` or `pnpm build`) → the UI
   stays responsive (scroll works during the burst) → `^C` from the key bar stops it.
4. Esc, Tab (completion), and arrows: `↑` recalls history; inside `vim` the arrows move the
   cursor and do **not** insert `[A` (DECCKM check); `Esc` exits insert mode.
5. Composer: type a multi-word line, Send → it runs; then "no newline" mode leaves it at
   the prompt un-submitted.
6. ★ Run a saved Action from the roster → a terminal named after it opens with the command
   already typed and executed; the shell survives the command.
7. Rename a session → the name updates in the roster, the header, and after a refetch.
8. Kill with confirm → row shows `exited`, then leaves the roster.
9. ★ Background the app for 60 s (home button) mid-output → foreground → the session
   re-attaches, scrollback replays **once** (no duplicated frames), live output resumes.
10. Kill the dev daemon, watch the reconnect banner, restart it → roster returns and the
    visible session re-attaches.
11. Kill the session from the desktop app while the phone views it → `found:false` path
    shows the "no longer on the daemon" state instead of a dead screen.
12. `terminal:create` refusal path (simulate by capping locally, or assert in a unit test on
    the `id: ''` branch) → the 64-limit alert.

iOS is the only platform, so the simulator pass **is** the required evidence for this worktree.

Before stopping: delete session debris, leave the worktree clean, and publish the Review
(Intent · Execution · Evidence) with the screenshots attached (`close-the-loop`).

---

## 7. Worktree notes

- Slug: **`mobile-terminal`** → `pnpm worktree create mobile-terminal` → branch
  `work/mobile-terminal`, isolated daemon in 43200–43999 (use it instead of 43118 if you
  are running in parallel with another worktree; pair the simulator against that port instead),
  playground at `~/code/porcelain-playgrounds/mobile-terminal`.
- **Start after 00-connection merges to `main`.** The stream hook has nothing to ride
  otherwise. If you must start early, stub 00's seam behind the §4.4 interface in a single
  file and delete the stub on rebase — never a second WS implementation.
- Stay inside `src/features/terminal/`, `src/app/(tabs)/(terminal)/`, and the §4.3 list.
  The other mobile worktrees (files/changes/review) own their own slices; a conflict in a
  shared file means someone widened their scope.
- PR into `main` with the Review's evidence attached, squash-merge, then
  `pnpm worktree remove mobile-terminal`.
