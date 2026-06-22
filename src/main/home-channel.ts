import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ZodType } from 'zod'

export interface HomeChannel<T> {
  path(): string
  readAll(): Promise<T>
  writeAll(all: T): Promise<void>
  mutate<R>(fn: (all: T) => R): Promise<R>
}

/**
 * The shared plumbing for an agent-channel JSON file under ~/.porcelain: an
 * env-overridable path, schema-validated read (empty on absent/invalid), atomic
 * tmp+rename write, and an in-process serialized read-modify-write so two quick
 * mutations never drop a write. Each channel layers its domain functions on top.
 */
export function createHomeChannel<T>(opts: {
  envVar: string
  fileName: string
  schema: ZodType<T>
  empty: () => T
}): HomeChannel<T> {
  const path = (): string =>
    process.env[opts.envVar] ?? join(homedir(), '.porcelain', opts.fileName)

  const readAll = async (): Promise<T> => {
    try {
      return opts.schema.parse(JSON.parse(await readFile(path(), 'utf8')))
    } catch {
      // absent, unparseable, or schema-invalid — treat as empty
      return opts.empty()
    }
  }

  const writeAll = async (all: T): Promise<void> => {
    const p = path()
    await mkdir(dirname(p), { recursive: true })
    const tmp = `${p}.tmp`
    await writeFile(tmp, JSON.stringify(all, null, 2))
    await rename(tmp, p)
  }

  // Serialize app-side read-modify-write so two quick mutations never drop a write.
  let chain: Promise<void> = Promise.resolve()
  const mutate = <R>(fn: (all: T) => R): Promise<R> => {
    const run = chain.then(async () => {
      const all = await readAll()
      const result = fn(all)
      await writeAll(all)
      return result
    })
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  return { path, readAll, writeAll, mutate }
}
