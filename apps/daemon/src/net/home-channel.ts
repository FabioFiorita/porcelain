import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { porcelainHomePath } from '@shared/porcelain-home'
import type { ZodType } from 'zod'

export interface HomeChannel<T> {
  path(): string
  readAll(): Promise<T>
  writeAll(all: T): Promise<void>
  /**
   * Serialized read-modify-write. The callback either mutates `all` in place
   * (returning nothing) or returns a full replacement doc; whichever it produces
   * is what gets persisted.
   */
  mutate(fn: (all: T) => T | undefined): Promise<void>
}

type PathOpts = { path: () => string } | { envVar: string; fileName: string }

/**
 * The single durable-JSON engine for the agent channels under ~/.porcelain (and, via
 * the `path` form, userData/config.json): schema-validated read (empty on
 * absent/invalid), corrupt-file backup, atomic tmp+rename, serialized read-modify-write.
 * Options: `transform` (post-parse hook inside the read); `cache` = `'none'` (default),
 * `'mtime'` (stat-guarded, safe with an external writer) or `'memory'` (ONLY for an
 * app-sole-writer file like config.json); `maxBytes`, above which a file reads as empty.
 */
export function createHomeChannel<T>(
  opts: PathOpts & {
    schema: ZodType<T>
    empty: () => T
    transform?: (parsed: T) => T
    cache?: 'none' | 'mtime' | 'memory'
    maxBytes?: number
  },
): HomeChannel<T> {
  const path = (): string =>
    'path' in opts ? opts.path() : (process.env[opts.envVar] ?? porcelainHomePath(opts.fileName))

  const cacheMode = opts.cache ?? 'none'
  // 'mtime': keyed on the file's stat stamp; 'memory': read-once. Both invalidate
  // on our own write.
  let stamped: { mtimeMs: number; size: number; value: T } | null = null
  let memo: T | null = null

  // Read + parse + transform a present file, backing it up on corruption. Callers
  // handle absence/size before reaching here.
  const parseFile = async (p: string): Promise<T> => {
    const raw = await readFile(p, 'utf8')
    try {
      const parsed = opts.schema.parse(JSON.parse(raw))
      return opts.transform ? opts.transform(parsed) : parsed
    } catch {
      // present but unparseable/schema-invalid — back it up (never silently lose a
      // file an external process may have written) and treat as empty.
      await rename(p, `${p}.corrupt-${Date.now()}`).catch((error: unknown) => {
        console.error(`porcelain: could not back up unparseable ${p}:`, error)
      })
      return opts.empty()
    }
  }

  // Uncached read: absence → empty; oversize → empty + warn; else parse.
  const readWithGuards = async (p: string): Promise<T> => {
    if (opts.maxBytes !== undefined) {
      let size: number
      try {
        size = (await stat(p)).size
      } catch {
        return opts.empty() // absent
      }
      if (size > opts.maxBytes) {
        console.error(`porcelain: ${p} is ${size} bytes (> ${opts.maxBytes}); treating as empty`)
        return opts.empty()
      }
    }
    try {
      return await parseFile(p)
    } catch {
      return opts.empty() // absent (readFile threw)
    }
  }

  const readAll = async (): Promise<T> => {
    const p = path()

    if (cacheMode === 'memory') {
      if (memo !== null) return memo
      memo = await readWithGuards(p)
      return memo
    }

    if (cacheMode === 'mtime') {
      let s: Awaited<ReturnType<typeof stat>>
      try {
        s = await stat(p)
      } catch {
        stamped = null // absent
        return opts.empty()
      }
      if (stamped !== null && stamped.mtimeMs === s.mtimeMs && stamped.size === s.size) {
        return stamped.value
      }
      if (opts.maxBytes !== undefined && s.size > opts.maxBytes) {
        console.error(`porcelain: ${p} is ${s.size} bytes (> ${opts.maxBytes}); treating as empty`)
        stamped = null
        return opts.empty()
      }
      const value = await parseFile(p)
      stamped = { mtimeMs: s.mtimeMs, size: s.size, value }
      return value
    }

    return readWithGuards(p)
  }

  const writeAll = async (all: T): Promise<void> => {
    const p = path()
    await mkdir(dirname(p), { recursive: true })
    const tmp = `${p}.tmp`
    await writeFile(tmp, JSON.stringify(all, null, 2))
    await rename(tmp, p)
    // Refresh caches so our own write is served without a re-parse; 'mtime'
    // re-stats lazily on the next read (cheap) rather than trusting a stat here.
    if (cacheMode === 'memory') memo = all
    else if (cacheMode === 'mtime') stamped = null
  }

  // Serialize app-side read-modify-write so two quick mutations never drop a write.
  let chain: Promise<void> = Promise.resolve()
  const mutate = (fn: (all: T) => T | undefined): Promise<void> => {
    const run = chain.then(async () => {
      const all = await readAll()
      const next = fn(all)
      await writeAll(next ?? all)
    })
    // The caller owns `run`'s rejection; this tail only keeps the chain alive so a
    // failed mutation never blocks the next one.
    chain = Promise.allSettled([run]).then(() => undefined)
    return run
  }

  return { path, readAll, writeAll, mutate }
}
