# Desktop app and daemon

These instructions apply to files under `apps/desktop/`. Mobile simulator and serve-sim setup is
scoped to `apps/mobile/AGENTS.local.md`; desktop-only or daemon-only work does not need it.

## Boundaries

- Renderer UI uses the existing shadcn/ui + Base UI architecture; do not hand-roll renderer
  primitives or introduce a second component library.
- `apps/desktop/src/backend/` owns the daemon and git/config plumbing. Load `audit` before changing
  main-process, IPC, config, file-read, or packaging behavior.
- The daemon shells out to the git CLI and serves the development stack on `43118`; production is
  `43117`. Never use production data or channels for product development.
- Keep one home per concern: Changes owns diffs/stage/commit, Review owns the review canvas, Files
  owns the tree, Board owns plans, and Terminal/Actions owns command execution.

## Verification

- Use the existing architecture and data seams rather than adding a second IPC or state pattern.
- Run targeted Vitest tests for backend/business logic and `pnpm verify` before committing.
- Mobile runtime instructions are intentionally out of scope here.
