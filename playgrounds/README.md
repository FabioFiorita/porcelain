# Development playgrounds

These committed templates are inputs, not working Git repositories.
The review-project template becomes a disposable repository with a local bare remote,
main and review worktrees, two commits, staged and unstaged edits, and an untracked file.

Run `pnpm dev:playground` from the repository root. It creates a unique run under
`.playgrounds/`, starts the API and Vite, and prints the token-file path.
Open the web URL; the client authenticates automatically.
Ctrl+C stops the owned processes and removes that run. The template stays unchanged.

All generated repositories, worktrees, databases and credentials live in the ignored
`.playgrounds/` directory. Do not register work repositories in this environment.
Automated tests generate independent runs in the OS temporary directory.

## Codex run actions

The Codex environment provides **Playground**, **Playground (manual auth)**, and
**Web only** actions. Stop the current run before switching; all use port 5173.

**Playground** runs `pnpm dev:playground` and authenticates once on each page load.
Disconnect leaves you disconnected until you reconnect or reload.

**Playground (manual auth)** runs `pnpm dev:playground --manual`. It waits for you
to connect. Both modes include the **Playground** tab in TanStack Devtools, where you
can reveal/copy the token or click **Connect to playground**. Manual token entry also
remains available. All connections use the normal authenticated inventory API.

No environment flag is needed. Production builds and preview never enable the bridge
or automatic authentication. **Web only** starts Vite without a generated playground.

Each launch generates its token automatically. Restarting creates a fresh playground
and token; replacing only the token file would not update the running server.
