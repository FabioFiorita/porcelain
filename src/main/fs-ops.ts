import { basename, dirname, extname, join } from 'node:path'

/**
 * Finder-style duplicate target: `bar.ts` → `bar copy.ts` → `bar copy 2.ts`, walking
 * until a free name is found. Pure — the caller supplies `exists` so the search is
 * testable without touching the filesystem. A file keeps its extension (the suffix is
 * inserted before it); a directory (and a dotfile like `.gitignore`, which has no
 * extension) gets the suffix appended whole.
 */
export function uniqueDuplicatePath(
  path: string,
  isDir: boolean,
  exists: (candidate: string) => boolean,
): string {
  const dir = dirname(path)
  const name = basename(path)
  const ext = isDir ? '' : extname(name)
  const stem = ext ? name.slice(0, -ext.length) : name

  for (let n = 1; ; n++) {
    const suffix = n === 1 ? ' copy' : ` copy ${n}`
    const candidate = join(dir, `${stem}${suffix}${ext}`)
    if (!exists(candidate)) return candidate
  }
}
