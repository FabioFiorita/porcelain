// @vitest-environment node

import * as fs from 'node:fs'
import { access, mkdir, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { supportsFileSymlinks, withTemporaryDirectory } from './temporary-directory'

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  symlinkSync: vi.fn(),
}))

describe('supportsFileSymlinks', () => {
  afterEach(() => vi.resetAllMocks())

  it('surfaces unexpected symlink errors and cleans up the probe', () => {
    const error = Object.assign(new Error('I/O failure'), { code: 'EIO' })
    let directory = ''
    vi.mocked(fs.symlinkSync).mockImplementation((target) => {
      directory = dirname(String(target))
      throw error
    })
    expect(() => supportsFileSymlinks()).toThrow(error)
    expect(fs.existsSync(directory)).toBe(false)
  })

  it('skips EPERM only on Windows', () => {
    const error = Object.assign(new Error('Permission denied'), { code: 'EPERM' })
    vi.mocked(fs.symlinkSync).mockImplementation(() => {
      throw error
    })
    if (process.platform === 'win32') expect(supportsFileSymlinks()).toBe(false)
    else expect(() => supportsFileSymlinks()).toThrow(error)
  })
})

describe('withTemporaryDirectory', () => {
  it('provides an absolute unique path under os.tmpdir and supports nested writes', async () => {
    const seen: string[] = []

    await withTemporaryDirectory('porcelain-tst-002-', async (directory) => {
      seen.push(directory)
      expect(isAbsolute(directory)).toBe(true)
      expect(directory.startsWith(await realpath(tmpdir()))).toBe(true)

      const nested = join(directory, 'nested', 'leaf')
      await mkdir(nested, { recursive: true })
      const file = join(nested, 'note.txt')
      await writeFile(file, 'adapter fixture', 'utf8')
      await expect(access(file)).resolves.toBeUndefined()
    })

    expect(seen).toHaveLength(1)
  })

  it('removes only the exact directory after a successful run', async () => {
    let directory = ''
    await withTemporaryDirectory('porcelain-tst-002-ok-', async (path) => {
      directory = path
      await writeFile(join(path, 'kept-while-running.txt'), 'ok', 'utf8')
      return 'result'
    })

    await expect(access(directory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('removes only the exact directory after the run throws', async () => {
    let directory = ''
    await expect(
      withTemporaryDirectory('porcelain-tst-002-fail-', async (path) => {
        directory = path
        await writeFile(join(path, 'partial.txt'), 'partial', 'utf8')
        throw new Error('adapter failed mid-run')
      }),
    ).rejects.toThrow('adapter failed mid-run')

    await expect(access(directory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('creates distinct directories for concurrent callers', async () => {
    const paths = await Promise.all([
      withTemporaryDirectory('porcelain-tst-002-a-', async (path) => path),
      withTemporaryDirectory('porcelain-tst-002-b-', async (path) => path),
    ])
    expect(paths[0]).not.toBe(paths[1])
    await expect(access(paths[0] as string)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(paths[1] as string)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
