# Porcelain review prototype

A clickable, fully mocked prototype of the Porcelain review workspace, to be
built for real in `apps/web`.

```bash
npm install
npm run dev     # http://localhost:5181
```

Formatting and lint are the repository's Biome (`biome.json` here extends the root one,
as `design/server-lab` does), so `pnpm lint` and `pnpm format:check` at the root cover it.

- [`HANDOFF.md`](HANDOFF.md): what was decided, how to build it in `apps/web`,
  and which libraries to add and remove. Start here.
- [`PROTOTYPE.md`](PROTOTYPE.md): the spec, screen by screen, with the code that
  implements each part and the proposed contract changes.

Everything resets on reload. The **Prototype** pill at the bottom simulates what
only a real agent, Git or the network would do (an agent replying or rewriting code,
a dropped connection, a revoked browser).
