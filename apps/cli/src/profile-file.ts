import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { porcelainHome } from '@shared/porcelain-home'
import { projectOverridesPath } from '@shared/project-store'
import { resolveHubIdentity } from './canvas-file'

/**
 * The worktree profile — pins, hides, and declared story layers (ADR 0003) —
 * written into the daemon-root PRIVATE Project record, never into the checkout.
 *
 * Two levels. `porcelain profile set` writes the project baseline that every
 * worktree inherits; `porcelain worktree profile set` writes this worktree's
 * override on top of it. A worktree with no override inherits, which is why
 * someone who does not use worktrees never has to know the second level exists.
 *
 * Writes are WHOLE-DOCUMENT (ADR 0006): one `--profile` JSON in, the level
 * replaced. Granular pin/unpin/hide/layer-move verbs multiply into many argument
 * shapes and many half-written states, and an agent produces a whole document
 * more reliably than it chains edits.
 *
 * Shape mirrors `privateProjectDocumentSchema`
 * (packages/contracts/src/projects) — the CLI cannot import it (CLI-001 allows
 * only node builtins and `@porcelain/shared`), so this file hand-parses the same
 * fields and preserves every key it does not own.
 */

interface ProfileLayer {
  label: string
  pattern: string
}

export interface ProjectProfile {
  pinnedPaths: string[]
  hiddenPaths: string[]
  layers: ProfileLayer[]
}

export interface WorktreeProfile {
  pinnedPaths: string[]
  hiddenPaths: string[]
  /** Paths this worktree wants to SEE despite the project hiding them. */
  unhiddenPaths: string[]
  /** `null` inherits the project's order; `[]` declines it. */
  layers: ProfileLayer[] | null
}

/** cli.ts's help-registry entries, kept here to hold that file's line budget. */
export const PROFILE_COMMANDS = {
  noun: 'profile',
  blurb: 'the project profile — pins, hides, and story layers every worktree of this repo inherits',
  verbs: [
    { verb: 'get', args: '', desc: 'Read the project profile as JSON' },
    {
      verb: 'set',
      args: '--profile <json|->',
      desc: 'Replace it wholesale: { pinnedPaths, hiddenPaths, layers }',
    },
  ],
  flags: ['profile'],
}

export const WORKTREE_COMMANDS = {
  noun: 'worktree',
  blurb: "this worktree's OVERRIDE of the project profile — normally absent, and inherited when so",
  verbs: [
    {
      verb: 'profile get',
      args: '',
      desc: 'Read the project baseline, this override, and the merge',
    },
    {
      verb: 'profile set',
      args: '--profile <json|->',
      desc: 'Replace the override: { pinnedPaths, hiddenPaths, unhiddenPaths, layers }',
    },
    { verb: 'profile clear', args: '', desc: 'Drop the override; go back to inheriting' },
  ],
  flags: ['profile'],
  flagOverrides: {
    profile:
      'Whole profile document as JSON, or - to read it from stdin (ADR 0006: no granular verbs)',
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string' && p !== '') : []
}

function layers(raw: unknown): ProfileLayer[] {
  if (!Array.isArray(raw)) return []
  const out: ProfileLayer[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) continue
    const { label, pattern } = entry
    if (typeof label !== 'string' || typeof pattern !== 'string') continue
    if (label === '' || pattern === '') continue
    out.push({ label, pattern })
  }
  return out
}

/** Absent, or explicitly null, both mean "inherit"; anything else is a declaration. */
function nullableLayers(raw: unknown): ProfileLayer[] | null {
  return raw === undefined || raw === null ? null : layers(raw)
}

function documentPath(repoPath: string): string {
  return projectOverridesPath(porcelainHome(), resolveHubIdentity(repoPath).projectId)
}

/** The whole private document, unparsed keys and all — never lose a field we do not own. */
function readDocument(repoPath: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(documentPath(repoPath), 'utf8'))
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeDocument(repoPath: string, document: Record<string, unknown>): void {
  const path = documentPath(repoPath)
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${randomUUID()}`
  writeFileSync(tmp, `${JSON.stringify(document, null, 2)}\n`)
  renameSync(tmp, path)
}

export function readProjectProfile(repoPath: string): ProjectProfile {
  const document = readDocument(repoPath)
  return {
    pinnedPaths: strings(document.pinnedPaths),
    hiddenPaths: strings(document.hiddenPaths),
    layers: layers(document.layers),
  }
}

export function readWorktreeProfile(repoPath: string): WorktreeProfile | null {
  const worktreeId = resolveHubIdentity(repoPath).worktreeId
  if (worktreeId === null) return null
  const stored = readDocument(repoPath).worktreeProfiles
  const entry = isRecord(stored) ? stored[worktreeId] : undefined
  if (!isRecord(entry)) return null
  return {
    pinnedPaths: strings(entry.pinnedPaths),
    hiddenPaths: strings(entry.hiddenPaths),
    unhiddenPaths: strings(entry.unhiddenPaths),
    layers: nullableLayers(entry.layers),
  }
}

/** Parse whatever `--profile` carried into the project shape. Unknown keys are dropped. */
export function toProjectProfile(raw: unknown): ProjectProfile {
  const value = isRecord(raw) ? raw : {}
  return {
    pinnedPaths: strings(value.pinnedPaths),
    hiddenPaths: strings(value.hiddenPaths),
    layers: layers(value.layers),
  }
}

export function toWorktreeProfile(raw: unknown): WorktreeProfile {
  const value = isRecord(raw) ? raw : {}
  return {
    pinnedPaths: strings(value.pinnedPaths),
    hiddenPaths: strings(value.hiddenPaths),
    unhiddenPaths: strings(value.unhiddenPaths),
    layers: nullableLayers(value.layers),
  }
}

export function setProjectProfile(repoPath: string, profile: ProjectProfile): ProjectProfile {
  writeDocument(repoPath, { ...readDocument(repoPath), ...profile })
  return profile
}

export function setWorktreeProfile(repoPath: string, profile: WorktreeProfile): WorktreeProfile {
  const worktreeId = requireWorktreeId(repoPath)
  const document = readDocument(repoPath)
  const existing = isRecord(document.worktreeProfiles) ? document.worktreeProfiles : {}
  writeDocument(repoPath, {
    ...document,
    worktreeProfiles: { ...existing, [worktreeId]: profile },
  })
  return profile
}

export function clearWorktreeProfile(repoPath: string): void {
  const worktreeId = requireWorktreeId(repoPath)
  const document = readDocument(repoPath)
  const existing = isRecord(document.worktreeProfiles) ? { ...document.worktreeProfiles } : {}
  delete existing[worktreeId]
  writeDocument(repoPath, { ...document, worktreeProfiles: existing })
}

function requireWorktreeId(repoPath: string): string {
  const worktreeId = resolveHubIdentity(repoPath).worktreeId
  if (worktreeId === null) {
    throw new Error(
      'this checkout has no Worktree id in the Hub inventory yet — open it in Porcelain once, then retry (the project profile is still writable with "porcelain profile set")',
    )
  }
  return worktreeId
}

function describeLayers(entries: ProfileLayer[] | null): string {
  if (entries === null) return '  (inheriting the project order)'
  if (entries.length === 0) return '  (none — falls back to the starters)'
  return entries.map((layer) => `  ${layer.label}  ${layer.pattern}`).join('\n')
}

function describePaths(paths: string[]): string {
  return paths.length === 0 ? '  (none)' : paths.map((p) => `  - ${p}`).join('\n')
}

/** cli.ts's `profile get` case body. */
export function describeProjectProfile(repoPath: string): string {
  const profile = readProjectProfile(repoPath)
  return [
    'Project profile — inherited by every worktree of this repository.',
    '',
    `Pinned:\n${describePaths(profile.pinnedPaths)}`,
    `Hidden:\n${describePaths(profile.hiddenPaths)}`,
    `Layers:\n${describeLayers(profile.layers)}`,
  ].join('\n')
}

/** cli.ts's `worktree profile get` case body — both levels, so the merge is legible. */
export function describeWorktreeProfile(repoPath: string): string {
  const base = readProjectProfile(repoPath)
  const override = readWorktreeProfile(repoPath)
  if (override === null) {
    return `${describeProjectProfile(repoPath)}\n\nThis worktree has no override — it inherits all of the above.`
  }
  return [
    describeProjectProfile(repoPath),
    '',
    'This worktree also declares:',
    `Pinned:\n${describePaths(override.pinnedPaths)}`,
    `Hidden:\n${describePaths(override.hiddenPaths)}`,
    `Shown despite the project hiding them:\n${describePaths(override.unhiddenPaths)}`,
    `Layers:\n${describeLayers(override.layers)}`,
    '',
    `Effective story order:\n${describeLayers(override.layers ?? base.layers)}`,
  ].join('\n')
}
