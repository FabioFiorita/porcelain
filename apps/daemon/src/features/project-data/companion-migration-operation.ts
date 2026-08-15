import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { MigrateCompanionInput, MigrationReportValue } from '@porcelain/contracts/project-data'
import { migrateCompanion as runMigration } from '@shared/companion-migration'
import type { MigratedWorktree } from '@shared/companion-migration-records'

/**
 * `project-data.migrateCompanion` — the daemon's entry point to the one-time
 * companion migration (#27).
 *
 * The conversion itself is `@porcelain/shared/companion-migration`, the same
 * module `porcelain migrate apply` runs. The CLI has no daemon transport
 * (scripts/lint-cli-boundary.mjs), so a daemon-only implementation would have
 * forced a second copy — and two migrations that disagree about what a Board
 * card becomes is the worst possible bug in a one-shot operation.
 *
 * What this layer owns is the part the CLI resolves differently: the EXPLICIT
 * target. `path` must be a live Worktree of `projectId`, compared through
 * `realpath` so a symlinked-but-equivalent checkout is accepted and a lookalike
 * one is not. An ambiguous target is refused, never guessed — the same rule
 * Canvas promotion already enforces (`projects.overlay-target-invalid`).
 */

export type MigrationWorktreesResult =
  | { readonly ok: true; readonly value: readonly MigratedWorktree[] }
  | { readonly ok: false }

export type MigrationWorktrees = Readonly<{
  listWorktrees: (projectId: string) => Promise<MigrationWorktreesResult>
}>

export type CompanionMigrationResult =
  | { readonly ok: true; readonly value: MigrationReportValue }
  | { readonly ok: false; readonly error: { readonly code: 'request.invalid' } }

export type CompanionMigration = Readonly<{
  migrateCompanion: (input: MigrateCompanionInput) => Promise<CompanionMigrationResult>
}>

const invalid = (): CompanionMigrationResult => ({
  ok: false,
  error: { code: 'request.invalid' },
})

export function createCompanionMigration(options: {
  /** Resolved `porcelainHome()` — where every new owner's store lives. */
  homeDir: string
  worktrees: MigrationWorktrees
  /** Seam for tests; production always runs the shared routine. */
  run?: typeof runMigration
}): CompanionMigration {
  const run = options.run ?? runMigration
  return Object.freeze({
    async migrateCompanion(input: MigrateCompanionInput): Promise<CompanionMigrationResult> {
      const listed = await options.worktrees.listWorktrees(input.projectId)
      if (!listed.ok) return invalid()

      let requested: string
      try {
        requested = await realpath(resolve(input.path))
      } catch {
        return invalid()
      }

      let target: MigratedWorktree | undefined
      for (const worktree of listed.value) {
        let candidate: string
        try {
          candidate = await realpath(resolve(worktree.path))
        } catch {
          continue
        }
        if (candidate === requested) {
          target = worktree
          break
        }
      }
      if (target === undefined) return invalid()

      const report = await run({
        repoPath: target.path,
        homeDir: options.homeDir,
        projectId: input.projectId,
        worktreeId: target.id,
        worktrees: listed.value,
        dryRun: input.dryRun === true,
      })
      return { ok: true, value: report }
    },
  })
}
