# Driving the development client

The card prints one command prefix. Append the agent-device operation, preserving every target flag. For example, preserve the card's literal values in a shell array:

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

`prepare ios-runner` builds or reuses and health-checks the driver's XCTest helper. It does not rebuild the Porcelain development client. Run `open --foreground` before preparing the iOS runner so its device lease exists. Keep the normal interaction deadlines; after any failed mutation inspect fresh state before deciding what to do, because a timed-out action can still take effect.

For deep links use the development scheme with `__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1`, e.g. `porcelain.dev://files?__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1`. Accept an iOS open-link confirmation when present. A cold launch must reconnect the development client to `mobile.metroUrl` (the development-client URL is `porcelain.dev://expo-development-client/?url=<encoded Metro URL>&` followed by the same flags).

Fixture commands remain on the lifecycle CLI: `pairing-link`, `agent`, and `server` readbacks (run the CLI without arguments for options). A one-time link expires and works once. Pairing happens through Settings; wait for the keyboard animation before Pair. Keep links, config and screenshots containing them private. The CLI records its deterministic operations, not your driver calls; save snapshots/screenshots/readbacks yourself in evidenceDirectory.
