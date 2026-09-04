# Worktrees and parallel development

Use this reference when work needs isolation or coordinated contributors. It describes repository
development; it does not authorize creating user-visible Codex tasks, publishing, or deleting work.
The command authority is [worktree.mjs](../../../../scripts/worktree.mjs); inspect its current help
and [development.md](../../../../docs/development.md) when selecting commands.

## Select the checkout

- **One direct change in the primary checkout:** work on `main` as allowed by
  [AGENTS.md](../../../../AGENTS.md). Inspect current status and preserve unrelated edits. Run
  `pnpm dev:env`; the primary development profile remains separate from production.
- **Codex-created task checkout:** [.codex/environments/environment.toml](../../../../.codex/environments/environment.toml)
  invokes `node scripts/worktree.mjs codex-bootstrap <checkout-path>`, then
  `pnpm install --frozen-lockfile`. Bootstrap validates the linked Codex worktree and allocates its
  profile/playground while preserving detached HEAD or an existing branch. Its managed metadata has
  `branch: null`; that describes runtime ownership, not a requirement to stay detached. Repeating
  bootstrap reuses a valid profile. In the primary checkout it is a no-op.
- **Repository-managed checkout:** from the primary checkout, use `pnpm worktree create <slug>`.
  Default base is committed `main`; using that base requires the primary checkout to be on `main`.
  `--base <ref>` selects another committed base. It currently creates `work/<slug>`, installs
  dependencies, and allocates a sibling checkout plus profile/playground. Follow the returned paths
  and verify them with `pnpm dev:env`; do not manually reproduce its allocation logic.
- **Existing detached external checkout:** `pnpm worktree adopt <path> <slug>` from the primary
  checkout converts it in place to the managed `work/<slug>` branch and allocates its runtime. This
  differs from Codex bootstrap, which preserves Git state. Adoption refuses an already-branched or
  already-managed checkout.

Use `pnpm worktree list` and `git worktree list --porcelain` to establish the actual allocations.
Creation normally refuses a dirty primary checkout. Resolve the ownership/base question instead
of adding `--force` as routine recovery: creating a worktree never includes uncommitted base files.
If a new implementation branch is needed outside the managed command, follow the repository and
user's naming instructions; do not rename a managed branch away from its recorded identity.

The current Codex setup and cleanup hook strings use Bash `${CODEX_WORKTREE_PATH:-$PWD}` syntax.
Do not assume those strings work under native PowerShell or claim setup ran because the file exists.
If hook setup fails, report the shell/error and inspect the checked-out configuration. From the
verified checkout, the direct Node bootstrap command with its explicit absolute checkout path avoids
shell-specific fallback expansion; install dependencies afterward, then verify `pnpm dev:env`.
This recovery does not prove or repair the hook itself. Never launch an unmanaged task checkout
whose resolved profile still belongs to the primary checkout.

## Coordinate changes and tools

Give each contributor a bounded outcome, checkout, owned files, and validation surface. Parallel
contributors sharing a checkout need disjoint file ownership. Assign a single owner for contracts,
lockfiles, shared configuration, and integration edits; sequence consumer work after the shared
interface is agreed. Read-only investigation can proceed while that owner works. Separate
worktrees isolate files and profiles, but still share Git references and machine resources.

Transfer the exact shared-interface commit into each consumer checkout before validating it.
Record which checkout and revision supply the daemon: a running Electron-owned daemon may still
serve an older contract even after the consumer checkout has the new code.

Choose tools by the evidence needed:

- Use shell, source inspection, and focused tests for contracts, daemon logic, and deterministic
  behavior. Prefer current package scripts over invented command variants.
- Use a browser runtime for web interactions. Independent operators may use separate browser
  sessions with separate development profiles and disposable fixtures; record their ownership.
- Use the Computer Use skill's native Windows tools for Electron window behavior and Android tools
  addressing an explicit serial for native mobile behavior. One operator owns shared native UI at
  a time. A separate terminal or worktree does not isolate foreground focus or a shared emulator.

Agree process/profile ownership before launch. Do not start a second daemon on a profile already
owned by Electron. Coordinate builds/restarts with every client using that daemon. Device installs,
Metro switching, pairing, and test fixtures on a shared device also require operator handoff.
Use the [entrypoint](../SKILL.md) readiness and evidence manifest for each assigned surface.

## Integrate and validate

Before integration, each owner reports changed files, source revision, checks actually run,
observed runtime outcomes, and unresolved dependencies. Integrate in dependency order: contracts
and owning behavior, shared client semantics, then consumers. Review the combined diff and preserve
unrelated work. A contributor's passing checks do not establish the combined revision's behavior.

Format changed files and run the smallest checks that demonstrate the integrated change. Follow
AGENTS.md for broad changes requiring `pnpm verify`. Rebuild/restart the affected outputs using
development.md, then collect evidence on the integrated revision for each affected client. Do not
call old captures current after source or built output changes. Source review, tests, and UI proof
answer different questions; record remaining surface gaps explicitly.

## Remove only completed, owned resources

First preserve requested evidence outside any checkout/playground scheduled for deletion and stop
task-owned client/Metro processes. Verify ownership of remaining processes, device state, and paths.
From the primary checkout, `pnpm worktree remove <slug>` checks cleanliness and integration into
the recorded base, stops the profile's recorded daemon, and deletes the checkout, managed branch
when present, channels, user data, and playground. Inspect the exact allocation before removal;
do not bypass a failed guard merely to finish cleanup.

`codex-cleanup <checkout-path>` is the Codex checkout-deletion hook. It validates the exact profile
owner and calls removal with force, so it is not a safe substitute for ordinary completed-work
cleanup. Use it only within authorized deletion of that task checkout after preserving work.
`pnpm worktree cleanup` considers multiple managed and eligible harness checkouts; avoid it for a
single task's cleanup. Prefer its exact slug and leave other tasks alone. Report resources retained
for continued work, including their ownership and how to resume them.
