---
name: mobile-verify
description: Prepare a disposable Porcelain mobile run, drive its development client with the pinned agent-device CLI, and retain evidence. Use before calling a mobile change done or correcting maps.
---

# Mobile verification

From the repository root, `C=.agents/skills/mobile-verify/scripts/cli`.

1. Run `$C doctor`, then `$C start` (or `--device ipad`). Native changes need `$C build` on the Mac first. The launcher owns a disposable server, Metro, pairing and a simulator claim; it closes its setup session before handing over.
2. Read the short card and private `connection.json`. Use **the entire pinned agent-device invocation** on every call: config, session, platform and owned UDID. Drive with that CLI, never agent-device MCP or interaction commands on `$C`. See [driving](references/driving.md).
3. Read [the feature map](features/README.md), drive its entry points and way back, and check each end state with fresh interactive snapshots, screenshots and independent server/storage reads. Save evidence in the card's folder. Pairing links and host tokens stay private.
4. Run the card's logs and stop commands. Stop closes only this run's sessions, stops captured processes and releases its claim; pooled simulators are shut down and never deleted. A borrowed `--udid` stays booted. Evidence remains. A failed stop retains private runtime state; inspect and retry by instance id.
5. Run `pnpm check:local` and only the changed specs by name. CI owns full suites. Keep the live instance running while you iterate; Metro reloads JavaScript edits. Run the changed e2e specs once, when the work is done, after stopping the instance.

The pool is the Mac's existing iPhone 17, iPhone 18 Pro and iPad Pro 13-inch (M5), shared with every other project; at most two simulators may be booted. The CLI never creates or deletes a simulator: a missing or busy device causes refusal. Each start clears app data and keychain; installation runs only when the native build fingerprint changes or the app is missing.

For T3-owned devices use [T3 handoff](references/driving.md#t3-owned-device). For Linux use [the Mac hub setup](references/remote.md); builds stay on the Mac. Report clients/platforms, local/LAN/remote connections, proof results and what remains unproved. iPhone does not prove iPad or Android; Local Network permission needs a physical device.
