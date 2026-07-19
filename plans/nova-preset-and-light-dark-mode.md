# Nova preset (`b5J4txmSY`) + light/dark mode

**Status:** DONE (2026-07-18). Commit 1 = `2051fa0` (nova apply + local-tweak re-graft + docs + regenerated linux baselines); commit 2 = the light/dark/system theme (see git log). Deviations from plan: the shell receives the *resolved* mode (not the raw pref) so OS flips under System retint native chrome; e2e pins `colorScheme: dark` in both harness fixtures so the System default stays deterministic under test; the six `*-darwin.png` baselines still need a Mac regeneration before the next release.

## Goal

1. Switch the app's shadcn preset from `b1tNqHXYe` (mira/mist/sky) to **`b5J4txmSY`** (nova/neutral/sky), via `pnpm dlx shadcn@latest apply --preset b5J4txmSY` — full **overwrite** apply (maintainer-approved 2026-07-18).
2. Ship **light/dark/system theme** — a persisted 3-way pref in Settings → General. The CSS groundwork already exists: `main.css` has full `:root` (light) and `.dark` token blocks (preset-owned *and* Porcelain-custom `--success`/`--diff-*`/`--ink-*` tokens are defined for both), and `@custom-variant dark (&:is(.dark *))` is class-driven (line 18). What's missing is the *switch*: `index.html` hardwires `<html class="dark">` and several modules are dark-only.

## Decisions (made with maintainer, 2026-07-18)

- **Apply mode: overwrite.** The preset changes component style mira → nova, so all 24 installed components get reinstalled with nova source. Local tweaks are re-applied by hand afterwards (known list below).
- **Translucent menus accepted.** The preset's `menuColor: default-translucent` conflicts with the documented "No vibrancy/glass/translucency anywhere" surface language — maintainer chose the preset as-is. Docs (CLAUDE.md/AGENTS.md + `architecture` skill) get updated to match; surfaces otherwise stay opaque.

## Preset delta (from `preset resolve` / `preset decode`)

| field | current `b1tNqHXYe` | new `b5J4txmSY` |
|---|---|---|
| style | mira | **nova** |
| baseColor | mist | **neutral** |
| theme | sky | sky (unchanged) |
| chartColor | cyan | **sky** |
| font | jetbrains-mono | jetbrains-mono (unchanged) |
| radius | default | default (unchanged) |
| menuAccent | subtle | subtle (unchanged) |
| menuColor | default | **default-translucent** |

Components the apply will overwrite (24): alert-dialog, badge, button, collapsible, command, context-menu, dialog, dropdown-menu, input, input-group, kbd, popover, scroll-area, separator, sheet, sidebar, skeleton, sonner, switch, tabs, textarea, toggle, toggle-group, tooltip.

## Commit 1 — preset switch

1. `pnpm dlx shadcn@latest apply b5J4txmSY --yes` from repo root. Rewrites: `components.json` (style `base-nova`, baseColor `neutral`, `menuColor: default-translucent`), the 24 `src/renderer/src/components/ui/*` files, and the preset-owned `:root`/`.dark` blocks in `src/renderer/src/assets/main.css`. Porcelain's custom token blocks below the preset region survive by design.
2. **Audit `git diff` and re-apply local tweaks.** Known: `ui/sonner.tsx` (`theme="dark"` + custom toast color mapping, lines 7/26–33 pre-apply). Scan the full ui diff for other deliberate local changes (the opaque redesign landed in `b649dc9` — diff against it).
3. **Trap — `next-themes`:** upstream `sonner.tsx` imports `useTheme` from `next-themes`, which is NOT a dependency here. The apply will restore that import and break the build. Re-apply the local hardcoded-`dark` sonner in commit 1 (it becomes dynamic in commit 2). Also grep `ui/` post-apply for any other new third-party imports the project lacks.
4. **Trap — new preset tokens:** check the main.css diff for nova-introduced CSS vars (e.g. shadow/surface tokens); if the preset-owned block gains vars, mirror them in the `@theme inline` mapping so Tailwind utilities exist.
5. Update `main.css` comments that say "mira preset" (lines 20–24 `@theme inline`, 170–189 banner) → nova.
6. **Docs:** CLAUDE.md (= AGENTS.md via symlink) Nomenclature → Surface language: preset code/name change; rewrite "No vibrancy/glass/translucency anywhere" → surfaces opaque, **menus translucent** (`menuColor: default-translucent`). Same two facts in `.agents/skills/architecture/SKILL.md`.
7. `pnpm verify`; spot-check; delegate diff to invariant-reviewer; commit.

## Commit 2 — light/dark/system theme

### Renderer

1. **`stores/preferences.ts`** — add `ThemeMode = 'system' | 'light' | 'dark'`, `theme` field (default `'system'`), `setTheme`. Prefs are renderer-local (zustand `persist`, localStorage key `porcelain-preferences`) — no backend/shared/preload schema changes needed.
2. **`main.tsx` pre-paint application** — before `createRoot`, synchronously read the store (`usePreferencesStore.getState()` — zustand persist hydrates synchronously from localStorage), resolve `system` via `matchMedia('(prefers-color-scheme: dark)')`, toggle the `dark` class on `documentElement` and set `style.colorScheme`. This replaces the hardwired `class="dark"` in `index.html` **before first paint** — no inline `<script>` needed, so CSP (`script-src 'self'`) stays untouched.
3. **`lib/theme.ts` (new, framework-free)** — `resolveTheme(pref)`, `applyResolvedTheme(mode)` (class + colorScheme), and a subscribe helper wrapping store-`subscribe` + `matchMedia` change events. **`hooks/use-theme.ts` (new)** — React binding returning the resolved mode, mounted once in `app-shell.tsx` beside the other one-shot hooks (lines ~221–227).
4. **`settings/general-section.tsx`** — "Appearance" `PreferenceRow` (label + description idiom, lines 41–59) with a 3-item `ToggleGroup` (System / Light / Dark) using `compactButtonClass` from `@renderer/lib/controls` and guarded `onValueChange` (`mode satisfies ThemeMode`) — mirrors the existing DiffMode toggle (lines 76–91).
5. **Dark-only hardcodes → theme-aware:**
   - `ui/sonner.tsx` — `theme` from `useTheme()` hook (replaces commit-1 hardcode).
   - `lib/highlight.ts` — register `@shikijs/themes/light-plus` alongside `dark-plus`; pick per resolved mode; add theme to the `tokenCache` key (line ~153). Consumers (`viewer/code-line.tsx:83`, `git/hunks-view.tsx`, `git/reading-surface.tsx`) must re-highlight on theme change — include a theme version (from the use-theme hook) in their memo deps.
   - `lib/terminal-registry.ts` — `TERMINAL_THEMES: Record<'light'|'dark', ITheme>` (current dark literals at lines 185–190; add a light palette); extend the existing module-level `usePreferencesStore.subscribe` (line 84) to re-theme open terminals on mode change; new terminals read the current mode. `terminal/terminal-view.tsx:42` `bg-[#16161a]` → inline `style={{ backgroundColor: TERMINAL_THEMES[mode].background }}` (single JS source of truth, no duplicate CSS token).
   - `prose-invert` → `dark:prose-invert`: `viewer/markdown-view.tsx:15`, `git/reading-surface.tsx:430`, `agent/agent-view.tsx:78`, `shell/notes-card.tsx:93`.
   - Dialog/Sheet/AlertDialog `bg-black/80` scrims: leave (standard in both modes; nova apply may restyle them anyway).

### Main process (OS chrome + no reload flash)

6. **`src/main/shell-api.ts`** — add `setThemeSource(mode: 'system'|'light'|'dark')` mutation: sets `nativeTheme.themeSource` (macOS `hiddenInset` chrome follows the app theme) and updates `backgroundColor` on all `BrowserWindow`s (dark `#090b0c` / light `#ffffff` to match `--background`). Wire through the existing shell client (`src/renderer/src/lib/trpc.ts:137`); the use-theme hook calls it on every resolved-mode change. Guard for the browser client (no Electron bridge) the same way existing shell calls do.
   - `window.ts` keeps `#090b0c` as the **boot default** (main can't read renderer localStorage pre-launch; window is hidden until `ready-to-show`, which fires after first paint — and step 2 applies the class pre-paint — so there is no visible flash on cold start. The mutation covers reloads/HMR).
   - Note: `nativeTheme` is used nowhere today (grep-verified) — this is the first introduction; keep it contained to the shell-api mutation.

### Tests / traps

- `matchMedia` may not exist in the unit-test DOM — check the vitest setup; stub if `use-theme` or `main.tsx` logic gets unit coverage. Terminal/highlight theme logic (pure maps) is unit-testable without DOM.
- E2E (`pnpm test:e2e`) is macOS-only — not run on this host; note in the commit that it wasn't exercised.
- Browser client gets light/dark for free (same renderer); verify no Electron-only calls fire there.

### Docs (same commit — hard rule 4)

- `main.css` banner: drop "no toggle ships yet — `<html class="dark">` is hardwired in index.html".
- CLAUDE.md (= AGENTS.md): theme pref exists (Settings → General → Appearance, System default).
- `.agents/skills/architecture/SKILL.md`: theme architecture (pref store, pre-paint class in `main.tsx`, `use-theme`, `nativeTheme.themeSource` sync, themed Shiki/xterm).
- Update this plan's status.

## Verification (close-the-loop, with evidence)

1. `pnpm verify` (lint + test + build; typecheck inside build) — hook-enforced before each commit.
2. Live check on this headless host: `DISPLAY=:1 pnpm dev`, computer-use the dev **"Electron"** window (never the installed Porcelain app). Screenshot matrix: dark (regression vs. today) and light across — app shell, Settings → General (the new toggle), code viewer (Shiki), diff view, markdown view, embedded terminal, a toast, and a dropdown/context menu (translucency + nova style).
3. System mode: on this Linux box `prefers-color-scheme` likely resolves light — verify the toggle + matchMedia path; macOS system flip verified by maintainer later if needed.
4. invariant-reviewer pass on each diff before committing.

## Housekeeping at execution time

- Working tree already has unrelated changes (`M CLAUDE.md`, `M .agents/skills/product/SKILL.md`, untracked `.agents/skills/close-the-loop/`). Commit 1 also edits CLAUDE.md — coordinate with maintainer whether their pending CLAUDE.md edits ride along or land separately; stage only intended files per commit.
- Two commits, straight to `main` (hard rule 8); no push without the maintainer.
