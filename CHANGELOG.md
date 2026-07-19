## [0.32.0](https://github.com/FabioFiorita/porcelain/compare/v0.31.1...v0.32.0) (2026-07-19)

### Features

* light/dark/system theme — persisted preference, themed Shiki + xterm + OS chrome ([6781508](https://github.com/FabioFiorita/porcelain/commit/6781508d62b61395d1c31f2c192c1a80d1dc0376))
* switch shadcn preset to nova (b5J4txmSY) — neutral base, translucent menus ([2051fa0](https://github.com/FabioFiorita/porcelain/commit/2051fa08c7579c96c6c2f8582e3cbfd24dc58c17))

## [0.31.1](https://github.com/FabioFiorita/porcelain/compare/v0.31.0...v0.31.1) (2026-07-18)

### Bug Fixes

* pin the Xvfb screen in Linux e2e — default 1280 clamps the 1400x900 window ([650d926](https://github.com/FabioFiorita/porcelain/commit/650d926ca40a5258a32dbaad2a5dcd4d116790c6))

## [0.31.0](https://github.com/FabioFiorita/porcelain/compare/v0.30.0...v0.31.0) (2026-07-18)

### Features

* Linux release leg — AppImage + deb + auto-update published with every release ([00d3e05](https://github.com/FabioFiorita/porcelain/commit/00d3e054aa4db3bc3734dad89a706c98108db750))
* the Review — one agent-authored document — plus chat claims ([4d727ca](https://github.com/FabioFiorita/porcelain/commit/4d727cafa138891bbcfaae21848eb8d450f5ada1))

### Bug Fixes

* Ctrl+W yields to a focused terminal on Linux — renderer-owned close-tab ([27a8e3b](https://github.com/FabioFiorita/porcelain/commit/27a8e3b0f8e7d983340bf7df46f61fa570a4550c))

## [0.30.0](https://github.com/FabioFiorita/porcelain/compare/v0.29.2...v0.30.0) (2026-07-18)

### Features

* daemon version-skew guard; app-wide compact-scale and surface-language pass ([d3acf7f](https://github.com/FabioFiorita/porcelain/commit/d3acf7f10524c6727c7738fa59d14a715465de79))
* Linux foundations — platform seam, Porcelain-aware agent sessions, Linux CI ([2eff230](https://github.com/FabioFiorita/porcelain/commit/2eff230e9407e5087c035914181956e52ba92c64))
* opaque redesign — mira/mist/sky identity, glass system removed, Linux window chrome ([b649dc9](https://github.com/FabioFiorita/porcelain/commit/b649dc95a283210653dc92d5e0e2bfa274d71248)), closes [#090b0c](https://github.com/FabioFiorita/porcelain/issues/090b0c)
* replace the MCP server with the bundled porcelain CLI ([7833529](https://github.com/FabioFiorita/porcelain/commit/7833529ee115293abb3ec88a401fa9e18a8ef8b1))

### Bug Fixes

* set author email — required by the Linux deb maintainer field ([95d7698](https://github.com/FabioFiorita/porcelain/commit/95d7698be56d8d9f4d457e55f8050bbf1749a973))
* UI hierarchy pass — quiet row actions, unified card/well recipes, board fill, dedupe Source control ([8ec2fbf](https://github.com/FabioFiorita/porcelain/commit/8ec2fbf3c85bcb0929b4a11ee94b6277466d095c))
* validate agent-channel HTML inputs, add read previews, skip project boot in codex/grok titles ([085bae4](https://github.com/FabioFiorita/porcelain/commit/085bae42c6894620cd735c1c27e5980df112b6b2))

## [0.29.2](https://github.com/FabioFiorita/porcelain/compare/v0.29.1...v0.29.2) (2026-07-17)

### Features

* Remote badge in title bar when window is on a remote daemon ([ac1cd13](https://github.com/FabioFiorita/porcelain/commit/ac1cd131cb5a17406773cd8dc38c0d34b6dc7894))

## [0.29.1](https://github.com/FabioFiorita/porcelain/compare/v0.29.0...v0.29.1) (2026-07-17)

## [0.29.0](https://github.com/FabioFiorita/porcelain/compare/v0.28.3...v0.29.0) (2026-07-17)

### Features

* built-in sandboxed HTML preview for .html files ([9d3fa82](https://github.com/FabioFiorita/porcelain/commit/9d3fa827c5f123a64450564eb038168f1091ebbc))

## [0.28.3](https://github.com/FabioFiorita/porcelain/compare/v0.28.2...v0.28.3) (2026-07-17)

### Bug Fixes

* loop evidence as on-disk directory, not MCP HTML payload ([61df10f](https://github.com/FabioFiorita/porcelain/commit/61df10fdcac792aa3f76a1b486a7b8b71b0aeab8))

## [0.28.2](https://github.com/FabioFiorita/porcelain/compare/v0.28.1...v0.28.2) (2026-07-17)

### Bug Fixes

* MCP htmlFile input and auto-reload on binary upgrade ([6742569](https://github.com/FabioFiorita/porcelain/commit/67425698027cdcf37bb492307610eba1e1406d50))

## [0.28.1](https://github.com/FabioFiorita/porcelain/compare/v0.28.0...v0.28.1) (2026-07-17)

### Bug Fixes

* refresh MCP server on daemon boot ([597d83d](https://github.com/FabioFiorita/porcelain/commit/597d83d4502cb8d7053fc8e2079a15d44bdbf3c5))

## [0.28.0](https://github.com/FabioFiorita/porcelain/compare/v0.27.1...v0.28.0) (2026-07-17)

### Features

* agent chat, env sync skill, board scroll; drop seed UI ([62f111a](https://github.com/FabioFiorita/porcelain/commit/62f111ac233378da4d205b06b60db4276ccc1b7f))

## [0.27.1](https://github.com/FabioFiorita/porcelain/compare/v0.27.0...v0.27.1) (2026-07-16)

## [0.27.0](https://github.com/FabioFiorita/porcelain/compare/v0.26.1...v0.27.0) (2026-07-16)

### Features

* add loop evidence — ephemeral validation proof in the Feature tab ([6b020d5](https://github.com/FabioFiorita/porcelain/commit/6b020d550d5ecea321fbe4c252f1a4a993f9edfb))
* reorganize Settings — Environments tab, disk MCP probe, Grok ([bd9e42e](https://github.com/FabioFiorita/porcelain/commit/bd9e42e832237c324bab6c281b5355cfcc538a17))

### Bug Fixes

* tighten Settings type hierarchy across all tabs ([a5744c1](https://github.com/FabioFiorita/porcelain/commit/a5744c1af02affefb03cf742ba1567455f647b85))

## [0.26.1](https://github.com/FabioFiorita/porcelain/compare/v0.26.0...v0.26.1) (2026-07-16)

## [0.26.0](https://github.com/FabioFiorita/porcelain/compare/v0.25.1...v0.26.0) (2026-07-16)

### Features

* **terminal:** let users choose WebGL or DOM paint path ([3ed559b](https://github.com/FabioFiorita/porcelain/commit/3ed559b7cea0503bc22f913a85c32c07c174b491))

## [0.25.1](https://github.com/FabioFiorita/porcelain/compare/v0.25.0...v0.25.1) (2026-07-16)

### Bug Fixes

* **ci:** clear setup-node dummy token so npm OIDC publish works ([c264c7e](https://github.com/FabioFiorita/porcelain/commit/c264c7e8ba5834d6134d2984734898f2de9be9e9))
* **ci:** keep OIDC probe as a single-line python snippet ([2fae29a](https://github.com/FabioFiorita/porcelain/commit/2fae29a3b3e4ccd6ce7736cf5b3462d41556b758))
* **ci:** make npm OIDC publish work without setup-node dummy auth ([609e764](https://github.com/FabioFiorita/porcelain/commit/609e7642b480c4bf98c130f4388468543ed511cd))
* **ci:** publish porcelain-daemon on Ubuntu via OIDC ([81ef6c9](https://github.com/FabioFiorita/porcelain/commit/81ef6c94b459578ece66fc02e41fae4436088921))
* **ci:** surface npm OIDC exchange errors for trusted publishing ([f46e64c](https://github.com/FabioFiorita/porcelain/commit/f46e64c78831b35f9ab5fdb4b8e909911dae89dd))
* use generic example paths in settings and fixtures ([52efb53](https://github.com/FabioFiorita/porcelain/commit/52efb53325cd5705fb50ecf133662b83fb2d77e7))

## [0.25.0](https://github.com/FabioFiorita/porcelain/compare/v0.24.4...v0.25.0) (2026-07-16)

### Features

* per-window environments and seed review comments to remote ([da9fd42](https://github.com/FabioFiorita/porcelain/commit/da9fd427d95c536e6175f3be29777aa830888fec))
* publish porcelain-daemon for npx serve on remote hosts ([551071b](https://github.com/FabioFiorita/porcelain/commit/551071b82615a28e92436cf7cf980aca7dcf1ffa))

### Bug Fixes

* **agent:** truthful usage metering and cleaner thread UX ([091771b](https://github.com/FabioFiorita/porcelain/commit/091771bf923e73c315d09af3297b89429a2f48b6))
* make the browser client usable for quick look on iPhone ([0f143ee](https://github.com/FabioFiorita/porcelain/commit/0f143eefaf4241de23fea2b4b6ca3013108132b3))
* strip Volta recursion flag from PTY/agent env ([4e71b84](https://github.com/FabioFiorita/porcelain/commit/4e71b846971e8268f8d38daeb13d1928294c08d9))

## [0.24.4](https://github.com/FabioFiorita/porcelain/compare/v0.24.3...v0.24.4) (2026-07-15)

### Features

* seed remote env settings and install MCP on the daemon host ([39e7d78](https://github.com/FabioFiorita/porcelain/commit/39e7d7895e413aa81b8811bc489348bd4942179f))

### Bug Fixes

* re-scan LAN/tailnet listeners when interfaces appear after boot ([cf75bc9](https://github.com/FabioFiorita/porcelain/commit/cf75bc91f821de6476c600c31d080ba40c2f59de))

## [0.24.3](https://github.com/FabioFiorita/porcelain/compare/v0.24.2...v0.24.3) (2026-07-15)

### Bug Fixes

* settings on welcome + CSP so remote daemon browse works ([dde89a4](https://github.com/FabioFiorita/porcelain/commit/dde89a4901d61281f14123d3d387d855585b8e40))

## [0.24.2](https://github.com/FabioFiorita/porcelain/compare/v0.24.1...v0.24.2) (2026-07-14)

### Bug Fixes

* keep mark-reviewed ticks after concurrent reviewedPaths polls ([c2e7416](https://github.com/FabioFiorita/porcelain/commit/c2e74163559c083263d38a845c1a39f324a87eca))

## [0.24.1](https://github.com/FabioFiorita/porcelain/compare/v0.24.0...v0.24.1) (2026-07-14)

### Features

* **skills:** require feature-artifact layout review before finish ([a6e752f](https://github.com/FabioFiorita/porcelain/commit/a6e752f8b9b0983cb46484d23c1e9b2d77691f34))

## [0.24.0](https://github.com/FabioFiorita/porcelain/compare/v0.23.5...v0.24.0) (2026-07-14)

### Features

* clear closed review comments with an eraser control ([ab657cf](https://github.com/FabioFiorita/porcelain/commit/ab657cf0eba7b5eb1517cbd16d7be09b52785a30))
* sticky-pin viewer tabs so agent/terminal stay fixed ([d36b229](https://github.com/FabioFiorita/porcelain/commit/d36b229c93139284828a45e78dd983781dc19dd1))

### Bug Fixes

* **agent:** stackable queue, cleaner timeline, and Grok multi-turn replies ([6e347ce](https://github.com/FabioFiorita/porcelain/commit/6e347ce63a61ddb3a8908bcb2246607f9b7675bd))

## [0.23.5](https://github.com/FabioFiorita/porcelain/compare/v0.23.4...v0.23.5) (2026-07-14)

### Features

* open recent CLI sessions in the Agent tab ([84fa4a6](https://github.com/FabioFiorita/porcelain/commit/84fa4a6d20d011b67a4d8a81f6b4dc5a1a292a4e))

## [0.23.4](https://github.com/FabioFiorita/porcelain/compare/v0.23.3...v0.23.4) (2026-07-14)

### Features

* add Grok as an Agent tab provider ([4558756](https://github.com/FabioFiorita/porcelain/commit/4558756645c62d5805340d44a5b0e62446c585b5))

### Bug Fixes

* scroll the terminal with touch on iPad Safari ([73d1a10](https://github.com/FabioFiorita/porcelain/commit/73d1a10e15ebd4b50ea9f8046791339107cb5aff))

## [0.23.3](https://github.com/FabioFiorita/porcelain/compare/v0.23.2...v0.23.3) (2026-07-13)

### Features

* continuous stacked-diff review for Changes and History ([c7b53c0](https://github.com/FabioFiorita/porcelain/commit/c7b53c0c6aaef1b11a81fcee1fe681a1df6850db))

## [0.23.2](https://github.com/FabioFiorita/porcelain/compare/v0.23.1...v0.23.2) (2026-07-13)

### Bug Fixes

* agent CLIs spawn with the login-shell PATH so npx-style MCP servers resolve under a Dock-launched app ([73815e5](https://github.com/FabioFiorita/porcelain/commit/73815e502a952faf6d5a063f091b520d5c370fa1))

## [0.23.1](https://github.com/FabioFiorita/porcelain/compare/v0.23.0...v0.23.1) (2026-07-13)

### Features

* comment and open files from the History tab's commit view ([2629980](https://github.com/FabioFiorita/porcelain/commit/2629980fa7fbde88915f6a30fdfbb699ec731bfd))
* new agent threads resume each provider's last-used config; model catalog cached so favorites show on first open ([b7ac296](https://github.com/FabioFiorita/porcelain/commit/b7ac296eb742c9a486ee8e8abaf9414f51f1aff9))
* steer a working agent thread — mid-turn send queues, stop runs the pending draft ([c776f7f](https://github.com/FabioFiorita/porcelain/commit/c776f7f44ff92743adeb59ffda954174bff2df12))
* window title shows the repo name (Dock and Mission Control) ([650866a](https://github.com/FabioFiorita/porcelain/commit/650866ad4dbb7561612ad9401fecc6e1feb2b844))

## [0.23.0](https://github.com/FabioFiorita/porcelain/compare/v0.22.1...v0.23.0) (2026-07-12)

### Features

* agent tab shows the CLI-resolved model and lists skills as slash commands ([4d3b2d9](https://github.com/FabioFiorita/porcelain/commit/4d3b2d95bb815a859fabf6b9014c2032e5f6e164))
* landing page shows the Agent tab ([0034d21](https://github.com/FabioFiorita/porcelain/commit/0034d21c8b353f80e26fce6446215c1e76ecc022))
* remove a project from the recents list ([856c119](https://github.com/FabioFiorita/porcelain/commit/856c1195f92495ba375ed78703dd59f6822a212d))

### Bug Fixes

* agent viewer tabs follow the thread's auto-title, and titles run shorter ([0e03ad1](https://github.com/FabioFiorita/porcelain/commit/0e03ad1fedcbd0f31a2333c9b2ad16317215cc32))
* instant reviewed toggles and contained agent quick-access cards ([1e9cd04](https://github.com/FabioFiorita/porcelain/commit/1e9cd046ed311663da42d1a1292b86e2ab8eaf56))
* provider limits read the right account — and OpenCode gets limits at all ([d3978f0](https://github.com/FabioFiorita/porcelain/commit/d3978f0a49522f7c0cb278cc5e0974fc5e5ab7dd))
* tab bar scrolls the active tab into view and tooltips full titles ([43f5efc](https://github.com/FabioFiorita/porcelain/commit/43f5efcc6bef558780cbdbcd8425139d04a11412))
* viewer keeps a minimum width — side panels give way on narrow windows ([7e57bda](https://github.com/FabioFiorita/porcelain/commit/7e57bdaeac5086048ae93709ad62f64eab9aadd3))

## [0.22.1](https://github.com/FabioFiorita/porcelain/compare/v0.22.0...v0.22.1) (2026-07-12)

### Bug Fixes

* composer drafts survive tab switches — agent messages per thread, commit message per repo ([8cb8f7a](https://github.com/FabioFiorita/porcelain/commit/8cb8f7ab98420a7ca195a29c79a0174cd1b96faa))

## [0.22.0](https://github.com/FabioFiorita/porcelain/compare/v0.21.3...v0.22.0) (2026-07-12)

### Features

* read Claude limits via the user-installed codexbar CLI, native probe as fallback ([81a2ec8](https://github.com/FabioFiorita/porcelain/commit/81a2ec8dba4a17f9fd391622fa74aa035ce88147))
* user-tunable limits refresh cadence with manual reload, and a CodexBar install hint ([52eb002](https://github.com/FabioFiorita/porcelain/commit/52eb002d5da3060820fb2c58cdd76170af1a36d9))

### Bug Fixes

* show 'Default model' on the model chip when the thread uses the CLI default ([caaf7d7](https://github.com/FabioFiorita/porcelain/commit/caaf7d771eb8d938de4e0ac8a905355965cfdcd1))

## [0.21.3](https://github.com/FabioFiorita/porcelain/compare/v0.21.2...v0.21.3) (2026-07-12)

### Bug Fixes

* collapse composer chip labels to icons when the pane is narrow ([3f81240](https://github.com/FabioFiorita/porcelain/commit/3f812408bf609cf1092bdd4e2c43cbf2446d489d))
* keep selected lines tinted while the viewer context menu is open ([ea156ef](https://github.com/FabioFiorita/porcelain/commit/ea156ef6a6576004e393f4c38203474b7215159e))
* keep the chips' accessible names value-based — a static aria-label overrode them ([7f6b58b](https://github.com/FabioFiorita/porcelain/commit/7f6b58b99b56e8cd3a7d9b0b2411639035ce83b5))
* wrap the provider menu label in a group — Base UI throws [#31](https://github.com/FabioFiorita/porcelain/issues/31) on bare labels ([fbf27a0](https://github.com/FabioFiorita/porcelain/commit/fbf27a04d8778a6c8389567185692dbfbf7b860c))

## [0.21.2](https://github.com/FabioFiorita/porcelain/compare/v0.21.1...v0.21.2) (2026-07-12)

## [0.21.1](https://github.com/FabioFiorita/porcelain/compare/v0.21.0...v0.21.1) (2026-07-12)

## [0.21.0](https://github.com/FabioFiorita/porcelain/compare/v0.20.5...v0.21.0) (2026-07-12)

### Features

* add the Agent tab — run Claude Code, Codex, and OpenCode inside Porcelain ([f45da98](https://github.com/FabioFiorita/porcelain/commit/f45da98ba9ea1f899f1fdb8b4ff62f5801d5d614))
* agent composer power features, provider limits, and session polish ([d9876e4](https://github.com/FabioFiorita/porcelain/commit/d9876e410ca4b57af45a5fb233bb04a2aeb572f0))
* agent threads — queued messages, image thumbnails, real turn timer, failure flag ([83af2a5](https://github.com/FabioFiorita/porcelain/commit/83af2a5dc05de1a2b4881c9ec6b4c58416609c0d))
* saved remote environments — named daemon list with switch, add-and-connect, remove ([ac23deb](https://github.com/FabioFiorita/porcelain/commit/ac23deba54b3e80e32951e88d12faf5363cb6708))

### Bug Fixes

* single-instance lock — a second launch focuses the running app ([850a04b](https://github.com/FabioFiorita/porcelain/commit/850a04bb9993570b4c157d029c0839890c946a33))

## [0.20.5](https://github.com/FabioFiorita/porcelain/compare/v0.20.4...v0.20.5) (2026-07-10)

### Bug Fixes

* execute trash helper outside app.asar ([5e69f39](https://github.com/FabioFiorita/porcelain/commit/5e69f392253bdb383286c1b44900ddb385258916))

## [0.20.4](https://github.com/FabioFiorita/porcelain/compare/v0.20.3...v0.20.4) (2026-07-07)

### Features

* mark-all / unmark-all reviewed toggle in the Changes header ([f50801c](https://github.com/FabioFiorita/porcelain/commit/f50801c2a4cf2925ba26a4a76a303d56470e5fe7))
* open Notes links on Cmd/Ctrl-click ([53de907](https://github.com/FabioFiorita/porcelain/commit/53de9079c13c018df33169266184343f9cd6c992))

### Bug Fixes

* close the confirm dialog on the delete/discard action ([a5f1965](https://github.com/FabioFiorita/porcelain/commit/a5f19659f2d4428a18b09d171aaec4da9c1c17fd))
* hide internal skills from skills.sh distribution ([a5ce949](https://github.com/FabioFiorita/porcelain/commit/a5ce949f2201b47d783eae7582e8b573024aa689))
* use the destructive variant for the delete/discard/clear confirm buttons ([27b3c39](https://github.com/FabioFiorita/porcelain/commit/27b3c398ebb1f01fcfaeef8f7e8bed84a17b20a6))

## [0.20.3](https://github.com/FabioFiorita/porcelain/compare/v0.20.2...v0.20.3) (2026-07-06)

### Bug Fixes

* only nag about skill upgrades once an agent's MCP is configured ([4610c1e](https://github.com/FabioFiorita/porcelain/commit/4610c1e50ddb0df0f9d7a044176e2777bddb6884))

## [0.20.2](https://github.com/FabioFiorita/porcelain/compare/v0.20.1...v0.20.2) (2026-07-06)

### Features

* replace bundled agent plugins with skills.sh skills + one-click MCP config ([26485fc](https://github.com/FabioFiorita/porcelain/commit/26485fc6243b8caf74297767dc1abc6a45e3aff3))

## [0.20.1](https://github.com/FabioFiorita/porcelain/compare/v0.20.0...v0.20.1) (2026-07-06)

### Features

* Codex plugin install + version tracking — surface updates like Claude does ([b9deebe](https://github.com/FabioFiorita/porcelain/commit/b9deebe928a5d292591c053e06c0da99df5aa69a))
* comment on any file, not just diffs — Add comment / Comment on file in the code viewer ([4e3feba](https://github.com/FabioFiorita/porcelain/commit/4e3feba537fdb47bd936af4aeaba3064442cfbdf))
* harden the daemon's LAN/tailnet listeners — honest 'port in use', orphan reaper, boot env override ([0d1686b](https://github.com/FabioFiorita/porcelain/commit/0d1686bf240f11ab0d72d14738670fb2f1adeae4))

## [0.20.0](https://github.com/FabioFiorita/porcelain/compare/v0.19.0...v0.20.0) (2026-07-06)

### Features

* agent comment replies — answer_review_comment MCP tool + inline reply under the comment (plugin 2.8.0) ([c3b4015](https://github.com/FabioFiorita/porcelain/commit/c3b4015efdfa5896e734d58225e24d5c13edecc5))
* create a branch from the branch picker (checkout -b) ([0353c9e](https://github.com/FabioFiorita/porcelain/commit/0353c9ee8fd419b94da4e0deec3b079db56bbffa))
* share the daemon on the local network — opt-in LAN listener on the private-range interface, same token gate and port as the tailnet path (Tailscale stays the away-from-home path) ([b1e2ee2](https://github.com/FabioFiorita/porcelain/commit/b1e2ee286dbbd3f9d58f8cc252d6615b2a7ab5fb))
* surface the daemon token in Settings — Copy-token button + file-path hint in Share over Tailscale, and a where-to-find-it line under the Remote daemon token field (users couldn't locate the token when connecting devices); new use-daemon-token hook is the lint-sanctioned crossing of the components→lib/daemon fence ([3e7fac6](https://github.com/FabioFiorita/porcelain/commit/3e7fac68cbc693ef5618b72714ef86b2d84cb911))
* unread dots on the rail when the agent pushes (feature/board/terminal), cleared on visit ([6bb9323](https://github.com/FabioFiorita/porcelain/commit/6bb93236c1fd612224a514d2b43e463e3eb49949))

### Bug Fixes

* keep the editor buffer dirty when an autosave fails — the watermark advanced before the write settled, so the unmount flush no-oped and the external adopt clobbered the edit ([70a6909](https://github.com/FabioFiorita/porcelain/commit/70a69093cfeaa90e2d48d8507a646d4a623222da))
* lock the browser client to the visible viewport — h-dvh shell, html/body scroll-lock, iOS viewport meta (on iPad the 100vh root exceeded the toolbar-shrunk viewport, so the page itself scrolled: chrome scrolled away while the fixed sidebar rails stayed) ([7465e98](https://github.com/FabioFiorita/porcelain/commit/7465e981d714d367519064660526ffbf335168fb))
* make the embedded terminal usable on iPad — DOM renderer on multi-touch devices (iOS evicts WebGL contexts), kill autocorrect on xterm's hidden textarea, contain touch scroll in the viewport, refocus on pointerdown ([cbf9d04](https://github.com/FabioFiorita/porcelain/commit/cbf9d0463e5c3618d6a38cc87847f0d199faae9e))

### Performance Improvements

* coalesce the 3s poll's git status/numstat into one shared working-tree snapshot per tick ([c47c44e](https://github.com/FabioFiorita/porcelain/commit/c47c44ee81e041d82dd6a43b5ed46a82ffa86040))
* fine-grained shiki imports — ship 11 grammars, not the registry ([0ae0edb](https://github.com/FabioFiorita/porcelain/commit/0ae0edb7d29ba1ae9854f4e8e87a5402473bb7c8))
* LRU-cache whole-file tokenization across tab switches ([a149267](https://github.com/FabioFiorita/porcelain/commit/a149267210b0c28ef903138bea02c542b5175a3d))

## [0.19.0](https://github.com/FabioFiorita/porcelain/compare/v0.18.0...v0.19.0) (2026-07-05)

### Features

* local porcelain daemon — renderer talks HTTP/WS to the electron-free backend ([5e3a042](https://github.com/FabioFiorita/porcelain/commit/5e3a0421d897ab192f68699b2eb8191502fd6bc5))
* remote envs phase 2 slice A — persistent daemon token (~/.porcelain/daemon-token, 0600) + settings-toggled Tailscale listener (fixed port 43117, same token gate, never 0.0.0.0) ([996012c](https://github.com/FabioFiorita/porcelain/commit/996012c2007c1af46605545ea9b726701884dc22))
* remote envs phase 2 slice B — PTYs survive disconnect: daemon-owned roster (terminalSessions/renameTerminal), attach/detach with 64KB scrollback replay, multi-client fan-out; socket close detaches, explicit kill only ([c8f09ed](https://github.com/FabioFiorita/porcelain/commit/c8f09ed50e86de928abb873fd675e13dd937ffa7))
* remote envs phase 2 slice C — daemon-side repo browser (browseDirs + RepoPickerDialog) replaces the native openRepo dialog; phase 2 marked shipped in the plan ([30dd1ab](https://github.com/FabioFiorita/porcelain/commit/30dd1abf250eeef996bc7e672f763ca718fb1015))
* remote envs phase 3 slice A — daemon serves the renderer to plain browsers: static server (traversal-guarded, unauthenticated assets, /trpc+/session stay token-gated), serve-time CSP connect-src rewrite, isBrowser seam (boot skips windowInit, shell-only UI hidden), localStorage token gate ([04e388c](https://github.com/FabioFiorita/porcelain/commit/04e388c17028bf1f5a63e41ae9ace36e36dd27ed))
* remote envs phase 3 slice B — browser void backdrop: html.browser paints opaque graphite + two blooms + edge vignette + 3% turbulence noise (post-filter opacity, not fill-opacity — feTurbulence ignores fill) so daemon-served clients keep the tiles-over-void depth without vibrancy ([40a0f3c](https://github.com/FabioFiorita/porcelain/commit/40a0f3c6b8b8a1de3c68334a72160410ae9f36b0))
* remote envs phase 3 slice C — browser primary mod remaps to Ctrl (Safari owns the Cmd row): shared isModExclusive/kbdLabel per the Linux-branch pattern, ⌃ labels, viewport meta, touch-visible close buttons; fix stale 'Review changes ⌘2' hint (Changes is ⌘3); phase 3 marked code-shipped in the plan ([ad8a848](https://github.com/FabioFiorita/porcelain/commit/ad8a84858874e68efecf37c80b5d660c45d39d41))
* remote envs phase 4 slice A — pnpm daemon:dist assembles the standalone plain-Node daemon package (bundle + chunks + renderer + MCP server, deps pinned from root); PORCELAIN_NO_STDIN_WATCHDOG=1 escape hatch for supervisors (systemd hands /dev/null); mock lib/trpc in terminals store test (unmocked rename fetch flaked the gate under load). Linux-verified in an OrbStack node:22 container: npm install compiles node-pty, 200/401 auth, openRepoPath, PTY spawn over WS ([05fe1b8](https://github.com/FabioFiorita/porcelain/commit/05fe1b8263dbe391f29cd43e9a4ec0ebaec9f3bf))
* remote envs phase 4 slice B — point the Mac app at a remote daemon: Settings → Remote access connect/disconnect (probe distinguishes unreachable vs 401 before accepting), remote-daemon.json in userData (plaintext token, same trust as the token file), daemonInfo() override + existing daemon-url-changed push, switch = renderer reload by design; corrupt-file load fails closed to null ([30cdfb6](https://github.com/FabioFiorita/porcelain/commit/30cdfb62d758a0b65a4e2dca84cfd5af15d4ec20))

### Bug Fixes

* action commands typed into a fresh terminal could be silently swallowed — initialInput raced the shell's readline init (reliably on slow machines; failed two release gates as a phantom flake); it now writes on the shell's first output, with a 2s fallback
* emit __esModule-aware interop (output.interop auto) for the CJS main bundles — ESM-only trash was required as a bare namespace, so every daemon trashPath/gitDiscardFile threw 'trash is not a function' since the split; caught by the local e2e run ([0f54fd3](https://github.com/FabioFiorita/porcelain/commit/0f54fd374a470718cb7344e07f75a34db7cb3cf6))
* give shell tRPC hooks their own React context — nested providers shared the default TRPCContext singleton, routing every app hook to the shell router (No procedure found → eternal Loading) ([ea0bf42](https://github.com/FabioFiorita/porcelain/commit/ea0bf420ae674a3ef926f6c1859fa463b0fc2134))
* tailnet browser client runs in an insecure context — crypto.randomUUID/navigator.clipboard don't exist on plain-HTTP non-localhost origins: randomId()/copyText() helpers (getRandomValues v4 + execCommand fallback) replace direct calls (terminal create/attach reqIds, all copy buttons); CSP gains font-src 'self' data: (Vite-inlined JetBrains Mono subset was blocked by the default-src fallback) ([1f06941](https://github.com/FabioFiorita/porcelain/commit/1f06941af03e1690933518a3f647db08a1a6a916))

## [0.18.0](https://github.com/FabioFiorita/porcelain/compare/v0.17.2...v0.18.0) (2026-07-04)

### Features

* feature artifacts — agent-authored HTML explainers in the viewer ([7139bbb](https://github.com/FabioFiorita/porcelain/commit/7139bbbc6a7d452e21cc4588c5400d0d81c71730))
* file-tree copy-path items + stable expansion across tab switches ([6ae1499](https://github.com/FabioFiorita/porcelain/commit/6ae14997ec37e9843b9e9b1908b51c56191b4fbf))
* live-refresh the Files tree on external file changes ([767cb00](https://github.com/FabioFiorita/porcelain/commit/767cb00b72565623ceaa84335b7c7e7017e2f0a1))
* open the real file from the diff view header ([36af9f6](https://github.com/FabioFiorita/porcelain/commit/36af9f6efedee199fef7d6b83944ca83339a6be2))
* rename terminal sessions ([e7eeb69](https://github.com/FabioFiorita/porcelain/commit/e7eeb694fee4e44f2bf8cc47a9728b1d2acbb7c8))

### Bug Fixes

* static "Feature artifact" label on the Feature-list opener row ([c580514](https://github.com/FabioFiorita/porcelain/commit/c580514978c489603d6b0588fc59b5ce8381d419))

## [0.17.2](https://github.com/FabioFiorita/porcelain/compare/v0.17.1...v0.17.2) (2026-06-29)

### Features

* add file timeline to the History tab's Quick Access ([acb1fed](https://github.com/FabioFiorita/porcelain/commit/acb1fed7d8060b185dcc365f60858796b4282c89))

### Bug Fixes

* live-refresh saved actions on MCP curate + guard app-event wiring ([2108cdc](https://github.com/FabioFiorita/porcelain/commit/2108cdcf42aec88f77d0785baf0b9256ee0931d3))

## [0.17.1](https://github.com/FabioFiorita/porcelain/compare/v0.17.0...v0.17.1) (2026-06-29)

### Bug Fixes

* re-snapshot the Codex local marketplace so re-install upgrades ([b10871c](https://github.com/FabioFiorita/porcelain/commit/b10871cb20f4c319836e77a30fca97c9df33d5e6))

## [0.17.0](https://github.com/FabioFiorita/porcelain/compare/v0.16.2...v0.17.0) (2026-06-29)

### Features

* add Codex plugin install path ([57db6c3](https://github.com/FabioFiorita/porcelain/commit/57db6c3f7a26c619147ae163c3dfe27e259cc77b))

### Bug Fixes

* contain agent settings overflow ([23e98ef](https://github.com/FabioFiorita/porcelain/commit/23e98ef037bdb3dd549468f57d09bbfc4992fe46))

## [0.16.2](https://github.com/FabioFiorita/porcelain/compare/v0.16.1...v0.16.2) (2026-06-26)

### Bug Fixes

* remove the opt-in TypeScript language server and revert the single-instance lock ([5c6456c](https://github.com/FabioFiorita/porcelain/commit/5c6456cf9e91d395beffb4e364de3b23b0acf17b))

## [0.16.1](https://github.com/FabioFiorita/porcelain/compare/v0.16.0...v0.16.1) (2026-06-26)

### Features

* **lsp:** completion, rename, format, type-def + implementation; harden the server ([a9d6848](https://github.com/FabioFiorita/porcelain/commit/a9d68488e44f443b4550c40e31fe9b9462d1ebb7))

### Bug Fixes

* **lsp:** render hover/completion/rename overlays via a portal, not Base UI Popover ([afefe20](https://github.com/FabioFiorita/porcelain/commit/afefe207f7ada4c5be5b170e17df4a5f2586f56f))
* **lsp:** wait for project load before serving go-to-definition ([1e2b478](https://github.com/FabioFiorita/porcelain/commit/1e2b47841727a0f2c9783ce52a98bfe78b914920))
* **window:** hold a single-instance lock so duplicate launches don't open a window ([f70d447](https://github.com/FabioFiorita/porcelain/commit/f70d447fcc015cb8b804323eb6f92ebc40235fe0))

## [0.16.0](https://github.com/FabioFiorita/porcelain/compare/v0.15.0...v0.16.0) (2026-06-26)

### Features

* **lsp:** opt-in TypeScript language server (off by default) ([899281d](https://github.com/FabioFiorita/porcelain/commit/899281dc80bc25e70d9da091dbdbbf4563152ec4))

### Bug Fixes

* **actions:** clear a saved action's working directory on edit ([ef8e1fd](https://github.com/FabioFiorita/porcelain/commit/ef8e1fd3978666e5e848a8b7ddd00562a33203cb))
* **review:** wrap long file paths in the Add comment dialog ([53bd6e0](https://github.com/FabioFiorita/porcelain/commit/53bd6e0b4b8a8546b14eba98a1548f51c6a0f008))

## [0.15.0](https://github.com/FabioFiorita/porcelain/compare/v0.14.0...v0.15.0) (2026-06-23)

### Features

* **mcp:** feature-view snapshot channel + comment status tags ([86c1ecc](https://github.com/FabioFiorita/porcelain/commit/86c1ecc950703d4c1aa3d69b0e9bdf0c38497418))
* **review:** comment on the feature view and wrap the inline-read note ([fff2d50](https://github.com/FabioFiorita/porcelain/commit/fff2d50fb9c3604a5af8a7b228d52fe763c0a633))
* **review:** let the agent drive the feature-view grouping ([4b64888](https://github.com/FabioFiorita/porcelain/commit/4b64888efac040db4a1154200028e151b9fa73b8))
* **review:** multi-line drag-select comments in the inline read ([2906fbf](https://github.com/FabioFiorita/porcelain/commit/2906fbfd0a135168de9eece9cd1e38660d947b8f))
* **viewer:** add Swift syntax highlighting ([0e54397](https://github.com/FabioFiorita/porcelain/commit/0e54397f11fd7e9dade96f99026f132c33e1772f))

### Bug Fixes

* **ui:** wrap long note tokens so the feature list Note card doesn't clip ([a5b8299](https://github.com/FabioFiorita/porcelain/commit/a5b82991870fd6d54f7010dacfa7e297bec9469f))

## [0.14.0](https://github.com/FabioFiorita/porcelain/compare/v0.13.0...v0.14.0) (2026-06-22)

### Features

* **board:** add a Clear done button to bulk-clear completed cards ([dd2a584](https://github.com/FabioFiorita/porcelain/commit/dd2a584d7918d2bcef77c4cf1415ee8939f57e1f))
* **diff:** highlight intra-line word changes ([bcb73b4](https://github.com/FabioFiorita/porcelain/commit/bcb73b42ed4a87d45a28cb571a22df96f93a8e45))
* **history:** flow-group a commit's files like the rest of the app ([e297b26](https://github.com/FabioFiorita/porcelain/commit/e297b266c7506dc423c0dac13707eb1b15d2c48e))
* **mcp:** expose human-reviewed file marks to the agent ([103b5bd](https://github.com/FabioFiorita/porcelain/commit/103b5bd5fc18d1d0e52eb182bff43a24adac26a9)), closes [#7](https://github.com/FabioFiorita/porcelain/issues/7)
* toast on launch when a newer plugin version is bundled ([ef24da1](https://github.com/FabioFiorita/porcelain/commit/ef24da152a65a114511ad57d101fbc45044f7924))
* **worktrees:** add "open in new window" to the worktree switcher ([bf479f5](https://github.com/FabioFiorita/porcelain/commit/bf479f509e7f0e87e008767af151c634c0fbb8ce))

### Bug Fixes

* **events:** refresh the inline reading surface on agent push ([df7ec71](https://github.com/FabioFiorita/porcelain/commit/df7ec7131f9038446c3bb1289bf7ccf9f228f93e))
* **main:** silence devtools-installer extension API deprecations ([49dc6eb](https://github.com/FabioFiorita/porcelain/commit/49dc6eb9e61af7a447e031a86e2df523facc01e7))
* **marketing:** equalize the speed-gallery cards and show the search shot in full ([1139436](https://github.com/FabioFiorita/porcelain/commit/1139436e13bec2742e095541aaeede1c930d30e7))
* **marketing:** make the landing page mobile-responsive ([a9bd5c4](https://github.com/FabioFiorita/porcelain/commit/a9bd5c493f150c22ddb98aa747d6a409a42021c8))
* **mcp:** don't reply to or execute a notification-shaped call ([ba5553b](https://github.com/FabioFiorita/porcelain/commit/ba5553bd960f02e80621e44fcee66136246b8869))
* restore gitRangeFlow empty-range fallback; invalidate gitCommitFlow on relayer ([88a8ac1](https://github.com/FabioFiorita/porcelain/commit/88a8ac1b9e2e23a232100ae653fab818187ad210))
* **ui:** register custom font-size tokens with tailwind-merge ([30dc01f](https://github.com/FabioFiorita/porcelain/commit/30dc01f1b4028406c9fea959cdc5a46c1c1b2d6a))
* **ui:** stop truncate from clipping the italic tab label's last glyph ([42ab6b3](https://github.com/FabioFiorita/porcelain/commit/42ab6b371096041be75acc3b2f7ac62950e41d86))
* **viewer:** adopt an external rewrite that arrived mid-edit ([2ebc23c](https://github.com/FabioFiorita/porcelain/commit/2ebc23c832f542bde1c4df11cde266d7de371200))
* **viewer:** open the find bar only in the active split pane ([2cc2367](https://github.com/FabioFiorita/porcelain/commit/2cc236763c2c21efc582abaa41b34cf04ddf1372))

### Performance Improvements

* **feature:** share one feature build between featureView and featureReading ([5be85ea](https://github.com/FabioFiorita/porcelain/commit/5be85eab1264d492b7d2cc3f248254590936ca27))
* **git:** compute the range merge-base once per branch-flow build ([864a45b](https://github.com/FabioFiorita/porcelain/commit/864a45b1abfa8dfb744a804e620ab2a1715ca870))
* **renderer:** memoize the change/feature/tree list rows ([24869c4](https://github.com/FabioFiorita/porcelain/commit/24869c461f0a8721beb4bc7393192ea873383f7a))
* **viewer:** cap whole-file syntax tokenization ([4b745a5](https://github.com/FabioFiorita/porcelain/commit/4b745a570857db86d7bcef046319303c8b021b18))

## [0.13.0](https://github.com/FabioFiorita/porcelain/compare/v0.12.0...v0.13.0) (2026-06-21)

### Features

* **marketing:** add GitHub Pages landing + privacy site ([c9de274](https://github.com/FabioFiorita/porcelain/commit/c9de2743d4455e783f21c89c682005897691ff69))
* **marketing:** refresh screenshots and tighten landing copy ([7b036f4](https://github.com/FabioFiorita/porcelain/commit/7b036f40b1b5b6e9e1bc8f0f542742f5e672f048))
* **mcp:** add flow-layers agent channel + skill ([1ad3cfd](https://github.com/FabioFiorita/porcelain/commit/1ad3cfd7616cf570590b463fcb96b14d21739932))

### Bug Fixes

* **branches:** match worktree-label style for Local/Remote headings ([02335c8](https://github.com/FabioFiorita/porcelain/commit/02335c80e719f02455c65da6be33ae1a0b37e87c))
* **branches:** size branch rows to match worktree popover (12.5px) ([6ff0996](https://github.com/FabioFiorita/porcelain/commit/6ff09960050bc43b521e87e3476bae37261fcdf6))
* **hooks:** harden git-guard — fail closed + parse git global flags ([72492d8](https://github.com/FabioFiorita/porcelain/commit/72492d8f4e687c7603aa09d692d839bf8f2ee6f2))
* **terminal:** auto-hide the xterm scrollbar until hovered ([1bbc5ee](https://github.com/FabioFiorita/porcelain/commit/1bbc5eea46cfb71a1271c74baede182ac50bc994))
* **terminal:** restyle the real scrollbar to a slim edge-hugging pill ([6cf8140](https://github.com/FabioFiorita/porcelain/commit/6cf814094cd25ecd5009381b54c71810b388bdc5))
* **worktrees:** poll worktree list so the picker self-heals ([9146600](https://github.com/FabioFiorita/porcelain/commit/9146600068713835b47b904bc1a6362e4e7b6a13))

## [0.12.0](https://github.com/FabioFiorita/porcelain/compare/v0.11.0...v0.12.0) (2026-06-19)

### Features

* **actions:** move saved commands up/down in the Terminal tab ([be84daa](https://github.com/FabioFiorita/porcelain/commit/be84daa91c467eac024e400e76827f2aea1c96c6))
* **branches:** show remote branches in the picker, with search ([5ab77c8](https://github.com/FabioFiorita/porcelain/commit/5ab77c8edbdf09eb09f8d2c556f4dfd78ef0d1df))
* **comments:** add Comment on file from the Changes list and file tree ([53f8abe](https://github.com/FabioFiorita/porcelain/commit/53f8abeccc5dcb7cf1cc5a8604b094c208ceeeaa))
* **composers:** save actions and comments with ⌘S too ([202cd67](https://github.com/FabioFiorita/porcelain/commit/202cd672b6838dc06334664435492fdb89781a64))
* **notes:** clearer 'Write a note…' placeholder ([c13a52d](https://github.com/FabioFiorita/porcelain/commit/c13a52d325890b1ab60ee62d1119af25a30cb617))
* **review:** clear reviewed marks for committed files on commit ([50d97af](https://github.com/FabioFiorita/porcelain/commit/50d97af715555ef7e5a1a1d272e4ceec24bc98b9))
* **settings:** rename Review flow to Review, preview pattern matches ([46d33e2](https://github.com/FabioFiorita/porcelain/commit/46d33e29c3baa8d10626f0ac4378193f917e4c77))

### Bug Fixes

* **terminal:** clear WebGL atlas on resize, tab-switch, and wake ([2c25909](https://github.com/FabioFiorita/porcelain/commit/2c25909c40eb1163e295e0a3c0e9fdf41d0b80fb))

## [0.11.0](https://github.com/FabioFiorita/porcelain/compare/v0.10.0...v0.11.0) (2026-06-19)

### Features

* **devtools:** dev-only TanStack Devtools shell with product + MCP panels ([e8ec94a](https://github.com/FabioFiorita/porcelain/commit/e8ec94aa5571fc3ed613f4fe2f6206f7b7046b54))
* **terminal:** WebGL renderer for crisp block-glyph art ([bc5f496](https://github.com/FabioFiorita/porcelain/commit/bc5f4960a822e2f53b6f507ef994a3a04b635240))
* **window:** File → New Window menu (⌘⌥N), switcher auto-close, React DevTools in dev ([d33cd78](https://github.com/FabioFiorita/porcelain/commit/d33cd78d633176c85aaddd0b44206c376c7e2857))
* **window:** multi-window support, one repo per window ([4907730](https://github.com/FabioFiorita/porcelain/commit/49077303887d6db5781f0c1ac65140521676f3b8))

### Bug Fixes

* **terminal:** debounce resize so the prompt doesn't stack on drag ([9e12951](https://github.com/FabioFiorita/porcelain/commit/9e12951f51f1a071d768a59f2064c2639dd4dc38))
* **terminal:** load fonts + clear WebGL atlas so Nerd Font glyphs render ([557d729](https://github.com/FabioFiorita/porcelain/commit/557d7294a0c4975a6f4d29b1af2b1bbee24e2e57))

## [0.10.0](https://github.com/FabioFiorita/porcelain/compare/v0.9.1...v0.10.0) (2026-06-18)

### Features

* **board:** icons in card menu; restore destructive red in dropdowns ([2b41ec4](https://github.com/FabioFiorita/porcelain/commit/2b41ec4f509952779a988d9fc744e6268f301fe9))
* **feature:** agent-title header + Stage-all-style action row ([a16addf](https://github.com/FabioFiorita/porcelain/commit/a16addf6bd3076e933b82ed51c006961f6e5e487))
* **finder:** search saved commands and commits by SHA ([d8d1717](https://github.com/FabioFiorita/porcelain/commit/d8d1717993206344180447552f6cc7199ee8c149))
* **git:** "all reviewed" completion state in the Changes header ([2b722f3](https://github.com/FabioFiorita/porcelain/commit/2b722f3282c3d39d3da29c9eadafc9bcf4ed18eb))
* **git:** add "Mark reviewed" to the diff header ([3695224](https://github.com/FabioFiorita/porcelain/commit/36952242c33ec30d49c055bd96c843c8cdd38040))
* **git:** branch picker with in-place checkout in the footer ([90799a4](https://github.com/FabioFiorita/porcelain/commit/90799a4650eec88a57f608165a56f7e945990743))
* **git:** icons on the Changes-list context menu ([3b98940](https://github.com/FabioFiorita/porcelain/commit/3b98940b5835afd895f74f1a7462d42382cd80c8))
* **history:** show full commit message in viewer; 13px rows + copy SHA/message context menu ([92658ef](https://github.com/FabioFiorita/porcelain/commit/92658effb42d279a34127026ba0ba6ab1ebf99c2))
* **mcp:** read repo notes — get_repo_notes tool + repo-notes skill ([9d3e23b](https://github.com/FabioFiorita/porcelain/commit/9d3e23b2994641250620a8fde50ddceccedc03f9))
* **plugin:** split review skill into focused skills (review, board, actions) ([8a08e0c](https://github.com/FabioFiorita/porcelain/commit/8a08e0c51587bf7d7b62410fa010ce5b1d89c0f8))
* **search:** add Search sidebar tab (⌘2) with repo-wide code search ([d582057](https://github.com/FabioFiorita/porcelain/commit/d5820573531b08012ef51545985ed56c676c0e08))
* **shell:** compact git-command chips; drop the agent-suggestions feature ([9d755b9](https://github.com/FabioFiorita/porcelain/commit/9d755b95225cc2ef5f482cf35c7f8f25d78073c4))
* **shell:** mockup UI polish — flow timeline, menu icons, JetBrains Mono ([e91f65d](https://github.com/FabioFiorita/porcelain/commit/e91f65dac4b2a07356c1fca600e73689e326ab84))
* **shell:** neutralize decorative accent + design polish ([60de50e](https://github.com/FabioFiorita/porcelain/commit/60de50ea6c5035b7db4efcb628f76e0ef76d5b7a))
* **shell:** respect the OS reduce-motion setting ([33a7876](https://github.com/FabioFiorita/porcelain/commit/33a78767c44cf78810d06fbc090847d566f1d872))
* **shell:** restore contextual git suggestions; polish source-control panel ([d52a18a](https://github.com/FabioFiorita/porcelain/commit/d52a18a4d029e054c245ef96017a470b61216fe1))
* **shell:** unified titlebar + search, rail avatar, collapse-all, branch/worktree footer, pattern builder ([c0e4d23](https://github.com/FabioFiorita/porcelain/commit/c0e4d23e85857ab0143581dc13bb9f41f7e4af9e))
* **sidebar:** hoist every tab's actions into the contextual panel header ([087e401](https://github.com/FabioFiorita/porcelain/commit/087e4018af8499de26db1e40c6f80f8f81c0d40e))
* **terminal:** icons in saved-command actions menu ([ac8863a](https://github.com/FabioFiorita/porcelain/commit/ac8863a80e43c431d26e3fd6c0626c736b8354a2))
* **ui:** unify selection & hover on one glass interaction language ([8bda4f3](https://github.com/FabioFiorita/porcelain/commit/8bda4f39414dfd2a06d42794c6aa99dc5874a3a9))
* **viewer:** live-refresh open files when they change on disk ([ca64ae4](https://github.com/FabioFiorita/porcelain/commit/ca64ae474b772cbd72d4ca579f9d79967adfa877))

### Bug Fixes

* **git:** visible keyboard focus on the review-surface controls ([7b4d472](https://github.com/FabioFiorita/porcelain/commit/7b4d47260f354d332c68591fe0e03a62b2a131e2))
* **shell:** match the mockup's spacious rail ([22e73f8](https://github.com/FabioFiorita/porcelain/commit/22e73f88e2cdd8f376edfbc6b77cdfe1b5232bad))
* **shell:** polish the sidebar chrome to the new mockup ([c503ba4](https://github.com/FabioFiorita/porcelain/commit/c503ba49b95d67f48d9e144d2dd2324c30cd287c))
* **shell:** sidebars sit UNDER the titlebar; plain folder for worktrees ([c0c310a](https://github.com/FabioFiorita/porcelain/commit/c0c310a8a2d5a8fd539bfb348e3a912f1793a679))
* **shell:** uniform spacing around the titlebar search, drop the divider ([14e5dca](https://github.com/FabioFiorita/porcelain/commit/14e5dca2cad56a116a145d932046ab79253a721c))
* **shell:** visible keyboard focus on the primary chrome controls ([d308f11](https://github.com/FabioFiorita/porcelain/commit/d308f11e579799db673d4f921061006a74d1acbd))
* **tabs:** close the viewer tab when its source is removed ([a73e4fe](https://github.com/FabioFiorita/porcelain/commit/a73e4fec8b166e601798b0d7c9e432e3ac55bea0))
* **terminal:** Shift+Enter inserts a newline in Claude Code, not submit ([82697ca](https://github.com/FabioFiorita/porcelain/commit/82697caf59bb5da1c600b70341009cae975c475b))
* **ui:** 13px file-finder input and result names (was 14) ([47b54ae](https://github.com/FabioFiorita/porcelain/commit/47b54aebe040d97e75485b6248e03bc02d5253b2))
* **ui:** default Button/Input/Toggle text to 13px, drop per-call overrides ([a397636](https://github.com/FabioFiorita/porcelain/commit/a397636a1a34d3d27fe0312ef73a4b7738acc458))
* **ui:** dial back menu glassiness so content stops leaking through ([e2d43b1](https://github.com/FabioFiorita/porcelain/commit/e2d43b136295590a40823a68aaf2a33551c5deba))
* **ui:** drop file tree & tab labels to 13px to match the glaze mockup ([3d5d642](https://github.com/FabioFiorita/porcelain/commit/3d5d6427951e6c7ef1488f1544d79c80cf72681a))
* **ui:** drop rail hairlines when the sidebar is collapsed ([1c10f66](https://github.com/FabioFiorita/porcelain/commit/1c10f66c8c0aa414e73028ca6a9f4f4fd7404877))
* **ui:** inset Quick Access content & make notes a porcelain card ([40a47df](https://github.com/FabioFiorita/porcelain/commit/40a47df33dddd3f0156c89249576b73fda94deb4))
* **ui:** match dialog surface to the dropdown glaze (popover/95 + film) ([a5bdfd8](https://github.com/FabioFiorita/porcelain/commit/a5bdfd85057ec7ed2da8448e2389a47b57639328))
* **ui:** raise left sidebar min width to 320 (was 300) ([9cafb63](https://github.com/FabioFiorita/porcelain/commit/9cafb634406a1bbfcc12db6da17cacc9a8557b3a))
* **ui:** raise sidebar min widths (left 300, right 280) so content can't overflow ([94899b3](https://github.com/FabioFiorita/porcelain/commit/94899b3c0c638872498bf498a414c7545a4d03eb))
* **ui:** standardize Settings dialog type scale to the glaze mockup ([87c4372](https://github.com/FabioFiorita/porcelain/commit/87c43727aab0569a577457b59189b4691bf15db3))
* **ui:** uniform padding on command input ([34bc432](https://github.com/FabioFiorita/porcelain/commit/34bc4325c3a5f9a1381e529ca281d54b3b2eae29))
* **ui:** unify control radius on rounded-md across the shell ([293178e](https://github.com/FabioFiorita/porcelain/commit/293178e477a8abcf44df71e4575eca7c04f7ae88))
* **ui:** unify toggles & tooltip on the glaze language; keep rail icons fixed ([9231614](https://github.com/FabioFiorita/porcelain/commit/923161466338e93e25aec874110d80d56318c78f))
* **ui:** warm the sidebar rail to glaze glass on hover ([7537d9c](https://github.com/FabioFiorita/porcelain/commit/7537d9c6ba034075898a6b23e6465f3f3ee06bb8))

## [0.9.1](https://github.com/FabioFiorita/porcelain/compare/v0.9.0...v0.9.1) (2026-06-17)

### Bug Fixes

* **release:** prepend newest changelog section instead of full regen ([a05247a](https://github.com/FabioFiorita/porcelain/commit/a05247a40a09330cfa1047ea1d5950465b71b403))
* **terminal:** treat ⌘↵ as newline so it doesn't submit in Claude Code ([89208aa](https://github.com/FabioFiorita/porcelain/commit/89208aacd6de8e571847aa50cad392984c5f36af))

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
