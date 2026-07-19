---
name: marketing
metadata:
  internal: true
description: Own the marketing process end-to-end — README, marketing site, screenshots, release visibility. Read before touching README.md, marketing/, or producing screenshots/launch copy.
---

# Porcelain — marketing

The agent owns this whole process. The maintainer is a **stakeholder** (reviews
outcomes, answers judgment questions), not a production step — do not park work
on "waiting for a screenshot from the user". The one deliberate exception is
listed under Screenshots.

## Surfaces

| Surface | What it is | Deploy |
|---|---|---|
| `README.md` | The repo front door — most traffic lands here first | push to main |
| `marketing/` | Static one-page site → https://fabiofiorita.github.io/porcelain/ | `pages.yml` auto-deploys on push when `marketing/**` changes — merging IS publishing |
| GitHub release notes / `CHANGELOG.md` | Release visibility (see `releasing` skill for the pipeline) | on release |
| Companion skills' prose (`/skills/`) | Users read these; they carry positioning too | skills.sh |

App copy is the `product` skill's domain, not this one.

## Message discipline

- **Source of truth for identity:** `plans/positioning-and-roadmap.md` while it
  lives (identity statement, three pillars, non-goals, "the reading room"
  design language). When it's reconciled away, the durable version belongs in
  the `product` skill — update this pointer then.
- Every marketing claim must be true of the shipped app **today** — verify
  against the code/`product` skill before writing, not from memory. Known
  drift class to check each pass: provider list (currently 4 — Claude Code,
  Codex, OpenCode, Grok — `src/shared/agent-protocol.ts` is the truth), the
  agent channel (bundled porcelain CLI, **no MCP, no port**), positioning era
  ("hub for agentic coding", not the retired "viewer + companion").
- Voice: confident, concrete, zero hype adjectives. Sell *legible* (the
  reading room), not "blazing fast AI-powered". Competitors' angle is breadth
  and velocity; ours is trust and review depth — don't copy their voice.
- **Never leak the personal setup** (CLAUDE.md rule): no beelink, no
  soaphealth, no personal hostnames in anything user-visible. Demo content
  uses generic names.

## Screenshots — the autonomous pipeline

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

### The pipeline is built — `pnpm shots`

`pnpm shots` (→ `playwright.shots.config.ts` → `e2e/marketing.shots.ts`) builds,
spawns the daemon against a seeded generic "orders" demo repo
(`e2e/helpers/demo-repo.ts` + `demo-seed.ts`), drives five surfaces, and writes
Retina PNGs (2880×1800, `deviceScaleFactor: 2`, dark) to `marketing/shots/`
(gitignored): `review.png` (Review doc — thesis, sections, flow diagram, diff),
`changes-flow.png`, `board.png`, `viewer.png`, `terminal.png`. It's excluded from
the normal e2e run (that config's `*.spec.ts` glob ignores the `.shots.ts` name).
Add shots by driving more tabs in the same spec. Traps the code won't tell you:

- **The Review renders in the viewer only after you OPEN it.** Selecting the
  Feature tab fills the *outline* (left sidebar) but leaves the empty quick-start
  in the viewer — click the review-name (or a chapter) button to open the
  document, then shoot.
- **xterm's WebGL canvas is BLANK in a headless screenshot** for normal
  scrollback output — the buffer holds the text (so `expectTerminalText` passes)
  but nothing is captured. A full-screen **pager** (`less` on the alternate
  screen) does paint, so the terminal shot drives `git -c color.ui=always log -p`.
  Same reason the e2e suite reads the terminal via a buffer hook, never a shot.
- **Seed board/chat/comments as channel JSON keyed by the canonical repo path**
  (realpath the temp dir first) — the daemon reads the same `PORCELAIN_*` files
  the CLI writes; a mismatched key renders empty.

## Site mechanics & traps

- `marketing/index.html` is a single self-contained page, styles inline plus
  `styles.css`; edit in place, no build step.
- **The version string is hard-coded once** in `index.html` (the "Apple
  Silicon · vX.Y.Z" line — marked with a comment). It drifts: it sat at
  v0.17.0 while the app shipped v0.32.0. Check it on every marketing pass and
  every release.
- `og:image` / `twitter:image` point at `images/feature-view.png` — replacing
  that file changes social cards; keep it the strongest single shot.
- Site copy and README must tell the same story in the same era — when one is
  refreshed, diff the other in the same pass.

## Release visibility

Competitors ship near-daily and it *reads* as momentum. Our cadence is fine;
legibility is the gap: release notes get a human-written summary line and,
when a visible surface changed, a current screenshot. The version bump on the
site (above) rides the same pass.

## Definition of done for a marketing pass

1. Claims verified against shipped code (provider list, channel, era).
2. README ↔ site ↔ product skill tell one story.
3. Site version string current; og:image still the best shot.
4. Screenshots regenerated for surfaces that changed (pipeline above).
5. No personal-setup leaks.
6. Normal gate: `pnpm verify` + commit (site deploys itself on push).
