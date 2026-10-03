---
name: mobile-verify
description: Drive the real Porcelain mobile app, the Expo development client on an iOS simulator, against a disposable server through the mobile control CLI, following the Markdown feature map, and read the evidence it records. Use before calling a mobile change done, when checking how a screen or flow behaves, when native code changed and the development client needs a rebuild, or when adding or correcting a mobile feature map entry.
---

# Mobile verification

The CLI at `.agents/skills/mobile-verify/scripts/cli` starts one disposable Porcelain server through the server kit, Metro on a free port and an iOS simulator of its own. It installs the development client, connects it to that Metro, pairs it with the server and drives it through agent-device, recording every command as a numbered evidence file. It never asserts and never runs tests: you read the evidence and decide, and the e2e tests the map names prove what must stay true.

Run every command from the repository root, on macOS, or on any machine that reaches a Mac's simulators through an agent-device hub (see [A simulator on another machine](#a-simulator-on-another-machine)).

## 0. Build the development client when native code changed

```sh
.agents/skills/mobile-verify/scripts/cli build
```

`build` runs Expo prebuild for iOS and `xcodebuild` for the simulator into `apps/mobile/ios/build`, and records the native fingerprint it built: the app's dependencies, `app.config.ts` and the build identity. It also leaves a copy of the app in `/tmp/porcelain-development-clients/<fingerprint>/`, which a remote `start` installs, and which a local `start` or e2e run installs in a checkout with no build of its own for that fingerprint, such as a fresh worktree. It takes several minutes; never request a cloud build for an iteration. `ios/`, `android/` and `.expo/` are generated and disposable; owned native modules belong under `apps/mobile/modules/`.

A JavaScript change needs no build: Metro serves it, and the CLI reloads the app when the JavaScript changed since the last command. `start`, every driving command and the e2e tests refuse while the native fingerprint differs from the built one, and say to run `build`.

## 1. Start

```sh
.agents/skills/mobile-verify/scripts/cli start
.agents/skills/mobile-verify/scripts/cli start --device ipad
```

`start` checks its tools first and stops with the install line when one is missing: Xcode with an iOS 26 or newer simulator runtime, agent-device, and the built development client. `doctor` runs the same checks and reports each live instance's simulator, Metro, server health and build freshness.

It prints the instance id, the simulator id and the evidence folder; it never prints a credential or a pairing link. When it returns, the app runs the development client from this checkout's Metro, with Expo's developer menu, floating button and onboarding switched off, and is paired with the server: Settings lists one environment, “Mobile Verification …”, Online.

- **Its own simulator.** `start` boots a simulator of its own, named `Porcelain verify <model>`: one it created earlier and that is shut down, or a new one, since a simulator's first boot is far heavier than later ones. It sets that simulator to US English, so system labels such as Open and Show Sidebar read the same on any host, reinstalls the development client there with an empty Keychain, and `stop` shuts that simulator down. It never boots, drives or shuts down a simulator it does not own. Keep one simulator live at a time on a shared host.
- **Several instances.** Instances are registered for this checkout only. With more than one live, every command needs `--instance <id>`.
- **Stale code.** A command refuses once server, CLI or native code changed after `start`, and says which: server or CLI code needs `stop` and `start`; native code needs `stop`, `build` and `start`.
- **Idle.** An instance that receives no command for 30 minutes stops itself; every command counts, failed or not. Its evidence stays.

## 2. Find the screen or flow

Open `.agents/skills/mobile-verify/features/README.md` and the file `<domain>.<capability>.md` of the screen or flow you changed. Its frontmatter names the `screen` it lives on, the `selectors` its steps use, the e2e `tests` that guard it and the server routes it calls.

## 3. Drive it

Follow the map's **Driving it** section: run each line as written and compare the app with the end state the line names.

| Command | What it does |
| --- | --- |
| `open <screen>` | opens a screen by its deep link, such as `/files`; it also takes a full `porcelain.dev://` link, adds the developer-menu flags and accepts iOS's open-link confirmation |
| `tap --label <label>` | taps an element by its accessibility label; `--id <testID>` taps by test id; `--long` holds it, for a context menu |
| `fill <value> --id <testID>` | replaces a field's text and waits for the keyboard animation to settle; the value `{pairing-link}` types a fresh one-time link from the instance's server, which the evidence never records |
| `snapshot` | records the accessibility tree |
| `screenshot` | records a screenshot |
| `logs` | records the app's log from the simulator, Metro's and the server's |

When the app is not where the map says, take a `snapshot` before acting further: it shows the labels to address. A map line that no longer matches the app is drift; correct the map.

Platform behaviour to expect:

- `tap --label` matches a label exactly, as the snapshot prints it; a long label such as an environment name is taken whole from the snapshot.
- agent-device's iOS accessibility backend can omit a native tab's selected trait; read selection from a screenshot. The Maestro e2e tests assert selection through XCTest.
- On iPad in portrait iPadOS hides the sidebar behind Show Sidebar; `open <screen>` reaches any destination without it.

## 4. Read the evidence

```sh
.agents/skills/mobile-verify/scripts/cli evidence
```

The folder holds `000-start.txt` (device, simulator, Metro, server, the environment name and how long each start phase took), one numbered file per command (`001-open.txt`, `004-screenshot.png`, `005-snapshot.txt`, `006-logs.txt`), and `metro.log`, `server.log` and `supervisor.log`. Pairing codes, links and credentials are redacted from every text file; `snapshot` prints the screen as it is so a next step can use what it shows. A screenshot taken while a link sits in the pairing field can show it; keep such a screenshot local. Read the snapshots and screenshots for what the app showed and `logs` for errors; the report names the evidence folder and what it shows.

## 5. Run the e2e tests the entry names

The frontmatter's `tests` lists the files that guard the screen or flow. They need macOS, Maestro (`brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro`) and the built development client, and they boot their own simulator, so stop the CLI's instance first on a shared host.

```sh
pnpm --filter @porcelain/mobile exec vitest run --config ../../vitest.config.ts --project @porcelain/mobile-e2e <file name>
pnpm --filter @porcelain/mobile exec vitest run --config ../../vitest.config.ts --project @porcelain/mobile-e2e-tablet <file name>
pnpm --filter @porcelain/mobile test:e2e
```

`test:e2e` runs the iPhone project, then the iPad project (`*.tablet.e2e.ts` and `pairing.e2e.ts`); on any other system it stops with what it needs. Each project's global setup builds the server, starts Metro and boots one simulator of its own (`Porcelain e2e <model>`, reused once created) and shuts it down at the end; each test reinstalls the app with an empty Keychain, starts the disposable servers it needs, runs one Maestro flow from `apps/mobile/spec/e2e/` and asserts what the servers kept. A flow's evidence (Maestro's screenshots, hierarchy and log, redacted) lands in `apps/mobile/test-results/e2e/<device>/<test>/`.

## 6. Stop

```sh
.agents/skills/mobile-verify/scripts/cli stop
```

`stop` ends only the instance the CLI started: it signals the PID in its instance file only while that process's command line is the instance's supervisor, which closes the agent-device session, shuts down its simulator, stops Metro and stops the server; then it sends SIGKILL to whatever is left of its process group and of Metro after a timeout, and shuts the simulator down itself if it is still booted. A recorded PID that now belongs to another process is reported and never signalled. The evidence folder stays.

## A simulator on another machine

The CLI can run on a machine without Xcode and drive a simulator on a Mac, the device host. The setup must provide:

- **A hub.** `agent-device proxy --port <port>` runs on the device host, and its URL is reachable from this machine, for example through an SSH tunnel.
- **A token.** The hub's token sits in an environment variable on this machine; the file names the variable, never the token.
- **Reachable ports.** Ports on this machine that the simulator reaches at `http://localhost:<port>`, for example through SSH remote forwards. The disposable server and Metro each take one.

Describe them in `.mobile-device-host.json` at the root of the main checkout, the directory that `git rev-parse --path-format=absolute --git-common-dir` points into; every worktree on this machine reads that one file. It is ignored and stays on this machine.

```json
{
  "hub": "http://127.0.0.1:4310",
  "tokenVariable": "AGENT_DEVICE_DAEMON_AUTH_TOKEN",
  "ports": [5173, 5183, 5193]
}
```

Without the file the CLI drives this Mac's simulators as above. With it, `start` and `doctor` check the file, the token, the hub and the ports and say exactly what is missing; `start` then runs the server and Metro here on free ports from the list, connects agent-device to the hub, reinstalls the development client on the device host's `Porcelain verify <model>` simulator with an empty Keychain, and pairs it. `stop` shuts that simulator down and disconnects. `logs` records Metro and the server; the app's own log stays on the device host.

Native builds stay on the device host. When it has no development client built for this checkout's native code, or no `Porcelain verify` simulator, `start` stops and names the command to run there, in a checkout of the same commit: `build` after a native change, and `start --device <kind>` then `stop` once to create the simulator.

## Platform coverage

Prove iPhone and iPad separately: `start --device ipad` for driving, and the tablet e2e project. A simulator proves loopback and LAN transport, not the iOS Local Network permission prompt; permission, denial and retry need a physical device. Android has its own native views and is not proven: it needs its own build and native proof. Report the platforms you proved, and never call an untested platform complete.

## Add or correct a map entry

A new screen, flow or view state gets its map file and its e2e test in the same change.

1. Name the file `features/<domain>.<capability>.md`; the domain is a mobile feature domain or `app` for the shell.
2. Write the frontmatter: `screen` (the screen it lives on, as `apps/mobile/src/app` names it), `selectors` (the test ids and accessible names the steps use, as `apps/mobile/src` spells them), `tests` (the e2e files that guard it) and `api` (every server route it calls, as `METHOD /api/...`).
3. Write the sections in order: **What it is**, **How a user reaches it** (every entry point, including its deep link), **Driving it** (the exact CLI lines, each followed by the end state to look for), **What proves it works** and **Gotchas**.
4. Link it from `features/README.md`.
5. Run `node scripts/feature-maps.ts`, or `pnpm check`.
6. Write the e2e test: a Maestro flow in `apps/mobile/spec/e2e/<flow>.yaml` that starts from `connect.yaml`, reaches its view state by deep link where a screen has one, and a `<flow>.e2e.ts` beside it that starts the servers in the state it needs through the `environments` fixture, runs the flow with `app.run` and asserts literal server state afterwards.
7. Drive the new lines once against a fresh instance and keep the evidence folder for the report.
