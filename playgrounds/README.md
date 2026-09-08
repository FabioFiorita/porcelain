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
