# Development playgrounds

These committed templates are inputs, not working Git repositories.
The review-project template becomes a disposable repository with a local bare remote,
main and review worktrees, two commits, staged and unstaged edits, and an untracked file.

Run `pnpm dev:playground` from the repository root. It creates a unique run under
`.playgrounds/`, starts the API and Vite, and prints the token-file path.
Open the web URL and paste that file's contents into Access token.
Ctrl+C stops the owned processes and removes that run. The template stays unchanged.

All generated repositories, worktrees, databases and credentials live in the ignored
`.playgrounds/` directory. Do not register work repositories in this environment.
Automated tests generate independent runs in the OS temporary directory.

## Codex run actions

The Codex environment provides **Playground**, **Playground (manual auth)**, and
**Web only** actions. Stop the current run before switching; all use port 5173.

**Playground** runs `PORCELAIN_PLAYGROUND_BRIDGE=1 pnpm dev:playground`.
Open TanStack Devtools and select **Playground** to reveal or copy the token, or
connect directly. Connection still uses the normal authenticated inventory API.

The bridge is off by default. **Playground (manual auth)** explicitly sets
`PORCELAIN_PLAYGROUND_BRIDGE=0`, removing the panel and credential endpoint while
keeping the same disposable API for authentication testing. Restart after changing
the flag. Production builds and preview never enable the bridge.

Each launch generates its token automatically. Restarting creates a fresh playground
and token; replacing only the token file would not update the running server.
