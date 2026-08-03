# @porcelain/shared

Pure helpers used by more than one app/package (daemon, CLI, web, shell). Not the
wire contract — that is `@porcelain/contracts`. Not client session logic — that is
`@porcelain/client-runtime` (when extracted).

No build step; consumers resolve TypeScript source via workspace exports or the
`@shared/*` / `@porcelain/shared/*` aliases (same electron-vite externalization trap
as contracts: do not promote this to a desktop `dependencies` entry while
electron-vite still bundles the CLI/daemon).

Subpath imports only — no root barrel.
