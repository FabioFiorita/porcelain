# Screenshots — the autonomous pipeline

Historic bottleneck: the maintainer hand-captured Mac Retina shots
(`marketing/images/*.png`, various sizes). Replaced by: **headless Chromium
against the daemon's web viewer** — the exact same client bundle the Mac app
renders, runnable entirely on the Linux host.

- Model it on the e2e browser harness (`playwright.config.ts` `browser`
  project, fixtures in `e2e/helpers/`): build, start the daemon, drive the web
  viewer. Read `e2e/visual.spec.ts` first — it already does
  screenshot-grade setup (theme pinning, seeded repo).
- Capture at `deviceScaleFactor: 2` for Retina-density output; pick the
  viewport per shot (full window ~1440×900@2x; feature close-ups crop tighter).
- **Theme:** dark for the site (it's a dark page); capture light variants when
  the README/docs context is theme-neutral.
- **Demo content is part of the shot.** Seed a playground repo with a small
  but real-looking app and a genuine agent-authored review set (publish via
  the porcelain CLI) so the Feature tab, flow order, board, and comments all
  show plausible content — never lorem, never empty states (unless the empty
  state IS the subject).
- **The one human step:** the web viewer has no macOS traffic lights /
  vibrancy chrome. Feature close-ups don't need it (most shipped images are
  content crops). For a full-window *native-chrome* hero shot, either frame
  the capture in drawn window chrome, or ask the maintainer for a single Mac
  capture — **batch all such asks into one request** with exact instructions
  (window size, theme, what's on screen).

## The pipeline is built — `pnpm shots`

`pnpm shots` (→ `playwright.shots.config.ts` → `e2e/marketing.shots.ts`) builds,
spawns the daemon against a seeded generic "orders" demo repo
(`e2e/helpers/demo-repo.ts` + `demo-seed.ts`), and writes Retina PNGs
(`deviceScaleFactor: 2`, dark) to `marketing/shots/` (gitignored). Read the spec
for the current surface list; the durable part is the split: **full-window** shots
(2880×1800) vs **element/clip crops** that map 1:1 to the `marketing/images/*` the
site uses. A few outputs are renamed on the way into `images/`: `board.png` →
`feat-board.png`, `review.png` → `feature-view.png`, `terminal.png` →
`feat-terminal.png`.
Excluded from the normal e2e run (that config's `*.spec.ts` glob ignores the
`.shots.ts` name). Add shots by driving more tabs in the same spec. **The
regenerated `shots/` are NOT auto-copied to `images/`** — review, then copy the
ones you're keeping over `marketing/images/`. Traps the code won't tell you:

- **Two phases, two contexts.** Full-window shots want a narrow sidebar (the app
  default); the panel/companion close-ups (grouped-panel, feat-commit, history,
  pin, hide) want a *wider* one so filenames breathe. Sidebar width is a global
  persisted pref, so the spec runs phase 1 at the default width, closes the
  context, then opens a **second context** seeding `porcelain-preferences` in
  `localStorage` (`{state:{sidebarWidth,rightSidebarWidth},version:0}`) before
  first paint. Don't try to resize mid-session — the store isn't exposed and the
  drag handle is pointer-only.
- **Panel crops use a computed clip, not `locator.screenshot()` of the card.** A
  sidebar card is full-window-tall, so an element shot trails off into empty space
  above the branch/worktree footer. `panelClip()` clips from the card top down to
  the bottom of its **last `[data-slot="sidebar-group-content"]`** (or the pinned
  `[data-slot="sidebar-group"]`) so the crop ends at the content. Left/right card =
  `[data-slot="sidebar-container"][data-side=…] [data-slot="sidebar-inner"]`.
- **A line-range comment needs a real DOM selection.** feat-comment builds a
  `Range` over two `[data-line]` rows in `page.evaluate`, then right-clicks *inside*
  it (so the right-click doesn't collapse the selection) → the diff's context menu
  reads `lineSelectionFromDom` and the composer shows the range + anchored hunk.
- **Pinned/actions are seeded like the other channels.** Pinned folder+file go in
  `config.json` `repos[repoDir].pinnedPaths` (**absolute** paths). Saved actions go
  in the `PORCELAIN_ACTIONS` channel keyed by repoDir — they light up both the
  finder's "Commands" group (feat-search needs a query like `orders` that hits both
  files *and* a command title) and the terminal tab's Actions companion.
- **The demo repo carries a real ~9-commit history** (layer-by-layer, recent
  staggered dates) so History/`git log` have depth. "relabel the pagination
  control" is kept **newest on purpose** — the terminal pager asserts on it. If you
  add commits after it, update that assertion.

- **The Review renders in the viewer only after you OPEN it.** Selecting the
  Feature tab fills the *outline* (left sidebar) but leaves the empty quick-start
  in the viewer — click the review-name (or a chapter) button to open the
  document, then shoot.
- **xterm's WebGL canvas is BLANK in a headless screenshot** for normal
  scrollback output — the buffer holds the text (so `expectTerminalText` passes)
  but nothing is captured. A full-screen **pager** (`less` on the alternate
  screen) does paint, so the terminal shot drives `git -c color.ui=always log -p`.
  Same reason the e2e suite reads the terminal via a buffer hook, never a shot.
- **Terminal marketing font is 8px** (not the app default 12): set via
  `window.__porcelainSetTerminalFontSize` under e2e after the pager is up, so
  Retina full-window shots do not look oversized next to UI chrome. Site CSS also
  caps `.gallery-full img` height so the terminal band does not dominate the page.
- **Seed board/comments as channel JSON keyed by the canonical repo path**
  (realpath the temp dir first) — the daemon reads the same `PORCELAIN_*` files
  the CLI writes; a mismatched key renders empty.
- **Strict-mode locators:** "N changed files" appears on both Changes summary and
  Glance — use `getByTestId('changes-summary')`. "Pinned" also matches
  "Pinned & notes" — use `{ exact: true }` on the group label.
- **Host chip leaks the real machine name.** The env switcher shows
  `daemonIdentity().host` (`os.hostname()`). Shots set `PORCELAIN_DAEMON_HOST=dev-box`
  so published images never show a personal hostname (beelink, …). Keep that env
  when re-running; review every full-window shot's top-right chip before copying
  to `marketing/images/`.
- **Terminal prompt leaks user@host:cwd.** The terminal shot runs
  `export PS1='$ '` + `clear` before `git log -p` for the same reason. Re-check
  the bottom of `terminal.png` for a real username, hostname, or `/tmp/porcelain-shots-*`.
