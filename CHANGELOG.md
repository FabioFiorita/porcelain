## [0.61.3](https://github.com/FabioFiorita/porcelain/compare/v0.61.2...v0.61.3) (2026-09-01)

### Features

* **desktop:** add Porcelain plugin installer ([24676b7](https://github.com/FabioFiorita/porcelain/commit/24676b72fe1406d7b0b2f1d7e8baf7951d6aeef2))

## [0.61.2](https://github.com/FabioFiorita/porcelain/compare/v0.61.1...v0.61.2) (2026-08-31)

### Bug Fixes

* **desktop:** expose MCP on the plugin port ([00b8888](https://github.com/FabioFiorita/porcelain/commit/00b88889e711b195a2f9d03314f5d83375de1d03))
* **plugin:** identify Porcelain MCP server ([bc43f25](https://github.com/FabioFiorita/porcelain/commit/bc43f25e4d7a2b7cb990c74ff0e7fc610f37fd1c))
* **plugin:** use a valid Porcelain MCP endpoint ([6df8558](https://github.com/FabioFiorita/porcelain/commit/6df85584f20ca852c846ed9b9a937063a9632d86))

## [0.61.1](https://github.com/FabioFiorita/porcelain/compare/v0.61.0...v0.61.1) (2026-08-31)

### Bug Fixes

* **desktop:** restore remote worktree ownership ([bf10e81](https://github.com/FabioFiorita/porcelain/commit/bf10e81ef9442b481bc80676d62aad28ad3eb7de))

## [0.61.0](https://github.com/FabioFiorita/porcelain/compare/v0.60.2...v0.61.0) (2026-08-30)

### Performance Improvements

* tighten project opening across clients ([420325a](https://github.com/FabioFiorita/porcelain/commit/420325aa2ca87edaeff38f769f87c7f9326c7673))

## [0.60.2](https://github.com/FabioFiorita/porcelain/compare/v0.60.1...v0.60.2) (2026-08-30)

### Features

* **canvas:** add semantic Decision Canvas v2 ([d609447](https://github.com/FabioFiorita/porcelain/commit/d60944789f9b7ed1a3e857f335b9d65d68a7e40c))

### Bug Fixes

* serve structured canvas assets ([511067b](https://github.com/FabioFiorita/porcelain/commit/511067beeb20164e4d5abf837d9bff343403dfb6))

## [0.60.1](https://github.com/FabioFiorita/porcelain/compare/v0.60.0...v0.60.1) (2026-08-28)

### Features

* **mobile:** align review surfaces with web ([#72](https://github.com/FabioFiorita/porcelain/issues/72)) ([040a9ca](https://github.com/FabioFiorita/porcelain/commit/040a9caa05c8bf8ad80f6111ca928f0480311651))
* **mobile:** bring review controls into Changes ([b412001](https://github.com/FabioFiorita/porcelain/commit/b41200168338fdaaa49ca64b3c4e3a47aa647349))
* **review:** identify agent-authored comments ([d1f4ec8](https://github.com/FabioFiorita/porcelain/commit/d1f4ec8af709930c38b428b4d8fb81da7cc5cb41))

### Bug Fixes

* **mobile:** clarify git and worktree actions ([47771ad](https://github.com/FabioFiorita/porcelain/commit/47771adad906785948033b02a8aa9f68c259f2d4))
* **mobile:** clarify projects and environments ([889abb5](https://github.com/FabioFiorita/porcelain/commit/889abb58e9fc0bcc61d3903f041897a8e7ef2aaf))
* **review:** preserve layers in commit history ([7a7d609](https://github.com/FabioFiorita/porcelain/commit/7a7d6092b3a9c432ec7a91a84ee922108f0f0685))

## [0.60.0](https://github.com/FabioFiorita/porcelain/compare/v0.59.2...v0.60.0) (2026-08-27)

### Features

* **canvas:** add review and plan templates ([625395d](https://github.com/FabioFiorita/porcelain/commit/625395d7393487e334312c0c1884578ab1a6fe21))
* **canvas:** add structured documents ([1007bfb](https://github.com/FabioFiorita/porcelain/commit/1007bfb335a3cef40f6dbbbfeed2fb358e9f0758))

### Bug Fixes

* **canvas:** allow remote daemon frame origins ([91e32e7](https://github.com/FabioFiorita/porcelain/commit/91e32e7a5462bf7894dcc8bc9f3be212a3f1872e))
* **canvas:** scope reviews to worktrees ([ed91d02](https://github.com/FabioFiorita/porcelain/commit/ed91d028e21f2f9ff4a148cff81dff1702668100))
* **canvas:** stream embedded video assets ([c42a243](https://github.com/FabioFiorita/porcelain/commit/c42a243e4b8fe4a3586cd05e98038d42a0d41e00))
* **desktop:** allow packaged session origin ([3dd66bd](https://github.com/FabioFiorita/porcelain/commit/3dd66bdfe36fe3d76fbc7227f9c296554beca8fd))
* **environments:** unify desktop daemon sessions ([4800dc6](https://github.com/FabioFiorita/porcelain/commit/4800dc6ca8e6d70436935f5cc97dfb5bd1c3a776))
* harden android-loop against stale locks and Wayland freeze ([07f3f68](https://github.com/FabioFiorita/porcelain/commit/07f3f6845fb0fefe983e230641011d42ebf4c7ae))
* **personalization:** contain long instructions ([2a69ca6](https://github.com/FabioFiorita/porcelain/commit/2a69ca6ab2a523dfacb5f8201c483055ee0ba4a9))
* **plugin:** use canonical Codex manifest ([6e3187d](https://github.com/FabioFiorita/porcelain/commit/6e3187d7c541106e7446bf6c8112991eae432ec3))
* **profile:** share navigation paths across worktrees ([0a5f7d3](https://github.com/FabioFiorita/porcelain/commit/0a5f7d35c7865b6fcbce9e66807d2f9ca2e74e11))
* **review:** scope layers to reviews ([21cbd5b](https://github.com/FabioFiorita/porcelain/commit/21cbd5bb43606410d41220cb710847b74d52bc1a))
* **sidebar:** remove daemon update prompt ([1b6119b](https://github.com/FabioFiorita/porcelain/commit/1b6119b1e2865ea9803d66be7befb900bb610947))
* **updates:** guard daemon restart workflow ([6e3edcd](https://github.com/FabioFiorita/porcelain/commit/6e3edcd80e267720540fdf4377e24b9a290df19a))

## [0.59.2](https://github.com/FabioFiorita/porcelain/compare/v0.59.1...v0.59.2) (2026-08-26)

### Features

* comment from rendered file views ([8d528ed](https://github.com/FabioFiorita/porcelain/commit/8d528edd78c676c1da7c5b5f91a8cca0d5760227))

## [0.59.1](https://github.com/FabioFiorita/porcelain/compare/v0.59.0...v0.59.1) (2026-08-26)

### Bug Fixes

* hide inactive tray icon on macOS ([1f8bc29](https://github.com/FabioFiorita/porcelain/commit/1f8bc291abe150639a1adeea32c0bfcc03a6a6bb))
* make worktree removal immediate across environments ([ff346a2](https://github.com/FabioFiorita/porcelain/commit/ff346a2deab13be706748368273dd654d2a34ca1))
* polish review and surface state ([90337a5](https://github.com/FabioFiorita/porcelain/commit/90337a518050247b0efa0e306a9b9427b6d4a31f))

## [0.59.0](https://github.com/FabioFiorita/porcelain/compare/v0.58.0...v0.59.0) (2026-08-25)

## [0.58.0](https://github.com/FabioFiorita/porcelain/compare/v0.57.2...v0.58.0) (2026-08-22)

### Features

* scope the app by Environment — Settings, project picker, and Terminals ([#70](https://github.com/FabioFiorita/porcelain/issues/70)) ([30a6208](https://github.com/FabioFiorita/porcelain/commit/30a62081e4e8daa77b63335e1c3fc8dc46b605ae))

## [0.57.2](https://github.com/FabioFiorita/porcelain/compare/v0.57.1...v0.57.2) (2026-08-21)

## [0.57.1](https://github.com/FabioFiorita/porcelain/compare/v0.57.0...v0.57.1) (2026-08-21)

## [0.57.0](https://github.com/FabioFiorita/porcelain/compare/v0.56.0...v0.57.0) (2026-08-21)

### Features

* **mobile:** draw the phone tab bar in Porcelain, not UIKit ([fd29b75](https://github.com/FabioFiorita/porcelain/commit/fd29b75f8485e3d4cbf8bb0cd6dbc6d59e7afc2d))
* **mobile:** give every screen a Porcelain header ([b9ce008](https://github.com/FabioFiorita/porcelain/commit/b9ce008e7db1bcfc8cef0bcc78cfd5f32de29d78))
* **mobile:** give the iPad the web client's window ([9630c1e](https://github.com/FabioFiorita/porcelain/commit/9630c1efe2845a9f98375d9d8d5d589eed140d2a))
* **mobile:** pick Settings sections instead of squeezing them ([1d7af4d](https://github.com/FabioFiorita/porcelain/commit/1d7af4d01645f00cec91c1e3a5bba746d2868f5f))
* **mobile:** retire @expo/ui for the Reusables primitives ([dccdb1d](https://github.com/FabioFiorita/porcelain/commit/dccdb1d042e086cc9a63b9653ef1ccbc0cbe08f1))

### Bug Fixes

* **mobile:** stop the iPad printing the sidebar twice, open both panels ([302fc41](https://github.com/FabioFiorita/porcelain/commit/302fc4117b791669ee312110dba6f0c7e0b2b4fe))

## [0.56.0](https://github.com/FabioFiorita/porcelain/compare/v0.55.1...v0.56.0) (2026-08-21)

### Features

* name an Environment so two daemons on one machine tell apart ([1a355ad](https://github.com/FabioFiorita/porcelain/commit/1a355adfab301fd834a8968421f0c6e92fc46946))
* **web:** hide Done Tasks by default and filter by several statuses ([b098868](https://github.com/FabioFiorita/porcelain/commit/b0988686c17dbe05ef7fd08e5f1542241ae517f6))
* **web:** make Terminals the one terminal surface ([986c6e9](https://github.com/FabioFiorita/porcelain/commit/986c6e96d5de76b133bfc2366730d4fb3c1bb978))
* **web:** put saved Actions back in the header ([fbca8ce](https://github.com/FabioFiorita/porcelain/commit/fbca8cede10ff0c7f10dafbb8a3a8ff57d7a8254))
* **web:** scope the Task Project picker to its Environment ([d6d53ff](https://github.com/FabioFiorita/porcelain/commit/d6d53ff27699312227abb949590a8fccede4ddf7))
* **web:** wrap long lines in the diff surfaces ([1e7edc2](https://github.com/FabioFiorita/porcelain/commit/1e7edc2f262989bc9518161022685484569009f1))

### Bug Fixes

* **desktop:** open Hub worktrees on other Environments through the shell ([#63](https://github.com/FabioFiorita/porcelain/issues/63)) ([937d5d0](https://github.com/FabioFiorita/porcelain/commit/937d5d0d40aab6db71b041145a1686e7aaa52c19))
* **desktop:** typecheck the e2e project in `pnpm check` ([268ff2a](https://github.com/FabioFiorita/porcelain/commit/268ff2ac39d6093e27652f80a420615987ab35d7)), closes [#63](https://github.com/FabioFiorita/porcelain/issues/63)
* **web:** drop the black left-edge bar from selected sidebar rows ([479b724](https://github.com/FabioFiorita/porcelain/commit/479b724616b4a96a1092d78bbf4fd20f95a39434))

## [0.55.1](https://github.com/FabioFiorita/porcelain/compare/v0.55.0...v0.55.1) (2026-08-19)

### Features

* **actions:** duplicate a saved Action from its row menu ([#44](https://github.com/FabioFiorita/porcelain/issues/44)) ([9da9957](https://github.com/FabioFiorita/porcelain/commit/9da9957da7750468e31137e1f6f9189a3b0af415))
* **desktop:** menu-bar quick add Task popover ([#58](https://github.com/FabioFiorita/porcelain/issues/58)) ([e67c010](https://github.com/FabioFiorita/porcelain/commit/e67c0102959b27535fb6363e57df0278df06c22f))
* **dev:** pnpm dev:web serves the browser client with HMR ([#54](https://github.com/FabioFiorita/porcelain/issues/54)) ([5eccd0a](https://github.com/FabioFiorita/porcelain/commit/5eccd0aac015711be9be4873c597052489574b8e))
* **git:** accept a grouped commit proposal in one click ([#53](https://github.com/FabioFiorita/porcelain/issues/53)) ([dd9b03b](https://github.com/FabioFiorita/porcelain/commit/dd9b03b243b15f5142aef0194c546ddbe78bce96))
* **git:** pick the branch you compare against ([#55](https://github.com/FabioFiorita/porcelain/issues/55)) ([84733d6](https://github.com/FabioFiorita/porcelain/commit/84733d6e6ff69fb6d72b480631856a94c5c1ab17))
* **highlight:** syntax-highlight Prisma schemas ([#40](https://github.com/FabioFiorita/porcelain/issues/40)) ([70a5ee9](https://github.com/FabioFiorita/porcelain/commit/70a5ee92fd0bb3819f3efbb05231d8e0dae8879e))
* **mcp:** make the companion tools expressible for the daily Task loop ([#48](https://github.com/FabioFiorita/porcelain/issues/48)) ([9b75044](https://github.com/FabioFiorita/porcelain/commit/9b7504497793f9fecaf6d8b68ce4a586de452b88))
* **tasks:** name the Environment a Task lives on ([#52](https://github.com/FabioFiorita/porcelain/issues/52)) ([52c9353](https://github.com/FabioFiorita/porcelain/commit/52c9353ef83b821a954e1bcf8b0501e1d406c573))
* **web:** daemon-wide Terminals board in the Viewer (T-1) ([#60](https://github.com/FabioFiorita/porcelain/issues/60)) ([eb785a8](https://github.com/FabioFiorita/porcelain/commit/eb785a822795cd182d91b62a40b55a869bcd3cea))
* **web:** prompt for a profile when a project has none ([#56](https://github.com/FabioFiorita/porcelain/issues/56)) ([4e2b56e](https://github.com/FabioFiorita/porcelain/commit/4e2b56e26029948e1b672f6fb34772afb74fe141)), closes [#39](https://github.com/FabioFiorita/porcelain/issues/39)
* **web:** prompt to update a remote daemon that lags the client ([#51](https://github.com/FabioFiorita/porcelain/issues/51)) ([06c9341](https://github.com/FabioFiorita/porcelain/commit/06c934155ca997c72e0a064e2543c1e259d0f5ee))
* **web:** show which file is open and which is reviewed ([#47](https://github.com/FabioFiorita/porcelain/issues/47)) ([2759544](https://github.com/FabioFiorita/porcelain/commit/27595445ec1429318d53af6d6c35bdf9095b244a)), closes [#46](https://github.com/FabioFiorita/porcelain/issues/46)
* **web:** trim the single-file diff to its changed lines, with expand controls ([#50](https://github.com/FabioFiorita/porcelain/issues/50)) ([341a98a](https://github.com/FabioFiorita/porcelain/commit/341a98a90b35136de86f5e1435c0afff4e1ab43a))

### Bug Fixes

* **contracts:** bump PROCEDURE_COUNT ratchet to the real count after the merge queue landing ([a89cac2](https://github.com/FabioFiorita/porcelain/commit/a89cac2356ae917743ee58e09b495c79d326b6f5))
* **daemon:** answer the MCP era probe and the classic handshake ([#43](https://github.com/FabioFiorita/porcelain/issues/43)) ([dff3e64](https://github.com/FabioFiorita/porcelain/commit/dff3e64cf006bcc00e6081a4742610955bf47041))
* **shared:** word the profile prompts for the porcelain_profile MCP tool ([#42](https://github.com/FabioFiorita/porcelain/issues/42)) ([59f79f6](https://github.com/FabioFiorita/porcelain/commit/59f79f62fada9ec99f9a5b8308fc358089453f6d)), closes [#39](https://github.com/FabioFiorita/porcelain/issues/39)
* **terminal:** suggest a local folder that exists for This-device terminals ([#41](https://github.com/FabioFiorita/porcelain/issues/41)) ([7889c22](https://github.com/FabioFiorita/porcelain/commit/7889c22148907a38e612eca6a4b5c74add32b521))
* **web:** draw terminal block and box glyphs on the cell grid ([#45](https://github.com/FabioFiorita/porcelain/issues/45)) ([c581d8c](https://github.com/FabioFiorita/porcelain/commit/c581d8c49e1192f7ff21687095393a739691e72d))
* **web:** remove duplicate duplicateTitle/COPY_SUFFIX from merge queue landing [#61](https://github.com/FabioFiorita/porcelain/issues/61) ([e44553a](https://github.com/FabioFiorita/porcelain/commit/e44553aef94fdac1141ec49f177f287e1d0d9eec))
* **web:** stop sidebar hover from merging into the selected row ([#46](https://github.com/FabioFiorita/porcelain/issues/46)) ([0e1e1f3](https://github.com/FabioFiorita/porcelain/commit/0e1e1f3b72ac50bd14a4cb2559f35a3f6b548069))
* **worktree-scripts:** scope the lifecycle signal by Project, end setup on removal ([#61](https://github.com/FabioFiorita/porcelain/issues/61)) ([1c909e0](https://github.com/FabioFiorita/porcelain/commit/1c909e00e545cf55ac47069e224d55cc9780edaf)), closes [#44](https://github.com/FabioFiorita/porcelain/issues/44)

### Performance Improvements

* **clients:** stop rebuilding empty arrays that break memoization ([#59](https://github.com/FabioFiorita/porcelain/issues/59)) ([a8f4e16](https://github.com/FabioFiorita/porcelain/commit/a8f4e16a3ce978d9c72a3e957f8c664598842fdf))

## [0.55.0](https://github.com/FabioFiorita/porcelain/compare/v0.54.0...v0.55.0) (2026-08-18)

### Features

* **quality:** gate exports whose only importer is a test ([ddd68d9](https://github.com/FabioFiorita/porcelain/commit/ddd68d948fa4b7bf4a1b88e15b94d4dc76285969))

### Bug Fixes

* **daemon:** same case-correction bug in the playground boundary check ([63439c6](https://github.com/FabioFiorita/porcelain/commit/63439c63120fadf02c38ab3ef31a03558fdfdb56))
* **desktop:** repair electron-vite dev after the apps/web extract ([3dfe7fe](https://github.com/FabioFiorita/porcelain/commit/3dfe7fe5fd6f77b1babb7125ed1165dcb5209481))
* **dev:** three playground-onboarding bugs on case-insensitive disks ([852e649](https://github.com/FabioFiorita/porcelain/commit/852e649e81d4d82640a62deceaab11a32e3f5fed))
* **release:** stop staging the deleted skills directory in the cut ([a9e2bf5](https://github.com/FabioFiorita/porcelain/commit/a9e2bf51b887e4043935547cdf2f167e3f78aa89))
* **tasks:** keep a row status edit out of the detail sheet ([2f50869](https://github.com/FabioFiorita/porcelain/commit/2f50869658bd51e4f7217f24b4aa5ac8af598c7e))
* **web:** keep macOS traffic lights off the sidebar toggle ([#37](https://github.com/FabioFiorita/porcelain/issues/37)) ([fac2710](https://github.com/FabioFiorita/porcelain/commit/fac2710e9642ce9a8e710176059dac47b8731d0d))
* **web:** refresh the Electron Hub tree after adding a project ([d8b9ee1](https://github.com/FabioFiorita/porcelain/commit/d8b9ee142f03174247452ff2858421d8e7c59f80))
* **web:** register the local Environment id as primary on Electron ([215fa9a](https://github.com/FabioFiorita/porcelain/commit/215fa9aef0d69631667455e9d0188e40d61efb4c))
* **web:** stop showing local Environment as offline on worktree switch ([563f725](https://github.com/FabioFiorita/porcelain/commit/563f7256fbe0365a14b9d954c40d80c83f29cb71))

## [0.54.0](https://github.com/FabioFiorita/porcelain/compare/v0.53.2...v0.54.0) (2026-08-17)

### Features

* **tasks:** ship a Linear-like board with a live notes composer ([6d28495](https://github.com/FabioFiorita/porcelain/commit/6d284953cafd1019c3c675862692b4dd00cfe78f))
* **web:** restore review comments and settle the companion shell ([732c499](https://github.com/FabioFiorita/porcelain/commit/732c499fb071d9e1d514c2ddb0c68f909cf7dc79))

### Bug Fixes

* **git:** publish a branch when push has no matching remote ([#36](https://github.com/FabioFiorita/porcelain/issues/36)) ([5d0bd85](https://github.com/FabioFiorita/porcelain/commit/5d0bd8535ebacbcfef694eb5d82ce4753a6eaf1f))
* **tasks:** typecheck attachment and tabs test fixtures ([a7c3dc7](https://github.com/FabioFiorita/porcelain/commit/a7c3dc70d5a624554f3c5b5024dc08ae253941b0))
* **web:** drop Settings Remotes from the browser ([f4ebe07](https://github.com/FabioFiorita/porcelain/commit/f4ebe07b9fff6844e6371fb947b8f8339e2ca60f))

## [0.53.2](https://github.com/FabioFiorita/porcelain/compare/v0.53.1...v0.53.2) (2026-08-17)

### Features

* **remote:** run a named Cloudflare tunnel for a stable hostname ([9599cb6](https://github.com/FabioFiorita/porcelain/commit/9599cb6a430e9806be4edd8a8f8419e6e6d6419c))
* **remote:** share via LAN plus Tailscale or Cloudflare ([0b35f31](https://github.com/FabioFiorita/porcelain/commit/0b35f31bb67c370e0690ffc1165a91268b7712de))

### Bug Fixes

* **web:** keep hub worktree clicks in one window ([5f13a8b](https://github.com/FabioFiorita/porcelain/commit/5f13a8ba4700b7a7cb2db178bdf717376f598d4d))

## [0.53.1](https://github.com/FabioFiorita/porcelain/compare/v0.53.0...v0.53.1) (2026-08-17)

### Features

* **companion:** remove legacy migration flow ([88607a5](https://github.com/FabioFiorita/porcelain/commit/88607a5e87d94a76df2751e1e05b7ba0d8f29901))
* **dev:** let a dev browser in without a pairing link ([9dfb4c9](https://github.com/FabioFiorita/porcelain/commit/9dfb4c9bb9f43091a5d90b702aa32d97a38fd02f))
* **dev:** pair on boot and build a playground fleet ([db52b19](https://github.com/FabioFiorita/porcelain/commit/db52b194047f4b35b1a2c9b0dfc6db30ed717690))
* **dev:** seed the dev daemon with state worth reviewing ([c50077f](https://github.com/FabioFiorita/porcelain/commit/c50077ff0aebe70a866d8de501f7daa0db251527))
* **ui:** adopt the base-rhea shadcn preset ([#32](https://github.com/FabioFiorita/porcelain/issues/32)) ([0221059](https://github.com/FabioFiorita/porcelain/commit/022105942182f046c8b68d31d0a938fc787b70e3))

### Bug Fixes

* **quality:** let lint-pillars ignore empty directories ([a585972](https://github.com/FabioFiorita/porcelain/commit/a585972ddb3774af82787d8cb958f880f7cc477b))
* **shell:** stop the preload bridge parsing through Zod's JIT ([#33](https://github.com/FabioFiorita/porcelain/issues/33)) ([975e6bf](https://github.com/FabioFiorita/porcelain/commit/975e6bf644c942c7f453b4a064f6faf4e1f43aea))

## [0.53.0](https://github.com/FabioFiorita/porcelain/compare/v0.52.1...v0.53.0) (2026-08-16)

### Features

* **actions:** complete Actions domain cutover (ACT-004) ([7491058](https://github.com/FabioFiorita/porcelain/commit/749105868f3c559c8ff0c5ba5856376be22e03c5))
* **actions:** daemon-root Actions with an explicit run target ([bebaed8](https://github.com/FabioFiorita/porcelain/commit/bebaed853587edbb4093447ef434a9c1289a4790)), closes [#26](https://github.com/FabioFiorita/porcelain/issues/26)
* **actions:** dual-writer cutover for Actions domain (ACT-001) ([9bc3bfe](https://github.com/FabioFiorita/porcelain/commit/9bc3bfe6921114436954b0ac5ffa3280b6e3149b))
* **actions:** relocate UI and prepare → Terminal create (ACT-003) ([096a277](https://github.com/FabioFiorita/porcelain/commit/096a2777ccbdbce74266c1b137e29d4a9ff7235f))
* **actions:** shared Actions client-runtime semantics (ACT-002) ([e09f400](https://github.com/FabioFiorita/porcelain/commit/e09f400d0640aa71132372fd924c5dba1ef5ada5))
* **agents:** add architecture recipe executor ([8d9e846](https://github.com/FabioFiorita/porcelain/commit/8d9e84667ba0ef76a22f205894af67e1122ff860))
* **agents:** queue reviewed architecture recipes ([37600a0](https://github.com/FabioFiorita/porcelain/commit/37600a0cbaba2cac6572881eaff966a544d0f90a))
* **architecture:** isolated execution-group dispatcher ([324af59](https://github.com/FabioFiorita/porcelain/commit/324af598eab6f97374347d5e6a0ac3f3d8293887))
* **architecture:** ratchet supporting-region composition (SUP-001) ([78bd4de](https://github.com/FabioFiorita/porcelain/commit/78bd4de713340f815b3bab118f907c920dcf62f4))
* **board:** complete mobile Board cutover (BRD-005) ([0182548](https://github.com/FabioFiorita/porcelain/commit/0182548f32187c9bba425128dcaca5e0eb5e36a8))
* **board:** operations, v1 adapter, and composition (BRD-002) ([07f6541](https://github.com/FabioFiorita/porcelain/commit/07f6541f97e12c686f3da530a6a4784f51503ea7))
* **board:** Web feature adapter and canonical wire swap (BRD-004) ([28d0f03](https://github.com/FabioFiorita/porcelain/commit/28d0f03183304afe7d893f157140c0b861621b2e))
* **cli:** add canvas set/list, the CLI/skill boundary for Canvas ([#21](https://github.com/FabioFiorita/porcelain/issues/21)) ([6a49dbc](https://github.com/FabioFiorita/porcelain/commit/6a49dbc668b803b0d3c4edc6b16371cb413652ee))
* **client-runtime:** add shared session recovery runtime ([24b3e0a](https://github.com/FabioFiorita/porcelain/commit/24b3e0a9d1bc68cfb6c092cac6b84bc61d6ef324))
* **client-runtime:** Board shared semantics (BRD-003) ([829c63d](https://github.com/FabioFiorita/porcelain/commit/829c63dc66c34f32c40979567d950e3c4723aa60))
* **client-runtime:** land Git workspace consequences (GIT-003) ([dd3a614](https://github.com/FabioFiorita/porcelain/commit/dd3a6142155826c04505eaa2d3efddd685155dd3))
* **client-runtime:** land Remote endpoint and health policy (REM-003) ([20224f2](https://github.com/FabioFiorita/porcelain/commit/20224f23404e5bd77a90f1a30c21ee2a40fe2a8e))
* **client-runtime:** land Review-comment shared semantics (RVC-002) ([5ee0cf4](https://github.com/FabioFiorita/porcelain/commit/5ee0cf447ffd9858d62f8f5445dbec856eb626bf))
* **client-runtime:** land Terminal stream state machine (TRM-003) ([df11848](https://github.com/FabioFiorita/porcelain/commit/df11848fc8967532b3ff7f2063b2a9e1b485a1f7))
* **cli:** lock agent CLI boundary gate (CLI-001) ([e89fdc0](https://github.com/FabioFiorita/porcelain/commit/e89fdc0c76e62b26e38ab65929d8496ae29be31f))
* **cli:** retire legacy review companion commands ([b50cdff](https://github.com/FabioFiorita/porcelain/commit/b50cdff5f5e045e007344b93706f574d557dc7ca))
* **contracts:** add canonical procedure catalog ([1beb5bb](https://github.com/FabioFiorita/porcelain/commit/1beb5bbed7bac588171ccbff2c9a693d39ee814b))
* **contracts:** announce protocol version 1 on daemonInfo ([182bae6](https://github.com/FabioFiorita/porcelain/commit/182bae64c126902b4356c7ec0b2be6e43759bff5))
* **contracts:** declare Git operation failures (GIT-001) ([b16b4ac](https://github.com/FabioFiorita/porcelain/commit/b16b4ac380678c1d012bc45882904098fcd636c9))
* **contracts:** define public error contract ([5cc672b](https://github.com/FabioFiorita/porcelain/commit/5cc672b62382c5b73ae1868d03d32c233e450005))
* **contracts:** establish domain procedure ledger ([5dcd760](https://github.com/FabioFiorita/porcelain/commit/5dcd76095dd95157caca89f14a3fa3abe77895fa))
* **contracts:** land Actions procedure contracts ([45738c9](https://github.com/FabioFiorita/porcelain/commit/45738c935efa38f881e23fdeec8115421ed1711f))
* **contracts:** land Board procedure contracts ([1db2cc9](https://github.com/FabioFiorita/porcelain/commit/1db2cc9222e2b0f41837d25073463a1590fe5d30))
* **contracts:** land canonical Board wire (BRD-001) ([9152a0d](https://github.com/FabioFiorita/porcelain/commit/9152a0d8e494bd711f53044fa3bc84a94654cd3a))
* **contracts:** land Files procedure contracts ([ce622b2](https://github.com/FabioFiorita/porcelain/commit/ce622b2d8366cad45f5a9f942debff0802e86b86))
* **contracts:** land Git procedure contracts ([7ad2bbb](https://github.com/FabioFiorita/porcelain/commit/7ad2bbba31a7a23f125f924074f2acc70bcc99fe))
* **contracts:** land Project Data procedure contracts ([9a46f39](https://github.com/FabioFiorita/porcelain/commit/9a46f39a723ad108ace71be3aa82cad6fb917dcb))
* **contracts:** land Projects procedure contracts ([77db795](https://github.com/FabioFiorita/porcelain/commit/77db7957da66cfe23e4e591744168485cf426a82))
* **contracts:** land Remote procedure contracts ([cd4bcb6](https://github.com/FabioFiorita/porcelain/commit/cd4bcb6ef8a6a8b4e438d4207158762db1535be9))
* **contracts:** land Review procedure contracts ([c796daf](https://github.com/FabioFiorita/porcelain/commit/c796daff8afe4da4497f97ffc771d427ba2c5eee))
* **contracts:** land Search procedure contracts ([890a393](https://github.com/FabioFiorita/porcelain/commit/890a393c20b106420513edce05ef0a982013976e))
* **contracts:** land Terminal procedure contracts ([cb0b61b](https://github.com/FabioFiorita/porcelain/commit/cb0b61b9721145c99590190b570ddb05981e2fa4))
* **contracts:** own realtime notification and stream contracts ([6bd506a](https://github.com/FabioFiorita/porcelain/commit/6bd506a4291f28dbf2a83e7bdc528b4c68dc29fa))
* **cutover:** retire legacy companion and terminal image surfaces ([f3629f4](https://github.com/FabioFiorita/porcelain/commit/f3629f4a25766a339c54d7b9bb3c2a2b8e621ab9))
* **cutover:** retire legacy companion surfaces ([eb29960](https://github.com/FabioFiorita/porcelain/commit/eb299603be478950cc2862f6cffdf1734acd0bd0))
* **cutover:** retire legacy review companion channels ([1c94df8](https://github.com/FabioFiorita/porcelain/commit/1c94df86cfa27260fe6a927f8cacd59018ab1f8f))
* **daemon:** centralize tRPC public errors ([f13db73](https://github.com/FabioFiorita/porcelain/commit/f13db739c886d318f328c0fbed040faf37dcfb57))
* **daemon:** establish explicit composition root and router factories ([e68712a](https://github.com/FabioFiorita/porcelain/commit/e68712a4b07c434783ac57e680fa4e2ec2f30f83))
* **daemon:** land Git workspace operations (GIT-002) ([cb20e92](https://github.com/FabioFiorita/porcelain/commit/cb20e92a1bd461cd53c9b3211e8d72351da87bb9))
* **daemon:** require the protocol header on tRPC and pairing ([39612db](https://github.com/FabioFiorita/porcelain/commit/39612db5a855dce7d7f346bd56ab65ac353bf773))
* **daemon:** return public HTTP errors ([3fdb3d6](https://github.com/FabioFiorita/porcelain/commit/3fdb3d6c4a46f6173b764fedf4a6a70ddda9227e))
* **daemon:** serve Canvas HTML on an authenticated same-origin route ([ac7227b](https://github.com/FabioFiorita/porcelain/commit/ac7227bcc337fa679796c598e5e3375f544ccc70)), closes [#26](https://github.com/FabioFiorita/porcelain/issues/26)
* **daemon:** validate Actions and Terminal procedures against contracts ([b305c40](https://github.com/FabioFiorita/porcelain/commit/b305c4079d495a9e5ccdd94547918beb4b27f38c))
* **daemon:** validate Board procedures against contracts ([af35b53](https://github.com/FabioFiorita/porcelain/commit/af35b537391678483e3a0458038b3439646c7297))
* **daemon:** validate Files and Search procedures against contracts ([6b569c6](https://github.com/FabioFiorita/porcelain/commit/6b569c60c896d596b690e3b569a0f163b204ea87))
* **daemon:** validate Git procedures against contracts ([37b6c61](https://github.com/FabioFiorita/porcelain/commit/37b6c61c937f40eb513f6955b8681f2f35045ec1))
* **daemon:** validate Projects and Files procedures against contracts ([3aeb5c0](https://github.com/FabioFiorita/porcelain/commit/3aeb5c00549a81e73d1cd32237d8630ad22d3996))
* **daemon:** validate Remote procedures against contracts ([95c4f2e](https://github.com/FabioFiorita/porcelain/commit/95c4f2e2e1a4a127fc23b8b8d12818acbde9ee47))
* **daemon:** validate Review procedures against contracts ([424d8d2](https://github.com/FabioFiorita/porcelain/commit/424d8d2de513fc3dc72831398d915e54edbf6758))
* **daemon:** validate settings-hosted procedures against contracts ([b7affd4](https://github.com/FabioFiorita/porcelain/commit/b7affd4c32e952d7f3863715ae96fd14a796e5b4))
* **desktop:** ratchet thin-shell boundary; keep address book (SUP-003) ([637f051](https://github.com/FabioFiorita/porcelain/commit/637f051d52e40707ce622011d92fc01ad02ce327))
* **evidence-assets:** inline empty external script tags ([#21](https://github.com/FabioFiorita/porcelain/issues/21)) ([b1dbaac](https://github.com/FabioFiorita/porcelain/commit/b1dbaac6407ca0af2ac091d5066a56d6df084b3a))
* **files:** complete Files contracts and public errors (FIL-001) ([eaeef63](https://github.com/FabioFiorita/porcelain/commit/eaeef63610b9b2a3b5066a84194758bbb636871d))
* **files:** land client-runtime identities and effects (FIL-004) ([8d7b5f1](https://github.com/FabioFiorita/porcelain/commit/8d7b5f1a179c6e8b0c22a2c6db9c22315bb94320))
* **files:** land FIL-002 hardened WorkspaceFiles host-fs cutover ([4c1ddd8](https://github.com/FabioFiorita/porcelain/commit/4c1ddd85ab3ffcf972e76f563679eadba87916cc))
* **files:** land FIL-003 operations facts and session Files watches ([a74de2a](https://github.com/FabioFiorita/porcelain/commit/a74de2a98824d8f76353f772cacb5c5203f6d443))
* **files:** land mobile Files adapter (FIL-006) ([ba58bbb](https://github.com/FabioFiorita/porcelain/commit/ba58bbbf9def6eeeaea354daf0134ff17d5931ca))
* **files:** land Web Files adapters on FIL-004 (FIL-005) ([0092427](https://github.com/FabioFiorita/porcelain/commit/00924279f73bcf6d5d014dd6333a4d06207fb4ac))
* **git:** bind diffReading and commitModels on Git feature (GIT-007) ([5e2c56c](https://github.com/FabioFiorita/porcelain/commit/5e2c56c98ce5f153081d945af2ee26129c41afbc))
* **git:** complete Git client cutover (GIT-006) ([96d14b8](https://github.com/FabioFiorita/porcelain/commit/96d14b82cf1cf7f53b5c82efce3b2eda9c21becd))
* **git:** land Git operations (GIT-005) ([a5ecf5c](https://github.com/FabioFiorita/porcelain/commit/a5ecf5c0f77a0b4c4ccfd97f1a3258b33134dd7f))
* **git:** land workspace client adapters (GIT-004) ([38837b6](https://github.com/FabioFiorita/porcelain/commit/38837b6b59359fc00c925a6f13a55228f27b0d5d))
* **hub:** aggregate multi-Environment inventory in the shell ([#30](https://github.com/FabioFiorita/porcelain/issues/30)) ([8a84a7e](https://github.com/FabioFiorita/porcelain/commit/8a84a7ea02b0112b9962c394413527d69cfe583b))
* **hub:** finish review and workspace controls ([10e2d83](https://github.com/FabioFiorita/porcelain/commit/10e2d8313a0d7608f81f8039505183c87dba0362))
* **mobile:** land daemon-backed quick open ([2ed5aed](https://github.com/FabioFiorita/porcelain/commit/2ed5aed2c792f110b10f90412cca9449cd07d2a8))
* **mobile:** land mobile Remote v1 environments (REM-005) ([89f527d](https://github.com/FabioFiorita/porcelain/commit/89f527d87b3efaad0564290f966dd9c2d8ddb0bd))
* **mobile:** land Terminal stream adapter (TRM-005) ([9d41676](https://github.com/FabioFiorita/porcelain/commit/9d41676c92f3e7129e92c6a036cb78dccc3f28f0))
* **project-data:** complete the domain and prove ownership (PDT-006) ([46d616a](https://github.com/FabioFiorita/porcelain/commit/46d616a1b5a4f615806c50f715ebcff038a6aaf7))
* **project-data:** delete home and active-layout migrations (PDT-005) ([3c5baff](https://github.com/FabioFiorita/porcelain/commit/3c5baffdb85283ba52ff641a23128f4b917d1ddf))
* **project-data:** land Notes layers visibility ops (PDT-002) ([987c686](https://github.com/FabioFiorita/porcelain/commit/987c686120ab7085f722b779b94c687fd3440f5e))
* **project-data:** land reset authorization fixtures (PDT-004) ([7edb891](https://github.com/FabioFiorita/porcelain/commit/7edb891676a735e2c3413957a51424838645b9c7))
* **project-data:** land v1 companion manifest root (PDT-001) ([c3f2743](https://github.com/FabioFiorita/porcelain/commit/c3f2743370ed25ead7424232663b01d13ab3d3e2))
* **project-data:** land Web mobile settings adapters (PDT-003) ([28f1e01](https://github.com/FabioFiorita/porcelain/commit/28f1e0174aba1d9c8062be908af7d34843cf2278))
* **project-data:** one-time companion migration ([#27](https://github.com/FabioFiorita/porcelain/issues/27)) ([1bb0901](https://github.com/FabioFiorita/porcelain/commit/1bb0901cc18d17e71f5b2e8593518a9010ec916f)), closes [#22](https://github.com/FabioFiorita/porcelain/issues/22) [#23](https://github.com/FabioFiorita/porcelain/issues/23) [#24](https://github.com/FabioFiorita/porcelain/issues/24) [#26](https://github.com/FabioFiorita/porcelain/issues/26)
* **project-data:** strict v1 JSON document primitive (DAT-001) ([2406a4e](https://github.com/FabioFiorita/porcelain/commit/2406a4e07633dd52d83764a29bb168902b14488f))
* **projects:** add daemon-root Canvas store ([#21](https://github.com/FabioFiorita/porcelain/issues/21)) ([a996a83](https://github.com/FabioFiorita/porcelain/commit/a996a83526c88e56dc88f8de66a2db7e62990f2d))
* **projects:** add Hub inventory of Environments and Worktrees ([5b1f51b](https://github.com/FabioFiorita/porcelain/commit/5b1f51beece57bbef2127045b20d2df14ceb432f))
* **projects:** land Project operations (PRJ-001) ([cde717e](https://github.com/FabioFiorita/porcelain/commit/cde717e388e3a3bf203917bf372ea32191a768a1))
* **projects:** land Project vocabulary cutover (PRJ-003) ([4b42aec](https://github.com/FabioFiorita/porcelain/commit/4b42aec283f5f121106dc7d024481eb6d236d57d))
* **projects:** land shared client adapters (PRJ-002) ([f3bacb4](https://github.com/FabioFiorita/porcelain/commit/f3bacb47472cc7bd7658636bd9153789ed6c2247))
* **projects:** promote Canvases and defaults into a Git overlay ([41567b6](https://github.com/FabioFiorita/porcelain/commit/41567b6c7c0650dcb0609a4019b3e5d7e3619c1d)), closes [#26](https://github.com/FabioFiorita/porcelain/issues/26) [#18](https://github.com/FabioFiorita/porcelain/issues/18)
* **projects:** wire Canvas list/read through contracts and daemon ([#21](https://github.com/FabioFiorita/porcelain/issues/21)) ([7cda406](https://github.com/FabioFiorita/porcelain/commit/7cda40666a5948e8db1e4ef181bf96c5ddf9372a))
* **protocol:** version owned daemon HTTP clients ([6788ed8](https://github.com/FabioFiorita/porcelain/commit/6788ed8818c2f25cddfab3f4bd917472dfe8849c))
* **remote:** complete Remote domain security gates (REM-006) ([b82dbb9](https://github.com/FabioFiorita/porcelain/commit/b82dbb9dea71acb3ebabbd205842303bf225f5d7))
* **remote:** land Remote identity and access operations (REM-001) ([80b5b66](https://github.com/FabioFiorita/porcelain/commit/80b5b6607f60dfedbbbb57d5f83cb163d779df2f))
* **remote:** land Remote listeners and HTTP pipeline (REM-002) ([a0169cf](https://github.com/FabioFiorita/porcelain/commit/a0169cf477fbfd5ee3c23c8d8fc1759b311cc0e1))
* **remote:** support trusted browser Hub origins ([a621c65](https://github.com/FabioFiorita/porcelain/commit/a621c652bcda7700e3df19490184627a49ba8e9f))
* **review:** add media and link evidence assets ([38ccdc2](https://github.com/FabioFiorita/porcelain/commit/38ccdc20c92b8a7050ed05319d9d7e497b0faa59))
* **review:** complete mobile Review-comment cutover (RVC-004) ([49696c8](https://github.com/FabioFiorita/porcelain/commit/49696c8e2ce8d7616eb91c217e19c81a4c5554b7))
* **review:** cut comments to v1 dual-writer operations (RVC-001) ([bdd9b28](https://github.com/FabioFiorita/porcelain/commit/bdd9b28377b14f8e541bed9a4c731c7e2a3bab4d))
* **review:** cut the wire over to the target catalog (REV-009) ([a7eda7f](https://github.com/FabioFiorita/porcelain/commit/a7eda7f39ec8886dfd8a138b56450dce302235a6))
* **review:** cut Web comments to RVC-002 shared semantics ([fc84d6b](https://github.com/FabioFiorita/porcelain/commit/fc84d6b17114f74771a290d6bc63adfeacafe97b))
* **review:** land inactive target-v1 contract catalog (REV-001) ([8cb0bc4](https://github.com/FabioFiorita/porcelain/commit/8cb0bc487ef93d39aca9db10de5a81e7631ac896))
* **review:** land lifecycle operations behind live wire (REV-002) ([85e2d7f](https://github.com/FabioFiorita/porcelain/commit/85e2d7fd20be0e08a3355f4f827a36a5a468c3a6))
* **review:** land mobile Review on contracts (REV-008) ([553bfbf](https://github.com/FabioFiorita/porcelain/commit/553bfbf4c659723cee75785f94d2d21d4d634cd6))
* **review:** land reading and inbox operations (REV-003) ([897cff0](https://github.com/FabioFiorita/porcelain/commit/897cff055397d370f2ca56bab50ecd7cfc09b864))
* **review:** make Review the daemon-root Canvas template ([b43a7a4](https://github.com/FabioFiorita/porcelain/commit/b43a7a410f69c679fc1d6ea014adb05c7c28a3eb))
* **review:** own shared Review semantics beyond comments ([c864962](https://github.com/FabioFiorita/porcelain/commit/c8649621af02b06a14004d77249c7cd86db9e4a6))
* **review:** prove security and mark domain complete (REV-010) ([919c20d](https://github.com/FabioFiorita/porcelain/commit/919c20d9fb4339d31b271eae513b23564dcb7359))
* **review:** retire repo-local review surfaces ([fd3a94b](https://github.com/FabioFiorita/porcelain/commit/fd3a94b63e0cb8b69f8fba2ec79c273eba85dfd0))
* **review:** split canvas intent and process tabs ([90a25ae](https://github.com/FabioFiorita/porcelain/commit/90a25ae5ca5d609c6816ccf0e55b86e50b5adda2))
* **runtime:** land foundation Zod boundary validation ([cf6052c](https://github.com/FabioFiorita/porcelain/commit/cf6052c401701a400cc1396de4f5ccd8a6791b09))
* **search:** complete Search cutover (SEA-003) ([544b151](https://github.com/FabioFiorita/porcelain/commit/544b1514e61843f2c151b2aa3eb5acea2c173be2))
* **search:** land Search client cutover (SEA-002) ([fbe6bb1](https://github.com/FabioFiorita/porcelain/commit/fbe6bb1f77d9460592cc44686d546634db08c668))
* **search:** land Search operations (SEA-001) ([51247cd](https://github.com/FabioFiorita/porcelain/commit/51247cd63929dc887f7a1f6168f659b1a11d20f5))
* **session:** cut over daemon, web, and mobile to target realtime ([0b442cd](https://github.com/FabioFiorita/porcelain/commit/0b442cd04d645ad9eda4450229dce1d862355f05))
* **session:** decide the daemon protocol handshake ([95d66e3](https://github.com/FabioFiorita/porcelain/commit/95d66e34e7692977f68b034672906b5937bf46bb))
* **session:** prepare daemon publisher, gateway, and watch interests ([df4e1b8](https://github.com/FabioFiorita/porcelain/commit/df4e1b8604fdc298df7574834309a4a87b14d024))
* **tasks:** add the daemon-owned Tasks domain ([37d4184](https://github.com/FabioFiorita/porcelain/commit/37d4184cb6ff41da09eb4a23ff2134f91fed8365)), closes [#23](https://github.com/FabioFiorita/porcelain/issues/23)
* **terminal:** complete Terminal request/response cutover (TRM-006) ([1625b5e](https://github.com/FabioFiorita/porcelain/commit/1625b5eb48a055ecef88518352a9f43505ad663a))
* **terminal:** daemon-owned development servers across Hub navigation ([b882966](https://github.com/FabioFiorita/porcelain/commit/b8829662fec38f37b1199a2d490f2190ac7bf3e8))
* **terminal:** define canonical stream vocabulary (TRM-001) ([d1c34c5](https://github.com/FabioFiorita/porcelain/commit/d1c34c5103c40fbc4e324201673c9b45295bfc48))
* **terminal:** land PTY lifecycle and stream gateway (TRM-002) ([841d734](https://github.com/FabioFiorita/porcelain/commit/841d73449003e2619b3a4c1953446d77751cd8d2))
* **testing:** add contract fixtures and validating daemon mock ([3abec68](https://github.com/FabioFiorita/porcelain/commit/3abec6887866a8b5c123a42ffb70e9aa9b85493f))
* **testing:** add operation stubs and controlled adapter fixtures ([b0e8ae2](https://github.com/FabioFiorita/porcelain/commit/b0e8ae2ac7ecd8feef012bdf8ad2a93bd0278612))
* **web:** Canvas sidebar, Viewer tab, and external-link bridge ([#21](https://github.com/FabioFiorita/porcelain/issues/21)) ([5e4a86a](https://github.com/FabioFiorita/porcelain/commit/5e4a86a1175d2e5e66eee45c84927f28b6d424ce))
* **web:** complete multi-environment hub cutover ([328216b](https://github.com/FabioFiorita/porcelain/commit/328216b7b0ed1b755ddf70abfd67fe37c35a9f65))
* **web:** land Remote settings adapters (REM-004) ([c8632d0](https://github.com/FabioFiorita/porcelain/commit/c8632d022c5afb50e3382f39506ba71b29dabac1))
* **web:** land Terminal stream adapter (TRM-004) ([c24bb8f](https://github.com/FabioFiorita/porcelain/commit/c24bb8fd69f64b52b2b0d6a9e06f22b2b34938e0))
* **web:** manage browser daemon connections ([31d79ae](https://github.com/FabioFiorita/porcelain/commit/31d79aedf82840edd842b4bf569fb4641df6cb62))
* **web:** prepare the unactivated session runtime binding ([b1f1f64](https://github.com/FabioFiorita/porcelain/commit/b1f1f64c0b836d7bbbbec2439a70ee8687d8f3e1))
* **web:** route hub data across browser environment sessions ([424a142](https://github.com/FabioFiorita/porcelain/commit/424a1427f7224a3582b1c8e547a4de0f761fb2b7))

### Bug Fixes

* **actions:** honor noop moves and normalized trust fingerprints ([5169368](https://github.com/FabioFiorita/porcelain/commit/516936893590a0eae02c4044959a1228b888bd34))
* **architecture:** close migration lint bypasses ([f1e0103](https://github.com/FabioFiorita/porcelain/commit/f1e0103cde92b3d3b955c80031878ca44eab8d37))
* **architecture:** harden deep-import baseline catalog validation ([6847bfe](https://github.com/FabioFiorita/porcelain/commit/6847bfe5e8786fbf5f124f687bbf47554919e02a))
* **architecture:** require canonical catalog import ([f2b69cc](https://github.com/FabioFiorita/porcelain/commit/f2b69cc55fc1b3d78bff91231ce0ee1efb377b71))
* **architecture:** support reviewed alias roots ([1f34ade](https://github.com/FabioFiorita/porcelain/commit/1f34adea17c963ed6f15d02bf5a0e4aa4d636b91))
* **board:** complete mobile recovery and enforcement ([98991ab](https://github.com/FabioFiorita/porcelain/commit/98991ab985ea36aea6bda508293f4cbbe7af260f))
* **contracts:** anonymize Remote fixtures ([6b743b5](https://github.com/FabioFiorita/porcelain/commit/6b743b5b62097a806aa83ded883f77e2424695e9))
* **contracts:** enforce procedure ownership baseline ([5571b81](https://github.com/FabioFiorita/porcelain/commit/5571b813e06b59092f618b59c39b2a1594591089))
* **contracts:** require non-null Explore readings ([c469e08](https://github.com/FabioFiorita/porcelain/commit/c469e085559b26a86ecc3562be5711528781986c))
* **daemon:** bound unexpected error type logs ([fb34e63](https://github.com/FabioFiorita/porcelain/commit/fb34e63ee8649f5bc0b130079a5a7e10d759457f))
* **daemon:** quarantine dev hub catalog ([acc4525](https://github.com/FabioFiorita/porcelain/commit/acc45255cd5f91f4c19689faf3049ab067a34ada))
* **daemon:** quarantine real repos from dev recents ([8ec60b6](https://github.com/FabioFiorita/porcelain/commit/8ec60b6195cd5e661a10660d5282cdc15e559e5e))
* **daemon:** report real error classes in the boundary log ([6ed476f](https://github.com/FabioFiorita/porcelain/commit/6ed476fd132e8ceb8b966a1c7106bc8eeea00610))
* **daemon:** restrict dev projects to playgrounds ([c153dad](https://github.com/FabioFiorita/porcelain/commit/c153dadf61cdaad1043698b24f6599347a407f55))
* **dispatch:** bind executor ownership and harden prepare/run ([9c9af3e](https://github.com/FabioFiorita/porcelain/commit/9c9af3e35933c174ba238b6b7dba9a070c6d240c))
* **dispatch:** finalize durable state after executor exit ([ca5d6fe](https://github.com/FabioFiorita/porcelain/commit/ca5d6fe9d2a8153a4d9962338134ba03fb702685))
* **dispatch:** isolate Claude Personal execution ([a9ae228](https://github.com/FabioFiorita/porcelain/commit/a9ae228b5e033add096106e0833e48e8332080a3))
* **files:** correct FIL-002 ELOOP, MIME, ops types, and adapter proof ([9fb94b1](https://github.com/FabioFiorita/porcelain/commit/9fb94b17293f4695d03f4977628808ce1f0f9f63))
* **files:** harden FIL-003 watch containment and lifecycle ([ddb10b1](https://github.com/FabioFiorita/porcelain/commit/ddb10b12fb0e4724e485cf32c8aecf8274c7cf15))
* **files:** preserve descendant cache freshness in FIL-004 ([307971a](https://github.com/FabioFiorita/porcelain/commit/307971a625334b49a6c139a21cf68bd1e1070740))
* **files:** require notification foreign freshness ([4c99a9a](https://github.com/FabioFiorita/porcelain/commit/4c99a9a1ddee2f942e2cad9d6184c1edbd6deefc))
* harden environment routing and dev playground boundary ([de45a3b](https://github.com/FabioFiorita/porcelain/commit/de45a3b02ec16bceb86c7d67595214ae972fe547))
* **hub:** finish target propagation left over from the store split ([dc94d8a](https://github.com/FabioFiorita/porcelain/commit/dc94d8a09341dbd289e7cd149df2ef6f0b70170e))
* **lint:** make the promise gate inspect what it claims to ([b348045](https://github.com/FabioFiorita/porcelain/commit/b3480458fc3c01e2c8171aae24fb2f5b060d760e))
* **mobile:** hide unfinished quick open in production ([f45ed5e](https://github.com/FabioFiorita/porcelain/commit/f45ed5ebec9cbb9294c06e80a7b41586e9f7c26e))
* **mobile:** repair mobile-tests typecheck fixtures ([80088e3](https://github.com/FabioFiorita/porcelain/commit/80088e3521eca260c57bc358afdbd44965cd1ee9))
* **projects:** correct code-review findings on Canvas ([#21](https://github.com/FabioFiorita/porcelain/issues/21)) ([5af1731](https://github.com/FabioFiorita/porcelain/commit/5af17313d5c59788c80d91ec866807575259a001))
* **protocol:** allow version header through CORS ([ef6adbe](https://github.com/FabioFiorita/porcelain/commit/ef6adbef4b403b23a8d3bfd9c79bd38242e838d7))
* **quality:** tolerate missing legacy router directory ([acdce2c](https://github.com/FabioFiorita/porcelain/commit/acdce2c8bcf385b455bf98df4106c306935e9d0c))
* **review:** check the archive exists before restore archives (REV-002) ([9a651ea](https://github.com/FabioFiorita/porcelain/commit/9a651ea6b04ca8413543f9cd76f7e004cd2cf41f))
* **review:** close RVC-001 integration gaps ([8d4a09f](https://github.com/FabioFiorita/porcelain/commit/8d4a09f32f0280bac8fcb8f7ef259a8e69e0ee24))
* **review:** harden RVC-004 mobile comments after independent review ([25f2b72](https://github.com/FabioFiorita/porcelain/commit/25f2b72ce6fb6e4f7205165bc2b4a49ad5469ffd))
* **review:** make recovery and optimism concurrency-safe ([81d91ef](https://github.com/FabioFiorita/porcelain/commit/81d91ef41d8c2c6eb0467efe7b3dd3618b1d4bd3))
* **runtime:** close foundation Zod acceptance findings ([0e85753](https://github.com/FabioFiorita/porcelain/commit/0e85753214da51fd3e9259af3413573fe5c75341))
* **search:** export query-key helpers from the feature index ([3ebd19e](https://github.com/FabioFiorita/porcelain/commit/3ebd19e167382e122c879b976e2c833964e122ed))
* **session:** publish from canonical watch scope ([16bc861](https://github.com/FabioFiorita/porcelain/commit/16bc8616a507f146c1e0574e1551ab5eb603e2f1))
* **terminal:** fan out exit to attached clients on kill ([e50610e](https://github.com/FabioFiorita/porcelain/commit/e50610ea8463cb5059614ddd154763be2bcc5cec))
* **terminal:** guard UTF-8 scrollback index access ([d29a475](https://github.com/FabioFiorita/porcelain/commit/d29a47599b09492a767cd6e238d95c42d3a39fc1))
* **web:** finish environment session cutover ([d8696aa](https://github.com/FabioFiorita/porcelain/commit/d8696aa77d8a10cb1106cd87f8f9be677f446aff))
* **web:** keep primary terminal stream for primary targets ([0aa3f85](https://github.com/FabioFiorita/porcelain/commit/0aa3f85b6a2ba4134cf4d850981546170dec5cdc))
* **web:** make hub summaries navigable ([e4e6179](https://github.com/FabioFiorita/porcelain/commit/e4e61790a96d9e51ecbba32f96e85291a8cef538))
* **web:** own every promise by intent, in one shared boundary ([39ff6ac](https://github.com/FabioFiorita/porcelain/commit/39ff6ac485ba7b560e8344a7a7640911ad17da64))
* **web:** preserve primary action query client ([a041c5e](https://github.com/FabioFiorita/porcelain/commit/a041c5e652619f1c98684b9759626ca0986beb3e))
* **web:** react to browser environment topology ([21eb658](https://github.com/FabioFiorita/porcelain/commit/21eb658d551246cbc5e0040e32c471f08d4ac002))
* **web:** refuse offline canvas environment targets ([efbf276](https://github.com/FabioFiorita/porcelain/commit/efbf276b52f30c9ae2d5dc1f444d60119f1368d3))
* **web:** remove destructive hub worktree control ([ce77505](https://github.com/FabioFiorita/porcelain/commit/ce7750576346a95a4a843f33a8446a05e58d38c0))
* **web:** retain primary watch notification channel ([b5fb3b5](https://github.com/FabioFiorita/porcelain/commit/b5fb3b569e4d0bdd9c65b389cb962230d262904a))
* **web:** route git actions and secondary process ownership ([83f0959](https://github.com/FabioFiorita/porcelain/commit/83f0959049e9dc4486bcd833993d3260a280cecd))
* **web:** route hub reads through owning environments ([58112d5](https://github.com/FabioFiorita/porcelain/commit/58112d51282e799969a9415bfaf86a54c172f90d))
* **web:** route targeted filesystem and terminal actions ([c0e4c21](https://github.com/FabioFiorita/porcelain/commit/c0e4c21c970f7ef732e10d2ad7ee24d12028762b))
* **web:** scope canvas overlay invalidation ([710d52c](https://github.com/FabioFiorita/porcelain/commit/710d52cb5bf64bcc46d0518aa89d4ad5ba0dc866))
* **web:** scope primary file notifications to Hub target ([3650886](https://github.com/FabioFiorita/porcelain/commit/3650886252310990994de70a11b93ba2ea8c441f))
* **web:** scope secondary Tasks caches and shortcuts ([5f5da2a](https://github.com/FabioFiorita/porcelain/commit/5f5da2acfec9208c1e443305e554eb0b5b491743))
* **web:** settle OSC52 auto-copy instead of toasting ([3fdd882](https://github.com/FabioFiorita/porcelain/commit/3fdd88225332ae9fc485734f31861801c5849961))

## [0.52.1](https://github.com/FabioFiorita/porcelain/compare/v0.52.0...v0.52.1) (2026-08-08)

### Features

* **mobile:** gate daemon imports behind feature hooks ([3d45f61](https://github.com/FabioFiorita/porcelain/commit/3d45f615dda68a578c27d3d1a8a44acc125878a1))
* **mobile:** name the two smallest type rungs ([923d3b7](https://github.com/FabioFiorita/porcelain/commit/923d3b7db08a0772fdb64c035f890d1dfa97185b))
* **mobile:** one card idiom, PANEL_CARD ([79f3c7f](https://github.com/FabioFiorita/porcelain/commit/79f3c7febd196ce1b68178c3bbe3b57cab9b6eda))

### Bug Fixes

* **daemon:** keep evidence tab labels distinguishable ([d08a529](https://github.com/FabioFiorita/porcelain/commit/d08a529e9b8228af0c219193c08a66faa87b370b))
* **lint:** skip non-regular files in docs walk ([1d1c9d2](https://github.com/FabioFiorita/porcelain/commit/1d1c9d25f40f127a64e509a31adbffa0664bab09))
* **mobile:** align Files, Changes and History rows to the surface gutter ([e857c95](https://github.com/FabioFiorita/porcelain/commit/e857c95181171718c6f549a16204107f590b67c4))
* **mobile:** stop stacking a modal for New branch / New worktree ([dae778b](https://github.com/FabioFiorita/porcelain/commit/dae778bc70f89880447b270528ad469983f5bd5f))

## [0.52.0](https://github.com/FabioFiorita/porcelain/compare/v0.51.0...v0.52.0) (2026-08-08)

### Features

* **terminal:** Ghostty terminals across web, Electron, and mobile ([#17](https://github.com/FabioFiorita/porcelain/issues/17)) ([98de562](https://github.com/FabioFiorita/porcelain/commit/98de5620465d6232089fe331f2b1447303d73601))

### Bug Fixes

* **release:** stage the whole skills dir when cutting ([fbc3d3a](https://github.com/FabioFiorita/porcelain/commit/fbc3d3a35c358e17f87624d86eab0f0f42665897))
* **web:** render markdown code blocks with real syntax highlighting ([#16](https://github.com/FabioFiorita/porcelain/issues/16)) ([0fa0d59](https://github.com/FabioFiorita/porcelain/commit/0fa0d5980f0377c147d959ed5c47e5969ae8cbdc))

## [0.51.0](https://github.com/FabioFiorita/porcelain/compare/v0.50.0...v0.51.0) (2026-08-07)

### Features

* **agents:** merge-queue skill lands selected work/* PRs ([04604e7](https://github.com/FabioFiorita/porcelain/commit/04604e76f48cf3c18aa44c3d1ab5e994111fa646))
* **daemon:** match commit generation to the repo's own commit style ([#11](https://github.com/FabioFiorita/porcelain/issues/11)) ([6ab5c52](https://github.com/FabioFiorita/porcelain/commit/6ab5c52c6bb14fbdd1b08959bc9403ba31721dc7))
* **desktop:** add Quick Open, New Terminal, and Split Pane to the menu ([d1f6b7f](https://github.com/FabioFiorita/porcelain/commit/d1f6b7f9be3ec1a6ab6e04bd895a6f40370dcb75))
* **desktop:** add Settings to the File menu ([dc19521](https://github.com/FabioFiorita/porcelain/commit/dc19521834ca1b1303aafc43efe4a57bc132f608))
* **mobile:** branch/worktree creation, push, and comment editing ([4424f83](https://github.com/FabioFiorita/porcelain/commit/4424f8378d5c3a98078e18057ed4814a00a84640))
* **mobile:** file writes, content search, and a real reader default ([b8b1c7d](https://github.com/FabioFiorita/porcelain/commit/b8b1c7d54f32f2c649b9842167dca12628b23f51))
* **mobile:** make terminal text size a real preference ([157693b](https://github.com/FabioFiorita/porcelain/commit/157693b9faf58a6fdfe93b05f377b65079ad2474))
* **mobile:** the Review and the Board ([fb15131](https://github.com/FabioFiorita/porcelain/commit/fb15131b735ab4837d381a32dfbdf23180e6cc44))
* **skills:** porcelain-remote — remote daemon setup and ops skill ([fc40fca](https://github.com/FabioFiorita/porcelain/commit/fc40fca4a5d636390eb2418c03f5b78b8299ee99))
* **terminal:** paste an image into a running session ([851e54c](https://github.com/FabioFiorita/porcelain/commit/851e54c4f5e8d08a482275c6fc6357f6941d3c80))
* **worktree:** publish PR evidence screenshots to R2 ([14cc2de](https://github.com/FabioFiorita/porcelain/commit/14cc2dea58a49f6e06f303392e6dd4f76cb45059))

### Bug Fixes

* complete release bookkeeping ([6da0667](https://github.com/FabioFiorita/porcelain/commit/6da06677ac51c85661b9665bc7bc350699ea7bfc))
* **e2e:** stop scraping evidence prepare's prose for the pack dir ([e80fd57](https://github.com/FabioFiorita/porcelain/commit/e80fd57945e19396e47dea29346e4c0cf8654ad6)), closes [#15](https://github.com/FabioFiorita/porcelain/issues/15)
* **evidence:** address Codex review that landed after PR [#15](https://github.com/FabioFiorita/porcelain/issues/15) merged ([4a9f110](https://github.com/FabioFiorita/porcelain/commit/4a9f110334a24ec2241a932796b27bd3ad1ee0a8))
* **mobile:** avoid the keyboard in the shell modal ([250d93d](https://github.com/FabioFiorita/porcelain/commit/250d93d26934bf2a6ed33e9ab94f6e48c2a996c5))
* **mobile:** dark-mode fields, iPad columns, and a Search companion ([5d6e911](https://github.com/FabioFiorita/porcelain/commit/5d6e9110d4e693dfd40efc5e3e4014c83a8b6926))
* **mobile:** drop the board empty note so columns always render ([4b41a39](https://github.com/FabioFiorita/porcelain/commit/4b41a39afdddabdf46b845cbda61afd98c2bab98))
* **mobile:** fade the ghost light-mode fill instead of tinting it ([28585bd](https://github.com/FabioFiorita/porcelain/commit/28585bdbb0a1bef760e361a819995ce6a63f53c2))
* **mobile:** give ghost buttons a visible idle fill ([8dd5e47](https://github.com/FabioFiorita/porcelain/commit/8dd5e47f9afe402b9a51cae05d6c5c3c15f5177f))
* **mobile:** give the terminal every point of the display it can use ([aec21c1](https://github.com/FabioFiorita/porcelain/commit/aec21c109d2705fbcb62caae6545ff0839ff7f33))
* **mobile:** let the shell own bottom chrome; flatten Evidence's tabs ([06070ed](https://github.com/FabioFiorita/porcelain/commit/06070ed336a6a8fdc7917258b4d35a9da45d6752))
* **mobile:** name the worktree chip after the checkout, not its branch ([4a5c973](https://github.com/FabioFiorita/porcelain/commit/4a5c973f1f569313625f36968bbcb1188702607b))
* **mobile:** one gutter, one rhythm, and nothing left under the tab bar ([3bf02b5](https://github.com/FabioFiorita/porcelain/commit/3bf02b588c72ac2a3b8132a7ef5a351a1907e33b))
* **mobile:** pin the spacing scale to points and share one screen header ([e492b7b](https://github.com/FabioFiorita/porcelain/commit/e492b7b65f0e7da1a496c7099b00ee0a375d0a99))
* **mobile:** sit both iPad column titles in the same title band ([19580eb](https://github.com/FabioFiorita/porcelain/commit/19580eb7f2dadc05b36aaf7137db427cb59c3e60))
* **mobile:** stop contentContainerStyle silently deleting the gutter ([73eb193](https://github.com/FabioFiorita/porcelain/commit/73eb193e14299334eda8ffb51a4281589e61d9b2))
* **mobile:** stop doubling companion padding, go full-screen in terminal ([a7cb72b](https://github.com/FabioFiorita/porcelain/commit/a7cb72ba9e257e4dabcb654b07a85f940589fb9c))
* **mobile:** terminal grid math, paste, and spawn size ([577738c](https://github.com/FabioFiorita/porcelain/commit/577738c500ce5f8db167c6b912b1a6a5bc6f1f83))
* **mobile:** time out daemon HTTP calls so endpoint failover fires ([#12](https://github.com/FabioFiorita/porcelain/issues/12)) ([e39884d](https://github.com/FabioFiorita/porcelain/commit/e39884da8ce6d7be1b0007d8ff222ac93668532c))
* **mobile:** tint ghost buttons with primary in light mode ([3046b24](https://github.com/FabioFiorita/porcelain/commit/3046b24663628c6a649a5dc7fd13a0c5fe90568b))
* **mobile:** use a laptop glyph for the notebook environment icon ([f6b68a8](https://github.com/FabioFiorita/porcelain/commit/f6b68a8be15f9206ae6e4df283830e12fbbe0740))
* **review:** gate publish on visibility, widen disclosure scope ([387c943](https://github.com/FabioFiorita/porcelain/commit/387c9434b78da56145e870a6ac373178b8b91069)), closes [#14](https://github.com/FabioFiorita/porcelain/issues/14)
* **worktree:** let create --force past a dirty primary main ([acc340d](https://github.com/FabioFiorita/porcelain/commit/acc340d3a4573541593032fec92421cd37f6f438))
* **worktree:** read the repo-local active-review layout for PR bodies ([f885a2a](https://github.com/FabioFiorita/porcelain/commit/f885a2a786985208369da59f1a0d04e24c80e80b))

## [0.50.0](https://github.com/FabioFiorita/porcelain/compare/v0.49.0...v0.50.0) (2026-08-05)

### Features

* **mobile:** give Changes a real navigation stack ([8bbe410](https://github.com/FabioFiorita/porcelain/commit/8bbe410783934145052ef28fc2ccd3772dca3009))
* **mobile:** give Files a real tab ([d4290c0](https://github.com/FabioFiorita/porcelain/commit/d4290c05d8d447dc8bd4845987dca02c74805ffc))
* **mobile:** give History a real commit list and commit viewer ([5c6e7ed](https://github.com/FabioFiorita/porcelain/commit/5c6e7ed676f88b88364b57e668b549d586c3a544))
* **mobile:** give Terminal a real, live PTY surface ([bc2c222](https://github.com/FabioFiorita/porcelain/commit/bc2c222c9905d7a74f9ec532a793a7f776d1547d))
* **mobile:** render markdown and HTML, not just their source ([80a3621](https://github.com/FabioFiorita/porcelain/commit/80a3621ef6ad25ac37865c29e99bb1512b214b71))
* **settings:** give companion data its own Data tab, on every client ([3670758](https://github.com/FabioFiorita/porcelain/commit/367075891faf4bab460bae586e85bc2b29ee77a5))

### Bug Fixes

* **agents:** repair stale skill commands, and gate them ([76ffb57](https://github.com/FabioFiorita/porcelain/commit/76ffb5733afa1ecc383b4534dac7941e68ce5715))
* **cli:** let a review start Intent-first, as the skill has always said ([3fa3858](https://github.com/FabioFiorita/porcelain/commit/3fa3858f437a3d5b4ac45a8ac5dea58a86e47b6f))
* declare tiptap markdown peer ([615dcd8](https://github.com/FabioFiorita/porcelain/commit/615dcd80d9ed6d0dc3e78e82f54a846dc8791384))
* **mobile:** refresh branch refs when opening picker ([02e9ff2](https://github.com/FabioFiorita/porcelain/commit/02e9ff2f23f57bac31345b7d501c030f60866326))
* **shell:** level the search field with the titlebar chips ([c7d6a82](https://github.com/FabioFiorita/porcelain/commit/c7d6a820f4dc05d83a5fcb6fb7ee505361ca5b8c))
* **shell:** make the update chip as tall as the env chip ([8d033b1](https://github.com/FabioFiorita/porcelain/commit/8d033b10f00d17838b0e3ea3c6326af0320f3441))
* **shell:** restore the sidebar cards' top edge, and align all three ([bf13285](https://github.com/FabioFiorita/porcelain/commit/bf13285abbe371a692fc280ca290befeb1338475))

## [0.49.0](https://github.com/FabioFiorita/porcelain/compare/v0.48.0...v0.49.0) (2026-08-05)

### Features

* **actions:** don't one-click a command this machine never accepted ([0f64841](https://github.com/FabioFiorita/porcelain/commit/0f6484131c0d84880592680d359a39e7f10ac042))
* **cli:** author intent documents, and teach the skill the new shape ([1a11547](https://github.com/FabioFiorita/porcelain/commit/1a115470c0ffd8d4b6717181bf4e06f4c0925bfd))
* **companion:** choose per channel what git carries ([5b414f7](https://github.com/FabioFiorita/porcelain/commit/5b414f74c814ba7be965f25b8df7ace73267b9de))
* **companion:** open a repo without touching its git status ([c317022](https://github.com/FabioFiorita/porcelain/commit/c3170223636047bbd139d35557a1b73e2d3363c4))
* Migrate mobile shell styling to NativeWind ([2d8f4b8](https://github.com/FabioFiorita/porcelain/commit/2d8f4b84941c04823f3476a8303325af99f1e20c))
* **mobile:** add diff syntax highlighting and read-all collapse ([a1994ea](https://github.com/FabioFiorita/porcelain/commit/a1994ead10db620ab43d0cec52266780ce3176cb))
* **mobile:** add native navigation POC ([40aafdc](https://github.com/FabioFiorita/porcelain/commit/40aafdca49afbb1b0c485b27c1d90aca0585f81e))
* **mobile:** add NativeWind Reusables foundation ([2dc2c8d](https://github.com/FabioFiorita/porcelain/commit/2dc2c8d71d544a4a9554616ce7cc41b7d6c7f7cc))
* **mobile:** add tablet shell outer layer with mock chrome ([2e3e922](https://github.com/FabioFiorita/porcelain/commit/2e3e9228b93e4f4562988a3016519e6d085d5bad))
* **mobile:** build the Changes tab against the daemon ([82139f7](https://github.com/FabioFiorita/porcelain/commit/82139f78e369cb90589811c739d205713ae22122))
* **mobile:** phone chrome with five dual-face tabs ([4e99d49](https://github.com/FabioFiorita/porcelain/commit/4e99d493018683b8b581516e7b7406a9f98e02b7))
* **mobile:** restore Android and emulator control ([38ef823](https://github.com/FabioFiorita/porcelain/commit/38ef823f32c35833afa496ce88dbc52c28f6a317))
* **mobile:** select a line range to comment on ([b8deff8](https://github.com/FabioFiorita/porcelain/commit/b8deff8b080a596ccb323d773e56078336bdfed8))
* **mobile:** share UI tokens and add Reusables primitives ([312d0fc](https://github.com/FabioFiorita/porcelain/commit/312d0fc6802fd38f58fec63e8a43c5f395706829))
* **mobile:** ship real Settings (General, Review, Environments) ([febe84b](https://github.com/FabioFiorita/porcelain/commit/febe84b9f03abfb75948cf173cb0d5e5bfd373e7))
* **mobile:** syntax-highlighted file viewer with md/html modes ([ffd339e](https://github.com/FabioFiorita/porcelain/commit/ffd339e6fa67d03184c88524533c5808864792d3))
* **review:** intent as a document set, and publishing one review ([d2aec7c](https://github.com/FabioFiorita/porcelain/commit/d2aec7c25aa1d76eda117cf6458935833dfd8df3))
* **review:** publish a review as a rule, not just a staged add ([a633576](https://github.com/FabioFiorita/porcelain/commit/a633576b4018e4f85d443ba736c4b74c9bb4f15c))

### Bug Fixes

* **companion:** keep the active review out of git ([437e835](https://github.com/FabioFiorita/porcelain/commit/437e83589d59e00cf2bb8c0f99364451b7ee2b1d))
* **companion:** stop the migrate storm, untrack machine artifacts ([dd65e3a](https://github.com/FabioFiorita/porcelain/commit/dd65e3a1c273d5a120ba76b7059f06328786224b))
* Improve mobile tablet navigation and modal backdrop ([839e995](https://github.com/FabioFiorita/porcelain/commit/839e9959df18d8d28438811eda0bb86495535ebb))
* **mobile:** align layer remove action ([b75e42c](https://github.com/FabioFiorita/porcelain/commit/b75e42c3ea961046a65ea46c7e209b775218f9c5))
* **mobile:** center tablet search and drop rail settings ([a5f8e73](https://github.com/FabioFiorita/porcelain/commit/a5f8e737f97d56fe9f2ed3672787de53eba465a3))
* **mobile:** declare CSS side-effect imports ([559249b](https://github.com/FabioFiorita/porcelain/commit/559249b2461ad36352d5ad18051a4bae86f279e8))
* **mobile:** do not auto-focus Search on face toggle ([55ba36d](https://github.com/FabioFiorita/porcelain/commit/55ba36dae9d68b255c9426f83b757dccb1fef1f5))
* **mobile:** make Appearance theme work; fill tablet Settings ([76b80f5](https://github.com/FabioFiorita/porcelain/commit/76b80f5e7a9d94fd0e3ab65d8193eaff5911bd54))
* **mobile:** offset collapsed split header ([38f040b](https://github.com/FabioFiorita/porcelain/commit/38f040ba9e44c1a08426d4e48e246b883d849a49))
* **mobile:** polish project picker overlays ([b218844](https://github.com/FabioFiorita/porcelain/commit/b218844846acc26aad7e1d9d816009936bca2b98))
* **mobile:** use segmented tabs for phone Settings sections ([7f916ee](https://github.com/FabioFiorita/porcelain/commit/7f916ee4145688560a2a001559c53a050d3cf091))
* **review:** parse scenes daemon-side, contain a bad pane ([3f4486f](https://github.com/FabioFiorita/porcelain/commit/3f4486ff88a0ac9d7caa512a59aa7f9a71e7e971))
* **web:** one React for the whole graph, which fixes the canvas ([94d22f4](https://github.com/FabioFiorita/porcelain/commit/94d22f407f187066ff8af5d51f9d18b5512c5d10))

## [0.48.0](https://github.com/FabioFiorita/porcelain/compare/v0.47.3...v0.48.0) (2026-08-04)

### Features

* **mobile:** dock terminal key bar to the keyboard, theme chrome ([1c92f75](https://github.com/FabioFiorita/porcelain/commit/1c92f75f0fa52df7a9078cabb56741d2ddd83b40)), closes [#16161a](https://github.com/FabioFiorita/porcelain/issues/16161a)
* **mobile:** native search bar on the Files search face ([8e0c68f](https://github.com/FabioFiorita/porcelain/commit/8e0c68f4a9fb993444477d1fafa1663a26af5622))
* **mobile:** render every path list on the diff's row canvas ([1fcb48c](https://github.com/FabioFiorita/porcelain/commit/1fcb48c01bd3f42bc8bb0711707191c57d353815))

### Bug Fixes

* make commit generation work on every model provider ([bd6b39e](https://github.com/FabioFiorita/porcelain/commit/bd6b39e1b882cb5ba8ae76b32299949a2d786779))
* **mobile:** make Kill take effect, swipe Rename and Kill ([64deaff](https://github.com/FabioFiorita/porcelain/commit/64deaff4e13649f06925263393fc968de1fcd73f))
* **mobile:** render prompt glyphs in the terminal ([ac465bb](https://github.com/FabioFiorita/porcelain/commit/ac465bb69f8e21f159fa1596f26e3ee74e85f785))
* **mobile:** restore the Files bolt, and the Codex findings under it ([b6c14f4](https://github.com/FabioFiorita/porcelain/commit/b6c14f47284f679577ea87556302cbe753423dbe))

## [0.47.3](https://github.com/FabioFiorita/porcelain/compare/v0.47.2...v0.47.3) (2026-08-03)

### Bug Fixes

* black Mac renderer, companion migrate, commit models, Changes ([46f4f6e](https://github.com/FabioFiorita/porcelain/commit/46f4f6e1349162c26296e0664b0b80f2da294047))

## [0.47.2](https://github.com/FabioFiorita/porcelain/compare/v0.47.1...v0.47.2) (2026-08-03)

### Features

* generate commit messages and groups ([de48850](https://github.com/FabioFiorita/porcelain/commit/de48850fa6f2721f7c0ff048b1aaab4f60d632eb))

## [0.47.1](https://github.com/FabioFiorita/porcelain/compare/v0.47.0...v0.47.1) (2026-08-03)

### Bug Fixes

* **daemon:** do not mkdir missing repo roots when watching ([e14e3e2](https://github.com/FabioFiorita/porcelain/commit/e14e3e26c165952371769a740237ad50c49d0c5a))

## [0.47.0](https://github.com/FabioFiorita/porcelain/compare/v0.46.3...v0.47.0) (2026-08-03)

### Features

* **client-runtime:** session protocol, word-diff; close arch program ([42647e3](https://github.com/FabioFiorita/porcelain/commit/42647e3985fed2a2cb3d671495db03a4ecb2fda5))
* **client-runtime:** share terminal-keys between web and mobile ([d06514e](https://github.com/FabioFiorita/porcelain/commit/d06514e509f74b5204624d8381ca0faaec901543))
* **contracts:** full procedure catalog and drop apps import ([2ee0610](https://github.com/FabioFiorita/porcelain/commit/2ee0610fd68e0b6c8e8a297bcdcd798d36e643be))
* **mobile:** Files dual-face Search with keyboard on re-tap ([5e3f910](https://github.com/FabioFiorita/porcelain/commit/5e3f91077d30ba42bf5c6e934e9a922804eff094))
* **mobile:** reconstruct shell for phone companion + iPad workstation ([5291b70](https://github.com/FabioFiorita/porcelain/commit/5291b70d850e99f2afb9e45e84a03119653a0d9e))
* repo-local .porcelain companion store with review archive ([f5e07bd](https://github.com/FabioFiorita/porcelain/commit/f5e07bda7623ae021679d4b3686c22ebf53cc9e5))

### Bug Fixes

* **daemon:** unwrap ESM trash default after CJS esbuild ([c5a4ab1](https://github.com/FabioFiorita/porcelain/commit/c5a4ab1b9c6a394717d1f77ba5575e5527a8941f))
* **mobile:** bolt companion icon and per-surface companion content ([2a8ad90](https://github.com/FabioFiorita/porcelain/commit/2a8ad905ee08fd0b57d812436f70801ed0ba11ef))
* **mobile:** dispatch EAS delivery instead of running it on every commit ([01e0102](https://github.com/FabioFiorita/porcelain/commit/01e0102c791d3a949d758214c808ce860bfce62f))
* **mobile:** do not use Stack.Toolbar in iPad companion inspector ([467589d](https://github.com/FabioFiorita/porcelain/commit/467589d1808b3cfa36711db1ee9b0c9c3f88616a))
* **mobile:** dual-face tabs without push/back or sheet reset ([ffeead5](https://github.com/FabioFiorita/porcelain/commit/ffeead58c2a3efdf52c696ca80132af9099cd57c))
* **mobile:** host the card delete dialog inside its SwiftUI tree ([54235be](https://github.com/FabioFiorita/porcelain/commit/54235be749df429643b87648b048b1979996bea9))
* **mobile:** iPad SplitView list|detail for Changes, Files, History ([23025ec](https://github.com/FabioFiorita/porcelain/commit/23025ec89e93ca164b6cec8b728c5cd1046bcff1))
* **mobile:** restore Files list and Done exit from Search face ([f64d906](https://github.com/FabioFiorita/porcelain/commit/f64d906d9c5e29082e6c4ae547f8d748579e7701))
* **mobile:** Search stays as tab face; pin query field above results ([44a8ab3](https://github.com/FabioFiorita/porcelain/commit/44a8ab3f92dff037d82107f57b855841d9c91abf))
* **release:** sync all packages to desktop bump stamp ([a825a15](https://github.com/FabioFiorita/porcelain/commit/a825a15482aab3d6e5e07dc8af838c75aa553283))

## [0.46.3](https://github.com/FabioFiorita/porcelain/compare/v0.46.2...v0.46.3) (2026-08-02)

### Features

* **mobile:** add daemon terminal surface ([8b25277](https://github.com/FabioFiorita/porcelain/commit/8b25277280ab66e1f7ccf990f661bc86601e7bcf))
* **mobile:** add files browser ([e27f25b](https://github.com/FabioFiorita/porcelain/commit/e27f25b1e04bea9a0b40909fcbf8ebb955706363))
* **mobile:** add review and board surfaces ([eff34d2](https://github.com/FabioFiorita/porcelain/commit/eff34d216dae29a273dc8cbc02716692b50ec7b3))
* **mobile:** complete changes history workspace flow ([f456b23](https://github.com/FabioFiorita/porcelain/commit/f456b23fa85ebe3fb2771a1469fc08b24c606f06))

## [0.46.2](https://github.com/FabioFiorita/porcelain/compare/v0.46.1...v0.46.2) (2026-08-02)

### Features

* **mobile:** adapt Changes for iPad ([bf429dc](https://github.com/FabioFiorita/porcelain/commit/bf429dc731a5870a983e3d24738ed09256856d14))
* **mobile:** add remote simulator dev runner ([0885fcd](https://github.com/FabioFiorita/porcelain/commit/0885fcdb2aa051e281b32f24da5edb5584cacfe4))
* **mobile:** native core — generic row canvas, shiki, plan-named deps ([77bd653](https://github.com/FabioFiorita/porcelain/commit/77bd6537b7142fe530164c6e33d9117994147540))
* **mobile:** refine iPhone shell and Changes UI ([6446ea8](https://github.com/FabioFiorita/porcelain/commit/6446ea81c8dbdf8295178627d523bd936992a802))
* **review:** collapse files in continuous diffs ([aa6aa99](https://github.com/FabioFiorita/porcelain/commit/aa6aa99ae2a2370f86d5391a2397ac0a4ef0c386))

### Bug Fixes

* **mobile:** configure EAS delivery profiles ([bb70fee](https://github.com/FabioFiorita/porcelain/commit/bb70fee49db1251412f79d0b54b249c63bf503ee))
* **mobile:** refine native link rows and history ([37366a2](https://github.com/FabioFiorita/porcelain/commit/37366a2fc4b7b8ccf4daca8d48484ba1e7efe5eb))
* **review:** fit diff controls in file headers ([df28d21](https://github.com/FabioFiorita/porcelain/commit/df28d21b826e5070fb7c4c3319bdb4f582aa3ed0))

### Reverts

* Revert "chore(mobile): release 0.1.1" ([8fba1d3](https://github.com/FabioFiorita/porcelain/commit/8fba1d38738d141c4497828dfdfa917bd2e51523))

## [0.46.1](https://github.com/FabioFiorita/porcelain/compare/v0.46.0...v0.46.1) (2026-08-01)

### Features

* group environment connections ([78f8687](https://github.com/FabioFiorita/porcelain/commit/78f86877ee73fb57ba6717114ab366a121ca8a8b))
* **mobile:** Changes tab end-to-end on the daemon seam ([2c4631f](https://github.com/FabioFiorita/porcelain/commit/2c4631f7c73f44248fa6e08202b7bee68f74d521))
* **mobile:** daemon connection seam per plan 00 ([f0bc4c8](https://github.com/FabioFiorita/porcelain/commit/f0bc4c89a777d59ee32c42e3c4ffa7c845bbdaf3))
* **mobile:** left-align titles and inline the settings surface ([d83f2d6](https://github.com/FabioFiorita/porcelain/commit/d83f2d64e91a7c6f6254ceb48f21c16e204fb27a))
* **mobile:** nest Project and Environment in the header context menu ([756cf05](https://github.com/FabioFiorita/porcelain/commit/756cf05f69ae1197f907ec8575243ad0ec91aedd))
* **mobile:** promote Board to its own tab ([747659a](https://github.com/FabioFiorita/porcelain/commit/747659a5d0b4102895abd792d8cdee68c65079b9))

### Bug Fixes

* complete environment group recovery ([ec2618f](https://github.com/FabioFiorita/porcelain/commit/ec2618f688b82e4dd1a3bbadce7b94e4051fcd51))
* **mobile:** give History a toolbar, unfold Settings to a button ([5897af9](https://github.com/FabioFiorita/porcelain/commit/5897af9047d2dba9bc42d33b8aa0b7720109ff98))
* **mobile:** put the companion button on the right edge of the header ([878ab90](https://github.com/FabioFiorita/porcelain/commit/878ab9011ad9fed99366f20a69e3c1c501adbac5))
* **review:** improve mobile HTML previews and evidence styles ([2d00c4e](https://github.com/FabioFiorita/porcelain/commit/2d00c4e9812fb63689866ba8a8b7a08279f8efef))

## [0.46.0](https://github.com/FabioFiorita/porcelain/compare/v0.45.3...v0.46.0) (2026-08-01)

### Features

* **dev:** add managed worktree lifecycle ([64672e4](https://github.com/FabioFiorita/porcelain/commit/64672e47874eb9ba555847c29c1d0402a31261ac))
* **lint:** ratchet the limits instead of cutting them again ([aaeab91](https://github.com/FabioFiorita/porcelain/commit/aaeab9127654fd42d2b57bac809deb167804f67b))
* **mobile:** 4-tab native shell, EAS preview pipeline, mobile lint gate ([b6e0d93](https://github.com/FabioFiorita/porcelain/commit/b6e0d938dd608162a9550955bb7507d8bcdc6997))
* **mobile:** adapt tabs to iPad; fingerprint-decided EAS delivery ([a70b93d](https://github.com/FabioFiorita/porcelain/commit/a70b93d83da6e9ba8be7f4e82069fba2c4b6a3c1))
* **mobile:** scaffold Expo native client ([1d77161](https://github.com/FabioFiorita/porcelain/commit/1d7716169d0715447a274409a87bf0e39bc2347a))
* **mobile:** wire EAS Observe launch metrics ([f3aaee6](https://github.com/FabioFiorita/porcelain/commit/f3aaee69b0a5d05ccd7358ab28138e55e3667042))
* **renderer:** optimistic writes on the board and comment channels ([b4cea91](https://github.com/FabioFiorita/porcelain/commit/b4cea91765e19fd2b3d64224fe3b4365b8c4081f))
* **worktrees:** main-first flow, harness cooperation, worktree-aware app ([c7d3a44](https://github.com/FabioFiorita/porcelain/commit/c7d3a4452db9e164549ea0da68e59265d7a9d68b))

### Bug Fixes

* **daemon:** bound unwatched terminal sessions ([0a36464](https://github.com/FabioFiorita/porcelain/commit/0a3646423f942c2df7949acef26f54d3451fd0b2))
* **daemon:** filter the LAN bind by interface, not just address range ([70798bb](https://github.com/FabioFiorita/porcelain/commit/70798bbd51500fbce63e3120f3e7bb6fe3f59c7e))
* **git:** keep cwd authoritative for every spawned git ([6598c49](https://github.com/FabioFiorita/porcelain/commit/6598c49e186516d338d87fe2772b8e7f16b51466))
* **mobile:** cut plan narrative from preview.yml and README ([ac65635](https://github.com/FabioFiorita/porcelain/commit/ac656355f312e61156c10892b76d0dd8ef56eca4))
* **mobile:** drop invalid generic args on require() in toolbar-icon ([8326008](https://github.com/FabioFiorita/porcelain/commit/83260084d0390168ddd0fa2ec183e5d20d6fb83c))
* **mobile:** free-plan delivery — submit, not testflight ([f6a35d6](https://github.com/FabioFiorita/porcelain/commit/f6a35d643286d9582abbfa591a2f21ab21455b30))
* **mobile:** plain button style on Settings rows ([0e4eb5e](https://github.com/FabioFiorita/porcelain/commit/0e4eb5e8189bdca0eb07397f3ec326cd15f9bbd6))
* **mobile:** rasterize Android toolbar icons from a vector icon set ([48519e9](https://github.com/FabioFiorita/porcelain/commit/48519e9e325ed72c31a8fa3f8154f310c4dd0796))
* **mobile:** render header toolbar buttons on Android ([a780494](https://github.com/FabioFiorita/porcelain/commit/a780494e92d6be6ee5a2a07d39ae01284886f3c2))
* **mobile:** set ios.supportsTablet — iPad ran in iPhone compat mode ([f3fb0b7](https://github.com/FabioFiorita/porcelain/commit/f3fb0b7c2aa458c0612d17421488d64770a5c88e))
* **renderer:** stop writing refs during render ([78d25ba](https://github.com/FabioFiorita/porcelain/commit/78d25ba91e8aa50ab65adfa559002f69b2917fa7))
* **worktrees:** scrub repo-local git env, fence the debris prune ([4123e25](https://github.com/FabioFiorita/porcelain/commit/4123e25ad880914d3d54b5bc537cd11df3e4ebc4))

## [0.45.3](https://github.com/FabioFiorita/porcelain/compare/v0.45.2...v0.45.3) (2026-07-29)

### Bug Fixes

* compress and cache remote assets ([3999b71](https://github.com/FabioFiorita/porcelain/commit/3999b711a30bde6afe2e22a135c5bc1f6053328e))

## [0.45.2](https://github.com/FabioFiorita/porcelain/compare/v0.45.1...v0.45.2) (2026-07-29)

### Bug Fixes

* restore mobile remote usability ([4bbdf93](https://github.com/FabioFiorita/porcelain/commit/4bbdf932d46af981028f29f2659b253921e38e5f))

## [0.45.1](https://github.com/FabioFiorita/porcelain/compare/v0.45.0...v0.45.1) (2026-07-29)

### Bug Fixes

* restore browser pairing and npm release checks ([1a6c5e3](https://github.com/FabioFiorita/porcelain/commit/1a6c5e37556830eaccc2a26a80ce4a339e48a49c))

## [0.45.0](https://github.com/FabioFiorita/porcelain/compare/v0.44.0...v0.45.0) (2026-07-29)

### Features

* add per-device remote access ([d377b93](https://github.com/FabioFiorita/porcelain/commit/d377b939a04185b78d855524a8094a0ca0c874cb))

### Bug Fixes

* **marketing:** restore mobile page gutters ([f173424](https://github.com/FabioFiorita/porcelain/commit/f1734247dffeae53b8b02fb9e93e908ccecebabc))

## [0.44.0](https://github.com/FabioFiorita/porcelain/compare/v0.43.7...v0.44.0) (2026-07-28)

### Features

* agent-shaped starter flow layers with dismissible setup tips ([2f86b3c](https://github.com/FabioFiorita/porcelain/commit/2f86b3c772f998dd168bf6f31f4f8c6b9c036b5b))

### Bug Fixes

* **release:** drop CI npm unpublish; wait longer and re-run same tag ([f1d649a](https://github.com/FabioFiorita/porcelain/commit/f1d649aec4795aaf7765f03beb0dc30e53540e5e))
* **review:** show only agent-declared files in Execution ([5f32ebd](https://github.com/FabioFiorita/porcelain/commit/5f32ebd97e15cc1c84f29116573382d26abb6eda))
* **settings:** tighten Remotes layout, type scale, and Share copy ([ae3dc51](https://github.com/FabioFiorita/porcelain/commit/ae3dc5130cae70fdf98ce150054751d90a64239b))
* **share:** show the real daemon token path for this host ([aefc3c7](https://github.com/FabioFiorita/porcelain/commit/aefc3c761032092b3125d7a17a63a59c9f25dc44))
* **shots:** clean modal crops for search and comment ([4cba009](https://github.com/FabioFiorita/porcelain/commit/4cba009b63e7612aa0139c48769c3ed460cc40b1))
* **shots:** demo repo basename northwind-orders ([3b2b037](https://github.com/FabioFiorita/porcelain/commit/3b2b037f36a3e93841c12dc5bde19f53551211ea))

## [0.43.7](https://github.com/FabioFiorita/porcelain/compare/v0.43.6...v0.43.7) (2026-07-28)

### Features

* **review:** make Review the start → end home for a unit of work ([d2ad4be](https://github.com/FabioFiorita/porcelain/commit/d2ad4be0f7766f1068058a90081a8a6693eb7660))
* **scope:** CLI hide/pin channel, Explore affordances, dual-machine gate ([1b6c88e](https://github.com/FabioFiorita/porcelain/commit/1b6c88e3b14c814c0775dfabf912cf9463155ddf))

### Bug Fixes

* **release:** unpublish broken npm versions so latest stays downloadable ([cd9171a](https://github.com/FabioFiorita/porcelain/commit/cd9171a2271b4df3da4a8a2e522a5807fd0f234d))
* **ui:** phone Settings layout, Clear review rail, richer Glance ([ba9b448](https://github.com/FabioFiorita/porcelain/commit/ba9b448139d339f0b3a88c7915ede54925273e8b))

## [0.43.6](https://github.com/FabioFiorita/porcelain/compare/v0.43.5...v0.43.6) (2026-07-27)

### Bug Fixes

* **daemon:** CLI install layout + verify npm tarball after publish ([7f193f4](https://github.com/FabioFiorita/porcelain/commit/7f193f4c68ea3fedad955c468227d1ed26ecdcb9))
* **terminal:** SGR wheel bytes for Claude touch scroll ([1bd5bcf](https://github.com/FabioFiorita/porcelain/commit/1bd5bcfae7b4d9efd2cd30fc71d1d628fda28768))

## [0.43.5](https://github.com/FabioFiorita/porcelain/compare/v0.43.4...v0.43.5) (2026-07-27)

### Bug Fixes

* **terminal:** typecheck touch-scroll unit tests ([e9aee83](https://github.com/FabioFiorita/porcelain/commit/e9aee833b70e7b8335cba4f06f49959c4ef56f47))

## [0.43.4](https://github.com/FabioFiorita/porcelain/compare/v0.43.3...v0.43.4) (2026-07-27)

### Bug Fixes

* **terminal:** stop sending arrow keys for touch scroll ([7b99648](https://github.com/FabioFiorita/porcelain/commit/7b99648d179b5d63750ad37992e52561995e8401))

## [0.43.3](https://github.com/FabioFiorita/porcelain/compare/v0.43.2...v0.43.3) (2026-07-27)

### Bug Fixes

* **terminal:** make finger pan scroll work on iPhone/iPad ([b11d0a3](https://github.com/FabioFiorita/porcelain/commit/b11d0a357fc3b3941e0d57ad754ea808c0e5777f))

## [0.43.2](https://github.com/FabioFiorita/porcelain/compare/v0.43.1...v0.43.2) (2026-07-27)

### Features

* **terminal:** floating Copy chip on selection ([0777ddc](https://github.com/FabioFiorita/porcelain/commit/0777ddca0daa0496669277d87f289ed47cc8e8ca))

### Bug Fixes

* **terminal:** honor OSC 52 so remote Claude Code copy works ([4dc26e6](https://github.com/FabioFiorita/porcelain/commit/4dc26e62ab0b89d729ae2cf7d8e1e8351595c6b8))

## [0.43.1](https://github.com/FabioFiorita/porcelain/compare/v0.43.0...v0.43.1) (2026-07-27)

### Bug Fixes

* **release:** don't trim null stdout when stdio is inherit ([b24b74a](https://github.com/FabioFiorita/porcelain/commit/b24b74a3338cfef018dd025b7412a7a5a3d1eefc))
* **shell:** move Update button into the window titlebar ([ea4f9a3](https://github.com/FabioFiorita/porcelain/commit/ea4f9a382aedf04e5ac7ac7ad9d47649e94eb3e9))
* **shell:** polish titlebar Update chip to match env control ([22e26ca](https://github.com/FabioFiorita/porcelain/commit/22e26ca672b6ccb40cdabcc7721403119a021c37))
* **terminal,shell:** iPad key bar + env detail alignment ([e997e50](https://github.com/FabioFiorita/porcelain/commit/e997e50ce4371bb3e2244131bfac322e0eef9011))

## [0.43.0](https://github.com/FabioFiorita/porcelain/compare/v0.42.3...v0.43.0) (2026-07-27)

### Features

* **daemon:** LAN/tailnet share uses the same configurable port ([6e190ec](https://github.com/FabioFiorita/porcelain/commit/6e190ec40b9c5228f4be53defe9f038355732089))
* **terminal:** dual-machine actions and header local-path control ([817c564](https://github.com/FabioFiorita/porcelain/commit/817c56467e212f08ced24203f33c2d6678dfa3f0))
* **terminal:** let users change the This device folder mapping ([5f4bfc8](https://github.com/FabioFiorita/porcelain/commit/5f4bfc85933b84ae0629b4a6992a4d717120b469))

### Bug Fixes

* **dev:** mint and pass daemon token for interactive dev:daemon ([e409cad](https://github.com/FabioFiorita/porcelain/commit/e409cad4518a477e5c6f1753bb1336ef0f491e08))
* **dev:** real flags, port-in-use help, and clarify dev vs published daemon ([2f5eab7](https://github.com/FabioFiorita/porcelain/commit/2f5eab7dc5be9995069ccc2747d176a3676548c3))
* **review:** clear evidence fully and stop stale Intent boards ([9471825](https://github.com/FabioFiorita/porcelain/commit/9471825412ad1e75e2c752f91700c7f0c1523b67))
* **shell:** center titlebar search and compact env chip on phone ([88a35bd](https://github.com/FabioFiorita/porcelain/commit/88a35bdcabf6dd2eaef407c52e9fc13d159dae24))
* **terminal:** stop closed sessions from resurfacing as EXITED ([e8b5b23](https://github.com/FabioFiorita/porcelain/commit/e8b5b235685d83bbedb1a1030cfc24bd73eb4d17))
* **ui:** system theme, Companion tab, live lists, env menu polish ([e048eb6](https://github.com/FabioFiorita/porcelain/commit/e048eb6387770903b668b3c33eeb4bb827b20657))

## [0.42.3](https://github.com/FabioFiorita/porcelain/compare/v0.42.2...v0.42.3) (2026-07-27)

### Bug Fixes

* **environments:** label This device from the local probe, not the bound daemon ([e846c5c](https://github.com/FabioFiorita/porcelain/commit/e846c5c317f3ec3ad7a451fd359eafc2c7707011))

## [0.42.2](https://github.com/FabioFiorita/porcelain/compare/v0.42.1...v0.42.2) (2026-07-27)

## [0.42.1](https://github.com/FabioFiorita/porcelain/compare/v0.42.0...v0.42.1) (2026-07-27)

## [0.42.0](https://github.com/FabioFiorita/porcelain/compare/v0.41.0...v0.42.0) (2026-07-27)

Porcelain is now **the review layer for agentic coding**: your agents run in your
terminal, Porcelain is where you review what they built. Three things were removed
to get there. (Conventional Commits only surfaces `feat`/`fix` below, so the
headline of this release is written out here.)

### Removed

* **The in-app agent runner.** The Agent tab, agent threads, the four provider
  drivers, and Settings → Agents are gone. Run Claude Code, Codex, OpenCode, Grok
  or anything else in the embedded terminal (or any other terminal) — they publish
  the same Review through the bundled `porcelain` CLI, so the Review inbox works
  exactly as before. Existing thread transcripts in `~/.porcelain/agent-threads/`
  are left on disk untouched.
* **The agent chat relay.** The Relay tab, agent-to-agent messages, and file claims.
  Coordinating parallel agents is not a problem Porcelain claims to solve.
* **The Linux desktop app.** The unsigned AppImage/deb build is no longer produced.
  **Linux is not dropped** — it stays first-class as a *daemon host*
  (`npx porcelain-daemon@latest serve`, published to npm as usual), with any
  browser as its seat. Only the desktop package went.

The sidebar is now 7 tabs (Files, Changes, Review, History, Search, Board,
Terminal); ⌘1–7 renumber accordingly, and a last-open Agent or Relay tab reopens
on Files. The `npx skills add` / `upgrade` commands moved to Settings → General →
Companion.

### Bug Fixes

* **pairing:** mint links against the numeric address, not the .local name ([397c78c](https://github.com/FabioFiorita/porcelain/commit/397c78c34cc97874acfb1e5254841bd5a0558811))
* **terminal:** show the key bar on touch devices only ([067c9ec](https://github.com/FabioFiorita/porcelain/commit/067c9ecba1f5240e27902bea6be6d83e1ae79740))

## [0.41.0](https://github.com/FabioFiorita/porcelain/compare/v0.40.0...v0.41.0) (2026-07-27)

### Features

* **browser-client:** serve an app icon for iOS bookmarks and home screen ([ca6f7ef](https://github.com/FabioFiorita/porcelain/commit/ca6f7ef2438db232138c9f405685dce60030106c))
* **devices:** per-device credentials, a live roster, and per-device revoke ([17b303e](https://github.com/FabioFiorita/porcelain/commit/17b303ea05d6f54bb298f708f1850eff2901a940))
* **environments:** many endpoints per machine, with preference-ordered failover ([2a15165](https://github.com/FabioFiorita/porcelain/commit/2a15165a5dec128d491e11fe9aa48dcb57b58eb7))
* **environments:** report daemon identity and make the top-bar chip the switcher ([2eb2569](https://github.com/FabioFiorita/porcelain/commit/2eb2569cd2ac24dba6ad06647d5b74ac786afefe))
* **pairing:** pairing link + QR, browser auto-pair, and paste-to-add ([1266020](https://github.com/FabioFiorita/porcelain/commit/1266020a928c54bf72df4fa0239903ed4818801e))
* **pairing:** short-lived pairing codes and a guarded POST /pair exchange ([54172d4](https://github.com/FabioFiorita/porcelain/commit/54172d4cdc44e572ef3af3cd781a03e816db20cd))
* **terminal:** a key bar on every pane, and no keyboard until you ask for it ([d071659](https://github.com/FabioFiorita/porcelain/commit/d071659c49194ba92848bca1096df966d3711fa0))
* **terminal:** run a shell on this device while the window works on another ([89b3926](https://github.com/FabioFiorita/porcelain/commit/89b3926f8cbe34d765b8a73200bec8d7669e95f5))

### Bug Fixes

* **ci:** do not use isLatest in gh release view JSON ([d2e520c](https://github.com/FabioFiorita/porcelain/commit/d2e520c44d40e86c8e1935ce2d4b408c1a63b602))
* **ci:** npm_only recovery path + trim gh output in publish ([e740160](https://github.com/FabioFiorita/porcelain/commit/e740160e433488144b83f0149d3ff4ee2be751c6))
* **ci:** run publish scripts from workflow SHA on tag retry ([0b72b20](https://github.com/FabioFiorita/porcelain/commit/0b72b201fbe921e4ece9fbf2a3cf468ee19acdd5))
* **ci:** trim gh stdout in release-publish ([3c7d3e2](https://github.com/FabioFiorita/porcelain/commit/3c7d3e2dc0735377c551914893f6457d88d440b6))

## [0.40.0](https://github.com/FabioFiorita/porcelain/compare/v0.39.5...v0.40.0) (2026-07-24)

### Features

* **agent:** render local markdown images in the timeline ([6f83227](https://github.com/FabioFiorita/porcelain/commit/6f83227c705a6db9c0d9ce52828c40ed83703ad4))
* **agents:** add Claude Opus 5 to the model picker catalog ([d23186d](https://github.com/FabioFiorita/porcelain/commit/d23186d871ff4cb571647b4928716ad19007b20e))
* **board:** Focus companion shows selected card detail ([412f3ad](https://github.com/FabioFiorita/porcelain/commit/412f3add4bc082bd18a7cf7f2fb99e58aa8537c3))
* **ci:** gate-then-cut releases with atomic multi-platform publish ([2bc91e1](https://github.com/FabioFiorita/porcelain/commit/2bc91e166ac89be73e9fd98fa89a790946af4d06))

### Bug Fixes

* **agents:** keep Claude process across turns, per-repo defaults, Active roster ([4a72b5a](https://github.com/FabioFiorita/porcelain/commit/4a72b5a5da4c8911f70f2ad1ba2281ce677dfcb8))
* **board:** Focus status icons match label size; Delete is red ([4343dc4](https://github.com/FabioFiorita/porcelain/commit/4343dc44ca6d7606e5354d35a9915dd81ed263b6))
* **ci:** strip color from gh JSON in release:check ([47fff1f](https://github.com/FabioFiorita/porcelain/commit/47fff1f5533d7ccbb5853419be0d2a9c25a891cc))
* seed dev playground under ~/code, not ~/Code ([d7a75e1](https://github.com/FabioFiorita/porcelain/commit/d7a75e1d2c702e5503624c5f11fd3c21fea22780))
* **ui:** denser flow-layers Pattern Builder type scale ([ee978f7](https://github.com/FabioFiorita/porcelain/commit/ee978f7fbff5e250222769ae1629cd9558545178))

## [0.39.5](https://github.com/FabioFiorita/porcelain/compare/v0.39.4...v0.39.5) (2026-07-23)

### Bug Fixes

* **e2e:** look for idle agent threads under Recent ([b178459](https://github.com/FabioFiorita/porcelain/commit/b178459d000b9bbc1a48f0af391e8db8fb567ee6))

## [0.39.4](https://github.com/FabioFiorita/porcelain/compare/v0.39.3...v0.39.4) (2026-07-23)

### Features

* remove provider usage limits from the Agent panel ([a7a7836](https://github.com/FabioFiorita/porcelain/commit/a7a7836732bccd00d44ff6c825bcef271b36530a))

### Bug Fixes

* **agent:** Active is live-only; hide archived from Glance ([8b3141d](https://github.com/FabioFiorita/porcelain/commit/8b3141d272858ffd35d55fde3d0161ce6782a129))

## [0.39.3](https://github.com/FabioFiorita/porcelain/compare/v0.39.2...v0.39.3) (2026-07-22)

### Bug Fixes

* keep code visible under open comment tint ([ef766c2](https://github.com/FabioFiorita/porcelain/commit/ef766c27abe39b43cdfb3176686e66fceade2a31))

## [0.39.2](https://github.com/FabioFiorita/porcelain/compare/v0.39.1...v0.39.2) (2026-07-22)

### Bug Fixes

* **agents:** block CI babysit in headless Agent-tab turns ([004d6da](https://github.com/FabioFiorita/porcelain/commit/004d6da9e1230fe11fc0eb481c7cf9c8a50ec275))
* **evidence:** show too-large instead of cleared when over 4 MB cap ([4d7865b](https://github.com/FabioFiorita/porcelain/commit/4d7865bb0c0a97b45bc72fd2d2696db62703848d))

## [0.39.1](https://github.com/FabioFiorita/porcelain/compare/v0.39.0...v0.39.1) (2026-07-21)

### Features

* **skills:** consolidate companion skills into porcelain-companion ([63a38db](https://github.com/FabioFiorita/porcelain/commit/63a38db43546ec057b8b6fd2d9ea6cbdd3e3474a))

### Bug Fixes

* **e2e:** declare __porcelainSetTerminalFontSize on Window ([4b58d3c](https://github.com/FabioFiorita/porcelain/commit/4b58d3c185d04a47dc603e57f0a81b801a0c3250))

## [0.39.0](https://github.com/FabioFiorita/porcelain/compare/v0.38.2...v0.39.0) (2026-07-21)

### Features

* **feature:** Intent / Execution / Evidence Review canvas ([411baa3](https://github.com/FabioFiorita/porcelain/commit/411baa33859bf05c682564b4876e5079e2968d27))
* **ui:** Review ship handoff, inbox cues, pin language ([0d0d4b2](https://github.com/FabioFiorita/porcelain/commit/0d0d4b229f0c62e47e835924a565131718e23d6c))
* **viewer:** syntax-highlight .env files ([e5b38e0](https://github.com/FabioFiorita/porcelain/commit/e5b38e09bc3abdaf58db9648502c55b05e242a78))

### Bug Fixes

* **feature:** move Review tab questions to hover tooltips ([8aabfd1](https://github.com/FabioFiorita/porcelain/commit/8aabfd1984d5d34a4acd39adaa55d26f8b3dee6e))
* **feature:** sidebar opens Review; no duplicate canvas tabs ([88d5768](https://github.com/FabioFiorita/porcelain/commit/88d5768e23eb63b1de115d359fa81c92306d22c5))
* **ui:** keep destructive menu items red ([4f8da71](https://github.com/FabioFiorita/porcelain/commit/4f8da710df33de6c40199a0acb7ab895aaf4fd90))

## [0.38.2](https://github.com/FabioFiorita/porcelain/compare/v0.38.1...v0.38.2) (2026-07-21)

### Bug Fixes

* **agent:** biome format for turn-fold stay-visible changes ([3c0a684](https://github.com/FabioFiorita/porcelain/commit/3c0a684c1f191033ece13d0f5011df319f0054b2))

## [0.38.1](https://github.com/FabioFiorita/porcelain/compare/v0.38.0...v0.38.1) (2026-07-21)

### Bug Fixes

* **agent:** keep plan and approvals outside turn folds ([dc01828](https://github.com/FabioFiorita/porcelain/commit/dc0182804ebae512753e7b8a3d9ee4b709d2b4f3))

## [0.38.0](https://github.com/FabioFiorita/porcelain/compare/v0.37.1...v0.38.0) (2026-07-21)

### Features

* **agent:** connected turn folds, changed-files preview, handoffs ([a3263e6](https://github.com/FabioFiorita/porcelain/commit/a3263e68b129343c6fe0097a2e7d610adb48127e))

## [0.37.1](https://github.com/FabioFiorita/porcelain/compare/v0.37.0...v0.37.1) (2026-07-20)

### Bug Fixes

* **e2e:** align smoke/visual/agent with Review rail and Glance home ([7ed1a74](https://github.com/FabioFiorita/porcelain/commit/7ed1a74d19bc4e377618e635eef56a0cd02a2f6f))

## [0.37.0](https://github.com/FabioFiorita/porcelain/compare/v0.36.1...v0.37.0) (2026-07-20)

### Features

* ship agent/review UX batch (P1–P5, P7) ([bb77665](https://github.com/FabioFiorita/porcelain/commit/bb776656c4e829ed12dd2bb8414161b4ad21e0b3))
* UI/UX waves A–C — loop handoffs, naming, Glance home ([81c88b6](https://github.com/FabioFiorita/porcelain/commit/81c88b632cc4eccffcf3233865448bdc99d4cf16))

### Bug Fixes

* env switch, Feature Clear orphans, rail order, Agent session ([1c7cadc](https://github.com/FabioFiorita/porcelain/commit/1c7cadca6b74612950c6cdd9b08ca57e66d153ac))

## [0.36.1](https://github.com/FabioFiorita/porcelain/compare/v0.36.0...v0.36.1) (2026-07-20)

### Bug Fixes

* **agent:** keep Grok context after Stop by pre-minting session id ([dc82db5](https://github.com/FabioFiorita/porcelain/commit/dc82db565de2c75ea3c613cd912db2fc01848780))

## [0.36.0](https://github.com/FabioFiorita/porcelain/compare/v0.35.2...v0.36.0) (2026-07-20)

### Features

* Excalidraw dual medium for Review Overview and Loop evidence ([9451551](https://github.com/FabioFiorita/porcelain/commit/94515518a189a3c1b962691691682f960d030581))
* Review canvas — tabbed Overview | Loop evidence + changed-line highlights ([2bb07e3](https://github.com/FabioFiorita/porcelain/commit/2bb07e38ef0060e11adbb62a7c44d9b5891a2ef3))

## [0.35.2](https://github.com/FabioFiorita/porcelain/compare/v0.35.1...v0.35.2) (2026-07-20)

### Bug Fixes

* drop the duplicate Push button under Commit ([c9c95f8](https://github.com/FabioFiorita/porcelain/commit/c9c95f86e3e9d58437535dd8ce06183f574254d2))
* drop the titlebar hairline that doubled under the search bar ([fb717d8](https://github.com/FabioFiorita/porcelain/commit/fb717d85adb61fac9259db5c7a34c70e00fb8798))
* forward Agent-tab images through the Grok headless driver ([0222b22](https://github.com/FabioFiorita/porcelain/commit/0222b22218b6f3f2e71f99729d031c23e30edf14))
* preview images in the viewer instead of dumping PNG bytes as text ([b3670e3](https://github.com/FabioFiorita/porcelain/commit/b3670e33559bd42c36548654447f04a055c1d7cc))

## [0.35.1](https://github.com/FabioFiorita/porcelain/compare/v0.35.0...v0.35.1) (2026-07-20)

### Bug Fixes

* drop the titlebar repo-identity button — the rail avatar is the one project-switcher trigger ([f4ccedd](https://github.com/FabioFiorita/porcelain/commit/f4ccedd3daf09f5a4136afedf4089c018c3a672f))

## [0.35.0](https://github.com/FabioFiorita/porcelain/compare/v0.34.0...v0.35.0) (2026-07-19)

### Features

* one-click push after the commit composer ([f6d931f](https://github.com/FabioFiorita/porcelain/commit/f6d931f2858dedb19a8f8edaf0f96a41b58b0db8))
* structured loop-evidence checks — native pass/fail chapter in the Review ([c78047b](https://github.com/FabioFiorita/porcelain/commit/c78047be72a575bb583b6881c973dac9aec8e1eb))
* the Glance — phone companion home on the empty viewer ([23f96f5](https://github.com/FabioFiorita/porcelain/commit/23f96f52c1521689a94537155af361c50e5a537d))

### Bug Fixes

* touch polish — split-view entry points hidden on phones, hover actions touch-visible ([5f8725c](https://github.com/FabioFiorita/porcelain/commit/5f8725cff1b5b33621ada474152983f911de1cf3))

## [0.34.0](https://github.com/FabioFiorita/porcelain/compare/v0.33.0...v0.34.0) (2026-07-19)

### Features

* move the Agent tab to rail position 3 ([ade188d](https://github.com/FabioFiorita/porcelain/commit/ade188d152fb25f2d94d36bc48b4317acfcb58ec))
* per-section sandboxed HTML embeds in the Review ([a90ffb0](https://github.com/FabioFiorita/porcelain/commit/a90ffb07ee2c6f0eac30d288cd6aff7900af507d))
* Review inbox across worktrees (roadmap Phase 3 core) ([46000bc](https://github.com/FabioFiorita/porcelain/commit/46000bc9edb30830279b17e85dc86ed47815b7d8))
* start an agent thread in a fresh worktree (roadmap Phase 2) ([bd13742](https://github.com/FabioFiorita/porcelain/commit/bd137425ec2fd6c5c872f8f752dd116652e3171e))

## [0.33.0](https://github.com/FabioFiorita/porcelain/compare/v0.32.0...v0.33.0) (2026-07-19)

### Features

* autonomous marketing-screenshot pipeline (pnpm shots) — seeded demo repo, Retina captures ([baf21b5](https://github.com/FabioFiorita/porcelain/commit/baf21b57de32a22b5c6b61a5b52f46efb9ca6e8b))
* board sidebar outline + empty-state confidence pass ([65a97aa](https://github.com/FabioFiorita/porcelain/commit/65a97aae12d97c39cf0398fca111fbb8dc0beb3e))
* composition fixes — board fills canvas, review diagram sizes to SVG, workspace empty state ([5c02d45](https://github.com/FabioFiorita/porcelain/commit/5c02d451ffe934790ea03c098d33a929abefffe9))
* repo-identity anchor in the title bar — shared project-switcher menu, second trigger ([2e659f3](https://github.com/FabioFiorita/porcelain/commit/2e659f3898ef92ee04f6facbcf1e3e6cc405e218))
* seat the title bar with a hairline border (design overhaul C2) ([26eae1f](https://github.com/FabioFiorita/porcelain/commit/26eae1fe84251dc56362b62b67b7a4d9b6339127))
* shots pipeline covers all 13 marketing surfaces; publish redesigned-UI images site-wide ([fe21028](https://github.com/FabioFiorita/porcelain/commit/fe2102899480a771bc62f064d84cb62418c0f264))
* typography system — Geist sans for UI chrome and prose, mono reserved for codelike content ([d57217a](https://github.com/FabioFiorita/porcelain/commit/d57217a8d1706848d8a76fa53e0ba1c1708fb4ad))

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
