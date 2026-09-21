# Browser connection and inventory

The browser talks to the API on its own origin. Vite proxies `/api` during development, and the persistent server can host the built client and API together. The browser never chooses a proxy target, and the server does not add permissive CORS as a substitute for a same-origin deployment.

A device redeems a single-use pairing grant. Its credential is returned as an HttpOnly, SameSite cookie scoped to `/api`, never exposed to application JavaScript or browser storage. Reload validates that session before restoring inventory. Disconnect expires the browser session cookie; revoking the paired device through the owner CLI invalidates the underlying credential.

Cookie-authenticated unsafe requests also require the server's origin checks. SameSite is an additional defense rather than the sole CSRF boundary. The current LAN deployment uses HTTP; HTTPS and reverse proxies require an explicit trusted-proxy and public-origin design.

The portable client owns transport and contract validation. Browser adapters opt into same-origin cookies; query code owns inventory cache identity and rejects data from a different environment. Disposable playgrounds pair through the local owner socket and use isolated repositories and SQLite state. The development bridge mints a pairing grant; it does not expose a reusable shared token or place one in browser assets.
