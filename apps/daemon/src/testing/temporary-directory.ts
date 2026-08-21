import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Create a unique directory under `os.tmpdir()` with the given prefix, run
 * `run` against its absolute path, and remove only that exact directory in
 * `finally` (never a parent or a glob).
 */
export async function withTemporaryDirectory<T>(
  prefix: string,
  run: (path: string) => Promise<T> | T,
): Promise<T> {
  // macOS exposes its temporary root as `/var/...` while filesystem APIs and Git can return
  // `/private/var/...`. Give tests the canonical spelling so path assertions exercise product
  // behavior instead of the operating system's compatibility symlink.
  const directory = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
