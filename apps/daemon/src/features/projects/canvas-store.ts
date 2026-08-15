import { rm } from 'node:fs/promises'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { z } from 'zod'
import {
  createStrictJsonDocument,
  type ReadStrictJsonDocument,
} from '../../project-data/strict-json-document'
import { readCanvasBundleEntry, type StoredCanvas, storedCanvasSchema } from './canvas-bundle'

export const CANVAS_INDEX_FILE_MAX_BYTES = 512 * 1024

const canvasIndexValueSchema = z
  .object({
    canvases: z.array(storedCanvasSchema),
  })
  .strict()

export type { CanvasKind, StoredCanvas } from './canvas-bundle'

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
  /** The private bundle directory — promotion's move source (canvas-overlay-store.ts). */
  bundleDirFor: (projectId: string, canvasId: string) => string
  /**
   * Forget one private Canvas: drop its index record and delete its bundle.
   *
   * Promotion calls this AFTER the tracked copy is in place, which is what makes
   * the tracked file canonical rather than a second editable copy free to
   * diverge from a private one (ADR 0002 / #26).
   */
  forgetCanvas: (projectId: string, canvasId: string) => Promise<CanvasStoreResult<void>>
}>

function unavailable(): CanvasStoreResult<never> {
  return { ok: false, error: { code: 'canvas.unavailable' } }
}

function notFound(): CanvasStoreResult<never> {
  return { ok: false, error: { code: 'canvas.not-found' } }
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

export function createCanvasStore(options: { homeDir: string }): CanvasStore {
  function indexDocument(projectId: string) {
    return createStrictJsonDocument({
      path: canvasIndexPath(options.homeDir, projectId),
      valueSchema: canvasIndexValueSchema,
      maxBytes: CANVAS_INDEX_FILE_MAX_BYTES,
    })
  }

  async function readCanvases(projectId: string): Promise<CanvasStoreResult<StoredCanvas[]>> {
    let result: ReadStrictJsonDocument<CanvasIndexValue>
    try {
      result = await indexDocument(projectId).read()
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

    bundleDirFor(projectId: string, canvasId: string): string {
      return canvasBundleDir(options.homeDir, projectId, canvasId)
    },

    async readCanvasEntry(
      projectId: string,
      canvasId: string,
    ): Promise<CanvasStoreResult<CanvasEntry>> {
      const listed = await readCanvases(projectId)
      if (!listed.ok) return listed
      const record = listed.value.find((canvas) => canvas.id === canvasId)
      if (record === undefined) return notFound()

      const bundle = await readCanvasBundleEntry(
        canvasBundleDir(options.homeDir, projectId, canvasId),
        record.entryFile,
      )
      if (!bundle.ok) {
        return bundle.error === 'entry-outside-bundle'
          ? { ok: false, error: { code: 'canvas.entry-outside-bundle' } }
          : notFound()
      }
      return { ok: true, value: { record, ...bundle.value } }
    },

    async forgetCanvas(projectId: string, canvasId: string): Promise<CanvasStoreResult<void>> {
      const listed = await readCanvases(projectId)
      if (!listed.ok) return listed
      const remaining = listed.value.filter((canvas) => canvas.id !== canvasId)
      if (remaining.length === listed.value.length) return notFound()
      try {
        await indexDocument(projectId).write({ canvases: remaining })
        await rm(canvasBundleDir(options.homeDir, projectId, canvasId), {
          recursive: true,
          force: true,
        })
      } catch {
        return unavailable()
      }
      return { ok: true, value: undefined }
    },
  })
}
