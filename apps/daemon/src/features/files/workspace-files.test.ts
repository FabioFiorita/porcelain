// @vitest-environment node
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import {
  lstat,
  mkdir,
  readFile,
  cp as realCp,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { supportsFileSymlinks, withTemporaryDirectory } from '../../testing/temporary-directory'
import { createNodeWorkspaceFiles } from './workspace-files'

const trash = vi.hoisted(() => ({ moveToTrash: vi.fn(async () => undefined) }))
vi.mock('../../fs/move-to-trash', () => trash)

const files = createNodeWorkspaceFiles()

// Windows requires Developer Mode or elevation for ordinary file/directory symlinks.
// Keep the full containment suite active wherever the host grants that capability.
const symlinkIt = supportsFileSymlinks() ? it : it.skip

afterEach(() => {
  vi.clearAllMocks()
})

describe('createNodeWorkspaceFiles', () => {
  it('reads a sorted tree and omits vanished pinned entries', async () => {
    await withTemporaryDirectory('porcelain-files-tree-', async (dir) => {
      await mkdir(join(dir, 'src'))
      await writeFile(join(dir, 'readme.md'), '# tree\n', 'utf8')
      await writeFile(join(dir, '.env'), 'secret\n', 'utf8')
      await writeFile(join(dir, '.DS_Store'), '', 'utf8')

      const hiddenPath = join(dir, '.env')
      const srcPath = join(dir, 'src')
      await expect(
        files.readDir({
          projectPath: dir,
          path: '.',
          showHidden: false,
          hiddenPaths: new Set([hiddenPath]),
          pinnedPaths: new Set([srcPath]),
        }),
      ).resolves.toEqual({
        ok: true,
        value: [
          { name: 'src', path: srcPath, kind: 'dir', hidden: false, pinned: true },
          {
            name: 'readme.md',
            path: join(dir, 'readme.md'),
            kind: 'file',
            hidden: false,
            pinned: false,
          },
        ],
      })

      await expect(
        files.pinnedEntries({
          projectPath: dir,
          hiddenPaths: new Set<string>(),
          pinnedPaths: [srcPath, join(dir, 'vanished')],
        }),
      ).resolves.toEqual([{ name: 'src', path: srcPath, kind: 'dir', hidden: false, pinned: true }])
    })
  })

  it('preserves slash-form project paths in nested directory entries', async () => {
    await withTemporaryDirectory('porcelain-files-slash-path-', async (dir) => {
      const projectPath = dir.replaceAll('\\', '/')
      await mkdir(join(dir, 'src'))
      await writeFile(join(dir, 'src', 'entry.ts'), 'export {}\n', 'utf8')

      await expect(
        files.readDir({
          projectPath,
          path: 'src',
          showHidden: false,
          hiddenPaths: new Set(),
          pinnedPaths: new Set(),
        }),
      ).resolves.toEqual({
        ok: true,
        value: [
          {
            name: 'entry.ts',
            path: `${projectPath}/src/entry.ts`,
            kind: 'file',
            hidden: false,
            pinned: false,
          },
        ],
      })
    })
  })

  symlinkIt('contains directory reads and persisted pins to the declared project', async () => {
    await withTemporaryDirectory('porcelain-files-contained-tree-', async (root) => {
      await withTemporaryDirectory('porcelain-files-outside-tree-', async (outside) => {
        await writeFile(join(outside, 'secret.txt'), 'outside', 'utf8')
        await symlink(outside, join(root, 'outside-link'))

        await expect(
          files.readDir({
            projectPath: root,
            path: 'outside-link',
            showHidden: false,
            hiddenPaths: new Set(),
            pinnedPaths: new Set(),
          }),
        ).resolves.toEqual({
          ok: false,
          error: { code: 'path-outside-project', path: 'outside-link' },
        })

        await expect(
          files.pinnedEntries({
            projectPath: root,
            hiddenPaths: new Set(),
            pinnedPaths: [join(outside, 'secret.txt'), join(root, 'outside-link')],
          }),
        ).resolves.toEqual([])
      })
    })
  })

  it.runIf(process.platform === 'win32')(
    'rejects a Windows junction that escapes the declared project',
    async () => {
      await withTemporaryDirectory('porcelain-files-junction-root-', async (root) => {
        await withTemporaryDirectory('porcelain-files-junction-outside-', async (outside) => {
          await writeFile(join(outside, 'secret.txt'), 'outside', 'utf8')
          await symlink(outside, join(root, 'outside-junction'), 'junction')

          await expect(
            files.readFile({ projectPath: root, path: 'outside-junction/secret.txt' }),
          ).resolves.toEqual({
            ok: false,
            error: { code: 'path-outside-project', path: 'outside-junction/secret.txt' },
          })
        })
      })
    },
  )

  symlinkIt('preserves a symlinked project namespace in directory entry paths', async () => {
    await withTemporaryDirectory('porcelain-files-project-link-', async (parent) => {
      const realProject = join(parent, 'real-project')
      const linkedProject = join(parent, 'linked-project')
      await mkdir(realProject)
      await writeFile(join(realProject, 'README.md'), 'linked checkout', 'utf8')
      await symlink(realProject, linkedProject)

      await expect(
        files.readDir({
          projectPath: linkedProject,
          path: '.',
          showHidden: false,
          hiddenPaths: new Set(),
          pinnedPaths: new Set(),
        }),
      ).resolves.toEqual({
        ok: true,
        value: [
          {
            name: 'README.md',
            path: join(linkedProject, 'README.md'),
            kind: 'file',
            hidden: false,
            pinned: false,
          },
        ],
      })
    })
  })

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

  it('previewHtml inlines a sibling script ONLY when the caller asks for it', async () => {
    // The scripts-enabled preview route asks; the tRPC procedure (web reader
    // fallback, mobile) never does — those frames refuse scripts anyway.
    await withTemporaryDirectory('porcelain-files-preview-scripts-', async (dir) => {
      await writeFile(join(dir, 'app.js'), 'document.title = "ran"', 'utf8')
      await writeFile(
        join(dir, 'index.html'),
        '<!doctype html><script src="./app.js"></script>',
        'utf8',
      )
      const withScripts = await files.previewHtml({
        projectPath: dir,
        path: 'index.html',
        inlineScripts: true,
      })
      expect(withScripts).toEqual({
        ok: true,
        value: expect.stringContaining('<script>document.title = "ran"</script>'),
      })
      const withoutScripts = await files.previewHtml({ projectPath: dir, path: 'index.html' })
      expect(withoutScripts).toEqual({
        ok: true,
        value: expect.stringContaining('<script src="./app.js"></script>'),
      })
    })
  })

  it('create/write/rename/duplicate/trash mutations work with relative wire paths', async () => {
    await withTemporaryDirectory('porcelain-files-mut-', async (dir) => {
      await writeFile(join(dir, 'written.txt'), 'before', 'utf8')
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

  symlinkIt('symlink escape is path-outside; contained symlink read follows', async () => {
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

  symlinkIt(
    'missing read/preview under resolvable outside intermediate is path-outside not soft missing',
    async () => {
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
    },
  )

  symlinkIt(
    'existing non-symlink under outside intermediate is path-outside for create and rename dest',
    async () => {
      await withTemporaryDirectory('porcelain-files-out-exist-', async (dir) => {
        const outside = join(dir, 'outside')
        const root = join(dir, 'root')
        mkdirSync(outside)
        mkdirSync(root)
        writeFileSync(join(outside, 'file.txt'), 'x')
        mkdirSync(join(outside, 'folder'))
        symlinkSync(outside, join(root, 'link'))
        writeFileSync(join(root, 'from.txt'), 'source')

        expect(await files.createFile({ projectPath: root, path: 'link/file.txt' })).toEqual({
          ok: false,
          error: { code: 'path-outside-project', path: 'link/file.txt' },
        })
        expect(await files.createFolder({ projectPath: root, path: 'link/folder' })).toEqual({
          ok: false,
          error: { code: 'path-outside-project', path: 'link/folder' },
        })
        expect(
          await files.renamePath({ projectPath: root, from: 'from.txt', to: 'link/file.txt' }),
        ).toEqual({
          ok: false,
          error: { code: 'path-outside-project', path: 'link/file.txt' },
        })
        // Source preserved when rename dest is rejected.
        expect(await readFile(join(root, 'from.txt'), 'utf8')).toBe('source')
      })
    },
  )

  symlinkIt('final dangling symlink is path-outside for write/create', async () => {
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

  symlinkIt('intermediate dangling symlink on missing-capable path is path-outside', async () => {
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

  symlinkIt('final ELOOP at leaf is path-outside', async () => {
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

  symlinkIt(
    'intermediate ELOOP is path-outside for write/create/rename dest (not unexpected)',
    async () => {
      await withTemporaryDirectory('porcelain-files-int-eloop-', async (dir) => {
        const loopA = join(dir, 'loop-a')
        const loopB = join(dir, 'loop-b')
        await symlink(loopB, loopA)
        await symlink(loopA, loopB)
        await writeFile(join(dir, 'from.txt'), 'source')

        // Initial lstat on lexical absolute hits ELOOP while resolving intermediate components.
        expect(
          await files.writeTextFile({
            projectPath: dir,
            path: 'loop-a/child.txt',
            content: 'x',
          }),
        ).toEqual({
          ok: false,
          error: { code: 'path-outside-project', path: 'loop-a/child.txt' },
        })
        expect(await files.createFile({ projectPath: dir, path: 'loop-a/new.txt' })).toEqual({
          ok: false,
          error: { code: 'path-outside-project', path: 'loop-a/new.txt' },
        })
        expect(await files.createFolder({ projectPath: dir, path: 'loop-a/new-dir' })).toEqual({
          ok: false,
          error: { code: 'path-outside-project', path: 'loop-a/new-dir' },
        })
        expect(
          await files.renamePath({
            projectPath: dir,
            from: 'from.txt',
            to: 'loop-a/renamed.txt',
          }),
        ).toEqual({
          ok: false,
          error: { code: 'path-outside-project', path: 'loop-a/renamed.txt' },
        })
        expect(await readFile(join(dir, 'from.txt'), 'utf8')).toBe('source')
      })
    },
  )

  symlinkIt('contained symlink write follows the contained target', async () => {
    await withTemporaryDirectory('porcelain-files-sym-write-', async (dir) => {
      await writeFile(join(dir, 'real.txt'), 'before')
      await symlink(join(dir, 'real.txt'), join(dir, 'link.txt'))
      expect(
        await files.writeTextFile({ projectPath: dir, path: 'link.txt', content: 'after\n' }),
      ).toEqual({ ok: true, value: undefined })
      // Node writeFile follows the symlink; target content updates; entry stays a link.
      expect(await readFile(join(dir, 'real.txt'), 'utf8')).toBe('after\n')
      expect((await lstat(join(dir, 'link.txt'))).isSymbolicLink()).toBe(true)
    })
  })

  symlinkIt('rename and trash act on the contained symlink entry, not its target', async () => {
    await withTemporaryDirectory('porcelain-files-sym-entry-', async (dir) => {
      await writeFile(join(dir, 'target.txt'), 'payload')
      await symlink(join(dir, 'target.txt'), join(dir, 'link.txt'))

      expect(
        await files.renamePath({
          projectPath: dir,
          from: 'link.txt',
          to: 'renamed-link.txt',
        }),
      ).toEqual({ ok: true, value: undefined })
      expect(await readFile(join(dir, 'target.txt'), 'utf8')).toBe('payload')
      expect((await lstat(join(dir, 'renamed-link.txt'))).isSymbolicLink()).toBe(true)
      await expect(lstat(join(dir, 'link.txt'))).rejects.toMatchObject({ code: 'ENOENT' })

      expect(await files.trashPath({ projectPath: dir, path: 'renamed-link.txt' })).toEqual({
        ok: true,
        value: undefined,
      })
      expect(trash.moveToTrash).toHaveBeenCalledWith(join(dir, 'renamed-link.txt'))
      // Target file still present with original content — trash moved the entry only.
      expect(await readFile(join(dir, 'target.txt'), 'utf8')).toBe('payload')
    })
  })

  symlinkIt(
    'contained intermediate symlink supports existing read and missing not-found',
    async () => {
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
    },
  )

  symlinkIt('duplicate advances past dangling sibling and never clobbers', async () => {
    await withTemporaryDirectory('porcelain-files-dup-', async (dir) => {
      await writeFile(join(dir, 'bar.ts'), 'src')
      await symlink(join(dir, 'nope'), join(dir, 'bar copy.ts'))
      const result = await files.duplicatePath({ projectPath: dir, path: 'bar.ts' })
      expect(result).toEqual({ ok: true, value: 'bar copy 2.ts' })
      expect(await readFile(join(dir, 'bar copy 2.ts'), 'utf8')).toBe('src')
    })
  })

  it('duplicate reselects after ERR_FS_CP_EEXIST / EEXIST without overwriting raced destination', async () => {
    await withTemporaryDirectory('porcelain-files-dup-race-', async (dir) => {
      await writeFile(join(dir, 'bar.ts'), 'original-src')

      let cpCalls = 0
      const raced = createNodeWorkspaceFiles({
        cp: async (src, dest, opts) => {
          cpCalls++
          if (cpCalls === 1) {
            // Race: destination appears between name selection and copy.
            await writeFile(String(dest), 'raced-content', 'utf8')
            throw Object.assign(new Error('exists'), { code: 'ERR_FS_CP_EEXIST' })
          }
          if (cpCalls === 2) {
            // Second collision shape (EEXIST) with another raced name.
            await writeFile(String(dest), 'raced-2', 'utf8')
            throw Object.assign(new Error('exists'), { code: 'EEXIST' })
          }
          return realCp(src, dest, opts)
        },
      })

      const result = await raced.duplicatePath({ projectPath: dir, path: 'bar.ts' })
      expect(result).toEqual({ ok: true, value: 'bar copy 3.ts' })
      expect(await readFile(join(dir, 'bar copy.ts'), 'utf8')).toBe('raced-content')
      expect(await readFile(join(dir, 'bar copy 2.ts'), 'utf8')).toBe('raced-2')
      expect(await readFile(join(dir, 'bar copy 3.ts'), 'utf8')).toBe('original-src')
      expect(cpCalls).toBe(3)
    })
  })

  symlinkIt(
    'duplicate of symlink-to-directory uses directory naming while copying the entry',
    async () => {
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
    },
  )

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

  it('writeTextFile refuses a missing leaf instead of recreating a renamed or trashed file', async () => {
    await withTemporaryDirectory('porcelain-files-save-missing-', async (dir) => {
      expect(
        await files.writeTextFile({ projectPath: dir, path: 'gone.txt', content: 'late save' }),
      ).toEqual({
        ok: false,
        error: { code: 'not-found', path: 'gone.txt' },
      })
      await expect(lstat(join(dir, 'gone.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
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

  it('post-rename ENOENT maps missing from, missing to parent; both present throws fallback', async () => {
    await withTemporaryDirectory('porcelain-files-rename-enoent-', async (dir) => {
      await writeFile(join(dir, 'from.txt'), 'x')
      const enoent = Object.assign(new Error('enoent'), { code: 'ENOENT' })

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

      await mkdir(join(dir, 'sub'))
      await writeFile(join(dir, 'from-parent.txt'), 'x')
      const missingToParent = createNodeWorkspaceFiles({
        rename: async () => {
          await rm(join(dir, 'sub'), { recursive: true })
          throw enoent
        },
      })
      expect(
        await missingToParent.renamePath({
          projectPath: dir,
          from: 'from-parent.txt',
          to: 'sub/to.txt',
        }),
      ).toEqual({
        ok: false,
        error: { code: 'not-found', path: 'sub/to.txt' },
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
