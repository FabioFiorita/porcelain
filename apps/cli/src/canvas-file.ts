import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  cpSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { canvasBundleDir, canvasIndexPath, isInsideDir } from '@shared/canvas-porcelain'
import { porcelainHome, porcelainHomePath } from '@shared/porcelain-home'
import {
  OVERLAY_CANVAS_MANIFEST_FILE,
  projectOverlayCanvasBundleDir,
  projectOverlayCanvasManifestPath,
} from '@shared/project-porcelain'
import { revealCompanionOverlay } from './git-exclude'

/**
 * Writes daemon-root Canvas bundles the same way the daemon's canvas-store
 * reads them (see apps/daemon/src/features/projects/canvas-store.ts): a
 * per-Project index.json manifest plus one bundle directory per Canvas under
 * $PORCELAIN_HOME/projects/<projectId>/canvases/. Unlike every other noun in
 * this file, that root is NOT `<repo>/.porcelain/` — Canvases are owned by the
 * stable Project record (ADR 0002), not this checkout, so they outlive it.
 *
 * Finding the Project id: the CLI has no daemon connection, so it reads the
 * SAME hub-inventory.json the daemon already wrote when this repo was first
 * opened in Porcelain (features/projects/hub-inventory-store.ts), matched by
 * `git rev-parse --git-dir` / `--git-common-dir` — plumbing, not a hand-rolled
 * `.git`-file parse, so this always agrees with what the daemon itself
 * resolved (hub-git-port.ts). A repo Porcelain has never opened has no
 * Project id yet, so Canvas writes fail with a clear message instead of
 * inventing one.
 *
 * `realpathSync.native`, not plain `realpathSync`: hub-git-port.ts resolves
 * with `node:fs/promises`' `realpath`, which is backed by libuv's native OS
 * call and corrects a path to the filesystem's true on-disk casing. Node's
 * default sync `realpathSync` is a pure-JS shim that does not. On a
 * case-insensitive volume (macOS, Windows) the two can disagree on casing for
 * the identical directory, and the exact-match compare below would then
 * reject a checkout the daemon already has registered.
 */

/** cli.ts's help-registry entry, kept here to hold that shrink-only file's line budget. */
export const CANVAS_COMMANDS = {
  noun: 'canvas',
  blurb: 'agent-authored explanation for this Project — daemon-root, outlives the checkout',
  verbs: [
    { verb: 'list', args: '', desc: 'List Canvases for this Project' },
    {
      verb: 'set',
      args: '--title <s> --kind html|markdown --source-dir <abs dir> [--entry <file>] [--id <s>] [--tracked]',
      desc: 'Create (omit --id) or replace (pass --id) a Canvas bundle from a local directory',
    },
    {
      verb: 'promote',
      args: '--id <s> [--worktree <abs path>]',
      desc: 'Move a private Canvas into the checkout as a tracked file (writes files; never git add)',
    },
  ],
  flags: ['title', 'kind', 'source-dir', 'entry', 'id', 'tracked', 'worktree'],
  flagOverrides: {
    tracked:
      'Write the bundle to <repo>/.porcelain/canvases/<id>/ (the tracked overlay) instead of the private daemon-root store',
    worktree:
      'Absolute path of the checkout to promote into (default: the repo this command resolved)',
  },
}

export type CanvasKind = 'html' | 'markdown'

export type CanvasRecord = {
  id: string
  worktreeId: string | null
  title: string
  kind: CanvasKind
  entryFile: string
  createdAt: string
  updatedAt: string
  /** The structured template this bundle follows. */
  template?: 'review'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function gitPlumbing(repoPath: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8' }).trim()
}

export type HubIdentity = { projectId: string; worktreeId: string | null }

/** The stable Project + Worktree identity the Hub already minted for this checkout. */
export function resolveHubIdentity(repoPath: string): HubIdentity {
  let gitDir: string
  let commonGitDir: string
  try {
    gitDir = realpathSync.native(
      resolve(repoPath, gitPlumbing(repoPath, ['rev-parse', '--git-dir'])),
    )
    commonGitDir = realpathSync.native(
      resolve(repoPath, gitPlumbing(repoPath, ['rev-parse', '--git-common-dir'])),
    )
  } catch {
    throw new Error(`not inside a git repository: ${repoPath}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(porcelainHomePath('hub-inventory.json'), 'utf8'))
  } catch {
    throw new Error(
      'no Hub inventory yet — open this repository in Porcelain once (so it gets a stable Project id), then retry',
    )
  }
  const value = isRecord(parsed) && isRecord(parsed.value) ? parsed.value : undefined
  const projects = Array.isArray(value?.projects) ? value.projects : []
  for (const project of projects) {
    if (!isRecord(project) || project.commonGitDir !== commonGitDir) continue
    const worktrees = Array.isArray(project.worktrees) ? project.worktrees : []
    const worktree = worktrees.find((w) => isRecord(w) && w.gitDir === gitDir)
    // `String(worktree.id)` on a record with no id yields the literal "undefined",
    // which reads as a real Worktree everywhere downstream — and the profile
    // store now KEYS on this value, so a bogus one silently files someone's
    // focus under a worktree that does not exist.
    const worktreeId =
      isRecord(worktree) && typeof worktree.id === 'string' && worktree.id !== ''
        ? worktree.id
        : null
    return { projectId: String(project.id), worktreeId }
  }
  throw new Error(
    'this checkout is not registered with a Porcelain Environment yet — open it in Porcelain once, then retry',
  )
}

type CanvasIndexEnvelope = { version: 1; value: { canvases: CanvasRecord[] } }

function readIndex(homeDir: string, projectId: string): CanvasRecord[] {
  try {
    const parsed = JSON.parse(
      readFileSync(canvasIndexPath(homeDir, projectId), 'utf8'),
    ) as CanvasIndexEnvelope
    return Array.isArray(parsed.value?.canvases) ? parsed.value.canvases : []
  } catch {
    return []
  }
}

function writeIndex(homeDir: string, projectId: string, canvases: CanvasRecord[]): void {
  const path = canvasIndexPath(homeDir, projectId)
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${randomUUID()}`
  const envelope: CanvasIndexEnvelope = { version: 1, value: { canvases } }
  writeFileSync(tmp, `${JSON.stringify(envelope, null, 2)}\n`)
  renameSync(tmp, path)
}

export function listCanvasesForRepo(repoPath: string): CanvasRecord[] {
  const { projectId } = resolveHubIdentity(repoPath)
  return readIndex(porcelainHome(), projectId)
}

/** Resolve a private Canvas bundle for another CLI noun (Review's template metadata). */
export function privateCanvasBundlePath(repoPath: string, canvasId: string): string {
  const { projectId } = resolveHubIdentity(repoPath)
  return canvasBundleDir(porcelainHome(), projectId, canvasId)
}

/** Remove one private Canvas and its index record; tracked overlays are untouched. */
export function removeCanvas(repoPath: string, canvasId: string): void {
  const { projectId } = resolveHubIdentity(repoPath)
  const homeDir = porcelainHome()
  const canvases = readIndex(homeDir, projectId)
  if (!canvases.some((canvas) => canvas.id === canvasId)) return
  rmSync(canvasBundleDir(homeDir, projectId, canvasId), { recursive: true, force: true })
  writeIndex(
    homeDir,
    projectId,
    canvases.filter((canvas) => canvas.id !== canvasId),
  )
}

export function describeCanvases(records: CanvasRecord[]): string {
  if (records.length === 0) {
    return 'No Canvases for this Project yet. Run `canvas set --title … --kind html|markdown --source-dir <abs dir>`.'
  }
  const lines = [`Canvases for this Project (${records.length}):`]
  for (const record of records) {
    lines.push(`- [${record.id}] ${record.title} (${record.kind}, updated ${record.updatedAt})`)
  }
  return lines.join('\n')
}

function parseCanvasKind(raw: string): CanvasKind {
  if (raw !== 'html' && raw !== 'markdown') throw new Error('kind must be one of html|markdown')
  return raw
}

/** cli.ts's `canvas set` case body, pulled in whole to keep that shrink-only file lean. */
export function describeSetCanvas(
  repoPath: string,
  flags: {
    title: string
    kind: string
    sourceDir: string
    entryFile?: string
    id?: string
    tracked?: boolean
  },
): string {
  const record = setCanvas({
    repoPath,
    title: flags.title,
    kind: parseCanvasKind(flags.kind),
    sourceDir: flags.sourceDir,
    entryFile: flags.entryFile,
    id: flags.id,
    tracked: flags.tracked,
  })
  const where =
    flags.tracked === true ? `tracked at ${projectOverlayCanvasBundleDir(repoPath, record.id)}` : ''
  const suffix = where === '' ? '' : ` — ${where}`
  return `Set Canvas ${record.id} "${record.title}" (${record.kind}, entry ${record.entryFile}) for ${repoPath}${suffix}`
}

/**
 * Copy a whole bundle into `destDir`, staged beside it and renamed into place so
 * a reader never sees a half-written bundle. `manifest`, when given, is the
 * tracked overlay's `canvas.json` — written inside the staging directory, so it
 * arrives with the bytes it describes rather than after them.
 */
function stageBundle(destDir: string, sourceDir: string, manifest?: CanvasRecord): void {
  const staging = `${destDir}.tmp-${randomUUID()}`
  mkdirSync(dirname(staging), { recursive: true })
  cpSync(sourceDir, staging, { recursive: true })
  if (manifest !== undefined) {
    writeFileSync(
      join(staging, OVERLAY_CANVAS_MANIFEST_FILE),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
  }
  rmSync(destDir, { recursive: true, force: true })
  renameSync(staging, destDir)
}

/** The tracked manifest for `<repo>/.porcelain/canvases/<id>/`, or null when there is none. */
function readTrackedManifest(repoPath: string, canvasId: string): CanvasRecord | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(projectOverlayCanvasManifestPath(repoPath, canvasId), 'utf8'))
  } catch {
    return null
  }
  // The directory name is the identity that addressed this bundle; a manifest
  // claiming another id names a Canvas this path has no right to speak for.
  if (!isRecord(parsed) || parsed.id !== canvasId) return null
  // Field by field, like resolveHubIdentity: this file arrives by `git clone`
  // from someone else's repository, so it is parsed, never trusted. Anything
  // short of the full record reads as "no tracked Canvas here".
  const text = (value: unknown): string | null =>
    typeof value === 'string' && value !== '' ? value : null
  const title = text(parsed.title)
  const entryFile = text(parsed.entryFile)
  const createdAt = text(parsed.createdAt)
  const updatedAt = text(parsed.updatedAt)
  const kind = parsed.kind === 'html' || parsed.kind === 'markdown' ? parsed.kind : null
  if (kind === null || title === null || entryFile === null) return null
  if (createdAt === null || updatedAt === null) return null
  // worktreeId is Environment-local, so a tracked manifest always reads as null
  // no matter what the clone it travelled from wrote there.
  return { id: canvasId, worktreeId: null, title, kind, entryFile, createdAt, updatedAt }
}

export function setCanvas(options: {
  repoPath: string
  title: string
  kind: CanvasKind
  sourceDir: string
  entryFile?: string
  id?: string
  /** Write the tracked overlay under the checkout instead of the daemon-root store. */
  tracked?: boolean
  template?: 'review'
}): CanvasRecord {
  if (!isAbsolute(options.sourceDir)) {
    throw new Error('--source-dir must be an absolute path')
  }
  let sourceStat: ReturnType<typeof statSync>
  try {
    sourceStat = statSync(options.sourceDir)
  } catch {
    throw new Error(`--source-dir not found: ${options.sourceDir}`)
  }
  if (!sourceStat.isDirectory()) {
    throw new Error('--source-dir must be a directory')
  }

  const entryFile = options.entryFile ?? (options.kind === 'html' ? 'index.html' : 'index.md')
  const entryLexical = resolve(options.sourceDir, entryFile)
  if (!isInsideDir(resolve(options.sourceDir), entryLexical)) {
    throw new Error(`--entry must resolve inside --source-dir, got: ${entryFile}`)
  }
  try {
    if (!statSync(entryLexical).isFile()) throw new Error('not a file')
  } catch {
    throw new Error(`entry file not found in --source-dir: ${entryFile}`)
  }

  const now = new Date().toISOString()

  if (options.tracked === true) {
    // The tracked overlay is addressed by path alone: no Project id, no Worktree
    // id (both are Environment-local and mean nothing in a clone), and the
    // daemon-root index is never touched. Updating a tracked Canvas is this
    // explicit write and nothing else — there is no two-way merge.
    const existingTracked =
      options.id === undefined ? null : readTrackedManifest(options.repoPath, options.id)
    if (options.id !== undefined && existingTracked === null) {
      throw new Error(
        `no tracked Canvas ${options.id} in ${options.repoPath} — omit --id to create a new one`,
      )
    }
    const trackedId = options.id ?? randomUUID()
    const trackedRecord: CanvasRecord = {
      id: trackedId,
      worktreeId: null,
      title: options.title,
      kind: options.kind,
      entryFile,
      createdAt: existingTracked?.createdAt ?? now,
      updatedAt: now,
      ...(options.template === undefined ? {} : { template: options.template }),
    }
    stageBundle(
      projectOverlayCanvasBundleDir(options.repoPath, trackedId),
      options.sourceDir,
      trackedRecord,
    )
    revealCompanionOverlay(options.repoPath)
    return trackedRecord
  }

  const homeDir = porcelainHome()
  const { projectId, worktreeId } = resolveHubIdentity(options.repoPath)
  const canvases = readIndex(homeDir, projectId)
  const existing = options.id !== undefined ? canvases.find((c) => c.id === options.id) : undefined
  if (options.id !== undefined && existing === undefined) {
    throw new Error(`no Canvas ${options.id} for this Project — omit --id to create a new one`)
  }
  const id = existing?.id ?? randomUUID()

  // Wholesale replace, staged then renamed into place so a reader never sees a
  // half-written bundle (matches the tmp+rename idiom the other nouns use).
  stageBundle(canvasBundleDir(homeDir, projectId, id), options.sourceDir)

  const record: CanvasRecord = {
    id,
    worktreeId,
    title: options.title,
    kind: options.kind,
    entryFile,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(options.template === undefined ? {} : { template: options.template }),
  }
  const next =
    existing === undefined ? [...canvases, record] : canvases.map((c) => (c.id === id ? record : c))
  writeIndex(homeDir, projectId, next)
  return record
}

/** cli.ts's `canvas promote` case body, kept here with the rest of the noun. */
export function describePromoteCanvas(
  repoPath: string,
  flags: { id: string; worktree?: string },
): string {
  const { record, bundlePath } = promoteCanvas({
    repoPath,
    id: flags.id,
    worktreePath: flags.worktree,
  })
  return `Promoted Canvas ${record.id} "${record.title}" to ${bundlePath}. It is a tracked file now — commit it when you want it in history (promotion never runs git add). The private copy is gone, so this checkout is the only editable one.`
}

/**
 * Move ONE private daemon-root bundle into a checkout's tracked overlay.
 *
 * A move, never a copy: the tracked bytes land first and only then does the
 * private bundle (and its index record) go, so a crash leaves a promoted Canvas
 * or an unpromoted one — never two editable copies of the same Canvas that can
 * drift apart. Plain files only; entering git history stays the human's call.
 */
export function promoteCanvas(options: {
  repoPath: string
  id: string
  /** The checkout to promote into. Default: the repo this command resolved. */
  worktreePath?: string
}): { record: CanvasRecord; bundlePath: string } {
  const target = options.worktreePath ?? options.repoPath
  if (!isAbsolute(target)) throw new Error('--worktree must be an absolute path')
  try {
    if (!statSync(target).isDirectory()) throw new Error('not a directory')
  } catch {
    throw new Error(`--worktree is not an existing directory: ${target}`)
  }

  const homeDir = porcelainHome()
  const { projectId } = resolveHubIdentity(options.repoPath)
  const canvases = readIndex(homeDir, projectId)
  const record = canvases.find((c) => c.id === options.id)
  if (record === undefined) {
    throw new Error(
      `no private Canvas ${options.id} for this Project — \`canvas list\` shows what can be promoted`,
    )
  }
  const sourceDir = canvasBundleDir(homeDir, projectId, record.id)
  try {
    if (!statSync(sourceDir).isDirectory()) throw new Error('not a directory')
  } catch {
    throw new Error(`Canvas ${record.id} has no bundle on disk at ${sourceDir}`)
  }

  // worktreeId is Environment-local: it would name nothing in the clone this
  // bundle now travels with, so a tracked manifest always carries null.
  const tracked: CanvasRecord = { ...record, worktreeId: null }
  const bundlePath = projectOverlayCanvasBundleDir(target, record.id)
  stageBundle(bundlePath, sourceDir, tracked)
  revealCompanionOverlay(target)

  rmSync(sourceDir, { recursive: true, force: true })
  writeIndex(
    homeDir,
    projectId,
    canvases.filter((c) => c.id !== record.id),
  )
  return { record: tracked, bundlePath }
}
