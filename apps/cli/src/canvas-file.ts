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
import { dirname, isAbsolute, resolve } from 'node:path'
import { canvasBundleDir, canvasIndexPath, isInsideDir } from '@shared/canvas-porcelain'
import { porcelainHome, porcelainHomePath } from '@shared/porcelain-home'

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
 */

/** cli.ts's help-registry entry, kept here to hold that shrink-only file's line budget. */
export const CANVAS_COMMANDS = {
  noun: 'canvas',
  blurb: 'agent-authored explanation for this Project — daemon-root, outlives the checkout',
  verbs: [
    { verb: 'list', args: '', desc: 'List Canvases for this Project' },
    {
      verb: 'set',
      args: '--title <s> --kind html|markdown --source-dir <abs dir> [--entry <file>] [--id <s>]',
      desc: 'Create (omit --id) or replace (pass --id) a Canvas bundle from a local directory',
    },
  ],
  flags: ['title', 'kind', 'source-dir', 'entry', 'id'],
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
    gitDir = realpathSync(resolve(repoPath, gitPlumbing(repoPath, ['rev-parse', '--git-dir'])))
    commonGitDir = realpathSync(
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
    return {
      projectId: String(project.id),
      worktreeId: worktree !== undefined && isRecord(worktree) ? String(worktree.id) : null,
    }
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
  flags: { title: string; kind: string; sourceDir: string; entryFile?: string; id?: string },
): string {
  const record = setCanvas({
    repoPath,
    title: flags.title,
    kind: parseCanvasKind(flags.kind),
    sourceDir: flags.sourceDir,
    entryFile: flags.entryFile,
    id: flags.id,
  })
  return `Set Canvas ${record.id} "${record.title}" (${record.kind}, entry ${record.entryFile}) for ${repoPath}`
}

export function setCanvas(options: {
  repoPath: string
  title: string
  kind: CanvasKind
  sourceDir: string
  entryFile?: string
  id?: string
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

  const homeDir = porcelainHome()
  const { projectId, worktreeId } = resolveHubIdentity(options.repoPath)
  const canvases = readIndex(homeDir, projectId)
  const existing = options.id !== undefined ? canvases.find((c) => c.id === options.id) : undefined
  if (options.id !== undefined && existing === undefined) {
    throw new Error(`no Canvas ${options.id} for this Project — omit --id to create a new one`)
  }
  const id = existing?.id ?? randomUUID()
  const now = new Date().toISOString()

  // Wholesale replace, staged then renamed into place so a reader never sees a
  // half-written bundle (matches the tmp+rename idiom the other nouns use).
  const bundleDir = canvasBundleDir(homeDir, projectId, id)
  const staging = `${bundleDir}.tmp-${randomUUID()}`
  mkdirSync(dirname(staging), { recursive: true })
  cpSync(options.sourceDir, staging, { recursive: true })
  rmSync(bundleDir, { recursive: true, force: true })
  renameSync(staging, bundleDir)

  const record: CanvasRecord = {
    id,
    worktreeId,
    title: options.title,
    kind: options.kind,
    entryFile,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  const next =
    existing === undefined ? [...canvases, record] : canvases.map((c) => (c.id === id ? record : c))
  writeIndex(homeDir, projectId, next)
  return record
}
