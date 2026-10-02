---
name: mobile-verify
description: Build and verify Porcelain's native Expo mobile app locally. Use for mobile routes, native presentation, platform capabilities, pairing and device lifecycle behavior; web and desktop use their own verifiers.
---

# Mobile proof

Run from the repository root. Use the development identity; keep the owner's store app separate.

Generate the iOS project with `pnpm --filter @porcelain/mobile exec expo prebuild --platform ios`. Generated `ios/`, `android/` and `.expo/` are disposable; owned native modules belong under `apps/mobile/modules/`.

Start Metro with `pnpm dev:mobile`. Development uses a native development client. A JavaScript change refreshes through Metro; changing native dependencies, plugins or module sources requires another local native build. Do not request a cloud build for an iteration.

Use the installed `xcodebuildmcp-cli` skill to discover simulators, inspect defaults and run `simulator build-and-run` against `apps/mobile/ios/PorcelainDev.xcworkspace`, scheme `PorcelainDev`, configuration `Debug`. Save its build duration and build/runtime log paths. Native compilation is a separate required stage, not part of the portable fast check.

Open `com.fabiofiorita.porcelain.dev` with Agent Device. Connect the development client to the URL Metro serves. Check the server's listening address when an advertised IPv4 loopback URL fails: `--localhost` can bind only IPv6; `http://localhost:8081` reaches that listener.

The initial shell journey covers unpaired navigation only. Run the Agent Device journey with semantic selectors, checking each destination's native content (`role=staticText` for SwiftUI text, not `role=text`) and Settings' empty-environment content. Its iOS AX backend can omit selected-tab traits; Maestro's XCTest selected-state assertions cover those separately. Preserve failures when a driver cannot substantiate a fact. Preserve an `.ad` recording with a selector destination guard and replay it. The initial recording replay diverged when Agent Device switched AX/XCTest backends and changed the native tab ancestry. Keep that failure as driver evidence; do not strip target identity metadata to make it pass. Maestro currently provides the repeatable shell regression. Run the same promise independently with Maestro:

```sh
maestro --udid <simulator-id> test .agents/skills/mobile-verify/flows/phone-shell.yaml --test-output-dir <evidence-directory>
```

Run the two drivers serially. Maestro YAML interpreted by Agent Device is not an independent Maestro result. Keep both candidates until actual workspace, native context-menu and comment-anchor journeys establish precision and reliability.

For behavior beyond the shell, use disposable real Porcelain servers. Pair through the real endpoint, then assert the selected environment/project/worktree or exact submitted comment on the server as well as the native UI. Never use a runtime fake API. Redact pairing codes and credentials from evidence; use recording variables for sensitive input.

With Metro running and the development client connected, run `node scripts/mobile-pairing.ts <iOS simulator id> [maestro|agent-device]` separately on iPhone and iPad. Maestro is the default. Close any Agent Device preview session first: its test runner acquires its own device session. Run the drivers serially against the same journey; Agent Device interpreting the YAML remains an Agent Device result. The runner builds two disposable real servers, issues fresh pairing links, runs `flows/pairing.yaml`, and checks each server for one Apple mobile device (`iOS` or `iPadOS`), the native pairing request and authenticated reads after restarting the app. Unique environment names prevent old saved entries from satisfying this run. It stops both fixture servers and removes their state, while preserving restricted local evidence and redacting secrets from text artifacts. A failure screenshot can contain typed pairing input; keep it local. This journey covers invalid-link recovery, sheet cancellation, multiple environments, native credential/metadata restoration, and forgetting through the SwiftUI context menu. It forgets both fixture environments through the UI and restarts to prove their removal; it keeps pre-existing pairings. It does not select a project or worktree.

For the live LAN checkpoint, issue a fresh link with the owner's `porcelain pair` command for the intended LAN address, then run `flows/lan-pairing.yaml` with Maestro's `-e PAIRING_LINK=<link>` option. Capture output through a private wrapper and redact the issued code and link from text artifacts. This flow pairs and cold-restarts the development client. Check `porcelain devices` on that server for the exact new device label, its native platform and `over lan`; an HTTP request from the Mac alone is not native transport proof.

Prove iPhone and iPad separately. A simulator proves LAN transport, not the iOS Local Network permission prompt; permission, denial and retry need a physical device. Android needs its own build and native proof. Report platform coverage explicitly.

Run `flows/tablet-shell.yaml` on iPad for Expo UI's SwiftUI three-column NavigationSplitView with Expo Router rendering the detail route. Router's Split View cannot customize its header, so the owner approved the SwiftUI split view for a native toolbar. The primary sidebar contains Review, Files, History and Settings; the content column contains the selected destination's master list; Router renders its detail in the detail column. Prove that collapsing the primary sidebar preserves the master and detail, and that rotation preserves Settings. iPadOS adapts column visibility in portrait. The tablet never embeds the phone tab navigator. Its shell journey now accepts saved environments and proves the Add environment action; the pairing journey proves saved state separately.

Run `pnpm check` at completion. For mobile guard changes, run the affected named probes from a clean committed checkout after stopping Metro; probes mutate runtime source. Never call an unimplemented destination or an untested platform complete.
