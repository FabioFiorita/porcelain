# Mobile feature map

These are optional navigation notes for current screens and flows. Use direct Maestro as described in [mobile-verify](../SKILL.md), inspect the actual hierarchy and compare observable state. Source labels, related tests and routes are references, not a checked inventory or an API contract. Keep a note only while it helps a drive; no frontmatter format or synchronization checker is required.

| Feature | Screen | What it does |
| --- | --- | --- |
| [access.environment-status](access.environment-status.md) | /settings | Each environment row says Checking, Online, Offline, Needs pairing, Another server or Update needed from what its server answered. |
| [access.forget-environment](access.forget-environment.md) | /settings | Holding an environment row offers Forget environment, which removes it, its credential and its remembered workspace from this device, through a cold launch. |
| [access.lan-pairing](access.lan-pairing.md) | /settings | Pairing with a Porcelain on another computer over the local network and reconnecting after a cold launch; a manual checkpoint against a real LAN server. |
| [access.pairing](access.pairing.md) | /settings | Add environment pairs through a pasted link, refuses an invalid one, pairs several and restores them after a cold launch. |
| [access.settings](access.settings.md) | /settings | Settings lists the paired environments with their status and offers Add environment, or says none is paired. |
| [app.deep-links](app.deep-links.md) | / | The app's scheme opens Review, Files, History and Settings directly, warm or after a cold launch. |
| [app.phone-shell](app.phone-shell.md) | / | On a phone, four native tabs, ready on Review within 30 seconds of a cold launch. |
| [app.tablet-shell](app.tablet-shell.md) | / | On iPad, a SwiftUI three-column split that keeps its master and detail through sidebar collapse and rotation. |
| [files.files](files.files.md) | /files | Files shows its empty state; it reads no files yet. |
| [history.history](history.history.md) | /history | History shows its empty state; it reads no commits yet. |
| [projects.workspace-picker](projects.workspace-picker.md) | /files | The toolbar picker chooses an environment, project and worktree without leaving the destination and restores each environment's choice. |
| [reviews.review](reviews.review.md) | / | Review, where the app opens, shows its empty state; it reads no review yet. |

## Platform coverage

The direct interactive procedure was exercised on an iPhone simulator. Existing regression files include iPad cases; an iPhone drive does not prove them. Android and physical-device Local Network permission need separate native evidence.
