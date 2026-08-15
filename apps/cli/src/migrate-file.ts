import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import {
  type MigrationReport,
  migrateCompanion,
  renderMigrationReport,
} from '@shared/companion-migration'
import type { MigratedWorktree } from '@shared/companion-migration-records'
import { porcelainHome, porcelainHomePath } from '@shared/porcelain-home'
import { resolveHubIdentity } from './canvas-file'

/**
 * `porcelain migrate` — the one-time move of this checkout's repo-local companion
 * into the daemon-root owners (#27).
 *
 * The conversion itself lives in `@porcelain/shared/companion-migration`, not
 * here. The CLI has no daemon transport (scripts/lint-cli-boundary.mjs) and the
 * daemon exposes the same operation as `project-data.migrateCompanion`, so the
 * routine has to be a shared module both can run — exactly the arrangement
 * `canvas-file.ts` already uses to write the daemon-root Canvas store. One
 * implementation, two entry points, no chance of two migrations disagreeing.
 */

/** cli.ts's help-registry entry, kept here to hold that shrink-only file's line budget. */
export const MIGRATE_COMMANDS = {
  noun: 'migrate',
  blurb: 'one-time move of this repo’s legacy .porcelain/ companion into its new owners',
  verbs: [
    {
      verb: 'apply',
      args: '[--dry-run] [--report <abs path>]',
      desc: 'Convert Reviews to Canvases, Board cards to Tasks, Actions and hide/pin to the Project store',
    },
  ],
  flags: ['dry-run', 'report'],
  flagOverrides: {
    'dry-run': 'Print the plan without writing anything',
    report: 'Absolute path to write the report to as JSON (in addition to stdout)',
  },
}

function gitLines(repoPath: string, args: string[]): string[] {
  try {
    return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8' }).split('\n')
  } catch {
    return []
  }
}

/**
 * Every live Worktree of this Project, with the id the Hub already minted.
 *
 * `git worktree list --porcelain` supplies path and branch; the id comes from the
 * same `hub-inventory.json` `resolveHubIdentity` reads, matched on the resolved
 * `--git-dir` of each checkout. A Worktree Porcelain has never seen has no id and
 * is simply left out — a Task pointing at an invented Worktree id would be worse
 * than a Task with no Worktree reference at all.
 */
export function listProjectWorktrees(repoPath: string): MigratedWorktree[] {
  const inventoryWorktrees = readInventoryWorktrees(repoPath)
  const out: MigratedWorktree[] = []
  let path: string | undefined
  let branch: string | undefined
  const flush = (): void => {
    if (path === undefined) return
    let gitDir: string
    try {
      gitDir = realpathSync(resolve(path, gitLines(path, ['rev-parse', '--git-dir'])[0] ?? ''))
    } catch {
      path = undefined
      branch = undefined
      return
    }
    const id = inventoryWorktrees.get(gitDir)
    if (id !== undefined) out.push({ id, path, ...(branch === undefined ? {} : { branch }) })
    path = undefined
    branch = undefined
  }
  for (const line of gitLines(repoPath, ['worktree', 'list', '--porcelain'])) {
    if (line.startsWith('worktree ')) {
      flush()
      path = line.slice('worktree '.length).trim()
      continue
    }
    if (line.startsWith('branch refs/heads/'))
      branch = line.slice('branch refs/heads/'.length).trim()
  }
  flush()
  return out
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `gitDir → worktreeId` for the Project this checkout belongs to. */
function readInventoryWorktrees(repoPath: string): Map<string, string> {
  const map = new Map<string, string>()
  let commonGitDir: string
  try {
    commonGitDir = realpathSync(
      resolve(repoPath, gitLines(repoPath, ['rev-parse', '--git-common-dir'])[0] ?? ''),
    )
  } catch {
    return map
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(porcelainHomePath('hub-inventory.json'), 'utf8'))
  } catch {
    return map
  }
  const value = isRecord(parsed) && isRecord(parsed.value) ? parsed.value : undefined
  const projects = Array.isArray(value?.projects) ? value.projects : []
  for (const project of projects) {
    if (!isRecord(project) || project.commonGitDir !== commonGitDir) continue
    for (const worktree of Array.isArray(project.worktrees) ? project.worktrees : []) {
      if (!isRecord(worktree)) continue
      if (typeof worktree.gitDir === 'string' && typeof worktree.id === 'string') {
        map.set(worktree.gitDir, worktree.id)
      }
    }
  }
  return map
}

/** cli.ts's `migrate apply` case body, kept here with the rest of the noun. */
export async function describeMigrate(
  repoPath: string,
  flags: { dryRun: boolean; reportPath?: string },
): Promise<string> {
  if (flags.reportPath !== undefined && !isAbsolute(flags.reportPath)) {
    throw new Error('--report must be an absolute path')
  }
  const { projectId, worktreeId } = resolveHubIdentity(repoPath)
  const report: MigrationReport = await migrateCompanion({
    repoPath,
    homeDir: porcelainHome(),
    projectId,
    worktreeId,
    worktrees: listProjectWorktrees(repoPath),
    dryRun: flags.dryRun,
  })
  if (flags.reportPath !== undefined) {
    mkdirSync(dirname(flags.reportPath), { recursive: true })
    writeFileSync(flags.reportPath, `${JSON.stringify(report, null, 2)}\n`)
  }
  return renderMigrationReport(report)
}
