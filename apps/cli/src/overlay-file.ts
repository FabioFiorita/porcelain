import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { projectOverridePath } from '@shared/project-overrides'
import { projectOverlayOverridesPath, projectPorcelainDir } from '@shared/project-porcelain'
import { revealCompanionOverlay } from './git-exclude'

/**
 * `<repo>/.porcelain/project.json` — the tracked half of the Git overlay
 * (ADR 0002 / #26): the project defaults a team shares. Personal hide/pin state
 * stays in the daemon-root private Project store and is never written here.
 *
 * Shape is `projectOverridesSchema` (packages/contracts/src/projects) exactly:
 * repo-RELATIVE hide/pin paths (an absolute path would name nothing in anyone
 * else's clone) plus per-Worktree setup scripts keyed by branch. The CLI has no
 * source for those scripts, so it carries over whatever is already on disk
 * rather than blanking a hand-written entry on every promotion.
 *
 * Plain JSON, no `{version,value}` envelope — repo-local companion files are
 * plain, and this one is meant to be read by a human in a diff.
 */

type WorktreeOverrides = Record<string, { setup: { startScript: string; disposeScript: string } }>

export interface ProjectOverrides {
  hiddenPaths: string[]
  pinnedPaths: string[]
  worktrees: WorktreeOverrides
}

/** cli.ts's help-registry entry, kept here to hold that shrink-only file's line budget. */
export const PROJECT_COMMANDS = {
  noun: 'project',
  blurb: 'the tracked Git overlay — project defaults promoted into <repo>/.porcelain/',
  verbs: [
    {
      verb: 'promote-overrides',
      args: '[--hidden <a,b>] [--pinned <a,b>]',
      desc: "Write .porcelain/project.json from this repo's hide/pin scope, plus any extra paths",
    },
  ],
  flags: ['hidden', 'pinned'],
  flagOverrides: {
    hidden: 'Extra repo-relative paths to hide, comma-separated (added to the promoted scope)',
    pinned: 'Extra repo-relative paths to pin, comma-separated (added to the promoted scope)',
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseWorktrees(value: unknown): WorktreeOverrides {
  if (!isRecord(value)) return {}
  const out: WorktreeOverrides = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry) || !isRecord(entry.setup)) continue
    const { startScript, disposeScript } = entry.setup
    if (typeof startScript !== 'string' || typeof disposeScript !== 'string') continue
    out[key] = { setup: { startScript, disposeScript } }
  }
  return out
}

/** What `<repo>/.porcelain/project.json` currently holds; empty when there is none. */
export function readOverrides(repoPath: string): ProjectOverrides {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(projectOverlayOverridesPath(repoPath), 'utf8'))
  } catch {
    return { hiddenPaths: [], pinnedPaths: [], worktrees: {} }
  }
  const value = isRecord(parsed) ? parsed : {}
  const strings = (raw: unknown): string[] =>
    Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string' && p !== '') : []
  return {
    hiddenPaths: strings(value.hiddenPaths),
    pinnedPaths: strings(value.pinnedPaths),
    worktrees: parseWorktrees(value.worktrees),
  }
}

function unique(paths: string[]): string[] {
  return [...new Set(paths)]
}

/**
 * Promote explicit hide/pin paths into the tracked overlay.
 *
 * Additive by design: extra `--hidden` / `--pinned` paths join the promoted
 * scope rather than replacing it, and existing Worktree setup entries survive,
 * so promoting twice never silently drops what someone already shared.
 */
export function promoteOverrides(
  repoPath: string,
  extra: { hidden?: string[]; pinned?: string[] } = {},
): ProjectOverrides {
  const existing = readOverrides(repoPath)
  const rel = (paths: string[]): string[] => paths.map((p) => projectOverridePath(repoPath, p))
  const overrides: ProjectOverrides = {
    hiddenPaths: unique([...existing.hiddenPaths, ...rel(extra.hidden ?? [])]).filter(
      (p) => p !== '',
    ),
    pinnedPaths: unique([...existing.pinnedPaths, ...rel(extra.pinned ?? [])]).filter(
      (p) => p !== '',
    ),
    worktrees: existing.worktrees,
  }

  const path = projectOverlayOverridesPath(repoPath)
  mkdirSync(projectPorcelainDir(repoPath), { recursive: true })
  const tmp = `${path}.tmp-${randomUUID()}`
  writeFileSync(tmp, `${JSON.stringify(overrides, null, 2)}\n`)
  renameSync(tmp, path)
  // Only now, with tracked bytes on disk, teach git to see the overlay.
  revealCompanionOverlay(repoPath)
  return overrides
}

/** cli.ts's `project promote-overrides` case body. */
export function describePromoteOverrides(
  repoPath: string,
  flags: { hidden?: string[]; pinned?: string[] },
): string {
  const overrides = promoteOverrides(repoPath, flags)
  const list = (paths: string[]): string =>
    paths.length === 0 ? '  (none)' : paths.map((p) => `  - ${p}`).join('\n')
  return `Promoted project overrides to ${projectOverlayOverridesPath(repoPath)}:\nHidden:\n${list(overrides.hiddenPaths)}\nPinned:\n${list(overrides.pinnedPaths)}\n\nThese are tracked files now — commit them when you want the team to have them (promotion never runs git add).`
}
