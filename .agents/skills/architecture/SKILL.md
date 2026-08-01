---
name: architecture
metadata:
  internal: true
description: Porcelain's stack, the one client architecture every feature follows, and the decisions and traps the code can't show you. Read before writing or reviewing any code in this repo.
---

# Porcelain architecture

Decisions, deliberate absences, and traps a fresh read won't recover. It does **not** paraphrase
how a feature is wired — open the entry file in **Nomenclature** and read it.

## Stack

| Area | Decision |
|---|---|
| Desktop/browser shell | Electron via electron-vite, React 19, strict TypeScript |
| Desktop/browser UI | shadcn/ui on **Base UI** (`@base-ui/react`, not Radix) + Tailwind v4, preset `b5J4txmSY` (nova/neutral/sky), dark default |
| Typography | Sans/mono split — `main.css` deliberately overrides the preset's `--font-sans` to Geist; mono is codelike content only. **TRAP:** `VirtualRows` hardcodes `font-mono`, so prose rows must override back to `font-sans` |
| Native mobile | Expo SDK 57, **iOS-only**, Expo Router, `@expo/ui/swift-ui` + `/modifiers`. EAS dev-client builds, never Expo Go |
| Client state | zustand, one small store per concern. No other state library |
| Git backend | Shell out to the `git` CLI, parse porcelain output. No git libraries |
| Per-repo config | App-side JSON under `userData`, keyed by repo path. Never write into work repos |
| Package manager | pnpm |
| Lint/format | Biome (no ESLint/Prettier); unused imports/vars are **errors** |
| Tests | Vitest (`apps/desktop/src/**/*.test.{ts,tsx}`) + Playwright (`apps/desktop/e2e/*.spec.ts`) |

Eight custom gates cover rules Biome can't express. The scoped ones skip comment lines.

| Gate | Enforces | Scope |
|---|---|---|
| `lint-escapes.mjs` | `as unknown as`, `void` on promises, mobile universal-`@expo/ui` imports | **all clients incl. `apps/mobile`** — hard rules 6/7 are about the language |
| `lint-control-recipes.mjs` | compact control classes come from `lib/controls.ts` | renderer |
| `lint-shadcn-heuristics.mjs` | hand-rolled renderer primitives | renderer |
| `lint-audit.mjs` | `isSafeExternalUrl`, `GIT_OPTIONAL_LOCKS`, hook env scrub | daemon/main |
| `lint-comments.mjs` | dates, oversized comment blocks, plan/billing narrative | repo, incl. `.yml`/`.md`/`.sh`/`.mjs` |
| `lint-render-refs.mjs` | `ref.current =` at render scope (TS AST, not regex) | renderer |
| `lint-ratchets.mjs` | 500-line file cap, hook sibling tests — allowlists where a **stale entry also fails** | repo |
| `lint-doc-budget.mjs` | per-tier word caps + a corpus total on `AGENTS.md` and authored skills | docs |

`knip` runs with `exports,types`, so an unused export fails the gate — it is not a
"deliberately public" escape hatch.

## Deliberately absent

| Not built | Why |
|---|---|
| In-app agent runner / chat threads | ~18k lines and a 40% fix rate in 16 days for a surface its author used twice. The Review is fed by the **porcelain CLI**, so an agent in Porcelain's terminal, another emulator, or over SSH publishes the same Review. Reopen `product`'s "Companion, not competitor" before rebuilding |
| Porcelain MCP server | Channels are the CLI writing local JSON |
| Agent chat / relay channel | Agent-to-agent messages with file claims and overlap detection weren't worth the maintenance; coordinating parallel agents is not a problem Porcelain claims to solve |
| Standalone artifact + evidence tab kinds | Folded into the Review canvas — one document, not a second narrative surface beside it |
| Glaze / vibrancy / a `Surface` wrapper | See "One opaque design" |
| A fleet-wide shared daemon token | Per-device credentials, individually revocable |
| Config→channel migrations, upgrade shims | Pre-audience: **no one-shot migrations from retired formats**; corrupt or unknown shapes → empty/default. Don't re-add `migrate*FromConfig`, `evidence.json`, action `cwd`, bare-string reviewed marks, or the single-`{url,token}` remote-daemon parse |
| Linux/Windows desktop packaging | A *distribution* decision only: nobody ran the unsigned Linux build and its failure could block a fine Mac release. **Every Linux runtime path stays** — `resolvePlatform`/`PORCELAIN_FORCE_LINUX`, `isLinuxShell`, renderer-drawn window controls, Ctrl-primary keybindings. Don't "clean up" those as dead code; the daemon ships to Linux via npm and the browser client is how Linux humans get a seat |

**Still product, not trash:** WebGL→DOM terminal fallback; dual primary+local daemon sessions;
`exportRepoSettings`/`importRepoSettings`; Linux shell chrome; `feature` internal ids while the UI says
Review (the rename is a structural project).

## Reference

Detail lives in `reference/*.md`, read on demand — don't open one until the task below matches.

| File | When to read |
|---|---|
| [`reference/one-architecture.md`](reference/one-architecture.md) | Changing how data flows daemon → hooks → components; touching the WS session, environments/failover, tab routing, keyboard-shortcut tiers, or test setup |
| [`reference/terminal.md`](reference/terminal.md) | Changing anything about PTY lifecycle, terminal rendering (WebGL/DOM), touch input, the key bar, or scrollback |
| [`reference/app-shell.md`](reference/app-shell.md) | Changing window chrome, sidebar/viewer layout, surface/color recipes, or any other App Shell trap |
| [`reference/mobile.md`](reference/mobile.md) | Changing anything under `apps/mobile`, or touching the native client's platform, delivery, or Rule-5 decisions |
| [`reference/nomenclature.md`](reference/nomenclature.md) | Looking up a term the human used (a tab name, shell region, or cross-cutting word) to find its entry file |
| [`reference/repo.md`](reference/repo.md) | Looking up a repo-wide fact (path aliases, Shiki, theme boot, shadcn re-apply) or a packaging/release/lint convention |
