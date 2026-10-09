# Driving the development client

The card prints one command prefix. Append the agent-device operation, preserving every target flag. A shell array avoids zsh splitting errors. For example, with the card's literal values:

```sh
D=(/private/instance/agent-device --config /private/instance/agent-device.json --session porcelain-mobile-ID --platform ios --udid OWNED_UDID)
"${D[@]}" open com.porcelain.app.dev --foreground
"${D[@]}" prepare ios-runner
"${D[@]}" snapshot -i
"${D[@]}" press @eN
"${D[@]}" fill @eN 'text'
"${D[@]}" wait text Online 45000
"${D[@]}" screenshot /private/evidence/settings.png
"${D[@]}" close
```

Use `mobile.bundleIdentifier` from connection.json rather than assuming the example bundle ID. Refresh `snapshot -i` before using refs; ref numbers from another snapshot can address a different node. Native tab selected traits may be missing; inspect a screenshot and the destination heading.

`prepare ios-runner` builds or reuses and health-checks the pinned driver's XCTest helper. It does not rebuild the Porcelain development client. A proxy journey needs `open --foreground` first to establish its device lease; then prepare once before interactions so cold helper startup does not consume a press or screenshot deadline. Keep the normal interaction deadlines; after any failed mutation inspect fresh state before deciding what to do, because a timed-out action can still take effect.

For deep links use the development scheme with `__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1`, e.g. `porcelain.dev://files?__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1`. Accept an iOS open-link confirmation when present. A cold launch must reconnect the development client to `mobile.metroUrl` (the development-client URL is `porcelain.dev://expo-development-client/?url=<encoded Metro URL>&` followed by the same flags).

Fixture commands remain on the lifecycle CLI: `pairing-link`, `agent`, and `server` readbacks (run the CLI without arguments for options). A one-time link expires and works once. Pairing happens through Settings; wait for the keyboard animation before Pair. Keep links, config and screenshots containing them private. The CLI records its deterministic operations, not your driver calls; save snapshots/screenshots/readbacks yourself in evidenceDirectory.

# T3-owned device

Open the assigned simulator in T3's Device panel; from Linux this is also the way to drive the Mac without the hub (see [remote](remote.md)). Use its exact UDID, launcher and private host config:

```sh
.agents/skills/mobile-verify/scripts/cli start --udid OWNED_UDID --agent-device-command /t3/returned/launcher --agent-device-config /t3/returned/host.json
```

Only an already booted device is accepted by `--udid`. The CLI reserves it against other Porcelain runs, resets the development app, closes its own setup session and prints a unique journey session on that same host. It never changes T3's state directory or shuts down the borrowed simulator. If another agent-device session owns the device, its owner must release that session before setup; never force a takeover. At the end stop the fixture, then let T3 close its own panel/device.
