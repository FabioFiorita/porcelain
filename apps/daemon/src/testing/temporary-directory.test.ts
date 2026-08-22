// @vitest-environment node
import { access, mkdir, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { withTemporaryDirectory } from './temporary-directory'

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
