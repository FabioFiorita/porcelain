# Local Mac app

Use the Node version in `.node-version`, pnpm 12.3.4, Git and Xcode Command
Line Tools. Install workspace dependencies with `pnpm install`.

Build, sign for this Mac, and install:

```sh
pnpm desktop:install
open /Applications/Porcelain.app
```

The command builds the web with Vite's `desktop` mode, bundles the Electron
host and server separately, and rebuilds `better-sqlite3` for the pinned
Electron version in a disposable staging directory. It packages native
libraries and the macOS trash executable outside ASAR. The installed app
requires neither a separately installed Node runtime nor a development server.

Signing uses an ad-hoc identity. No Apple certificate, notarization, updater,
or distribution workflow is involved. Installation verifies the copied
signature and retains the previous app in
`~/Library/Caches/Porcelain/build-backups.noindex/`.

The app keeps its profile and server data in
`~/Library/Application Support/Porcelain/`. The server owns the `server/`
subdirectory and has its own database and owner socket. Development servers
keep their separate data. The desktop pairs itself through that owner socket;
the renderer has no Node access or privileged IPC.

Closing the last window keeps the server running. Activating Porcelain in the
Dock opens its window again. Quit or Command-Q closes the windows, stops the
managed server and exits the app.

## Proof

```sh
pnpm check
pnpm verify:desktop installed-project
```

The desktop feature map lives in `scripts/desktop-feature-map.ts`. The command
launches the installed app against a disposable real Git repository and an
isolated profile. It checks project registration, SQLite creation, window
close, Dock activation, project and pairing persistence after restart, and
server shutdown. Evidence is retained under `dist/desktop/evidence/`.

The HTTP net and browser journeys retain their Linux namespace sandbox.
Run their branch checkpoint on Linux. The macOS network parser specs use
route and ARP output captured on a Mac and preserve the existing LAN rule:
the default physical interface must have a known subnet, gateway and router
hardware address before that network can be approved.
