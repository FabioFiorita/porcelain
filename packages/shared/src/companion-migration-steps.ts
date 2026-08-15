import { randomUUID } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from './canvas-porcelain'
import {
  inferWorktree,
  mergeOverrides,
  planActionMigration,
  readBoardCards,
  readPrivateOverrides,
  readRepoScope,
  readStoredTasks,
  retiredChannelsPresent,
  storedTaskIds,
  taskForCard,
  writeActionsDocument,
  writePrivateOverrides,
  writeStoredTasks,
} from './companion-migration-records'
import {
  type MigrateCompanionInput,
  type MigrationReport,
  record,
} from './companion-migration-report'
import {
  type ReviewCanvasSource,
  readReviewConversion,
  writeReviewBundle,
} from './companion-migration-review'
import {
  fingerprintOf,
  isDirectory,
  type MigrationLedger,
  readJsonEnvelope,
  writeJsonEnvelope,
} from './companion-migration-store'
import { PROJECT_ACTIVE_DIR, PROJECT_REVIEWS_DIR, projectPorcelainPath } from './project-porcelain'

/**
 * One step per legacy channel: Reviews, the Board, Actions, hide/pin, and the
 * retired channels that get reported rather than converted.
 *
 * Each step catches its own failures and records them, so one unreadable review
 * cannot stop the Board behind it — a migration that aborts halfway through and
 * says nothing about the rest is a migration nobody can trust to finish.
 */

export type Commit = (key: string, fingerprint: string, createdId?: string) => Promise<void>

type CanvasIndexRecord = {
  id: string
  worktreeId: string | null
  title: string
  kind: 'html' | 'markdown'
  entryFile: string
  createdAt: string
  updatedAt: string
  template?: 'review'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Active review first, then every archived review, oldest directory name first. */
async function reviewSources(repoPath: string): Promise<ReviewCanvasSource[]> {
  const sources: ReviewCanvasSource[] = []
  const activeDir = projectPorcelainPath(repoPath, PROJECT_ACTIVE_DIR)
  if (await isDirectory(activeDir)) {
    sources.push({ kind: 'active', dir: activeDir, sourceId: 'active' })
  }
  const archiveRoot = projectPorcelainPath(repoPath, PROJECT_REVIEWS_DIR)
  let names: string[]
  try {
    names = await readdir(archiveRoot)
  } catch {
    return sources
  }
  for (const name of names.sort()) {
    if (name.startsWith('.') || name.includes('/')) continue
    const dir = join(archiveRoot, name)
    if (!(await isDirectory(dir))) continue
    sources.push({ kind: 'archived', dir, sourceId: name })
  }
  return sources
}

async function readCanvasIndex(homeDir: string, projectId: string): Promise<CanvasIndexRecord[]> {
  const value = await readJsonEnvelope(canvasIndexPath(homeDir, projectId))
  if (!isRecord(value) || !Array.isArray(value.canvases)) return []
  return value.canvases as CanvasIndexRecord[]
}

export async function migrateReviews(
  input: MigrateCompanionInput,
  report: MigrationReport,
  ledger: MigrationLedger,
  commit: Commit,
  clock: () => string,
  dryRun: boolean,
): Promise<void> {
  for (const source of await reviewSources(input.repoPath)) {
    const key = source.kind === 'active' ? 'review:active' : `review:archived/${source.sourceId}`
    const label = `.porcelain/${source.kind === 'active' ? PROJECT_ACTIVE_DIR : `${PROJECT_REVIEWS_DIR}/${source.sourceId}`}`
    const done = ledger.entries[key]
    if (done !== undefined) {
      record(report, {
        kind: 'review',
        source: label,
        outcome: 'already-migrated',
        ...(done.createdId === undefined ? {} : { createdId: done.createdId }),
      })
      continue
    }
    try {
      const conversion = await readReviewConversion(source)
      const canvasId = randomUUID()
      const now = clock()
      const stamp = conversion.archivedAt ?? now
      const canvas: CanvasIndexRecord = {
        id: canvasId,
        worktreeId: input.worktreeId ?? null,
        title: conversion.title,
        kind: conversion.kind,
        entryFile: conversion.entryFile,
        createdAt: stamp,
        updatedAt: stamp,
        template: 'review',
      }
      if (!dryRun) {
        await writeReviewBundle(
          canvasBundleDir(input.homeDir, input.projectId, canvasId),
          conversion,
        )
        const canvases = await readCanvasIndex(input.homeDir, input.projectId)
        await writeJsonEnvelope(canvasIndexPath(input.homeDir, input.projectId), {
          canvases: [...canvases, canvas],
        })
      }
      await commit(key, fingerprintOf(conversion.fingerprintParts), canvasId)
      record(report, {
        kind: 'review',
        source: label,
        outcome: 'converted',
        createdId: canvasId,
        detail: `Canvas "${conversion.title}" (${conversion.kind}, ${conversion.assets.length} asset(s))`,
      })
      for (const rejected of conversion.rejectedAssets) {
        record(report, {
          kind: 'review',
          source: `${label}/assets/${rejected}`,
          outcome: 'unsupported',
          detail: 'asset not copied',
        })
      }
    } catch (error) {
      record(report, {
        kind: 'review',
        source: label,
        outcome: 'failed',
        detail: describeError(error),
      })
    }
  }
}

export async function migrateBoard(
  input: MigrateCompanionInput,
  report: MigrationReport,
  ledger: MigrationLedger,
  commit: Commit,
  clock: () => string,
  dryRun: boolean,
): Promise<void> {
  const { cards, invalid } = await readBoardCards(input.repoPath)
  if (invalid > 0) {
    record(report, {
      kind: 'task',
      source: '.porcelain/board.json',
      outcome: 'unsupported',
      detail: `${invalid} card(s) had no usable id or title`,
    })
  }
  if (cards.length === 0) return

  const tasks = await readStoredTasks(input.homeDir)
  const existing = storedTaskIds(tasks)
  const worktrees = input.worktrees ?? []
  const next = [...tasks]
  for (const card of cards) {
    const key = `board-card:${card.id}`
    const fingerprint = fingerprintOf([card.id, card.title, card.body ?? '', card.status])
    if (ledger.entries[key] !== undefined || existing.has(card.id)) {
      record(report, {
        kind: 'task',
        source: `.porcelain/board.json#${card.id}`,
        outcome: 'already-migrated',
        createdId: card.id,
      })
      continue
    }
    try {
      const worktree = inferWorktree(card, worktrees)
      const task = taskForCard({ card, projectId: input.projectId, worktree, now: clock() })
      next.push(task)
      existing.add(task.id)
      if (!dryRun) await writeStoredTasks(input.homeDir, next)
      await commit(key, fingerprint, task.id)
      record(report, {
        kind: 'task',
        source: `.porcelain/board.json#${card.id}`,
        outcome: 'converted',
        createdId: task.id,
        detail: `Task "${task.title}" (${task.status}${worktree === undefined ? '' : `, worktree ${worktree.id}`})`,
      })
    } catch (error) {
      record(report, {
        kind: 'task',
        source: `.porcelain/board.json#${card.id}`,
        outcome: 'failed',
        detail: describeError(error),
      })
    }
  }
}

export async function migrateActions(
  input: MigrateCompanionInput,
  report: MigrationReport,
  commit: Commit,
  dryRun: boolean,
): Promise<void> {
  const plan = await planActionMigration(input.repoPath, input.homeDir, input.projectId)
  for (const duplicate of plan.duplicates) {
    record(report, {
      kind: 'action',
      source: `.porcelain/actions.json#${duplicate.id}`,
      outcome: 'already-migrated',
      detail: `"${duplicate.title}" already exists in the Project store`,
    })
  }
  // The destination merge above is what makes this idempotent: a second run sees
  // its own output as a duplicate. The ledger entries below are the audit trail,
  // not the guard — which is why an action can be reported converted exactly once
  // even if the ledger is lost.
  if (plan.merged === null) return
  try {
    if (!dryRun) await writeActionsDocument(input.homeDir, input.projectId, plan.merged)
    for (const action of plan.incoming) {
      await commit(
        `action:${action.id}`,
        fingerprintOf([action.id, action.title, action.command]),
        action.id,
      )
      record(report, {
        kind: 'action',
        source: `.porcelain/actions.json#${action.id}`,
        outcome: 'converted',
        createdId: action.id,
        detail: `"${action.title}" — unreviewed, the trust prompt still applies`,
      })
    }
  } catch (error) {
    record(report, {
      kind: 'action',
      source: '.porcelain/actions.json',
      outcome: 'failed',
      detail: describeError(error),
    })
  }
}

export async function migrateScope(
  input: MigrateCompanionInput,
  report: MigrationReport,
  ledger: MigrationLedger,
  commit: Commit,
  dryRun: boolean,
): Promise<void> {
  const scope = await readRepoScope(input.repoPath)
  if (scope.hiddenPaths.length === 0 && scope.pinnedPaths.length === 0) return
  const key = 'overrides:scope'
  const fingerprint = fingerprintOf([...scope.hiddenPaths, '|', ...scope.pinnedPaths])
  if (ledger.entries[key] !== undefined) {
    record(report, {
      kind: 'overrides',
      source: '.porcelain/scope.json',
      outcome: 'already-migrated',
    })
    return
  }
  try {
    const current = await readPrivateOverrides(input.homeDir, input.projectId)
    const { next, added } = mergeOverrides(current, scope)
    if (!dryRun) await writePrivateOverrides(input.homeDir, input.projectId, next)
    await commit(key, fingerprint)
    record(report, {
      kind: 'overrides',
      source: '.porcelain/scope.json',
      outcome: 'converted',
      detail: `${added} path(s) into the private Project overrides (never the tracked overlay)`,
    })
  } catch (error) {
    record(report, {
      kind: 'overrides',
      source: '.porcelain/scope.json',
      outcome: 'failed',
      detail: describeError(error),
    })
  }
}

export async function reportRetired(repoPath: string, report: MigrationReport): Promise<void> {
  for (const channel of await retiredChannelsPresent(repoPath)) {
    record(report, {
      kind: 'retired',
      source: `.porcelain/${channel.file}`,
      outcome: 'unsupported',
      detail: channel.reason,
    })
  }
  record(report, {
    kind: 'retired',
    source: 'terminal image passthrough',
    outcome: 'unsupported',
    detail: 'retired with no new owner; Canvas evidence assets replace it',
  })
}
