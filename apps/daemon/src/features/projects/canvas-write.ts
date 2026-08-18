import { randomUUID } from 'node:crypto'
import { cp, mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, normalize } from 'node:path'
import { settleBackground } from '@shared/background'

/**
 * Writing a Canvas bundle.
 *
 * Until now the daemon could only READ bundles: `apps/cli` was the sole writer,
 * poking `$PORCELAIN_HOME` from its own process while the daemon watched. That is
 * the second-writer arrangement the MCP move exists to end, and it is why this file
 * had to be written before an agent could publish a Review over a tool call.
 *
 * Every write lands by staging beside the destination and renaming over it, so a
 * reader never observes a half-written bundle — the same discipline the CLI used,
 * kept because the daemon serves the Canvas to a live browser while it writes.
 */

export type CanvasBundleSource =
  /** Generated content — the Review template renders to memory, never to a temp dir. */
  | Readonly<{ kind: 'files'; files: readonly Readonly<{ path: string; content: string }>[] }>
  /** A directory the caller already assembled, copied wholesale. */
  | Readonly<{ kind: 'directory'; sourceDir: string }>

export type CanvasWriteError = 'unavailable' | 'entry-outside-bundle' | 'source-missing'

export type CanvasWriteResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; error: CanvasWriteError }>

/**
 * A bundle-relative path that cannot climb out of the bundle. Rejecting `..` and
 * absolute paths here is what stops a tool argument from writing anywhere on the
 * daemon host — the read side already refuses to serve an entry outside the bundle,
 * and the write side must not create one in the first place.
 */
export function isContainedBundlePath(candidate: string): boolean {
  if (candidate === '' || isAbsolute(candidate)) return false
  const normalized = normalize(candidate)
  if (normalized === '..' || normalized.startsWith(`..${'/'}`)) return false
  // Windows-style separators would slip past a '/'-only check.
  return !normalized.startsWith('..\\')
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/**
 * Materialize `source` at `destDir`, atomically. Staging happens in a sibling
 * directory rather than the system temp dir so the rename stays on one filesystem;
 * a cross-device rename would fall back to a copy and lose the atomicity.
 */
export async function writeCanvasBundle(
  destDir: string,
  source: CanvasBundleSource,
): Promise<CanvasWriteResult> {
  if (source.kind === 'files') {
    for (const file of source.files) {
      if (!isContainedBundlePath(file.path)) return { ok: false, error: 'entry-outside-bundle' }
    }
  } else if (!(await isDirectory(source.sourceDir))) {
    return { ok: false, error: 'source-missing' }
  }

  const staging = `${destDir}.tmp-${randomUUID()}`
  try {
    await mkdir(dirname(staging), { recursive: true })
    if (source.kind === 'directory') {
      await cp(source.sourceDir, staging, { recursive: true })
    } else {
      await mkdir(staging, { recursive: true })
      for (const file of source.files) {
        const target = join(staging, file.path)
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, file.content, 'utf8')
      }
    }
    await rm(destDir, { recursive: true, force: true })
    await rename(staging, destDir)
    return { ok: true }
  } catch {
    // Best-effort sweep of the staging directory. The write has already failed and
    // the caller is being told so; a leftover `.tmp-<uuid>` is debris, not a second
    // failure to report, but it is still named rather than silently swallowed.
    settleBackground(rm(staging, { recursive: true, force: true }), 'teardown')
    return { ok: false, error: 'unavailable' }
  }
}

/** Only used by tests that need a scratch directory to import from. */
export async function scratchBundleDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'porcelain-canvas-'))
}
