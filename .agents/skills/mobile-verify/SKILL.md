---
name: mobile-verify
description: Drive the Porcelain Expo development client against a disposable server through the mobile control CLI and feature maps. Use before calling a mobile change done, for native rebuilds or map corrections.
---

# Mobile verification

`C=.agents/skills/mobile-verify/scripts/cli`, from the repository root. Run `$C` alone for commands and options. It drives and records; read the evidence against the map's promises. It never asserts or runs tests.

Use macOS, or the `workstation` skill for the owner's Mac and simulator hub. Native builds stay on the Mac. Use only the development client and disposable server.

## Drive the feature

1. Run `$C doctor`. After native dependencies, app config or owned native modules change, run `$C build` on the Mac. JavaScript changes need no native build; the CLI reloads them. Follow a stale-code refusal's restart instructions.
2. Run `$C start` for iPhone, or `$C start --device ipad`. It owns its simulator, Metro and server; only stop your instance. With multiple instances, include `--instance <id>` on every command.
3. Read `features/README.md` and the feature's map. Follow **Driving it** and compare each end state with snapshots, screenshots and server state. If navigation differs, run `$C snapshot` before another action.
4. Run `$C evidence`, read the numbered files and logs, then `$C stop`. Evidence remains. Text is redacted; screenshots can contain a pairing link, so keep those local.
5. Run only the test files named by the changed map. Stop the CLI instance first: tests boot their own simulator on the shared Mac.

```sh
pnpm --filter @porcelain/mobile exec vitest run --config ../../vitest.config.ts --project @porcelain/mobile-e2e <file name>
pnpm --filter @porcelain/mobile exec vitest run --config ../../vitest.config.ts --project @porcelain/mobile-e2e-tablet <file name>
```

## What a drive cannot prove

CI runs three iPhone shards and one iPad job on separate GitHub-hosted macOS runners when mobile is affected. Vitest shards the complete projects, so new spec files join coverage automatically. It uses the official Maestro CLI and the repository's development-client build, cached by native fingerprint, runner architecture and Xcode. With no `.mobile-device-host.json`, each job uses its local simulator with no simulator limit. Full suites belong to CI; locally run only the changed feature's named tests. Failure evidence is uploaded from `apps/mobile/test-results/`.

The kit normally selects the newest available iOS runtime, at least iOS 26. For a diagnostic comparison, `PORCELAIN_MOBILE_IOS_RUNTIME` selects an exact installed version; an unavailable version fails rather than falling back. E2E setup records the selected device and runtime in `simulator.json`. Comparing runtimes does not authorize changing normal CI coverage.

CI records `resources.log` at server build, Metro warmup, simulator boot, server startup, app reset, each Maestro phase and cleanup, with periodic samples every 30 seconds during setup and tests. It includes CPU load, `vm_stat`, query-only `memory_pressure`, `top`, CPU-ranked process names, parents and resident memory, and booted simulator inventories. Compare stage timestamps and cleanup samples before changing runner load; command failures are recorded too. Local verification does not run this sampler.

Maestro receives Vitest's test cancellation signal, so a timed-out or cancelled test stops its CLI process at the existing deadline. Fixture cleanup also stops and awaits its captured child before closing launch readiness; it never finds or kills processes by name. Check cleanup samples for remaining driver or logging processes before attributing a later flow's load to the app.

Before boot, the kit stamps the Apple Intelligence readiness preference and clears queued CoreFollowUp banners in its own simulator's data directory, so system onboarding does not cover the app. On CI only, before booting an e2e simulator, the kit merges six launchd overrides into that owned simulator's disable store: `apsd`, `chronod`, `PosterBoard`, `mediaanalysisd`, `mediaanalysisd.service` and `photoanalysisd`. Push certificate loops, widgets and media analysis competed with flows on the three-CPU runner. Push notifications, system widgets and Photos analysis are not covered by this simulator configuration; app networking, links, accessibility and diagnostic logging remain enabled. Host services and local verification are untouched. Native builds regenerate the ignored iOS project with `expo prebuild --clean --platform ios` before xcodebuild; a cached `.app` skips both commands.

Metro startup warms the launch asset path and options from its iOS manifest through the same origin that answered readiness, before a simulator requests it. Expo can advertise `127.0.0.1` even when `localhost` reaches Metro over IPv6. The log records both URLs; one bundle request waits for the real transform and reports its HTTP or network error directly. A handwritten bundle URL can warm a different transform and leave the first flow waiting for a cold bundle on CI. All matrix jobs finish independently, so a failing flow on one device preserves the other device's result; test retries are not added.

The manifest readiness check follows native Expo's HEAD then GET requests, including its platform, accept and forwarding headers. Forwarded manifest bundle URLs can be relative; warmup resolves them against the ready origin. Before every initial or cold launch, Maestro asks a local readiness endpoint in the fixture to warm the manifest and bundle. It responds successfully only when those requests finish within one second, polling inside the existing three-minute Metro readiness deadline. This runs after driver startup and also covers later relaunches inside a flow; the app's Review assertion deadline stays unchanged. Response latencies are recorded in `metro.log`, and fixture cleanup closes the endpoint. Environment artifacts retain startup stages and request methods, routes and statuses, without request bodies or credentials.

Maestro's initial and cold launches pass Expo's `--initialUrl` argument with this run's Metro URL and developer-menu flags. Expo applies the flags before loading React, so startup does not depend on a SpringBoard link confirmation or race an already-open developer menu. Product deep links still use `open-link.yaml`; no launch retry is needed.

- iPhone and iPad need separate drives. Android needs its own build and native proof; an iOS drive does not cover it.
- A simulator proves loopback and LAN transport, but iOS Local Network permission, denial and retry require a physical device.
- The iOS accessibility backend can omit a native tab's selected trait; inspect a screenshot. Maestro uses XCTest to assert selection.
- In portrait, iPadOS hides the sidebar behind Show Sidebar; use the map's deep link to reach its screen.
- Native labels match the snapshot exactly; copy an environment label whole rather than shortening it.

## A simulator on another machine

The ignored `.mobile-device-host.json` in the main checkout is shared by its worktrees. `doctor` diagnoses its hub, token variable, forwarded ports and simulator limit. Use `workstation` for the owner's existing setup; do not overwrite it. The CLI reads configuration in `scripts/host.ts`; tool installation, native freshness and missing simulator instructions come from `doctor` and `start`.

## Correct a map

Copy the nearest map: frontmatter names the screen, exact source selectors, test files and `METHOD /api/...` routes. Include every entry point, deep link, observable end state and way back. Link it from `features/README.md`, run `pnpm features:check`, and drive the changed steps on a fresh instance. For a new flow, copy the nearest Maestro flow and e2e test; assert literal server state through the `environments` fixture.

Report platforms driven, tests run, unproved behaviour and the evidence folder. Never call an untested platform complete.
