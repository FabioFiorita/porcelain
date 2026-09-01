import { randomUUID } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ProjectOverrides } from '@porcelain/contracts/projects'
import { projectOverridesSchema } from '@porcelain/contracts/projects'
import {
  OVERLAY_CANVAS_MANIFEST_FILE,
  legacyProjectOverlayCanvasManifestPath,
  projectOverlayCanvasBundleDir,
  projectOverlayCanvasesDir,
  projectOverlayCanvasManifestPath,
  projectOverlayOverridesPath,
  projectPorcelainDir,
} from '@shared/project-porcelain'
import { revealCompanionOverlay } from '../../project/git-exclude'
import { readCanvasBundleEntry, type StoredCanvas, storedCanvasSchema } from './canvas-bundle'
import type { CanvasEntry, CanvasStoreError, CanvasStoreResult } from './canvas-store'

/**
 * The tracked Git overlay: `<repo>/.porcelain/canvases/<id>/` plus
 * `<repo>/.porcelain/project.json` (ADR 0002 / #26).
 *
 * Three rules hold this together:
 *
 * 1. **Promotion is the only writer.** Nothing here runs on open, on read, or
 *    on a Canvas update. `.porcelain/` is materialized by an explicit promote
 *    and by nothing else, so a repository a human merely looked at stays exactly
 *    as they left it.
 * 2. **Tracked is canonical, and read-only to the daemon.** A promoted bundle is
 *    served in place from the checkout; the daemon never writes back into it and
 *    never keeps a private shadow copy. Updating a tracked Canvas is an agent
 *    writing the tracked path on purpose (`porcelain canvas set --tracked`).
 * 3. **Plain files, no git.** Promotion writes and moves files. It never stages
 *    or commits — entering history stays the human's decision.
 *
 * Everything under here arrives by `git clone` on somebody else's machine, so
 * every read goes through `readCanvasBundleEntry`'s confinement gate and every
 * manifest through the same strict schema the private index uses.
 */

/** One manifest is one record; a bundle with a huge manifest is corrupt, not big. */
const OVERLAY_MANIFEST_MAX_BYTES = 64 * 1024
const OVERLAY_OVERRIDES_MAX_BYTES = 256 * 1024

export type CanvasOverlayStore = Readonly<{
  /** True when `<repo>/.porcelain/` exists at all — the "never promoted" probe. */
  overlayPresent: (repoPath: string) => Promise<boolean>
  listOverlayCanvases: (repoPath: string) => Promise<CanvasStoreResult<StoredCanvas[]>>
  readOverlayCanvasEntry: (
    repoPath: string,
    canvasId: string,
  ) => Promise<CanvasStoreResult<CanvasEntry>>
  /** Delete one tracked Canvas bundle. This is explicit; reads never mutate the overlay. */
  deleteOverlayCanvas: (repoPath: string, canvasId: string) => Promise<CanvasStoreResult<void>>
  /**
   * Copy `sourceBundleDir` into the overlay under `record.id` and write its
   * manifest. Staged beside the destination and renamed into place, so a reader
   * never sees a half-written tracked bundle.
   */
  writeOverlayCanvas: (input: {
    repoPath: string
    record: StoredCanvas
    sourceBundleDir: string
  }) => Promise<CanvasStoreResult<{ record: StoredCanvas; bundlePath: string }>>
  readOverrides: (repoPath: string) => Promise<CanvasStoreResult<ProjectOverrides | null>>
  writeOverrides: (
    repoPath: string,
    overrides: ProjectOverrides,
  ) => Promise<CanvasStoreResult<ProjectOverrides>>
}>

const unavailable = (): CanvasStoreResult<never> => ({
  ok: false,
  error: { code: 'canvas.unavailable' } satisfies CanvasStoreError,
})

const notFound = (): CanvasStoreResult<never> => ({
  ok: false,
  error: { code: 'canvas.not-found' } satisfies CanvasStoreError,
})

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/** Read + validate a JSON file under a byte cap; `null` when it is simply absent. */
async function readBoundedJson(path: string, maxBytes: number): Promise<unknown | null> {
  let size: number
  try {
    size = (await stat(path)).size
  } catch {
    return null
  }
  if (size > maxBytes) {
    console.error(`porcelain: ${path} is ${size} bytes (> ${maxBytes}); ignoring`)
    return null
  }
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown
  } catch {
    console.error(`porcelain: ${path} is not readable JSON; ignoring`)
    return null
  }
}

async function readOverlayManifest(
  repoPath: string,
  canvasId: string,
): Promise<StoredCanvas | null> {
  for (const path of [
    projectOverlayCanvasManifestPath(repoPath, canvasId),
    legacyProjectOverlayCanvasManifestPath(repoPath, canvasId),
  ]) {
    const raw = await readBoundedJson(path, OVERLAY_MANIFEST_MAX_BYTES)
    if (raw === null) continue
    const parsed = storedCanvasSchema.safeParse(raw)
    if (!parsed.success) continue
    // The directory name is the identity that addressed this bundle; a manifest
    // claiming a different id would let one clone shadow an unrelated Canvas.
    if (parsed.data.id !== canvasId) return null
    return parsed.data
  }
  return null
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${randomUUID()}`
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`)
  await rename(tmp, path)
}

export function createCanvasOverlayStore(): CanvasOverlayStore {
  return Object.freeze({
    overlayPresent(repoPath: string): Promise<boolean> {
      return isDirectory(projectPorcelainDir(repoPath))
    },

    async listOverlayCanvases(repoPath: string): Promise<CanvasStoreResult<StoredCanvas[]>> {
      const dir = projectOverlayCanvasesDir(repoPath)
      let entries: Dirent[]
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        // No overlay is the normal case, not a failure — an unpromoted repo.
        return { ok: true, value: [] }
      }
      const records: StoredCanvas[] = []
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const record = await readOverlayManifest(repoPath, entry.name)
        if (record !== null) records.push(record)
      }
      return { ok: true, value: records }
    },

    async readOverlayCanvasEntry(
      repoPath: string,
      canvasId: string,
    ): Promise<CanvasStoreResult<CanvasEntry>> {
      const record = await readOverlayManifest(repoPath, canvasId)
      if (record === null) return notFound()
      const bundle = await readCanvasBundleEntry(
        projectOverlayCanvasBundleDir(repoPath, canvasId),
        record.entryFile,
      )
      if (!bundle.ok) {
        return bundle.error === 'entry-outside-bundle'
          ? { ok: false, error: { code: 'canvas.entry-outside-bundle' } }
          : notFound()
      }
      return { ok: true, value: { record, ...bundle.value } }
    },

    async deleteOverlayCanvas(
      repoPath: string,
      canvasId: string,
    ): Promise<CanvasStoreResult<void>> {
      const record = await readOverlayManifest(repoPath, canvasId)
      if (record === null) return notFound()
      try {
        await rm(projectOverlayCanvasBundleDir(repoPath, canvasId), {
          recursive: true,
          force: true,
        })
      } catch {
        return unavailable()
      }
      return { ok: true, value: undefined }
    },

    async writeOverlayCanvas(
      input,
    ): Promise<CanvasStoreResult<{ record: StoredCanvas; bundlePath: string }>> {
      const bundlePath = projectOverlayCanvasBundleDir(input.repoPath, input.record.id)
      const staging = `${bundlePath}.tmp-${randomUUID()}`
      try {
        await mkdir(projectOverlayCanvasesDir(input.repoPath), { recursive: true })
        // Copy, not rename: the private store lives under $PORCELAIN_HOME, which
        // is routinely a different filesystem from the checkout (EXDEV).
        await cp(input.sourceBundleDir, staging, { recursive: true })
        // `manifest.json` is overlay-owned. Refuse a source bundle that already
        // uses the reserved name instead of silently replacing another entry or
        // asset and recreating the collision this boundary exists to prevent.
        const reservedPathExists = await stat(join(staging, OVERLAY_CANVAS_MANIFEST_FILE)).then(
          () => true,
          () => false,
        )
        if (reservedPathExists) throw new Error('reserved Canvas overlay manifest path')
        await writeJsonAtomically(join(staging, OVERLAY_CANVAS_MANIFEST_FILE), input.record)
        await rm(bundlePath, { recursive: true, force: true })
        await rename(staging, bundlePath)
      } catch {
        // Never leave a half-copied `<id>.tmp-…` sitting in the human's tree; a
        // failure to clean up is worth seeing rather than swallowing.
        await rm(staging, { recursive: true, force: true }).catch((error: unknown) => {
          console.error(`porcelain: could not clean up ${staging}:`, error)
        })
        return unavailable()
      }
      // Only now, with tracked bytes actually on disk, teach git to see them.
      await revealCompanionOverlay(input.repoPath)
      return { ok: true, value: { record: input.record, bundlePath } }
    },

    async readOverrides(repoPath: string): Promise<CanvasStoreResult<ProjectOverrides | null>> {
      const raw = await readBoundedJson(
        projectOverlayOverridesPath(repoPath),
        OVERLAY_OVERRIDES_MAX_BYTES,
      )
      if (raw === null) return { ok: true, value: null }
      const parsed = projectOverridesSchema.safeParse(raw)
      return { ok: true, value: parsed.success ? parsed.data : null }
    },

    async writeOverrides(
      repoPath: string,
      overrides: ProjectOverrides,
    ): Promise<CanvasStoreResult<ProjectOverrides>> {
      try {
        await mkdir(projectPorcelainDir(repoPath), { recursive: true })
        await writeJsonAtomically(projectOverlayOverridesPath(repoPath), overrides)
      } catch {
        return unavailable()
      }
      await revealCompanionOverlay(repoPath)
      return { ok: true, value: overrides }
    },
  })
}
