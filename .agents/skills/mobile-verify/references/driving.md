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

## Scroll the review document

The generic `scroll down 0.7` can target a different scroll container on a review screen. Use a bounded `gesture pan` inside the reading document on iOS and Android. This is a driver targeting choice; do not change app layout or repeat an unchanged generic scroll.

1. Take a fresh full `snapshot` and screenshot. Identify the visible review document's rectangle, excluding the native header, horizontal decision strip, sidebar, right panel, fixed Continue/decision controls and tab bar. Coordinates come from this device's current screenshot; do not reuse phone coordinates on iPad or after rotation. Driver coordinates use logical screen units, not necessarily screenshot pixels.
2. Choose `x` near the reading column's center, `y` in its lower half and a negative `dy` whose endpoint stays inside the document. Append `gesture pan <x> <y> 0 <dy> 500` to the complete card invocation. Keep both endpoints away from links, buttons and nested diff/code scrollers. For example, if the document occupies x=20…380 and y=240…740 in driver units, use `gesture pan 200 680 0 -360 500`; these numbers are illustrative, not device defaults.
3. Take a fresh full snapshot. Verify that a named lower section, such as Not proven or The walkthrough, is now visible and the first card moved. Save before/after screenshots. A gesture returning success alone does not prove movement. If the tree omits text, compare screenshots; never report an unchanged viewport as a pass.
4. To return, pan within the same document using a positive `dy` with both endpoints inside its bounds. Verify the first card returns. On phone, Continue at decision n stays fixed above the tabs throughout.

For iPad, first use `orientation landscape-left`, inspect the central document bounds and drive down/up there. Then use `orientation portrait`, refresh geometry/refs and repeat. These commands take no `--settle`. Restore a borrowed simulator's original orientation. A portrait panel sheet must be closed before targeting the document behind it.
