# 05 — Native core (one binary)

Not a tab. This plan lands the **native surface** the other five plans need, in a single build, so
every session after it ships OTA. Read `../daemon-api.md` for the procedures it polls; the UI that
consumes each module belongs to the plan that named it, not to this one.

## 1. Mission

`runtimeVersion` is **fingerprint**, and the fingerprint moves on every native change. That is the
whole reason this plan exists: an OTA can only land on a binary whose fingerprint matches, so a
dependency added in the middle of `02-changes` doesn't ship to the phone already in the pocket — it
strands it until a new build is cut, installed, and (for TestFlight) reviewed. `README.md` states the
mechanical cost plainly: the Metro-from-this-box loop "cannot force a reload or rebuild natively (no
⌘R, no Xcode), so **a new native module or permission means another Mac session**."

So: decide the native surface **once**, up front, from what the plans actually ask for. When this
merges and one build goes out, `01`–`04` are JS-and-assets work.

## 2. The inventory

Every native capability the five plans imply, with a verdict. The bar is the product identity
(`product` skill): Porcelain is where agent work is **reviewed**, a companion to the host where
agents run — not a harness for running them. A module that only makes sense for *authoring* on the
phone fails that filter no matter how cheap it is.

### 2.1 Already satisfied — no build needed

Everything in `01-files`, `03-review` and `04-terminal` v1 runs on the **current** binary.
`react-native-webview` (evidence HTML, the xterm bundle), `expo-secure-store`, `expo-sqlite`,
`expo-crypto`, `@expo/ui/swift-ui`, `expo-network` are all installed. `04`'s xterm bundle is a
committed generated asset from the root `@xterm/*` deps — an asset is OTA-deliverable, which is
exactly why that plan chose it. No verdict needed: these are already here.

### 2.2 `expo-clipboard` — plan-named, overdue

`00-connection` §3 (Pairing) reads the pairing link from the clipboard with it, `01-files` §2.5 uses
it for **Copy path**, and `00`'s file list already promises to add it. It was simply never installed.
Reading is the product: getting a path or a link out of the app and into the agent's terminal is the
hand-off, not authoring.

### 2.3 `react-native-shiki-engine` — pay `02` §2.2's deferred cost now

`02-changes` §2.2 deferred syntax highlighting as a **cost** decision, not an API limit, and named
the cost exactly: "T3 Code needed a custom shiki engine to do this well; we're not paying that for
v1." The cost it named is the *native* half — a JSI/TurboModule Oniguruma engine that cannot arrive
over the air. Installing it here inverts the trade: the binary carries the engine, and whether the
diff reader lights up becomes a JS decision `02` can make, defer, or reverse OTA.

Deliberately **not** installed: `@shikijs/core`, `@shikijs/langs`, `@shikijs/themes`. They are pure
JS, so they are OTA-addable at any time, and the monorepo already pins `^4.2.0` in `apps/desktop` —
the grammar/theme choice stays `02`'s, made against a real diff.

### 2.4 `expo-notifications` + `expo-background-task` + `expo-task-manager` — local only

The companion-core moment: an agent finished on the host, and the human is not at the desk.
`worktreeInbox` already answers "which sibling worktrees have work awaiting review", so a background
task polls it and raises a **local** notification — "review published". No new daemon surface, no
account, no server.

**Remote push is rejected until a relay exists.** APNs needs a server holding a certificate and the
device tokens; the architecture skill's "no relay tier, deliberately — a relay is a recurring bill"
applies to notifications exactly as it applies to environments. Local-from-poll gets most of the
value for none of the infrastructure.

Keeping that true costs one config plugin, because **`expo-notifications`' plugin is auto-applied**:
`@expo/prebuild-config`'s legacy-plugin pass runs it for any autolinked module whether or not
`plugins` lists it, and it writes `aps-environment` unconditionally. Leaving it out of `plugins`
therefore changes nothing. So `plugins/with-local-only-notifications.js` deletes the entitlement;
position can't lose to it, but **mods are LIFO** — a static plugin that writes entitlements must
come after it in the array, or it re-adds the key. Same pass auto-applies `expo-task-manager`,
which is why `fetch` shows up in
`UIBackgroundModes` unbidden; harmless, and not removable without also removing the module.
`expo-background-task` is *not* in that legacy set, so it is listed explicitly for its
`processing` mode and `BGTaskSchedulerPermittedIdentifiers`.

Background execution is iOS-scheduled and best-effort by design; the notification is a nudge, never
the source of truth. The Review tab re-reads on foreground either way.

### 2.5 `expo-haptics` — native feel, no plugin, no permission

Stage/unstage, commit, resolve-a-comment: the confirmations a native app is expected to give. Zero
config surface, and it is the cheapest thing in this batch to have wrongly omitted.

### 2.6 The row engine — one custom Expo native module

The one thing no package provides. `02` renders diffs as native text rows and `04` §2.1 ruled out a
native emulator "because it costs the Expo dev-client/EAS simplicity that makes this app shippable
by one person" — a cost this batch is already paying once. So build a **generic row engine**: a
SwiftUI module that renders rows of styled spans from data, with diff as its first consumer and a
terminal adapter as the door `04` explicitly left open.

**Standing constraint (rule-5 exception, granted):** the Swift surface stays **generic** — rows,
theme and tokens cross as data; feature logic stays in JS. A diff-shaped API in Swift is a second
native module the next time something needs rows, and re-opens the Mac-session cost this plan exists
to close.

## 3. Rejected — and why, so nobody re-derives it

| Capability | Why not |
|---|---|
| `expo-image-picker` / `expo-document-picker` | **Authoring, not reviewing.** Attaching a photo to a comment is composing content on the phone; the agent produces evidence, the human reads it. Fails the identity filter, not the cost one. |
| `expo-sharing` / `expo-file-system` | No plan asks for either. Exporting a diff or a review as a file is an unplanned feature, and a share sheet is a surface with no home in the shell (rule 10). |
| `expo-local-authentication` | Unplanned. `expo-secure-store` already sits behind device unlock, which is the threat model an on-device credential actually has; a Face ID gate over it is theatre until something asks for it. |
| Notification-service / share / widget extension targets | Extension targets are their own batch — a second bundle identifier, entitlements, and a build matrix. Nothing in `00`–`04` needs one, and the local-notification path above needs no service extension. |
| Remote push (APNs) | §2.4 — no relay, and no entitlement claiming otherwise. |

## 4. Files to change

- `apps/mobile/package.json` — the six dependencies above.
- `apps/mobile/app.config.ts` — `expo-background-task` in `plugins`, then
  `./plugins/with-local-only-notifications` last. No new `infoPlist` usage strings: none of these
  modules requires one (the notification permission prompt is a runtime API, not a plist key).
- `apps/mobile/plugins/with-local-only-notifications.js` — the `aps-environment` stripper (§2.4).
- `knip.json` — the four modules are listed under the `apps/mobile` workspace's
  `ignoreDependencies`: front-loading means no JS imports them yet, and knip cannot see a native
  module that is only autolinked. **Delete an entry when its plan lands and imports it** — that
  restores the dead-dependency check for the one dependency it can actually check.
- `apps/mobile/modules/` — the row-engine module (Swift + its TS surface).
- `.agents/skills/architecture/reference/mobile.md` — the granted rule-5 exception.

## 5. The standing constraint

**A future feature needing native surface outside this core is a planning decision to flag, never a
silent build.** Adding a native dependency mid-plan moves the fingerprint and strands every installed
app until someone opens a Mac. Say so, price it, batch it — the same way this plan batched these six.

## 6. Verification

**Static (the rule-3 gate).** From the repo root: `pnpm verify`.

**Fingerprint.** `npx expo-updates fingerprint:generate` before and after must differ — that is the
proof this batch is a build, and the number to quote when asking for one.

**Runtime.** A dev-client build (`pnpm dev:build`, or `sim:build` + `sim:install` for the simulator),
then, per module: paste a pairing link via the clipboard; a haptic on a commit; the row engine
rendering a real diff; a scheduled local notification arriving with the app backgrounded (grant the
permission prompt first, and note iOS may delay the background task by minutes — schedule one
directly to prove the notification path, then observe the task separately). Full recipe and the
LAN-URL trap: `README.md` → *Shared verification recipe*. Dev daemon on 43118 only.
