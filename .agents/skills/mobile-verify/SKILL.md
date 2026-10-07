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
4. Run `$C evidence`, read the numbered files and logs, then `$C stop`. Evidence remains; use `$C evidence --instance <id>` after stopping. Text is redacted; screenshots can contain a pairing link, so keep those local.
5. Run only the test files named by the changed map. Stop the CLI instance first: tests boot their own simulator on the shared Mac.

```sh
pnpm --filter @porcelain/mobile exec vitest run --config ../../vitest.config.ts --project @porcelain/mobile-e2e <file name>
pnpm --filter @porcelain/mobile exec vitest run --config ../../vitest.config.ts --project @porcelain/mobile-e2e-tablet <file name>
```

Sessions have no idle expiry. Stop your instance when finished. A failed stop exits nonzero and retains private runtime state; inspect its report before retrying. Repeat a confirmed stop with `$C stop --instance <id>`. The shared stop result confirms owned-process cleanup; it does not certify simulator shutdown.

## What a drive cannot prove

- iPhone and iPad need separate drives. Android needs its own build and native proof; an iOS drive does not cover it.
- A simulator proves loopback and LAN transport, but iOS Local Network permission, denial and retry require a physical device.
- The iOS accessibility backend can omit a native tab's selected trait; inspect a screenshot. Maestro uses XCTest to assert selection.
- In portrait, iPadOS hides the sidebar behind Show Sidebar; use the map's deep link to reach its screen.
- Native labels match the snapshot exactly; copy an environment label whole rather than shortening it.

## A simulator on another machine

The ignored `.mobile-device-host.json` in the main checkout is shared by its worktrees. `doctor` diagnoses its hub, token variable, forwarded ports and simulator limit. Use `workstation` for the owner's existing setup; do not overwrite it. The CLI reads configuration in `scripts/host.ts`; tool installation, native freshness and missing simulator instructions come from `doctor` and `start`.

## Correct a map

Keep useful navigation, entry points, observable end states and ways back in ordinary journey guides linked from `features/README.md`. Drive changed steps on a fresh instance and retain evidence. Guides have no mandatory metadata, source inventory or test-link gate. Add automated regression cases separately when a behavior needs a durable test.

Report platforms driven, tests run, unproved behaviour and the evidence folder. Never call an untested platform complete.
