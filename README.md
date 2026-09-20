# Porcelain

A review workspace for code produced by agents working in other tools.
We are building the server and web experience first; Electron and mobile follow.

With Node from `.node-version` installed:

```sh
npx --yes pnpm@12.3.4 install --frozen-lockfile
pnpm dev
```

Open <http://127.0.0.1:5173> to review a disposable sample project through the real server.
Ctrl+C stops the processes and removes the sample state.

- [Product intent](docs/product.md)
- [Development](docs/development.md)
- [Architecture](docs/architecture.md)

For a persistent server that serves the built web app and can be opened from another device on
the LAN, run `pnpm serve --lan`. It keeps projects under `~/.porcelain/` and prints the local
address. Use `pnpm serve` for loopback-only access.

Nothing can reach it until you pair a device. On the machine running the server:

```sh
porcelain pair "Phone" --address <the address the command printed>
```

That prints a link, good once, that you open on the device itself. The address has to be one this
server answers at, so use what `pnpm serve` printed; the not-paired screen in the browser shows the
whole command with the right address already filled in. `porcelain devices` lists
what is paired and `porcelain revoke <id>` ends it, immediately and including whatever that
device has open.

To assemble the plain-Node package used by `npx @fabiofiorita/porcelain serve`, run
`pnpm build:package`; it writes the ignored publishable package to `dist-porcelain/`.
