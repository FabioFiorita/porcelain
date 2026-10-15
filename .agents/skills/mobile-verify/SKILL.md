---
name: mobile-verify
description: Prepare a disposable Porcelain mobile run, drive its development client with the synced agent-device CLI, and retain evidence. Use before calling a mobile change done or correcting maps.
---

# Mobile verification

From the repository root, `C=.agents/skills/mobile-verify/scripts/cli`.

1. Follow the workstation's device-usage rules. Run `$C doctor`, then `$C start --fixture focused` (or add `--device ipad`) for the feature-map journeys. Native changes need `$C build` on the Mac first. The launcher owns a disposable server, Metro, pairing and a simulator claim; it closes its setup session before handing over.
2. Read the short card and private `connection.json`. Use **the entire agent-device invocation from the card** on every call: config, session, platform and owned UDID. Open the card's app with `--foreground` to establish the journey's proxy lease, then prepare its Apple runner with `prepare ios-runner` before interactions; setup already prepares its own session before pairing. Drive with that CLI, never agent-device MCP or interaction commands on `$C`. See [driving](references/driving.md).
3. Read [the feature map](features/README.md), drive its entry points and way back, and check each end state with fresh interactive snapshots, screenshots and independent server/storage reads. Save evidence in the card's folder. Pairing links and host tokens stay private.
4. Run the card's logs and stop commands. Stop closes only this run's sessions, stops captured processes and releases its claim; pooled simulators are shut down and never deleted. A borrowed `--udid` stays booted. Evidence remains. A failed stop retains private runtime state; inspect and retry by instance id.
5. Run `pnpm check:local` and only the changed specs by name. CI owns full suites. Keep the live instance running while you iterate; Metro reloads JavaScript edits. Mobile features are driven on demand through this skill.

The CLI claims an existing simulator from its fixed pool and respects the configured host limit; the workstation's usage rules may be stricter. It never creates or deletes a simulator: a missing or busy device causes refusal. Each start clears app data and keychain; installation runs only when the native build fingerprint changes or the app is missing.

For the developer's walkthrough, start with `--manual-pairing`. It prepares the same server and Metro and opens the development client, leaving pairing and all feature interactions to the developer. Settings → Add environment → Use development server fills the link; the developer selects Pair.

`start` defaults to `--fixture development`, including manual pairing: a synthetic Dispatch Desk with nested source and docs, long source lines, Markdown/HTML/SVG previews, two worktrees, varied history with a merge, pending modified/added/deleted/renamed files, a published review and reviewer/agent comments. Each fresh start reproduces it once through real Git and server APIs/MCP; `fixture.json` records the seed operations. Stop and start to reset it. `--fixture focused` retains the small README fixture expected by the feature maps and does not seed reviews or comments.

For T3-owned devices use [T3 handoff](references/driving.md#t3-owned-device). From Linux, drive the Mac through T3's Device panel or the agent-device hub; see [remote](references/remote.md). Builds stay on the Mac. Report clients/platforms, local/LAN/remote connections, proof results and what remains unproved. iPhone does not prove iPad or Android; Local Network permission needs a physical device.
