# Verification evidence

## Capture and read back

Record the commit, map, fixture, entry/action/return, driver, platform and connection. For UI, save a fresh snapshot, screenshot and URL or screen name. For a before/after comparison, use the same fixture, action, viewport or orientation, density and appearance on both commits. Confirm mutations independently through the filesystem, Git, storage or the surface's server readback. Retain the results in the card's evidence directory and remove credentials, pairing fragments and inherited environment values.

Exercise widths, themes and data sizes that can change the result. Use the web sweep for shared shell, responsive layout, themes and broad visual audits. Report the states driven, named automated checks, source inspection and gaps from unmet preconditions. Restore the fixture or restart before repeating, then stop the owned instance.

## Measure time to readable content

The CLI card and `ready.json` report the same elapsed milliseconds from the registry launch to a published instance. This measures each surface's own readiness condition. Record device boot, native build, pairing outside the launcher and user journeys separately.

To time opening a source file, mark the input that opens it and use a browser frame observation or a native trace to mark when its text and a line number are visible. Time completed syntax coloring separately. Retain raw timings, method and sample counts. Measure cold and warm runs separately with the same device, driver, fixture, connection, cache condition and build mode on both commits.

For render churn, use React DevTools Profiler or the same named React Profiler boundary on both commits, in the same development or profiling mode. Record the action, number of commits and which components updated. Keep those profiles separate from production-mode user timings.

On an Android phone, set `EXPO_PUBLIC_PORCELAIN_PERF=1` when starting `mobile-verify` in development mode to enable the in-app marks. Use the bound driver to relaunch Porcelain Dev and open the same worktree from Worktrees, then open All changes from its Changes screen. With the fixture paired, retain each fresh app process's `adb logcat` output filtered to `porcelain-perf`. Capture at least five cold samples on each commit with the same device and fixture. Record first row layout, tap-to-file row and tap-to-heading times, and count the matching screen's `-commit` lines over the same navigation window. A `clock-rn` line identifies the startup timestamp provided by React Native, which may start at runtime initialization. A `clock-js` line identifies initialization of the timing helper as the fallback. Keep those samples separate and report the origin. These development measurements include the profiler and measure layout callbacks. The marks are disabled with `--production-js`.

## Check accessibility

Check roles, names and selected or disabled states during entry, action and return. For example, open a Review diff with Enter, confirm the dialog's name and initial focus, dismiss with Escape and check focus returns to the opener. Use a driver-native Android audit when available. Keep its raw accessibility tree, findings and a matching screenshot. Confirm a deliberately introduced regression is detected before making the audit a gate. Record any TalkBack, VoiceOver, native menu or switch-access journey separately.
