# Development playgrounds

These committed templates are inputs, not working Git repositories.
The review-project template becomes a disposable repository with a local bare remote,
main and review worktrees, and a runnable Fieldnotes task-board application.
The template needs no dependency installation: run `node server.mjs` inside a generated
worktree to open the sample app, or `node --test tests/task-store.spec.mjs` for its domain tests.
Porcelain starts only its own API and web client; the sample app is optional.

The generated history tells the story of planning, task modeling, an HTTP endpoint,
and a responsive board. Main and review then advance independently. Review has an
unpushed commit and a saved filtering experiment available through stash actions.
Its pending review includes a staged document rename and addition, staged and
unstaged README edits, a stylesheet diff, a deleted obsolete plan, untracked notes
and a PNG, and ignored preview cache. These scenarios exercise file browsing,
text/binary inspection, commit history, diffs, branch comparison and Git actions
without network accounts. The local bare remote supports fetch and push.

Startup also seeds two live review layers aligned with the pending changes, a
code-range comment and reply on `src/task-store.mjs`, a pinned `src` directory,
hidden `.cache` directory, and a stored HTML launch-review report. The review-guide
commit has an explicitly associated immutable review layer; later live ordering
changes leave its history snapshot intact. Deleted and untracked files remain
unassigned so the review can show both grouped and unassigned changes.

Use the authenticated API for these server features as the client grows. Artifact
storage is available; isolated artifact rendering and sharing are not implemented.
Git actions mutate this disposable state: prepare, execute with a fresh request ID,
and inspect the receipt. Restart the playground to restore every example, branch,
stash and private record. No remote account, external project or manual reset is needed.

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
