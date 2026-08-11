// @vitest-environment node
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { createNodeWorkspaceFiles } from './workspace-files'

const trash = vi.hoisted(() => ({ moveToTrash: vi.fn(async () => undefined) }))
vi.mock('../../fs/move-to-trash', () => trash)

const files = createNodeWorkspaceFiles()

afterEach(() => {
  vi.clearAllMocks()
})

describe('createNodeWorkspaceFiles', () => {
  it('throws on unusable project root (missing or file)', async () => {
    await withTemporaryDirectory('porcelain-files-root-', async (dir) => {
      const fileRoot = join(dir, 'not-a-dir')
      await writeFile(fileRoot, 'x')
      await expect(
        files.readFile({ projectPath: join(dir, 'missing'), path: 'a.txt' }),
      ).rejects.toThrow(/unusable project root/)
      await expect(files.readFile({ projectPath: fileRoot, path: 'a.txt' })).rejects.toThrow(
        /unusable project root/,
      )
    })
  })

  it('returns text/image/binary/too-large/not-found FileView branches', async () => {
    await withTemporaryDirectory('porcelain-files-read-', async (dir) => {
      await writeFile(join(dir, 'notes.txt'), 'line one\n', 'utf8')
      await writeFile(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))
      await writeFile(join(dir, 'blob.bin'), Buffer.from([0, 1, 2, 3]))
      // Size just over 10 MiB
      const big = join(dir, 'big.bin')
      await writeFile(big, Buffer.alloc(10 * 1024 * 1024 + 1))

      expect(await files.readFile({ projectPath: dir, path: 'notes.txt' })).toEqual({
        ok: true,
        value: { type: 'text', content: 'line one\n' },
      })
      const image = await files.readFile({ projectPath: dir, path: 'shot.png' })
      expect(image.ok && image.value.type === 'image').toBe(true)
      expect(await files.readFile({ projectPath: dir, path: 'blob.bin' })).toEqual({
        ok: true,
        value: { type: 'binary', size: 4 },
      })
      const tooLarge = await files.readFile({ projectPath: dir, path: 'big.bin' })
      expect(tooLarge).toMatchObject({ ok: true, value: { type: 'too-large' } })
      expect(await files.readFile({ projectPath: dir, path: 'missing.txt' })).toEqual({
        ok: true,
        value: { type: 'not-found' },
      })
    })
  })

  it('previewHtml returns inlined html or soft null', async () => {
    await withTemporaryDirectory('porcelain-files-preview-', async (dir) => {
      await writeFile(join(dir, 'index.html'), '<!doctype html><p>preview</p>', 'utf8')
      const ok = await files.previewHtml({ projectPath: dir, path: 'index.html' })
      expect(ok).toEqual({ ok: true, value: expect.stringContaining('<p>preview</p>') })
      expect(await files.previewHtml({ projectPath: dir, path: 'missing.html' })).toEqual({
        ok: true,
        value: null,
      })
    })
  })

  it('create/write/rename/duplicate/trash mutations work with relative wire paths', async () => {
    await withTemporaryDirectory('porcelain-files-mut-', async (dir) => {
      expect(
        await files.writeTextFile({ projectPath: dir, path: 'written.txt', content: 'héllo\n' }),
      ).toEqual({ ok: true, value: undefined })
      expect(await readFile(join(dir, 'written.txt'), 'utf8')).toBe('héllo\n')

      expect(await files.createFile({ projectPath: dir, path: 'created.txt' })).toEqual({
        ok: true,
        value: undefined,
      })
      expect(await files.createFolder({ projectPath: dir, path: 'folder' })).toEqual({
        ok: true,
        value: undefined,
      })

      await writeFile(join(dir, 'from.txt'), 'source', 'utf8')
      expect(await files.renamePath({ projectPath: dir, from: 'from.txt', to: 'to.txt' })).toEqual({
        ok: true,
        value: undefined,
      })
      expect(await readFile(join(dir, 'to.txt'), 'utf8')).toBe('source')

      const dup = await files.duplicatePath({ projectPath: dir, path: 'to.txt' })
      expect(dup).toEqual({ ok: true, value: 'to copy.txt' })
      expect(await readFile(join(dir, 'to copy.txt'), 'utf8')).toBe('source')

      expect(await files.trashPath({ projectPath: dir, path: 'created.txt' })).toEqual({
        ok: true,
        value: undefined,
      })
      expect(trash.moveToTrash).toHaveBeenCalledWith(join(dir, 'created.txt'))
    })
  })

  it('maps create collision to already-exists and rename conflict without overwriting', async () => {
    await withTemporaryDirectory('porcelain-files-conflict-', async (dir) => {
      await writeFile(join(dir, 'exists.txt'), 'a')
      await writeFile(join(dir, 'from.txt'), 'source')
      await writeFile(join(dir, 'to.txt'), 'destination')

      expect(await files.createFile({ projectPath: dir, path: 'exists.txt' })).toEqual({
        ok: false,
        error: { code: 'already-exists', path: 'exists.txt' },
      })
      expect(await files.createFolder({ projectPath: dir, path: 'exists.txt' })).toEqual({
        ok: false,
        error: { code: 'already-exists', path: 'exists.txt' },
      })

      // Best-effort precheck: destination content preserved when precheck fires.
      // POSIX race caveat: Node cannot provide portable atomic no-replace rename.
      expect(await files.renamePath({ projectPath: dir, from: 'from.txt', to: 'to.txt' })).toEqual({
        ok: false,
        error: { code: 'destination-exists' },
      })
      expect(await readFile(join(dir, 'to.txt'), 'utf8')).toBe('destination')
      expect(await readFile(join(dir, 'from.txt'), 'utf8')).toBe('source')
    })
  })

  it('symlink escape is path-outside; contained symlink read follows', async () => {
    await withTemporaryDirectory('porcelain-files-symlink-', async (dir) => {
      const outside = join(dir, 'outside-target')
      const root = join(dir, 'root')
      mkdirSync(root)
      writeFileSync(outside, 'secret')
      symlinkSync(outside, join(root, 'escape'))

      expect(await files.readFile({ projectPath: root, path: 'escape' })).toEqual({
        ok: false,
        error: { code: 'path-outside-project', path: 'escape' },
      })

      await writeFile(join(root, 'real.txt'), 'inside')
      await symlink(join(root, 'real.txt'), join(root, 'link.txt'))
      expect(await files.readFile({ projectPath: root, path: 'link.txt' })).toEqual({
        ok: true,
        value: { type: 'text', content: 'inside' },
      })
    })
  })

  it('missing read/preview under resolvable outside intermediate is path-outside not soft missing', async () => {
    await withTemporaryDirectory('porcelain-files-out-int-', async (dir) => {
      const outside = join(dir, 'outside')
      const root = join(dir, 'root')
      mkdirSync(outside)
      mkdirSync(root)
      // link → /outside (resolvable intermediate); target missing
      symlinkSync(outside, join(root, 'link'))
      expect(await files.readFile({ projectPath: root, path: 'link/missing.txt' })).toEqual({
        ok: false,
        error: { code: 'path-outside-project', path: 'link/missing.txt' },
      })
      expect(await files.previewHtml({ projectPath: root, path: 'link/missing.html' })).toEqual({
        ok: false,
        error: { code: 'path-outside-project', path: 'link/missing.html' },
      })
    })
  })

  it('existing non-symlink under outside intermediate is path-outside for create dest', async () => {
    await withTemporaryDirectory('porcelain-files-out-exist-', async (dir) => {
      const outside = join(dir, 'outside')
      const root = join(dir, 'root')
      mkdirSync(outside)
      mkdirSync(root)
      writeFileSync(join(outside, 'file.txt'), 'x')
      symlinkSync(outside, join(root, 'link'))
      expect(await files.createFile({ projectPath: root, path: 'link/file.txt' })).toEqual({
        ok: false,
        error: { code: 'path-outside-project', path: 'link/file.txt' },
      })
    })
  })

  it('final dangling symlink is path-outside for write/create', async () => {
    await withTemporaryDirectory('porcelain-files-dangling-', async (dir) => {
      await symlink(join(dir, 'no-such-target'), join(dir, 'dangle'))
      expect(await files.writeTextFile({ projectPath: dir, path: 'dangle', content: 'x' })).toEqual(
        {
          ok: false,
          error: { code: 'path-outside-project', path: 'dangle' },
        },
      )
      expect(await files.createFile({ projectPath: dir, path: 'dangle' })).toEqual({
        ok: false,
        error: { code: 'path-outside-project', path: 'dangle' },
      })
    })
  })

  it('intermediate dangling symlink on missing-capable path is path-outside', async () => {
    await withTemporaryDirectory('porcelain-files-int-dangle-', async (dir) => {
      await symlink(join(dir, 'no-such-dir'), join(dir, 'dangle-dir'))
      expect(
        await files.writeTextFile({
          projectPath: dir,
          path: 'dangle-dir/child.txt',
          content: 'x',
        }),
      ).toEqual({
        ok: false,
        error: { code: 'path-outside-project', path: 'dangle-dir/child.txt' },
      })
    })
  })

  it('final ELOOP at leaf is path-outside', async () => {
    await withTemporaryDirectory('porcelain-files-eloop-', async (dir) => {
      const a = join(dir, 'a')
      const b = join(dir, 'b')
      await symlink(b, a)
      await symlink(a, b)
      expect(await files.readFile({ projectPath: dir, path: 'a' })).toEqual({
        ok: false,
        error: { code: 'path-outside-project', path: 'a' },
      })
    })
  })

  it('contained intermediate symlink supports existing read and missing not-found', async () => {
    await withTemporaryDirectory('porcelain-files-in-link-', async (dir) => {
      await mkdir(join(dir, 'real-dir'))
      await writeFile(join(dir, 'real-dir', 'file.txt'), 'ok')
      await symlink(join(dir, 'real-dir'), join(dir, 'link-dir'))
      expect(await files.readFile({ projectPath: dir, path: 'link-dir/file.txt' })).toEqual({
        ok: true,
        value: { type: 'text', content: 'ok' },
      })
      expect(await files.readFile({ projectPath: dir, path: 'link-dir/missing.txt' })).toEqual({
        ok: true,
        value: { type: 'not-found' },
      })
      expect(await files.trashPath({ projectPath: dir, path: 'link-dir/missing.txt' })).toEqual({
        ok: false,
        error: { code: 'not-found', path: 'link-dir/missing.txt' },
      })
    })
  })

  it('duplicate advances past dangling sibling and never clobbers', async () => {
    await withTemporaryDirectory('porcelain-files-dup-', async (dir) => {
      await writeFile(join(dir, 'bar.ts'), 'src')
      await symlink(join(dir, 'nope'), join(dir, 'bar copy.ts'))
      const result = await files.duplicatePath({ projectPath: dir, path: 'bar.ts' })
      expect(result).toEqual({ ok: true, value: 'bar copy 2.ts' })
      expect(await readFile(join(dir, 'bar copy 2.ts'), 'utf8')).toBe('src')
    })
  })

  it('duplicate of symlink-to-directory uses directory naming while copying the entry', async () => {
    await withTemporaryDirectory('porcelain-files-dup-dirlink-', async (dir) => {
      await mkdir(join(dir, 'utils'))
      await writeFile(join(dir, 'utils', 'a.ts'), '1')
      await symlink(join(dir, 'utils'), join(dir, 'utils-link'))
      const result = await files.duplicatePath({ projectPath: dir, path: 'utils-link' })
      expect(result.ok).toBe(true)
      if (result.ok) {
        // Directory naming (no extension split) because resolved target is a directory.
        expect(result.value).toBe('utils-link copy')
      }
    })
  })

  it('mutation missing parent maps to not-found', async () => {
    await withTemporaryDirectory('porcelain-files-miss-parent-', async (dir) => {
      expect(
        await files.writeTextFile({
          projectPath: dir,
          path: 'no-parent/child.txt',
          content: 'x',
        }),
      ).toEqual({
        ok: false,
        error: { code: 'not-found', path: 'no-parent/child.txt' },
      })
    })
  })

  it('post-I/O ENOENT maps: write/create/trash not-found; read soft; preview null; dup not-found', async () => {
    await withTemporaryDirectory('porcelain-files-post-io-', async (dir) => {
      await writeFile(join(dir, 'gone.txt'), 'x')
      const enoent = Object.assign(new Error('enoent'), { code: 'ENOENT' })

      const writeFail = createNodeWorkspaceFiles({
        writeFile: async () => {
          throw enoent
        },
      })
      expect(
        await writeFail.writeTextFile({ projectPath: dir, path: 'gone.txt', content: 'y' }),
      ).toEqual({
        ok: false,
        error: { code: 'not-found', path: 'gone.txt' },
      })
      expect(await writeFail.createFile({ projectPath: dir, path: 'new-file.txt' })).toEqual({
        ok: false,
        error: { code: 'not-found', path: 'new-file.txt' },
      })

      const mkdirFail = createNodeWorkspaceFiles({
        mkdir: async () => {
          throw enoent
        },
      })
      expect(await mkdirFail.createFolder({ projectPath: dir, path: 'new-folder' })).toEqual({
        ok: false,
        error: { code: 'not-found', path: 'new-folder' },
      })

      const trashFail = createNodeWorkspaceFiles({
        moveToTrash: async () => {
          throw enoent
        },
      })
      expect(await trashFail.trashPath({ projectPath: dir, path: 'gone.txt' })).toEqual({
        ok: false,
        error: { code: 'not-found', path: 'gone.txt' },
      })

      const readFail = createNodeWorkspaceFiles({
        readFile: async () => {
          throw enoent
        },
      })
      expect(await readFail.readFile({ projectPath: dir, path: 'gone.txt' })).toEqual({
        ok: true,
        value: { type: 'not-found' },
      })
      expect(await readFail.previewHtml({ projectPath: dir, path: 'gone.txt' })).toEqual({
        ok: true,
        value: null,
      })

      const cpFail = createNodeWorkspaceFiles({
        cp: async () => {
          throw enoent
        },
      })
      expect(await cpFail.duplicatePath({ projectPath: dir, path: 'gone.txt' })).toEqual({
        ok: false,
        error: { code: 'not-found', path: 'gone.txt' },
      })
    })
  })

  it('post-rename ENOENT maps missing from; both present throws fallback', async () => {
    await withTemporaryDirectory('porcelain-files-rename-enoent-', async (dir) => {
      await writeFile(join(dir, 'from.txt'), 'x')
      const enoent = Object.assign(new Error('enoent'), { code: 'ENOENT' })
      const { unlink } = await import('node:fs/promises')

      const missingFrom = createNodeWorkspaceFiles({
        rename: async () => {
          await unlink(join(dir, 'from.txt'))
          throw enoent
        },
      })
      expect(
        await missingFrom.renamePath({ projectPath: dir, from: 'from.txt', to: 'to.txt' }),
      ).toEqual({
        ok: false,
        error: { code: 'not-found', path: 'from.txt' },
      })

      await writeFile(join(dir, 'from2.txt'), 'x')
      const bothPresent = createNodeWorkspaceFiles({
        rename: async () => {
          throw enoent
        },
      })
      // from still present, to parent present → throw (unexpected race)
      await expect(
        bothPresent.renamePath({ projectPath: dir, from: 'from2.txt', to: 'to2.txt' }),
      ).rejects.toThrow()
    })
  })
})
