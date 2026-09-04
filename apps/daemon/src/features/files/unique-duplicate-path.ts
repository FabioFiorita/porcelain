import { lstatSync } from 'node:fs'
import { basename, dirname, extname, join, posix } from 'node:path'

/** True when any directory entry exists at path, including a dangling symlink. */
export function entryExists(path: string): boolean {
  try {
    lstatSync(path)
    return true
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return false
    throw err
  }
}

const MAX_NAME_CANDIDATES = 10_000

/**
 * Finder-style duplicate target: `bar.ts` → `bar copy.ts` → `bar copy 2.ts`, walking
 * until a free name is found. Pure — the caller supplies `exists` so the search is
 * testable without touching the filesystem. Bound to MAX_NAME_CANDIDATES then throws.
 *
 * A file keeps its extension (the suffix is inserted before it); a directory (and a
 * dotfile like `.gitignore`, which has no extension) gets the suffix appended whole.
 * The `exists` callback must treat dangling symlinks as occupied (use `entryExists`).
 */
export function uniqueDuplicatePath(
  path: string,
  isDir: boolean,
  exists: (candidate: string) => boolean,
): string {
  // Tests and cross-environment callers may carry a POSIX repository identity
  // while this daemon runs on Windows. Preserve that path's grammar instead of
  // silently rewriting it into a Windows lexical path before `exists` sees it.
  const pathApi =
    path.includes('/') && !path.includes('\\') ? posix : { basename, dirname, extname, join }
  const dir = pathApi.dirname(path)
  const name = pathApi.basename(path)
  const ext = isDir ? '' : pathApi.extname(name)
  const stem = ext ? name.slice(0, -ext.length) : name

  for (let n = 1; n <= MAX_NAME_CANDIDATES; n++) {
    const suffix = n === 1 ? ' copy' : ` copy ${n}`
    const candidate = pathApi.join(dir, `${stem}${suffix}${ext}`)
    if (!exists(candidate)) return candidate
  }
  throw new Error(`uniqueDuplicatePath: no free name within ${MAX_NAME_CANDIDATES} candidates`)
}
