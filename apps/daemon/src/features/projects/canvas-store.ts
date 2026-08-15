import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { z } from 'zod'
import {
  createStrictJsonDocument,
  type ReadStrictJsonDocument,
} from '../../project-data/strict-json-document'

export const CANVAS_INDEX_FILE_MAX_BYTES = 512 * 1024

const canvasKindSchema = z.enum(['html', 'markdown'])

const storedCanvasSchema = z
  .object({
    id: z.string().min(1),
    // null: not scoped to the Worktree that authored it — Canvases outlive a
    // deleted checkout (ADR 0002), so a Worktree-scoped one must degrade gracefully.
    worktreeId: z.string().min(1).nullable(),
    title: z.string().min(1),
    kind: canvasKindSchema,
    entryFile: z.string().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict()

const canvasIndexValueSchema = z
  .object({
    canvases: z.array(storedCanvasSchema),
  })
  .strict()

export type CanvasKind = z.infer<typeof canvasKindSchema>
export type StoredCanvas = z.infer<typeof storedCanvasSchema>
type CanvasIndexValue = z.infer<typeof canvasIndexValueSchema>

export type CanvasStoreError =
  | { readonly code: 'canvas.unavailable' }
  | { readonly code: 'canvas.not-found' }
  | { readonly code: 'canvas.entry-outside-bundle' }

export type CanvasStoreResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: CanvasStoreError }

export type CanvasEntry = Readonly<{
  record: StoredCanvas
  /** Real (symlink-resolved) bundle directory — the containment root for asset inlining. */
  bundleDir: string
  content: string
}>

export type CanvasStore = Readonly<{
  listCanvases: (projectId: string) => Promise<CanvasStoreResult<StoredCanvas[]>>
  readCanvasEntry: (projectId: string, canvasId: string) => Promise<CanvasStoreResult<CanvasEntry>>
}>

function unavailable(): CanvasStoreResult<never> {
  return { ok: false, error: { code: 'canvas.unavailable' } }
}

function notFound(): CanvasStoreResult<never> {
  return { ok: false, error: { code: 'canvas.not-found' } }
}

function outsideBundle(): CanvasStoreResult<never> {
  return { ok: false, error: { code: 'canvas.entry-outside-bundle' } }
}

function reportUnavailable(
  result: Exclude<ReadStrictJsonDocument<CanvasIndexValue>, { kind: 'missing' | 'valid' }>,
): void {
  if (result.kind === 'corrupt') {
    console.error(`porcelain: canvas index is corrupt; backup at ${result.backupPath}`)
    return
  }
  if (result.kind === 'incompatible-version') {
    console.error(`porcelain: canvas index has unsupported version ${result.version}`)
    return
  }
  console.error(
    `porcelain: canvas index is ${result.byteLength} bytes (> ${CANVAS_INDEX_FILE_MAX_BYTES})`,
  )
}

/** Exact outside rule — never startsWith('..') alone (false-positives a name like `..foo`). */
function isInsideDir(dir: string, candidate: string): boolean {
  const rel = relative(dir, candidate)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

export function createCanvasStore(options: { homeDir: string }): CanvasStore {
  async function readCanvases(projectId: string): Promise<CanvasStoreResult<StoredCanvas[]>> {
    const document = createStrictJsonDocument({
      path: canvasIndexPath(options.homeDir, projectId),
      valueSchema: canvasIndexValueSchema,
      maxBytes: CANVAS_INDEX_FILE_MAX_BYTES,
    })
    let result: ReadStrictJsonDocument<CanvasIndexValue>
    try {
      result = await document.read()
    } catch {
      return unavailable()
    }
    if (result.kind === 'missing') return { ok: true, value: [] }
    if (result.kind !== 'valid') {
      reportUnavailable(result)
      return unavailable()
    }
    return { ok: true, value: result.value.canvases }
  }

  return Object.freeze({
    listCanvases: readCanvases,

    async readCanvasEntry(
      projectId: string,
      canvasId: string,
    ): Promise<CanvasStoreResult<CanvasEntry>> {
      const listed = await readCanvases(projectId)
      if (!listed.ok) return listed
      const record = listed.value.find((canvas) => canvas.id === canvasId)
      if (record === undefined) return notFound()

      const bundleDirLexical = resolve(canvasBundleDir(options.homeDir, projectId, canvasId))
      let bundleDirReal: string
      try {
        bundleDirReal = await realpath(bundleDirLexical)
      } catch {
        return notFound()
      }

      // Lexical pre-gate against the declared bundle dir, THEN a realpath check
      // against the resolved bundle dir — a symlinked entryFile cannot smuggle a
      // read outside the bundle even if it passes the first check.
      const entryLexical = resolve(bundleDirLexical, record.entryFile)
      if (!isInsideDir(bundleDirLexical, entryLexical)) return outsideBundle()

      let entryReal: string
      try {
        entryReal = await realpath(entryLexical)
      } catch {
        return notFound()
      }
      if (!isInsideDir(bundleDirReal, entryReal)) return outsideBundle()

      try {
        const info = await stat(entryReal)
        if (!info.isFile()) return notFound()
        const content = await readFile(entryReal, 'utf8')
        return { ok: true, value: { record, bundleDir: bundleDirReal, content } }
      } catch {
        return notFound()
      }
    },
  })
}
