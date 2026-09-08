import { execFileSync } from 'node:child_process';
import * as filesystem from 'node:fs/promises';
import {
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { NodeFileReader } from './file-reader.ts';
import { inspectPath, verifyPath } from './inspect-path.ts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    open: vi.fn(actual.open),
    lstat: vi.fn(actual.lstat),
    opendir: vi.fn(actual.opendir),
  };
});

describe('FileReader', () => {
  async function fixture(
    run: (root: string, reader: NodeFileReader) => Promise<void>,
  ) {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), 'porcelain-files-')),
    );
    try {
      await run(root, new NodeFileReader());
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
  const target = (root: string, path: string) => ({
    root,
    path,
    worktreeId: 'ccfb8c0d-4ba5-43e3-bca5-8b76000eec65',
  });

  it('lists one directory in deterministic order, including ignored/dot files but excluding Git metadata', async () =>
    fixture(async (root, reader) => {
      await mkdir(join(root, 'folder'));
      await mkdir(join(root, '.git'));
      await writeFile(join(root, '.env'), 'fixture');
      await writeFile(join(root, 'folder', 'nested'), 'not recursive');
      await symlink('folder', join(root, 'link'));
      execFileSync('mkfifo', [join(root, 'pipe')]);
      const listing = await reader.list(target(root, ''));
      expect(listing.entries).toEqual([
        { name: '.env', kind: 'file' },
        { name: 'folder', kind: 'directory' },
        { name: 'link', kind: 'symlink' },
        { name: 'pipe', kind: 'other' },
      ]);
      await expect(reader.read(target(root, 'pipe'))).rejects.toMatchObject({
        code: 'PATH_NOT_READABLE',
      });
    }));

  it('preserves UTF-8 bytes, BOM, CRLF and empty text', async () =>
    fixture(async (root, reader) => {
      for (const text of ['', '\ufeffolá\r\n世界\n']) {
        await writeFile(join(root, 'text'), text);
        expect(await reader.read(target(root, 'text'))).toEqual({
          worktreeId: target(root, '').worktreeId,
          path: 'text',
          encoding: 'utf-8',
          byteLength: Buffer.byteLength(text),
          text,
        });
      }
    }));

  it('rejects invalid UTF-8, NUL, oversized files and oversized JSON escaping', async () =>
    fixture(async (root, reader) => {
      for (const bytes of [Buffer.from([0xff]), Buffer.from('a\0b')]) {
        await writeFile(join(root, 'text'), bytes);
        await expect(reader.read(target(root, 'text'))).rejects.toMatchObject({
          code: 'UNSUPPORTED_TEXT',
        });
      }
      for (const text of [
        'a'.repeat(1024 * 1024 + 1),
        '\u0001'.repeat(200_000),
      ]) {
        await writeFile(join(root, 'text'), text);
        await expect(reader.read(target(root, 'text'))).rejects.toMatchObject({
          code: 'FILE_TOO_LARGE',
        });
      }
      await writeFile(join(root, 'text'), 'a'.repeat(1024 * 1024 - 200));
      expect((await reader.read(target(root, 'text'))).byteLength).toBe(
        1024 * 1024 - 200,
      );
    }));

  it('rejects traversal and all symlink traversal, including dangling and in-root links', async () =>
    fixture(async (root, reader) => {
      await mkdir(join(root, 'inside'));
      await writeFile(join(root, 'inside', 'file'), 'inside');
      await symlink('inside', join(root, 'local'));
      await symlink(tmpdir(), join(root, 'outside'));
      await symlink('missing', join(root, 'dangling'));
      await symlink('inside/file', join(root, 'file-link'));
      for (const path of [
        '../sibling',
        `../${root.split('/').at(-1)}-other`,
        'local/file',
        'outside/file',
        'dangling',
        'file-link',
      ]) {
        await expect(reader.read(target(root, path))).rejects.toMatchObject({
          code: 'PATH_NOT_READABLE',
        });
      }
      await expect(reader.list(target(root, 'local'))).rejects.toMatchObject({
        code: 'PATH_NOT_READABLE',
      });
      await expect(
        reader.list(target(root, 'inside/file')),
      ).rejects.toMatchObject({ code: 'PATH_NOT_READABLE' });
      await expect(reader.read(target(root, 'missing'))).rejects.toMatchObject({
        code: 'PATH_NOT_FOUND',
      });
    }));

  it('returns complete bounded directories or an explicit error', async () =>
    fixture(async (root, reader) => {
      for (const name of Array.from(
        { length: 2000 },
        (_, index) => `file-${index}`,
      ))
        await writeFile(join(root, name), '');
      expect((await reader.list(target(root, ''))).entries).toHaveLength(2000);
      await writeFile(join(root, 'overflow'), '');
      await expect(reader.list(target(root, ''))).rejects.toMatchObject({
        code: 'DIRECTORY_TOO_LARGE',
      });
    }));

  it('rejects detected file, parent and directory changes between observations', async () =>
    fixture(async (root) => {
      await mkdir(join(root, 'parent'));
      await writeFile(join(root, 'parent/file'), 'before');
      const fileTarget = target(root, 'parent/file');
      const before = await inspectPath(fileTarget);
      await writeFile(join(root, 'parent/file'), 'after changed');
      await expect(verifyPath(before, fileTarget)).rejects.toMatchObject({
        code: 'CONTENT_CHANGED',
      });
      const replaced = await inspectPath(fileTarget);
      await rename(join(root, 'parent'), join(root, 'old'));
      await mkdir(join(root, 'parent'));
      await writeFile(join(root, 'parent/file'), 'after changed');
      await expect(verifyPath(replaced, fileTarget)).rejects.toMatchObject({
        code: 'CONTENT_CHANGED',
      });
      const directoryTarget = target(root, 'parent');
      const directory = await inspectPath(directoryTarget);
      await writeFile(join(root, 'parent/new'), 'new');
      await expect(
        verifyPath(directory, directoryTarget),
      ).rejects.toMatchObject({
        code: 'CONTENT_CHANGED',
      });
      await rm(join(root, 'parent'), { recursive: true });
      await expect(
        verifyPath(directory, directoryTarget),
      ).rejects.toMatchObject({
        code: 'CONTENT_CHANGED',
      });
    }));

  it('honors already cancelled reads and listings', async () =>
    fixture(async (root, reader) => {
      const signal = AbortSignal.abort();
      await expect(reader.list(target(root, ''), signal)).rejects.toMatchObject(
        {
          name: 'AbortError',
        },
      );
      await expect(
        reader.read(target(root, 'file'), signal),
      ).rejects.toMatchObject({ name: 'AbortError' });
    }));

  it('rejects a replacement between path inspection and open, closing the file handle', async () =>
    fixture(async (root, reader) => {
      const path = join(root, 'file');
      await writeFile(path, 'before');
      const originalOpen = (
        await vi.importActual<typeof import('node:fs/promises')>(
          'node:fs/promises',
        )
      ).open;
      let opened: Awaited<ReturnType<typeof originalOpen>> | undefined;
      const intercepted = vi
        .mocked(filesystem.open)
        .mockImplementationOnce(async (...args) => {
          await rename(path, join(root, 'old'));
          await writeFile(path, 'replacement');
          opened = await originalOpen(...args);
          return opened;
        });
      try {
        await expect(reader.read(target(root, 'file'))).rejects.toMatchObject({
          code: 'CONTENT_CHANGED',
        });
        if (!opened) throw new Error('Expected a file handle');
        await expect(opened.stat()).rejects.toMatchObject({ code: 'EBADF' });
      } finally {
        intercepted.mockRestore();
      }
    }));

  it('closes opened files on cancellation and when content grows beyond the bound', async () =>
    fixture(async (root, reader) => {
      const path = join(root, 'file');
      const originalOpen = (
        await vi.importActual<typeof import('node:fs/promises')>(
          'node:fs/promises',
        )
      ).open;
      for (const scenario of ['cancel', 'grow']) {
        await writeFile(path, 'before');
        const controller = new AbortController();
        let opened: Awaited<ReturnType<typeof originalOpen>> | undefined;
        const intercepted = vi
          .mocked(filesystem.open)
          .mockImplementationOnce(async (...args) => {
            opened = await originalOpen(...args);
            if (scenario === 'cancel') controller.abort();
            else await writeFile(path, 'a'.repeat(1024 * 1024 + 1));
            return opened;
          });
        try {
          const reading = reader.read(target(root, 'file'), controller.signal);
          if (scenario === 'cancel')
            await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
          else
            await expect(reading).rejects.toMatchObject({
              code: 'FILE_TOO_LARGE',
            });
          if (!opened) throw new Error('Expected a file handle');
          await expect(opened.stat()).rejects.toMatchObject({ code: 'EBADF' });
        } finally {
          intercepted.mockRestore();
        }
      }
    }));

  it('bounds serialized directory responses even below the entry count limit', async () =>
    fixture(async (root, reader) => {
      for (const index of Array.from({ length: 1000 }, (_, index) => index))
        await writeFile(join(root, `${'\u0001'.repeat(190)}-${index}`), '');
      await expect(reader.list(target(root, ''))).rejects.toMatchObject({
        code: 'DIRECTORY_TOO_LARGE',
      });
    }));

  it('preserves unexpected filesystem failures during verification', async () =>
    fixture(async (root) => {
      await writeFile(join(root, 'file'), 'text');
      const fileTarget = target(root, 'file');
      const before = await inspectPath(fileTarget);
      const failure = Object.assign(new Error('private device failure'), {
        code: 'EIO',
      });
      vi.mocked(filesystem.lstat).mockRejectedValueOnce(failure);
      await expect(verifyPath(before, fileTarget)).rejects.toBe(failure);
    }));

  it('rejects invalid raw directory names without partial results and closes the handle', async () =>
    fixture(async (root, reader) => {
      await writeFile(join(root, 'valid'), 'text');
      const originalOpen = (
        await vi.importActual<typeof import('node:fs/promises')>(
          'node:fs/promises',
        )
      ).opendir;
      let opened: Awaited<ReturnType<typeof originalOpen>> | undefined;
      const intercepted = vi
        .mocked(filesystem.opendir)
        .mockImplementationOnce(async (...args) => {
          const directory = await originalOpen(...args);
          opened = directory;
          const original = {
            [Symbol.asyncIterator]:
              directory[Symbol.asyncIterator].bind(directory),
          };
          directory[Symbol.asyncIterator] = async function* () {
            for await (const entry of original) {
              yield entry;
              // Inject Linux-style non-UTF8 name bytes without requiring macOS to create them.
              Object.defineProperty(entry, 'name', {
                value: Buffer.from([0xff]),
              });
              yield entry;
            }
            return undefined;
          };
          return directory;
        });
      try {
        await expect(reader.list(target(root, ''))).rejects.toMatchObject({
          code: 'UNSUPPORTED_PATH',
        });
        if (!opened) throw new Error('Expected a directory handle');
        await expect(opened.read()).rejects.toMatchObject({
          code: 'ERR_DIR_CLOSED',
        });
      } finally {
        intercepted.mockRestore();
      }
    }));

  it('returns addressable Unicode names including a literal replacement character and BOM', async () =>
    fixture(async (root, reader) => {
      for (const name of ['olá-世界', '\ufffd', '\ufeffname'])
        await writeFile(join(root, name), name);
      const listing = await reader.list(target(root, ''));
      expect(listing.entries).toHaveLength(3);
      for (const entry of listing.entries)
        expect((await reader.read(target(root, entry.name))).text).toBe(
          entry.name,
        );
    }));
});
