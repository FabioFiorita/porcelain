import type { MigratedWorktree } from './companion-migration-records'

/**
 * What the one-time companion migration (#27) says about itself.
 *
 * The report is the whole point of the operation, not a log of it: legacy files
 * are never deleted, so the human's next move — delete `.porcelain/` at #28's
 * cutover, or go rescue something first — is decided entirely by reading this.
 * Anything the migration could not convert therefore has to appear here with a
 * reason, never be silently absent.
 *
 * `packages/contracts/src/project-data` mirrors these shapes on the wire; the
 * CLI renders the same values as text. One record, two presentations.
 */

export type MigrationOutcome = 'converted' | 'already-migrated' | 'unsupported' | 'failed'

export type MigrationItemKind = 'review' | 'task' | 'action' | 'overrides' | 'retired'

export type MigrationItem = {
  kind: MigrationItemKind
  /** Human-readable source, e.g. `.porcelain/reviews/2026-08-01`. */
  source: string
  outcome: MigrationOutcome
  /** Why it was skipped, retired, or failed. */
  detail?: string
  /** The id minted in the new owner, when one was. */
  createdId?: string
}

export type MigrationReport = {
  projectId: string
  repoPath: string
  dryRun: boolean
  ranAt: string
  items: MigrationItem[]
  counts: {
    converted: number
    alreadyMigrated: number
    unsupported: number
    failed: number
  }
}

export type MigrateCompanionInput = {
  repoPath: string
  homeDir: string
  projectId: string
  /** The Worktree this checkout is, when the caller knows it — stamped on Canvases. */
  worktreeId?: string | null
  /** Every live Worktree of this Project, used to infer Task references. */
  worktrees?: readonly MigratedWorktree[]
  dryRun?: boolean
  /** Injectable clock so a report is assertable without freezing global time. */
  now?: () => string
}

export function emptyReport(input: {
  projectId: string
  repoPath: string
  dryRun: boolean
  ranAt: string
}): MigrationReport {
  return {
    ...input,
    items: [],
    counts: { converted: 0, alreadyMigrated: 0, unsupported: 0, failed: 0 },
  }
}

/** Append one item and keep the counts in step — the only way an item is added. */
export function record(report: MigrationReport, item: MigrationItem): void {
  report.items.push(item)
  if (item.outcome === 'converted') report.counts.converted += 1
  else if (item.outcome === 'already-migrated') report.counts.alreadyMigrated += 1
  else if (item.outcome === 'unsupported') report.counts.unsupported += 1
  else report.counts.failed += 1
}

/** The stdout form of a report — the same content the JSON `--report` file carries. */
export function renderMigrationReport(report: MigrationReport): string {
  const head = report.dryRun
    ? `Migration PLAN for ${report.repoPath} (project ${report.projectId}) — nothing was written.`
    : `Migrated ${report.repoPath} (project ${report.projectId}).`
  const lines = [head, '']
  for (const item of report.items) {
    const detail = item.detail === undefined ? '' : ` — ${item.detail}`
    lines.push(`  [${item.outcome}] ${item.kind}: ${item.source}${detail}`)
  }
  if (report.items.length === 0) lines.push('  (nothing found)')
  lines.push(
    '',
    `converted ${report.counts.converted} · already migrated ${report.counts.alreadyMigrated} · unsupported ${report.counts.unsupported} · failed ${report.counts.failed}`,
    'Legacy files were left in place. Delete `.porcelain/` yourself once the new surfaces look right.',
  )
  return lines.join('\n')
}
