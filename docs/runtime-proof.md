# Runtime proof

Proof is the changed behavior observed in a real client. A build that succeeds, a command that
exits zero, and a window that opens are not proof of it. Reach for proof when the deliverable is
user-facing, remote, Electron, or mobile; the shared task, worktree, daemon, and process-ownership
loop stays in [development.md](development.md).

## Pick the surface

Each surface has a skill that owns its driving loop, its traps, and its cleanup:

| The change is visible in | Skill |
| --- | --- |
| `apps/web`, or a daemon procedure seen through the UI | `prove-web` |
| The Electron shell — preload, IPC, windows, menus | `prove-desktop` |
| `apps/mobile` on Android | `prove-android` |
| `apps/mobile` on iOS | `prove-ios` |

Browser and Electron load the same web client, so renderer-only behavior is cheapest on the browser
and reaching for Electron buys nothing. Mobile adds native lifecycle, installation, and terminal
rendering on top of the same daemon contracts. A change that spans clients is proved on each
surface it touches, and the surfaces that stayed unproved are named as such.

Proof runs on the development daemon and a playground; an automated check uses the E2E helpers'
isolated home, token, and fixture repository.

## Mobile delivery

The native fingerprint decides the route, and `eas fingerprint:compare` decides the fingerprint:

| Change | Simulator or emulator | Phone |
| --- | --- | --- |
| Fingerprint unchanged | Metro Fast Refresh | `eas update` |
| Fingerprint moved | Matching local native build, or EAS when local tooling is unavailable | EAS workflow for iOS; local Android development build |

## Completion

Runtime proof is complete when the changed behavior was observed in the selected client, the final
state was inspected, every process and fixture the run owns was cleaned up, and the command plus
its result is recorded.
