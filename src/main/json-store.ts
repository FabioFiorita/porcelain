import { readFile, rename, writeFile } from 'fs/promises'

async function readJson<T>(path: string, parse: (raw: unknown) => T, empty: T): Promise<T> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    return empty
  }
  try {
    return parse(JSON.parse(raw))
  } catch {
    await rename(path, `${path}.corrupt-${Date.now()}`).catch(() => {})
    return empty
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await rename(tmp, path)
}

export interface JsonStore<T> {
  load: () => Promise<T>
  update: (mutate: (current: T) => T) => Promise<T>
}

/** Durable JSON persistence: atomic writes, corrupt-file backup, serialized updates. */
export function createJsonStore<T>(opts: {
  path: () => string
  parse: (raw: unknown) => T
  empty: T
}): JsonStore<T> {
  let cached: T | null = null
  let queue: Promise<unknown> = Promise.resolve()

  const load = async (): Promise<T> => {
    if (cached !== null) return cached
    cached = await readJson(opts.path(), opts.parse, opts.empty)
    return cached
  }

  const update = (mutate: (current: T) => T): Promise<T> => {
    const next = queue.then(async () => {
      const updated = mutate(await load())
      await writeJsonAtomic(opts.path(), updated)
      cached = updated
      return updated
    })
    queue = next.catch(() => {})
    return next
  }

  return { load, update }
}
