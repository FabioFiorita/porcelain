# Browser inventory

The first client workflow connects to one configured environment, reads its inventory,
refreshes discovery and selects a worktree. It uses the existing authenticated inventory
contracts; registering projects, file viewing and live updates remain later user paths.

The web development server proxies same-origin `/api` requests to a configured local API.
The browser never chooses a proxy target. This establishes the local browser path without
adding permissive CORS. Production asset hosting,
arbitrary remote connections and Electron transport still require separate integration.

Browser login validates the entered bearer token and issues a signed, 30-day HttpOnly,
SameSite=Strict cookie scoped to `/api`. The credential is not saved in localStorage or
sessionStorage. Reload validates the cookie before restoring inventory. Failed restoration
leaves manual login available. Disconnect clears the cookie before dropping the connection;
a failed logout reports an error and permits retry. Disposable playground credentials stay
memory-only. Bearer authentication remains available to agents and portable clients.

Cookie authentication and logout require a custom browser header. No CORS permission is
provided, preventing other origins from sending that header with cookies. SameSite is an
additional defense, not the sole CSRF boundary. The signature is derived from the configured
server token and expires on the server, so sessions survive restarts and token rotation
invalidates them. Logout removes the browser cookie; it does not revoke copied cookies.
The current LAN deployment uses HTTP; Secure cookies and trusted proxy configuration must
be established when introducing HTTPS. Cookies are host-scoped, not port-isolated, so other
services on this LAN hostname must also be trusted.

The portable client package owns authenticated inventory requests and contract validation.
Its transport is injected so browser globals stay at the application boundary. Redirects,
HTTP caching and ambient cookies are disabled by default. The browser session adapter
explicitly opts into same-origin cookies and supplies the required browser header. Transport failures preserve their cause;
the UI displays safe messages rather than server response bodies.
TanStack Form owns connection input, Query owns inventory, and Router owns the selected
worktree ID. Inventory keys include environment identity. A response from a different
environment is rejected until the user reconnects. Manual refresh uses the server's
discovery operation and retains the last inventory with an explicit stale-data warning
when it fails. Unavailable projects and worktrees remain visible.

Committed templates under `playgrounds/` seed generated repositories. Interactive runs
use an ignored `.playgrounds/` directory; tests use independent temporary directories.
Each run owns its API, Vite process, local Git remote, worktrees and SQLite state, and
removes them on shutdown. No real projects or credentials are fixtures.

Browser smoke covers the built client through the actual proxy/API with real Git inventory,
rejected authentication, refresh, selection and disconnect. Controlled responses cover
empty/unavailable inventory and failures. Client specs protect request policy and schema
validation. These checks do not establish Electron, mobile or remote deployment behavior.

## Development playground connection

The disposable launcher enables a Vite-only credential bridge for both automatic and
manual development modes. It passes its own token-file path to Vite without embedding
credentials in browser assets. The bridge reads that single file only on a same-origin
POST with the development request header. It rejects other origins, non-loopback hostnames,
and cross-site fetch metadata; responses are not cached. The filesystem serving deny list
also blocks the selected token and generated playgrounds.

`pnpm dev:playground` authenticates once on page load. `--manual` waits for a user action.
Both modes include a TanStack Devtools panel for reveal/copy/connect and retain manual
token entry. All paths use the existing authenticated inventory transport without saving
credentials in browser storage. Login paths share an attempt generation: the first successful
connection or a disconnect invalidates outstanding login completions. Disconnect does not
trigger another automatic attempt; a reload does. Failed automatic attempts leave manual
connection available.

The launcher supplies the internal bridge and automatic-connection flags to Vite.
Standalone Vite has neither enabled by default; build and preview disable both regardless
of those flags. This is local fixture tooling, not a public token-provisioning API.
