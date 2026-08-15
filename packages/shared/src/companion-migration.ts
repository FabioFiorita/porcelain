import {
  emptyReport,
  type MigrateCompanionInput,
  type MigrationReport,
  record,
} from './companion-migration-report'
import {
  type Commit,
  migrateActions,
  migrateBoard,
  migrateReviews,
  migrateScope,
  reportRetired,
} from './companion-migration-steps'
import { isDirectory, readMigrationLedger, writeMigrationLedger } from './companion-migration-store'
import { projectPorcelainDir } from './project-porcelain'

/**
 * The one-time migration from the repo-local companion to the daemon-root owners
 * (#27). Runs per checkout, against an explicit Project id, and is invoked by a
 * human or an agent — never on daemon startup, because a store rewrite that
 * happens because a process restarted is a store rewrite nobody chose.
 *
 * Three properties make it safe to run again:
 *
 * 1. **A ledger, not a heuristic.** `$PORCELAIN_HOME/projects/<id>/migration.json`
 *    records every source key it has converted, and is written after EVERY item.
 *    A crash halfway leaves the finished half recorded; the next run continues.
 * 2. **Destination-aware writers.** Every conversion also reads its destination
 *    and merges, so even a lost ledger cannot duplicate a Task or an Action.
 * 3. **Nothing is deleted.** The legacy files are left exactly where they are —
 *    the human removes them at the #28 cutover, once they have seen the report.
 *
 * `dryRun` walks the same code path and returns the same report; it simply never
 * writes. That is deliberate: a plan produced by a second, simpler code path is
 * a plan that can be wrong about what the real one would do.
 */

export {
  emptyReport,
  type MigrateCompanionInput,
  type MigrationItem,
  type MigrationItemKind,
  type MigrationOutcome,
  type MigrationReport,
  renderMigrationReport,
} from './companion-migration-report'

export async function migrateCompanion(input: MigrateCompanionInput): Promise<MigrationReport> {
  const dryRun = input.dryRun === true
  const clock = input.now ?? (() => new Date().toISOString())
  const report = emptyReport({
    projectId: input.projectId,
    repoPath: input.repoPath,
    dryRun,
    ranAt: clock(),
  })

  if (!(await isDirectory(projectPorcelainDir(input.repoPath)))) {
    record(report, {
      kind: 'retired',
      source: '.porcelain',
      outcome: 'already-migrated',
      detail: 'this checkout has no repo-local companion directory; nothing to migrate',
    })
    return report
  }

  const ledger = await readMigrationLedger(input.homeDir, input.projectId)
  // Written after every item, not once at the end: that is what makes a crashed
  // run resumable rather than one that starts over and duplicates its own work.
  const commit: Commit = async (key, fingerprint, createdId) => {
    ledger.entries[key] = {
      fingerprint,
      migratedAt: clock(),
      ...(createdId === undefined ? {} : { createdId }),
    }
    if (!dryRun) await writeMigrationLedger(input.homeDir, input.projectId, ledger)
  }

  await migrateReviews(input, report, ledger, commit, clock, dryRun)
  await migrateBoard(input, report, ledger, commit, clock, dryRun)
  await migrateActions(input, report, commit, dryRun)
  await migrateScope(input, report, ledger, commit, dryRun)
  await reportRetired(input.repoPath, report)
  return report
}
