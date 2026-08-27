import { readFile, realpath, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { isInsideDir } from '@shared/canvas-porcelain'
import { z } from 'zod'

/**
 * The Canvas bundle format and the ONE confinement gate that reads it.
 *
 * A bundle is a directory with an entry document and its sibling assets. Two
 * stores hold bundles in that exact shape: the private daemon-root store
 * (`canvas-store.ts`, under `$PORCELAIN_HOME`) and the tracked Git overlay
 * (`canvas-overlay-store.ts`, under `<repo>/.porcelain/canvases/`). Promotion
 * is a directory move between them, which is only true because the format does
 * not change — and it stays that way because both read through here.
 *
 * A promoted bundle arrives by `git clone` from someone else's repository, so
 * the overlay is the LESS trusted of the two sources. Sharing this gate means
 * the tracked path is confined by exactly the same lexical + realpath pair as
 * the private one, with no second implementation to fall behind.
 */

export const canvasKindSchema = z.enum(['html', 'markdown', 'structured'])

export const storedCanvasSchema = z
  .object({
    id: z.string().min(1),
    // null: not scoped to the Worktree that authored it — Canvases outlive a
    // deleted checkout (ADR 0002), so a Worktree-scoped one must degrade
    // gracefully. Always null once promoted: a Worktree id is Environment-local
    // and would name nothing in the clone the tracked bundle travels to.
    worktreeId: z.string().min(1).nullable(),
    title: z.string().min(1),
    kind: canvasKindSchema,
    entryFile: z.string().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    /** Which structured template the bundle follows, when it follows one. */
    template: z.enum(['review', 'plan']).optional(),
  })
  .strict()

export type CanvasKind = z.infer<typeof canvasKindSchema>
export type StoredCanvas = z.infer<typeof storedCanvasSchema>

export type CanvasBundleError = 'not-found' | 'entry-outside-bundle'

export type ReadCanvasBundleResult =
  | { readonly ok: true; readonly value: { bundleDir: string; content: string } }
  | { readonly ok: false; readonly error: CanvasBundleError }

/**
 * Read one bundle's entry document, confined to the bundle directory.
 *
 * Lexical pre-gate against the declared bundle dir, THEN a realpath check
 * against the resolved bundle dir — a symlinked `entryFile` (or a `../`
 * traversal committed into a tracked bundle) cannot smuggle a read outside the
 * bundle even if it passes the first check. `bundleDir` in the result is the
 * symlink-resolved directory, which is the containment root asset inlining then
 * uses, so assets are held to the same boundary as the entry itself.
 */
export async function readCanvasBundleEntry(
  bundleDirInput: string,
  entryFile: string,
): Promise<ReadCanvasBundleResult> {
  const bundleDirLexical = resolve(bundleDirInput)
  let bundleDirReal: string
  try {
    bundleDirReal = await realpath(bundleDirLexical)
  } catch {
    return { ok: false, error: 'not-found' }
  }

  const entryLexical = resolve(bundleDirLexical, entryFile)
  if (!isInsideDir(bundleDirLexical, entryLexical)) {
    return { ok: false, error: 'entry-outside-bundle' }
  }

  let entryReal: string
  try {
    entryReal = await realpath(entryLexical)
  } catch {
    return { ok: false, error: 'not-found' }
  }
  if (!isInsideDir(bundleDirReal, entryReal)) {
    return { ok: false, error: 'entry-outside-bundle' }
  }

  try {
    const info = await stat(entryReal)
    if (!info.isFile()) return { ok: false, error: 'not-found' }
    const content = await readFile(entryReal, 'utf8')
    return { ok: true, value: { bundleDir: bundleDirReal, content } }
  } catch {
    return { ok: false, error: 'not-found' }
  }
}
