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

Run `pnpm dev` from the repository root. It creates a unique run under
`.playgrounds/`, starts the API and Vite, and prints the token-file path.
Open the web URL; the client authenticates automatically.
Ctrl+C stops the owned processes and removes that run. The template stays unchanged.

All generated repositories, worktrees, databases and credentials live in the ignored
`.playgrounds/` directory. Do not register work repositories in this environment.
Automated tests generate independent runs in the OS temporary directory.

## Profiles

Performance problems hide in small repositories, so `pnpm dev` opens the `app` profile:
the Fieldnotes story committed on top of generated history shaped like a mid-size
application (about 1,000 files, 2,000 commits with merges, six remote branches, an
agent worktree, 150 extra review changes and 60,000 ignored dependency files per
worktree). `pnpm dev --profile=monorepo` grows to 20,000 files, 50,000 commits,
200 remote branches and agent worktrees with 0, 50 and 400 changes, each with
400,000 ignored files. `--profile=fixture` is the story alone; preview, browser
smoke and tests use it. Numbers live in `apps/server/src/development/profiles.ts`.
Generated code stays under `apps/`, `packages/`, `services/` and `tools/`, so every
story path, commit and review record above still applies.

The first run of a profile generates its base into `.playgrounds/.cache`
(about 5 seconds for `app`, under a minute for `monorepo`); later runs clone it with
hard links in seconds. Changed history or file numbers regenerate the base, while
change counts apply per run. When generated content changes, the generator spec's
digest fails until `generatorVersion` in `helpers/synthetic-base.ts` is bumped with it;
bases of other versions are then removed. A monorepo run needs about 2.5 GB and
2.3 million inodes (its cached base 0.5 GB), so keep it off small temporary file
systems. Runs record their owner process, and the next start removes runs whose
owner was killed. Delete `.playgrounds/.cache` to reclaim space.

## Running

The Codex **Run Porcelain** action runs `pnpm dev`. Stop the current run before starting another;
the web uses port 5173. Use `pnpm dev --manual` when testing the connection form. The Playground
tab in Devtools can reveal the disposable token and reconnect the browser.

Production builds and preview never enable automatic authentication or the credential bridge.
Each launch generates fresh sample data and credentials.
