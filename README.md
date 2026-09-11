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
