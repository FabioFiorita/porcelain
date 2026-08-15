import type {
  CanvasRecord,
  ListCanvasesInput,
  MintCanvasAccessTokenInput,
  ReadCanvasInput,
} from '@porcelain/contracts/projects'
import { inlineLocalAssets } from '../../fs/evidence-assets'
import type { CanvasAccessTokens } from './canvas-access-tokens'
import type { CanvasStore, CanvasStoreError, StoredCanvas } from './canvas-store'
import type { ProjectOperationResult } from './projects-results'

export type CanvasOperations = Readonly<{
  listCanvases: (input: ListCanvasesInput) => Promise<ProjectOperationResult<CanvasRecord[]>>
  readCanvas: (
    input: ReadCanvasInput,
  ) => Promise<ProjectOperationResult<{ record: CanvasRecord; content: string }>>
  /** For the HTML iframe's authenticated GET route (canvas-http.ts) — see its docstring. */
  mintCanvasAccessToken: (
    input: MintCanvasAccessTokenInput,
  ) => Promise<ProjectOperationResult<{ token: string }>>
}>

function unavailable(): ProjectOperationResult<never> {
  return { ok: false, error: { code: 'canvas.unavailable' } }
}

function notFound(): ProjectOperationResult<never> {
  return { ok: false, error: { code: 'canvas.not-found' } }
}

/** `entry-outside-bundle` is a storage-integrity detail, not a distinct public outcome. */
function fromStoreError(error: CanvasStoreError): ProjectOperationResult<never> {
  return error.code === 'canvas.unavailable' ? unavailable() : notFound()
}

function toPublicRecord(record: StoredCanvas): CanvasRecord {
  return {
    id: record.id,
    worktreeId: record.worktreeId,
    title: record.title,
    kind: record.kind,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export function createCanvasOperations(options: {
  store: CanvasStore
  accessTokens: CanvasAccessTokens
}): CanvasOperations {
  return Object.freeze({
    async listCanvases(input) {
      const listed = await options.store.listCanvases(input.projectId)
      if (!listed.ok) return fromStoreError(listed.error)
      const records = listed.value
        .map(toPublicRecord)
        // Newest-updated first — the sidebar's natural order with no client-side sort.
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return { ok: true, value: records }
    },

    async readCanvas(input) {
      const entry = await options.store.readCanvasEntry(input.projectId, input.canvasId)
      if (!entry.ok) return fromStoreError(entry.error)

      const { record, bundleDir, content } = entry.value
      // Markdown stays raw text — the Viewer's existing Markdown renderer owns
      // presentation. Only HTML gets server-side asset inlining (ticket #21's
      // "safe relative asset access" criterion is scoped to HTML Canvases).
      const rendered =
        record.kind === 'html' ? await inlineLocalAssets(bundleDir, content, bundleDir) : content
      return { ok: true, value: { record: toPublicRecord(record), content: rendered } }
    },

    async mintCanvasAccessToken(input) {
      const listed = await options.store.listCanvases(input.projectId)
      if (!listed.ok) return fromStoreError(listed.error)
      const exists = listed.value.some((canvas) => canvas.id === input.canvasId)
      if (!exists) return notFound()
      const token = options.accessTokens.mint({
        projectId: input.projectId,
        canvasId: input.canvasId,
      })
      return { ok: true, value: { token } }
    },
  })
}
