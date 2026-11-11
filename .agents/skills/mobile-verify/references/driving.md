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

For deep links use the development scheme with `__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1`, e.g. `porcelain.dev://files?__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1`. Accept an iOS open-link confirmation when present. A development-client cold launch must reconnect to `mobile.metroUrl` (the development-client URL is `porcelain.dev://expo-development-client/?url=<encoded Metro URL>&` followed by the same flags).

Fixture commands remain on the lifecycle CLI: `pairing-link`, `agent`, and `server` readbacks (run the CLI without arguments for options). A one-time link expires and works once. Pairing happens through Settings; wait for the Pair control to be enabled. Keep links, config and screenshots containing them private. The CLI records its deterministic operations, not your driver calls; save snapshots/screenshots/readbacks yourself in evidenceDirectory.

Relaunch the development client with that development-client URL, not `open --relaunch`: a plain relaunch brings back the Expo tools button, which covers the top bar's trailing buttons. Never run `close` on a device tool's bound session; it ends the lease's session, and only a new lease (device close with shutdown, then open) recovers it.

Rotate with `orientation landscape-left` and `orientation portrait` (not `rotate`), on iPad as on Android.

## Scroll the review document

Use the bound device command for every action. Take a fresh snapshot and screenshot, find the reading document bounds, and pan inside that document with both endpoints clear of native headers, tabs, fixed Continue controls, sidebars and nested code scrollers. Use that device’s current logical coordinates; never reuse coordinates from another device or orientation. A successful gesture is not proof: verify a named lower section, then pan back and verify the first card returns. Preserve the fixed controls throughout.

On tablets, verify landscape and portrait. Refresh bounds and refs after rotation and repeat down/up. Restore the original orientation. Shared document/layout changes use an Android tablet; iOS-native gesture or geometry changes need an iPad run. Close a sheet before targeting the document behind it. Keep gesture duration separate from waiting for product readiness; never use a fixed sleep as a success condition.

On iOS, `scroll up` and `scroll top` can report success without moving the Walkthrough page; use `gesture pan <x> <y> 0 <dy> <ms>` inside the document. A multiline composer reports no usable bounds, so tap it by its coordinates from a screenshot, then `type`.

A standalone embedded cold-link journey is separate from Metro development-client bootstrap. Confirm the app process is absent, launch the requested URL with the owned bound command, and verify the requested revision/decision survives cancellation and pairing without resending the URL. Retain independent server readback. An artifact build, warm bootstrap or simulator loopback does not prove cold entry, public OS association, physical LAN or permission behavior.
