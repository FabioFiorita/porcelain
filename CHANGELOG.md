## [0.9.0](https://github.com/FabioFiorita/porcelain/compare/v0.8.0...v0.9.0) (2026-06-17)

### Features

* **finder:** surface folders in Cmd+P, not just files ([48d9a5d](https://github.com/FabioFiorita/porcelain/commit/48d9a5d82d3e83869137d29de5b7a6d1f7603da7))

## [0.8.0](https://github.com/FabioFiorita/porcelain/compare/v0.7.1...v0.8.0) (2026-06-17)

### Features

* **board:** hide the Quick Access panel on the Board tab ([587c2eb](https://github.com/FabioFiorita/porcelain/commit/587c2eb89894adf3ddbd9112774c93250aff6975))
* **shortcuts:** daily keyboard shortcuts for files, board, terminal ([9d9619b](https://github.com/FabioFiorita/porcelain/commit/9d9619b5f9c851e5d235910d8a7fe761c366a8f4))
* **terminal:** macOS line-editing chords (match Ghostty) ([45ebb83](https://github.com/FabioFiorita/porcelain/commit/45ebb83ba9ebc0a2199329d0741f509b86c13625))

### Bug Fixes

* **plugin:** make install button upgrade, not just first-install ([4e827d0](https://github.com/FabioFiorita/porcelain/commit/4e827d0aae82bcca1296bd6cd4b7f1550f62bd9b))

## [0.7.1](https://github.com/FabioFiorita/porcelain/compare/v0.7.0...v0.7.1) (2026-06-16)

### Features

* **terminal:** nerd-font glyphs + fix split-to-side ([e8127f1](https://github.com/FabioFiorita/porcelain/commit/e8127f10c027f5a344f2c737975420f528f61f1f))

## [0.7.0](https://github.com/FabioFiorita/porcelain/compare/v0.6.0...v0.7.0) (2026-06-16)

### Features

* **agents:** show "Update" when the installed plugin is behind ([dea83ee](https://github.com/FabioFiorita/porcelain/commit/dea83ee9872f01a7303490908c35c0cd905a2689))
* **changes:** branch/base-diff review — Working↔Branch scope toggle ([a92bcae](https://github.com/FabioFiorita/porcelain/commit/a92bcaea5c1e3ee3219b466079a6896d6dc88c0a))
* **changes:** mark-as-reviewed toggle on the Changes list ([e7f556f](https://github.com/FabioFiorita/porcelain/commit/e7f556fcec16a4df65505da9727f3aa9e8ee509f))
* discard changes, surface .env in finder, rework commit composer, Agents settings ([dc966ac](https://github.com/FabioFiorita/porcelain/commit/dc966ac2dc77e604e5208f73f07c297bb0abbfcb))
* embedded terminal + saved action runner ([cf36fde](https://github.com/FabioFiorita/porcelain/commit/cf36fdee3f7cc28dda1be5424f5f6b05c8fd043d))
* **files:** add Reveal in Finder + Delete to the tree context menu ([cbdee99](https://github.com/FabioFiorita/porcelain/commit/cbdee9963cbbf1578300d32ce5fdd976dd8b68bd))
* **git:** prototype branch-range diff helpers (gitMergeBase, gitRangeChangedFiles, gitRangeDiffFile) ([4b67dea](https://github.com/FabioFiorita/porcelain/commit/4b67deac3c99a0d6805eb34460675adbcfd20492))
* project board (todo/doing/done) with full MCP card control ([867bd15](https://github.com/FabioFiorita/porcelain/commit/867bd15eaa39f4c41b4d545c091b1720d7ed5ef1))
* review comments fed to the agent over MCP ([a6f0231](https://github.com/FabioFiorita/porcelain/commit/a6f02317832ff51fe9661a1c5cd0aacc92300810))
* **search:** add Cmd+Shift+F project-wide content search overlay ([f4d0301](https://github.com/FabioFiorita/porcelain/commit/f4d0301c5144f7ba2aeef8b479bead4abade4958))

### Bug Fixes

* **api:** guard per-file diff reads in featureReading against vanished files ([ad1cfd6](https://github.com/FabioFiorita/porcelain/commit/ad1cfd6142f94e125ed1bee927563804bc633f13))
* **diff:** handle renamed files in the -z status and numstat parsers ([0824bc5](https://github.com/FabioFiorita/porcelain/commit/0824bc57c89fee834d47a0c8c8e2d7f755857b76))
* **git:** surface real gitGrep failures instead of swallowing them as no-match ([7ae08d2](https://github.com/FabioFiorita/porcelain/commit/7ae08d2d7215eae43e828d542f1ef9549ded98ca))
* **notes:** capture repo path per card instance to prevent autosave flush writing to wrong repo ([be21bbf](https://github.com/FabioFiorita/porcelain/commit/be21bbf23215b082f24c1f87e8e253dd8215c0e3))
* **viewer:** key every identity-bearing tab branch to prevent stale-content flashes ([cff4312](https://github.com/FabioFiorita/porcelain/commit/cff4312ebbe6cc34491c854594f6094d63a9c71e))

### Performance Improvements

* **editor:** defer syntax-highlight tokenization off the keystroke path ([9383e31](https://github.com/FabioFiorita/porcelain/commit/9383e3161faebbb7749f8b8d39a7776390108db2))

## [0.6.0](https://github.com/FabioFiorita/porcelain/compare/v0.5.0...v0.6.0) (2026-06-15)

### Features

* **changes:** reveal the opened file in the tree on "Open file" ([e9aa647](https://github.com/FabioFiorita/porcelain/commit/e9aa647053d2291c97495807e7a56ecdcb6070bb))
* **sidebar:** start-align the project switcher to fill the title bar ([e54bb7c](https://github.com/FabioFiorita/porcelain/commit/e54bb7cb322e5e5d064501cb604315fb921b9b33))
* **ui:** glassy right-panel git actions ([12aa0b7](https://github.com/FabioFiorita/porcelain/commit/12aa0b7a39dbfffca21a62b448a40f690091a3d2))
* **ui:** polish empty states, settings chrome, and right-panel sections ([fb51fff](https://github.com/FabioFiorita/porcelain/commit/fb51fff5cf4851d2fce676b8eddb9f006f03e041))

## [0.5.0](https://github.com/FabioFiorita/porcelain/compare/v0.4.0...v0.5.0) (2026-06-15)

### Features

* **changes-list:** open the full file from a row's context menu ([7769ebb](https://github.com/FabioFiorita/porcelain/commit/7769ebb6f157bb1f64556e2d8f2b478dd0730911))
* **explore:** read-only feature-flow exploration from a symbol or file ([1a04f20](https://github.com/FabioFiorita/porcelain/commit/1a04f20b686f4f8214bd8f68fefb791e3a653dcf))
* **feature-view:** add Clear button to dismiss an agent review set ([089b059](https://github.com/FabioFiorita/porcelain/commit/089b059c5134dbc9015f6d0f861bab08de0e63af))
* **feature-view:** MCP-only inline reading surface with symbol slicing ([d899e82](https://github.com/FabioFiorita/porcelain/commit/d899e82ea8d40bbc69e28a3c5a4be2237986f06a))
* **feature-view:** promote the feature view to its own sidebar tab ([b439fc2](https://github.com/FabioFiorita/porcelain/commit/b439fc2128ded7038b9e0721f6207db4686e7625))
* **mcp:** add get_feature_review read tool ([341c135](https://github.com/FabioFiorita/porcelain/commit/341c135ef129dcf018fa7285416277aea6bce6b2))
* **settings:** choose rebase or merge for the git pull quick command ([3f3c187](https://github.com/FabioFiorita/porcelain/commit/3f3c187ccc9e0c9e56cee71c7758b024f0bd6236))
* **sidebar:** replace tab strip with icon rail + content panel ([9789d0a](https://github.com/FabioFiorita/porcelain/commit/9789d0aeec874ee6f7bcb0b11b5e3439636fd564))

### Bug Fixes

* **feature-view:** relabel Clear → 'Clear agent set' to name its scope ([e9c2e55](https://github.com/FabioFiorita/porcelain/commit/e9c2e5560c5dee08437e587086ec89108269062e))

## [0.4.0](https://github.com/FabioFiorita/porcelain/compare/v0.3.1...v0.4.0) (2026-06-14)

### Features

* **settings:** add manual check-for-updates section ([da44abc](https://github.com/FabioFiorita/porcelain/commit/da44abc54c997394467d11e56fdb6fcab83fe611))

## [0.3.1](https://github.com/FabioFiorita/porcelain/compare/v0.3.0...v0.3.1) (2026-06-14)

### Features

* **viewer:** split view with two side-by-side panes ([90c1088](https://github.com/FabioFiorita/porcelain/commit/90c1088e2dce091462b44a4cb3bb9e32374d10c4))

### Bug Fixes

* **ui:** dark-mode tooltip surface and enclose active tab border ([0f64766](https://github.com/FabioFiorita/porcelain/commit/0f64766addf52a2ab1232728013acca2c3611841))

## [0.3.0](https://github.com/FabioFiorita/porcelain/compare/v0.2.0...v0.3.0) (2026-06-14)

### Features

* **review:** add feature view with MCP server and Claude Code plugin ([93d2170](https://github.com/FabioFiorita/porcelain/commit/93d2170d2bf9ca3aaed25805ede9e73ad7e8b86d))

### Bug Fixes

* **git:** list untracked files individually so folder diffs don't EISDIR ([fb6ec0f](https://github.com/FabioFiorita/porcelain/commit/fb6ec0fb3268447332fec6f4e131c2932ed5ed68))
* **highlight:** tokenize whole files and disable mono ligatures ([3a6c411](https://github.com/FabioFiorita/porcelain/commit/3a6c4119713af8ddd43e4a0aeebd640750503a26))

## [0.2.0](https://github.com/FabioFiorita/porcelain/compare/v0.1.2...v0.2.0) (2026-06-13)

### Features

* **git:** file staging plus index-lock race fix ([8a9f667](https://github.com/FabioFiorita/porcelain/commit/8a9f667084bd4712342fb65ec2dc1da8f614a17a))
* **notes:** per-repo quick-notes card under pinned files ([a355c9a](https://github.com/FabioFiorita/porcelain/commit/a355c9aaef0467e382a4be133c7f512dffca0fa5))

## [0.1.2](https://github.com/FabioFiorita/porcelain/compare/v0.1.1...v0.1.2) (2026-06-13)

## [0.1.1](https://github.com/FabioFiorita/porcelain/compare/v0.1.0...v0.1.1) (2026-06-13)

### Bug Fixes

* **ci:** drop 'Developer ID Application:' prefix from signing identity ([2c9a954](https://github.com/FabioFiorita/porcelain/commit/2c9a95433915b1149867e65d91b655ddd8847ca5))

## [0.1.0](https://github.com/FabioFiorita/porcelain/compare/f75431b7679e4e8d95cc816859957bbbdcfc9d85...v0.1.0) (2026-06-13)

### ⚠ BREAKING CHANGES

* remove embedded terminal; quick commands run in-app

### Features

* always-editable viewer with autosave, kbd shortcut hints ([68a7474](https://github.com/FabioFiorita/porcelain/commit/68a7474360009be77da25bbf3d1e38619f269cfe))
* app shell with sidebar, tab bar, viewer, and terminal panes ([b7cf86c](https://github.com/FabioFiorita/porcelain/commit/b7cf86cd6ede7d12092b94827e17c3cf61405e7f))
* apply luma emerald shadcn preset (b2D0xPJT8) ([06d0fd8](https://github.com/FabioFiorita/porcelain/commit/06d0fd826d83b78663e684c5dd018088e6509d62))
* auto-open the last repository on startup ([2a95915](https://github.com/FabioFiorita/porcelain/commit/2a95915b3f83ab1df4281155955308b14d598351))
* branch display and worktree switcher in sidebar footer ([9239af6](https://github.com/FabioFiorita/porcelain/commit/9239af6e05774a16dfeaff359974b7f7f09eb817))
* cap file reads and show a too-large view ([f5da0df](https://github.com/FabioFiorita/porcelain/commit/f5da0df213b8d65bf274501ec6fe416c7b23c7cd))
* cmd+f find-in-file bar with match cycling ([7b16d68](https://github.com/FabioFiorita/porcelain/commit/7b16d6891b8e38d3700ba1dfd9adca62164c9fbb))
* cmd+p fuzzy file finder ([3b17ab6](https://github.com/FabioFiorita/porcelain/commit/3b17ab6eb920019c052560ae4e7d1fd3b6bf16ea))
* colored file-type and folder icons in tree, finder, and sidebar tabs ([288970a](https://github.com/FabioFiorita/porcelain/commit/288970a2f220497c9c4e3c352b498d6c9e46fe8c))
* commit history tab with per-commit diff view ([7179eba](https://github.com/FabioFiorita/porcelain/commit/7179eba599d89149eb839dbd95806d6fdb0aad36))
* contextual git suggestions in quick access (pull/push/stash) ([8ade47e](https://github.com/FabioFiorita/porcelain/commit/8ade47ef72f211f579e1f485677db224c420ff47))
* diff stats on change rows, middle-click tab close, pruned recents ([23df005](https://github.com/FabioFiorita/porcelain/commit/23df005349de450acf4753263efd1119b5c3ad3a))
* direct commit and tab-aware quick access sections ([c5c922f](https://github.com/FabioFiorita/porcelain/commit/c5c922f2bb5293baf0a0144366e91c04b229199c))
* flow-layer settings dialog and markdown reader ([2e58b6e](https://github.com/FabioFiorita/porcelain/commit/2e58b6e4b24b06369dc15ba85bfbfd144e765dcd))
* flow-ordered review groups changes by layer with import edges ([2adae04](https://github.com/FabioFiorita/porcelain/commit/2adae04289e63b1a2d15c217a0b2ca66df435dfb))
* folder hiding with context menu and eye toggle, recent repos on welcome ([8582b10](https://github.com/FabioFiorita/porcelain/commit/8582b10a64917b48a03ab05f6cd8f2e4aef0c560))
* glassier look with hud vibrancy and lower panel alphas ([eb06ec9](https://github.com/FabioFiorita/porcelain/commit/eb06ec9712387196f1a79b7f54e5affeb54dba42))
* glaze design system phases 0-1 — floating tiles, tokens, tab capsules ([754bad7](https://github.com/FabioFiorita/porcelain/commit/754bad78c22d07fef461b3061dfd5877b4760584))
* history-only commit chips, glass floating sidebar tab bar ([52146fc](https://github.com/FabioFiorita/porcelain/commit/52146fc97afd8f06ce47e6b8a48c098a2418e5cd))
* isolate dev config from the installed app, seed playground repo ([b9cf596](https://github.com/FabioFiorita/porcelain/commit/b9cf596788fc506c19bb9100e1d53449e58ec079))
* keep syntax highlighting in quick-edit mode ([47aca92](https://github.com/FabioFiorita/porcelain/commit/47aca928af4011206ecb211b7c69231ded45ca3b))
* liquid glass vibrancy with hidden inset title bar and drag regions ([b88330b](https://github.com/FabioFiorita/porcelain/commit/b88330b5785d8a515b9a77ea0a894adf6133ed3d))
* mac dmg/zip packaging with GitHub auto-update ([0a9e55d](https://github.com/FabioFiorita/porcelain/commit/0a9e55dcd24aa96e0b5e8dd3c1403299667b50f9))
* perf batch, tab context menu, crash visibility ([ba3e2a1](https://github.com/FabioFiorita/porcelain/commit/ba3e2a1a7067d80527793e088609a325d275d914))
* porcelain squircle branding on welcome and empty viewer ([33a2ca3](https://github.com/FabioFiorita/porcelain/commit/33a2ca3b268a5ed06343ed112c5781e3f2b0ac72))
* project switcher dropdown in the sidebar header ([8d0aa1c](https://github.com/FabioFiorita/porcelain/commit/8d0aa1c9bad6699fc18ef236d074079d17164480))
* quick edits, viewer context menu, find references ([b38bd08](https://github.com/FabioFiorita/porcelain/commit/b38bd08b9f33bb793b1d9adb2448f9145bcd9a07))
* remove embedded terminal; quick commands run in-app ([0ed5605](https://github.com/FabioFiorita/porcelain/commit/0ed5605cc3a30f8db186753952b31a6292179b8c))
* resizable sidebar and multi-select batch hide ([76298d9](https://github.com/FabioFiorita/porcelain/commit/76298d9e4e89d499d9ad5655f2064ca37aa765b2))
* right quick-access sidebar with pins, git commands, commit helper ([bcd890c](https://github.com/FabioFiorita/porcelain/commit/bcd890c231d7bcbeb5fb43b8d3c99e1dc9ad5213))
* scaffold electron-vite app with shadcn (Base UI), Tailwind v4, Biome, Vitest ([f75431b](https://github.com/FabioFiorita/porcelain/commit/f75431b7679e4e8d95cc816859957bbbdcfc9d85))
* selection-aware viewer context menu and resizable right sidebar ([d4c442a](https://github.com/FabioFiorita/porcelain/commit/d4c442a090eda6c8638dda0289885a2e04bb3999))
* settings dialog with sidebar sections (general + review flow) ([042f19f](https://github.com/FabioFiorita/porcelain/commit/042f19f3f535f80f51f669cdc5b86952b2128cf9))
* single-click preview tabs, double-click or edit pins ([b51b5d8](https://github.com/FabioFiorita/porcelain/commit/b51b5d819d30a601d99c9679a47bac4ff5b3f78b))
* tab shortcuts, persisted preferences, image and binary file views ([4b2a154](https://github.com/FabioFiorita/porcelain/commit/4b2a15475a8228735cf951d518b4eae84ab224e2))
* TanStack Query caching and Shiki syntax highlighting ([c55bdbf](https://github.com/FabioFiorita/porcelain/commit/c55bdbf9bdc9d0a19ae423293651d540c2a77729))
* typed tRPC IPC, repo opening, lazy file tree with shadcn sidebar ([4cf6757](https://github.com/FabioFiorita/porcelain/commit/4cf6757a760fee8564b264549fce22d7ad9ac568))
* welcome screen for repo selection and aligned sidebar header ([f997f26](https://github.com/FabioFiorita/porcelain/commit/f997f2649db60f71e227b0ad1bc68c295cf9abc2))
* working terminal pane with node-pty and xterm.js ([f7bf7ff](https://github.com/FabioFiorita/porcelain/commit/f7bf7ff534af592babb60c6a02ca3d96c7864db4))
* working-tree git diffs with unified and split views ([7dfac0b](https://github.com/FabioFiorita/porcelain/commit/7dfac0b4328318321d837e959c778caa62863d51))

### Bug Fixes

* capture editor selection on menu open; kbd hints in menus and tab tooltips ([6e4f9a8](https://github.com/FabioFiorita/porcelain/commit/6e4f9a8c7f15674a9e1ab5d02152994b1a879b6d))
* entire top bar is window-draggable, only tabs opt out ([fba789f](https://github.com/FabioFiorita/porcelain/commit/fba789fdb002e5df52f60ee5b7cdf34b0772613d))
* file finder shows filename first with left-truncated directory ([4b4d645](https://github.com/FabioFiorita/porcelain/commit/4b4d645da069862e81720d825acaf04fb7b077c8))
* hide .DS_Store, cmd+1/2/3 sidebar tabs, no-wrap source rows, finder group padding ([298d9ee](https://github.com/FabioFiorita/porcelain/commit/298d9eee516776de976474dcb431928fc31a8c7a))
* only open http/https/mailto links externally ([65029a8](https://github.com/FabioFiorita/porcelain/commit/65029a883ee4e4a32f42eb025b0b516f7eab6c38))
* persist config atomically and serialize updates ([6c6a09c](https://github.com/FabioFiorita/porcelain/commit/6c6a09c3e0954ab0255dff7d3a0533e9786440eb))
* pin tRPC to v10 for electron-trpc compatibility ([693716c](https://github.com/FabioFiorita/porcelain/commit/693716c0c3a83ee5e298aabcce49ed1ab0df0f21))
* share one tRPC ipcLink client between hooks and stores ([127fa89](https://github.com/FabioFiorita/porcelain/commit/127fa895060bc824ef7da5d9fb901ea2b05b478a))
* sidebar trigger clears traffic lights when sidebar is collapsed ([91bc17f](https://github.com/FabioFiorita/porcelain/commit/91bc17fbc4e46798eee3e01b10d34f13d5d1bf0a))
* terminal nerd font, dark scrollbar, collapsed by default with toggle ([b33c24c](https://github.com/FabioFiorita/porcelain/commit/b33c24c0599c0785390fb5b89e2e6a50abc92df2))
* transparent html/body so vibrancy shows through ([7f30563](https://github.com/FabioFiorita/porcelain/commit/7f30563d53915cc735d692c8f376d551cea67c4e))
* use Shiki JS regex engine to satisfy renderer CSP ([ee8aac4](https://github.com/FabioFiorita/porcelain/commit/ee8aac41e0edd346b3324f6ed6b7eec1a27e1929))
* virtualize viewer and diff rendering, keep git status live ([04f40c5](https://github.com/FabioFiorita/porcelain/commit/04f40c53b25494310ce32139da5af5cb08a9d0ce))
