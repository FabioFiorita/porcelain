# Browser inventory

The first client workflow connects to one configured environment, reads its inventory,
refreshes discovery and selects a worktree. It uses the existing authenticated inventory
contracts; registering projects, file viewing and live updates remain later user paths.

The web development server proxies same-origin `/api` requests to a configured local API.
The browser never chooses a proxy target. This establishes the local browser path without
adding permissive CORS or a second authentication protocol. Production asset hosting,
arbitrary remote connections and Electron transport still require separate integration.

The access token is entered in a password field, held only in memory, and excluded from
URLs, query keys and persistent browser storage. Disconnect aborts active requests, clears
the query cache and drops the connection. Reload requires a new connection. This is
session access, not token provisioning or durable credential management.

The portable client package owns authenticated inventory requests and contract validation.
Its transport is injected so browser globals stay at the application boundary. Redirects,
ambient cookies and HTTP caching are disabled. Transport failures preserve their cause;
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

## Optional playground bridge

The disposable launcher may opt into a Vite-only credential bridge with
`PORCELAIN_PLAYGROUND_BRIDGE=1`. It passes its own token-file path to Vite without
embedding credentials in browser assets. The bridge reads that single file only on
an explicit same-origin POST with the development request header. It rejects other
origins, non-loopback hostnames, and cross-site fetch metadata; responses are not cached.
The filesystem serving deny list also blocks the selected token and generated playgrounds.

A TanStack Devtools panel can reveal/copy credentials or connect using the existing
authenticated inventory transport. It does not change server authentication or save
credentials in browser storage. Both login paths share an attempt generation: the first
successful connection or a disconnect invalidates outstanding login completions. Normal development defaults to the manual login path;
`0` explicitly disables the panel and endpoint. Build and preview disable them regardless
of the flag. This is local fixture tooling, not a public token-provisioning API.
