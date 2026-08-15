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

/**
 * The Canvas iframe has neither `allow-top-navigation` nor `allow-popups` (see
 * canvas-view.tsx), so a link inside it cannot go anywhere on its own — this
 * is the ONLY way one can. Document-level click capture (works regardless of
 * load order, including content the Canvas's own scripts add later) turns
 * every non-fragment `<a href>` click into a postMessage the parent Web app
 * relays through the same target=_blank → shell.openExternal path ordinary
 * Markdown links already use (canvas-view.tsx). Appended, not prepended, so
 * it runs after whatever the Canvas's own inline scripts execute — capture-
 * phase delegation means load order doesn't otherwise matter, but this keeps
 * the served bytes in intent order: content first, bootstrap last.
 */
const EXTERNAL_LINK_BRIDGE = `<script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href');if(!href||href.charAt(0)==='#')return;e.preventDefault();parent.postMessage({source:'porcelain-canvas',href:href},'*')},true)</script>`

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
        record.kind === 'html'
          ? `${await inlineLocalAssets(bundleDir, content, bundleDir, true)}${EXTERNAL_LINK_BRIDGE}`
          : content
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
