import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type {
  CanvasRecord,
  ListCanvasesInput,
  ListOverlayInput,
  ListOverlayOutput,
  MintCanvasAccessTokenInput,
  ProjectOverrides,
  PromoteCanvasInput,
  PromoteCanvasOutput,
  PromoteOverridesInput,
  ReadCanvasInput,
} from '@porcelain/contracts/projects'
import { projectOverlayCanvasBundleDir } from '@shared/project-porcelain'
import { inlineLocalAssets, mimeFor } from '../../fs/evidence-assets'
import type { CanvasAccessTokens } from './canvas-access-tokens'
import type { CanvasKind, StoredCanvas } from './canvas-bundle'
import type { CanvasOverlayStore } from './canvas-overlay-store'
import type { CanvasEntry, CanvasStore, CanvasStoreError, CanvasStoreResult } from './canvas-store'
import type { CanvasBundleSource } from './canvas-write'
import type { ProjectOperationResult } from './projects-results'

/**
 * Live checkouts of one Project — promotion's only legal targets.
 *
 * A narrow capability rather than a call into the Hub inventory operation: the
 * single question Canvas promotion needs answered is "is this path really a
 * Worktree of this Project", and answering it anywhere looser would let a
 * caller write an agent's Canvas into an unrelated repository.
 */
export type CanvasWorktrees = Readonly<{
  listWorktrees: (
    projectId: string,
  ) => Promise<ProjectOperationResult<readonly { id: string; path: string }[]>>
}>

/**
 * Publishing a Canvas. Not a wire procedure: the app has never created a Canvas —
 * the human does not author them — so this exists for the agent surface, where it
 * replaces the CLI writing `$PORCELAIN_HOME` behind the daemon's back.
 */
export type WriteCanvasOperationInput = Readonly<{
  projectId: string
  worktreeId: string | null
  id?: string
  title: string
  kind: CanvasKind
  entryFile: string
  template?: 'review' | 'plan' | 'decision'
  source: CanvasBundleSource
}>

/** Internal replace mode used by the agent surface when updating a tracked Canvas. */
export type PromoteCanvasOperationInput = PromoteCanvasInput &
  Readonly<{
    replace?: boolean
  }>

export type CanvasOperations = Readonly<{
  listCanvases: (input: ListCanvasesInput) => Promise<ProjectOperationResult<CanvasRecord[]>>
  writeCanvas: (input: WriteCanvasOperationInput) => Promise<ProjectOperationResult<CanvasRecord>>
  /** Drop one Canvas, deleting its tracked bundle when the addressed checkout owns it. */
  forgetCanvas: (input: {
    projectId: string
    canvasId: string
    worktreePath?: string
  }) => Promise<ProjectOperationResult<void>>
  readCanvas: (
    input: ReadCanvasInput,
  ) => Promise<ProjectOperationResult<{ record: CanvasRecord; content: string }>>
  readCanvasAsset: (
    input: ReadCanvasInput & { assetPath: string },
  ) => Promise<ProjectOperationResult<{ bytes: Buffer; contentType: string }>>
  /** For the HTML iframe's authenticated GET route (canvas-http.ts) — see its docstring. */
  mintCanvasAccessToken: (
    input: MintCanvasAccessTokenInput,
  ) => Promise<ProjectOperationResult<{ token: string }>>
  promoteCanvas: (
    input: PromoteCanvasOperationInput,
  ) => Promise<ProjectOperationResult<PromoteCanvasOutput>>
  promoteOverrides: (
    input: PromoteOverridesInput,
  ) => Promise<ProjectOperationResult<ProjectOverrides>>
  listOverlay: (input: ListOverlayInput) => Promise<ProjectOperationResult<ListOverlayOutput>>
}>

function unavailable(): ProjectOperationResult<never> {
  return { ok: false, error: { code: 'canvas.unavailable' } }
}

function notFound(): ProjectOperationResult<never> {
  return { ok: false, error: { code: 'canvas.not-found' } }
}

function targetInvalid(): ProjectOperationResult<never> {
  return { ok: false, error: { code: 'projects.overlay-target-invalid' } }
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
const BRIDGE_SOURCE = `document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href');if(!href||href.charAt(0)==='#')return;e.preventDefault();parent.postMessage({source:'porcelain-canvas',href:href},'*')},true)`

const EXTERNAL_LINK_BRIDGE = `<script>${BRIDGE_SOURCE}</script>`

/**
 * The CSP source expression that lets ONLY the bridge above execute.
 *
 * ADR 0002 requires promotion to decide the script question rather than inherit
 * the unpromoted policy: an unpromoted Canvas is agent-authored on this machine
 * by an agent the user already trusts with a shell, but a promoted one arrives
 * through `git clone` from somebody else's repository. So a tracked Canvas is
 * served with `script-src` pinned to this one hash — the browser refuses every
 * author script, inline or external, and no server-side sanitizer has to be
 * complete for that to hold. Styles, images, and links keep working, which is
 * the point of promoting a Canvas at all.
 */
export const CANVAS_BRIDGE_SCRIPT_HASH = `'sha256-${createHash('sha256')
  .update(BRIDGE_SOURCE, 'utf8')
  .digest('base64')}'`

function toPublicRecord(record: StoredCanvas, tracked: boolean): CanvasRecord {
  return {
    id: record.id,
    worktreeId: record.worktreeId,
    title: record.title,
    kind: record.kind,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    tracked,
  }
}

/** Newest-updated first — the sidebar's natural order with no client-side sort. */
function byUpdatedDesc(a: CanvasRecord, b: CanvasRecord): number {
  return b.updatedAt.localeCompare(a.updatedAt)
}

export function createCanvasOperations(options: {
  store: CanvasStore
  overlay: CanvasOverlayStore
  worktrees: CanvasWorktrees
  accessTokens: CanvasAccessTokens
}): CanvasOperations {
  /**
   * Resolve the explicit promotion target. `path` must be a live Worktree of
   * `projectId`; a `worktreeId`, when given, must name that same checkout.
   * Compared through realpath so a symlinked-but-equivalent path is accepted and
   * a lookalike one is not. Anything else is rejected, never guessed.
   */
  async function resolveTarget(input: {
    projectId: string
    path: string
    worktreeId?: string
  }): Promise<ProjectOperationResult<string>> {
    const listed = await options.worktrees.listWorktrees(input.projectId)
    if (!listed.ok) return listed

    let requested: string
    try {
      requested = await realpath(resolve(input.path))
    } catch {
      return targetInvalid()
    }

    for (const worktree of listed.value) {
      let candidate: string
      try {
        candidate = await realpath(resolve(worktree.path))
      } catch {
        continue
      }
      if (candidate !== requested) continue
      if (input.worktreeId !== undefined && input.worktreeId !== worktree.id) return targetInvalid()
      return { ok: true, value: worktree.path }
    }
    return targetInvalid()
  }

  /**
   * Tracked wins over private for the same id: a promoted Canvas IS the Canvas,
   * and the private bundle that produced it was moved rather than kept. A
   * private record still carrying a promoted id can only mean a half-finished
   * promotion, and honouring the tracked bytes is the recovery.
   */
  async function mergedRecords(
    input: ListCanvasesInput,
  ): Promise<ProjectOperationResult<CanvasRecord[]>> {
    const privateRecords = await options.store.listCanvases(input.projectId)
    if (!privateRecords.ok) return fromStoreError(privateRecords.error)
    const visiblePrivate =
      input.worktreeId === undefined
        ? privateRecords.value
        : privateRecords.value.filter(
            (record) =>
              record.template !== 'review' ||
              record.worktreeId === null ||
              record.worktreeId === input.worktreeId,
          )
    const asPrivate = (records: readonly StoredCanvas[]): CanvasRecord[] =>
      records.map((record) => toPublicRecord(record, false))
    if (input.worktreePath === undefined) {
      return { ok: true, value: asPrivate(visiblePrivate).sort(byUpdatedDesc) }
    }

    const tracked = await options.overlay.listOverlayCanvases(input.worktreePath)
    if (!tracked.ok) return fromStoreError(tracked.error)

    const trackedIds = new Set(tracked.value.map((record) => record.id))
    const records = [
      ...tracked.value.map((record) => toPublicRecord(record, true)),
      ...asPrivate(visiblePrivate.filter((record) => !trackedIds.has(record.id))),
    ]
    return { ok: true, value: records.sort(byUpdatedDesc) }
  }

  /** The tracked bundle first, then the private one — the same precedence as the list. */
  async function resolveEntry(
    input: ReadCanvasInput,
  ): Promise<ProjectOperationResult<{ entry: CanvasEntry; tracked: boolean }>> {
    if (input.worktreePath !== undefined) {
      const tracked: CanvasStoreResult<CanvasEntry> = await options.overlay.readOverlayCanvasEntry(
        input.worktreePath,
        input.canvasId,
      )
      if (tracked.ok) return { ok: true, value: { entry: tracked.value, tracked: true } }
      if (tracked.error.code === 'canvas.unavailable') return fromStoreError(tracked.error)
    }
    const stored = await options.store.readCanvasEntry(input.projectId, input.canvasId)
    if (!stored.ok) return fromStoreError(stored.error)
    return { ok: true, value: { entry: stored.value, tracked: false } }
  }

  return Object.freeze({
    async forgetCanvas(input: {
      projectId: string
      canvasId: string
      worktreePath?: string
    }): Promise<ProjectOperationResult<void>> {
      if (input.worktreePath !== undefined) {
        const tracked = await options.overlay.readOverlayCanvasEntry(
          input.worktreePath,
          input.canvasId,
        )
        if (tracked.ok) {
          const deleted = await options.overlay.deleteOverlayCanvas(
            input.worktreePath,
            input.canvasId,
          )
          if (!deleted.ok) return fromStoreError(deleted.error)
          // A crash between promotion and private cleanup can leave a stale private
          // duplicate. Remove it when present so tracked remains the sole canonical copy.
          const privateCopy = await options.store.forgetCanvas(input.projectId, input.canvasId)
          if (!privateCopy.ok && privateCopy.error.code !== 'canvas.not-found') {
            return fromStoreError(privateCopy.error)
          }
          return { ok: true, value: undefined }
        }
        if (tracked.error.code === 'canvas.unavailable') return fromStoreError(tracked.error)
      }
      const forgotten = await options.store.forgetCanvas(input.projectId, input.canvasId)
      return forgotten.ok ? { ok: true, value: undefined } : fromStoreError(forgotten.error)
    },

    async writeCanvas(
      input: WriteCanvasOperationInput,
    ): Promise<ProjectOperationResult<CanvasRecord>> {
      const written = await options.store.writeCanvas(input.projectId, {
        id: input.id,
        worktreeId: input.worktreeId,
        title: input.title,
        kind: input.kind,
        entryFile: input.entryFile,
        template: input.template,
        source: input.source,
      })
      if (!written.ok) return fromStoreError(written.error)
      // Freshly written is always private: promotion is a separate, explicit act.
      return { ok: true, value: toPublicRecord(written.value, false) }
    },

    listCanvases: mergedRecords,

    async readCanvas(input) {
      const resolved = await resolveEntry(input)
      if (!resolved.ok) return resolved

      const { entry, tracked } = resolved.value
      // Markdown stays raw text — the Viewer's existing Markdown renderer owns
      // presentation. Only HTML gets server-side asset inlining, rooted at the
      // symlink-resolved bundle directory, so a promoted bundle can reach its
      // own assets and nothing else in the repository it now lives in.
      // Tracked HTML never has its author scripts inlined either: refusing to
      // embed third-party code is cheap, and the hash-pinned `script-src` above
      // is what actually guarantees it could not have run.
      const rendered =
        entry.record.kind === 'html'
          ? `${await inlineLocalAssets(entry.bundleDir, entry.content, entry.bundleDir, !tracked, false)}${EXTERNAL_LINK_BRIDGE}`
          : entry.content
      return {
        ok: true,
        value: { record: toPublicRecord(entry.record, tracked), content: rendered },
      }
    },

    async readCanvasAsset(input) {
      const resolved = await resolveEntry(input)
      if (!resolved.ok || resolved.value.entry.record.kind !== 'html') return notFound()
      const root = await realpath(resolved.value.entry.bundleDir).catch(() => null)
      if (root === null || isAbsolute(input.assetPath) || input.assetPath.includes('\0'))
        return notFound()
      const lexical = resolve(root, input.assetPath)
      const rel = relative(root, lexical)
      if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
        return notFound()
      try {
        const actual = await realpath(lexical)
        const actualRel = relative(root, actual)
        if (
          actualRel === '' ||
          actualRel === '..' ||
          actualRel.startsWith(`..${sep}`) ||
          isAbsolute(actualRel)
        )
          return notFound()
        return { ok: true, value: { bytes: await readFile(actual), contentType: mimeFor(lexical) } }
      } catch {
        return notFound()
      }
    },

    async mintCanvasAccessToken(input) {
      const listed = await mergedRecords({
        projectId: input.projectId,
        worktreePath: input.worktreePath,
      })
      if (!listed.ok) return listed
      const exists = listed.value.some((canvas) => canvas.id === input.canvasId)
      if (!exists) return notFound()
      const token = options.accessTokens.mint({
        projectId: input.projectId,
        canvasId: input.canvasId,
        worktreePath: input.worktreePath ?? null,
      })
      return { ok: true, value: { token } }
    },

    async promoteCanvas(input) {
      const target = await resolveTarget(input)
      if (!target.ok) return target

      // Promotion is idempotent unless the agent explicitly replaces the private
      // bytes after an update. The normal path remains recoverable: once the tracked
      // bundle exists it is canonical, even if the private source has been removed.
      const alreadyTracked = await options.overlay.readOverlayCanvasEntry(
        target.value,
        input.canvasId,
      )
      if (alreadyTracked.ok) {
        if (input.replace !== true) {
          return {
            ok: true,
            value: {
              record: toPublicRecord(alreadyTracked.value.record, true),
              bundlePath: projectOverlayCanvasBundleDir(target.value, input.canvasId),
            },
          }
        }
      } else if (alreadyTracked.error.code === 'canvas.unavailable') {
        return fromStoreError(alreadyTracked.error)
      }

      const entry = await options.store.readCanvasEntry(input.projectId, input.canvasId)
      if (!entry.ok) return fromStoreError(entry.error)

      const written = await options.overlay.writeOverlayCanvas({
        repoPath: target.value,
        // `worktreeId: null`: this record is about to live in a file that travels
        // to other machines, where an Environment-local Worktree id names nothing.
        record: { ...entry.value.record, worktreeId: null },
        sourceBundleDir: options.store.bundleDirFor(input.projectId, input.canvasId),
      })
      if (!written.ok) return fromStoreError(written.error)

      // Only once the tracked bytes are on disk: one canonical copy, never two.
      const forgotten = await options.store.forgetCanvas(input.projectId, input.canvasId)
      if (!forgotten.ok) return fromStoreError(forgotten.error)

      return {
        ok: true,
        value: {
          record: toPublicRecord(written.value.record, true),
          bundlePath: written.value.bundlePath,
        },
      }
    },

    async promoteOverrides(input) {
      const target = await resolveTarget(input)
      if (!target.ok) return target

      const current = await options.overlay.readOverrides(target.value)
      if (!current.ok) return fromStoreError(current.error)
      const base = current.value ?? { hiddenPaths: [], pinnedPaths: [], worktrees: {} }
      const next: ProjectOverrides = {
        hiddenPaths: input.hiddenPaths ?? base.hiddenPaths,
        pinnedPaths: input.pinnedPaths ?? base.pinnedPaths,
        worktrees: input.worktrees ?? base.worktrees,
      }
      const written = await options.overlay.writeOverrides(target.value, next)
      if (!written.ok) return fromStoreError(written.error)
      return { ok: true, value: written.value }
    },

    async listOverlay(input) {
      const present = await options.overlay.overlayPresent(input.path)
      if (!present) {
        return {
          ok: true,
          value: { path: input.path, present: false, canvases: [], overrides: null },
        }
      }
      const canvases = await options.overlay.listOverlayCanvases(input.path)
      if (!canvases.ok) return fromStoreError(canvases.error)
      const overrides = await options.overlay.readOverrides(input.path)
      if (!overrides.ok) return fromStoreError(overrides.error)
      return {
        ok: true,
        value: {
          path: input.path,
          present: true,
          canvases: canvases.value
            .map((record) => toPublicRecord(record, true))
            .sort(byUpdatedDesc),
          overrides: overrides.value,
        },
      }
    },
  })
}
