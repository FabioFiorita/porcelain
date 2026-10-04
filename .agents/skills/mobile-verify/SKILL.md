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

CI runs both mobile e2e projects on separate GitHub-hosted macOS runners when mobile is affected. It uses the official Maestro CLI and the repository's development-client build, cached by native fingerprint, runner architecture and Xcode. With no `.mobile-device-host.json`, each job uses its local simulator with no simulator limit. Full suites belong to CI; locally run only the changed feature's named tests. Failure evidence is uploaded from `apps/mobile/test-results/`.

Before boot, the kit stamps the Apple Intelligence readiness preference and clears queued CoreFollowUp banners in its own simulator's data directory, so system onboarding does not cover the app. Native builds regenerate the ignored iOS project with `expo prebuild --clean --platform ios` before xcodebuild; a cached `.app` skips both commands.

Metro startup warms the launch asset path and options from its iOS manifest through the same origin that answered readiness, before a simulator requests it. Expo can advertise `127.0.0.1` even when `localhost` reaches Metro over IPv6. The log records both URLs; one bundle request waits for the real transform and reports its HTTP or network error directly. A handwritten bundle URL can warm a different transform and leave the first flow waiting for a cold bundle on CI. Both matrix jobs finish independently, so a failing flow on one device preserves the other device's result; test retries are not added.

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
