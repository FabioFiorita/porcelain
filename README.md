# Porcelain

Porcelain is a server and web workspace for reviewing code produced by agents.
The server owns repositories and review data; the web app presents them.

With the Node version in `.node-version` installed:

```sh
npx --yes pnpm@12.3.4 install --frozen-lockfile
pnpm dev:server
```

`dev:server` currently requires Linux and `bwrap`. It mounts the source tree
read-only, hides the host home directory, creates a private temporary Git
repository and database, and starts the real API on a free loopback port. It
prints a JSON line containing its address and manifest path. Each invocation
owns its own state. Ctrl+C closes the server and removes its temporary files.

For a persistent installation, `pnpm serve` starts the server and built web app
using `~/.porcelain/`. `pnpm serve --lan` also accepts LAN connections; a device
must be paired before it can use the API.
