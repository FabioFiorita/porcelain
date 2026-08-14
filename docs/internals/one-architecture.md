# Data flow and runtime traps

The domain ownership rules live in [`domain-architecture.md`](domain-architecture.md). This page
keeps the cross-surface details that are easy to break: daemon transport, shell lifecycle, session
recovery, Web navigation, mobile transport, and state ownership.

## The daemon is always a server

```text
contracts catalog
  → daemon composition root
    → canonical domain router
      → operation → rules/ports → adapters
        → HTTP procedure result or WS notification/stream
          → client-runtime semantics
            → Web/mobile feature adapter → presentation
```

The renderer never calls daemon code in-process. Local and remote use the same HTTP/WS path, so
transport behavior cannot diverge merely because the daemon is on the same machine. The daemon
serves the Web client to both a plain browser and Electron; only platform integration differs.

The daemon prints one `{"port": N}` line at boot. Desktop owns its child lifecycle through
`utilityProcess.fork`, capped restart backoff, and local-window URL updates. Standalone daemons
retain their parent-death watchdog unless launched with `--no-watchdog`. Private LAN/Tailscale
listeners reconcile enabled sockets over time because interfaces can appear after boot. Exposure,
pairing, and token policy belongs to the Remote domain and
[`remote-setup.md`](../remote-setup.md).

## Shell and environment bindings

The Electron shell is a thin platform boundary. It owns windows, menus, updater, local process
startup, and the shell-only IPC surface; it does not become a second application backend. A window
binding is keyed by `webContents.id`, so different windows may use different daemon environments.
Tokens remain in the main process and never cross into the renderer.

An environment has one identity with multiple endpoints. Endpoint kind is derived from the address
while preference is stored by kind. Failover is sequential and preference-ordered, not a race;
unauthorized stops immediately because it means re-pair, not wake. Reachability updates last-known-
good only; it never moves the user's preference. Writers that probe before saving must update by
environment id after the await, never write an old array snapshot that can resurrect a removed
environment.

The renderer session is an instance, not a module-global socket. Each instance owns its socket,
listeners, pending requests, and reconnect backoff. A remote-bound window may still need a local
Terminal, so it can own the separate local session; do not add extra sessions for ordinary data.
The active window's project belongs to the primary session's machine.

## Session protocol

`packages/contracts` is the single source for session frame shapes and `AppEvent` definitions. The
`/session` WebSocket carries application notifications and Terminal lifecycle/data frames; it is
not tRPC. On a reconnect, resend session hello, file/directory watches, and Terminal attachments:
server-side session state ends with the socket.

Notifications are recoverable signals. A client invalidates or reconciles the affected query family,
then reads server truth. They do not carry a second mutable copy of the domain. Terminal output is
the exception: it is an ordered bounded stream with request ids, epochs, sequence/lifecycle rules,
detach/attach behavior, and bounded scrollback. Do not reduce it to cache invalidation.

The browser client may use a polling backstop for selected expensive/recoverable reads. Mobile polls
only while a relevant screen is focused and uses the same freshness semantics to respect battery and
cellular limits.

## Web navigation and state

Web navigation is held by the tabs store rather than URL routing. A tab's `(kind, path, line)` is
the navigation state; ids are always produced by `tabId(kind, key)`. Viewer dispatch is exhaustive,
so adding a Web tab kind requires a compiler-visible Viewer case. Preview tabs are replaced by the
next single-click, while pinned tabs are sticky; split view is pane state, not a second tab model.

Mobile has its own native navigation and screen model. It shares contracts, client-runtime
semantics, and daemon transport with Web, but does not copy Web tab state or UI components. A
mobile feature owns its transport hook at the `src/lib/daemon` seam, uses NativeWind v5, and
exposes stable test ids/accessibility labels for runtime proof.

When adding a Web tab, add pure rules and tests, the domain procedure if needed, client-runtime
semantics, the feature adapter/hook, `TabKind`, the view, the opener, the exhaustive Viewer case,
and any keyboard binding. When adding a mobile surface, keep it in the owning feature or registered
supporting region; compose existing domain queries rather than creating a parallel procedure.

Quick Open is the landed example of that supporting-region rule. Its mobile sheet composes Files,
Actions, and Git queries locally, debounces file search, filters non-local actions, and hands
selection to existing viewer/Terminal navigation. It is not content search, a new daemon domain, or
a second action executor.

## Query and mutation boundaries

Client components render data and intent. They do not import transport clients. In Web, imports of
`lib/trpc` and `lib/daemon` from `components/**` are prohibited; domain hooks/stores and feature
adapters are the seam. In mobile, `src/lib/daemon` is the only daemon seam; feature hooks use
client-runtime query/mutation definitions and the native adapter.

| Concern | Owner |
|---|---|
| Daemon/server truth | client-runtime query definitions + client query cache |
| Mutation invalidation and foreign effects | client-runtime mutation definitions or an explicit cross-domain feature workflow |
| Realtime freshness | client-runtime notification effects + a session bridge |
| Cross-component UI | one focused store |
| Reload-persistent preferences | the preferences store only |
| Local presentation | component state |

Mutations invalidate the smallest affected families. A whole-cache invalidation is valid only for a
command such as pull or stash whose effect is genuinely global. Cross-domain effects are explicit;
they are not hidden in an event handler or a recursive operation call.

## Browser and tailnet traps

The tailnet browser client is an insecure HTTP context by design: WireGuard protects the wire, but
browser APIs such as `crypto.randomUUID` and `navigator.clipboard` are unavailable there. Use the
shared `randomId()` and `copyText()` helpers. Context-menu paste has no polyfill; native keyboard
paste remains the browser's responsibility.

Keyboard ownership is tiered: Electron `before-input-event` only overrides an OS default; app-global
bindings live in the Web shortcut hook; component listeners own local state; focused controls own
their chords. Terminal editing is translated in the Terminal registry, not by global window
listeners. Browser modifier remapping follows the client platform, and terminal focus must not
trigger destructive file shortcuts.

## Proof and change discipline

Pure daemon rules and operations carry most regression coverage. Adapter tests prove real host
representations; contract tests prove exact wire shapes; router tests prove one-operation binding
and public error mapping; client-runtime tests prove query/mutation/freshness/session behavior; Web
and mobile feature tests mock the domain seam, not tRPC internals. Playwright runs against the
browser client and an isolated development daemon; it is not proof against the installed app or
the production daemon.

Run `pnpm quality:changed` for touched files and `pnpm verify` for the completed unit. Runtime proof
is proportional to user-visible risk, but every change closes the chain from intention to test,
gate, and durable documentation.
