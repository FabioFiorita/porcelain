import { describe, expect, it } from 'vitest';
import {
  DirectoryTooLargeError,
  PathNotFoundError,
  PathNotReadableError,
} from '@porcelain/files/errors';
import { MemoryFiles } from '../../spec/fakes/memory-files.ts';
import { MemoryIgnoredEntries } from '../../spec/fakes/memory-ignored-entries.ts';
import { ListDirectoryService } from './list-directory-service.ts';

const worktreeId = 'a'.repeat(32);
const roomy = { maxEntries: 100, maxResponseBytes: 1024 * 1024 };

describe('ListDirectoryService', () => {
  it('lists the entries of a folder in code unit order', async () => {
    const files = new MemoryFiles({ 'b.md': '', 'B.md': '', 'a/x.md': '' });
    const service = new ListDirectoryService(files, new MemoryIgnoredEntries());
    await expect(service.execute({ worktreeId, path: '' })).resolves.toEqual({
      worktreeId,
      path: '',
      entries: [
        { name: 'B.md', kind: 'file' },
        { name: 'a', kind: 'directory' },
        { name: 'b.md', kind: 'file' },
      ],
    });
  });

  it('flags entries that Git ignores by their worktree path', async () => {
    const files = new MemoryFiles({ 'src/app.ts': '', 'src/app.log': '' });
    const service = new ListDirectoryService(
      files,
      new MemoryIgnoredEntries(['src/app.log', 'app.ts']),
      roomy,
    );
    await expect(
      service.execute({ worktreeId, path: 'src' }),
    ).resolves.toMatchObject({
      entries: [
        { name: 'app.log', kind: 'file', ignored: true },
        { name: 'app.ts', kind: 'file' },
      ],
    });
  });

  it('lists a folder at the entry limit and refuses one entry more', async () => {
    const service = (count: number) =>
      new ListDirectoryService(
        new MemoryFiles(
          Object.fromEntries(
            Array.from({ length: count }, (_, index) => [`f${index}`, '']),
          ),
        ),
        new MemoryIgnoredEntries(),
        { maxEntries: 3, maxResponseBytes: 1024 },
      );
    await expect(
      service(3).execute({ worktreeId, path: '' }),
    ).resolves.toMatchObject({ entries: { length: 3 } });
    await expect(service(4).execute({ worktreeId, path: '' })).rejects.toThrow(
      DirectoryTooLargeError,
    );
  });

  it('refuses a listing whose answer exceeds the response limit', async () => {
    const service = new ListDirectoryService(
      new MemoryFiles({ [`${'n'.repeat(200)}.md`]: '' }),
      new MemoryIgnoredEntries(),
      { maxEntries: 10, maxResponseBytes: 200 },
    );
    await expect(service.execute({ worktreeId, path: '' })).rejects.toThrow(
      DirectoryTooLargeError,
    );
  });

  it('reports a missing folder as not found and a file as unreadable', async () => {
    const service = new ListDirectoryService(
      new MemoryFiles({ 'README.md': '' }),
      new MemoryIgnoredEntries(),
    );
    await expect(
      service.execute({ worktreeId, path: 'missing' }),
    ).rejects.toThrow(PathNotFoundError);
    await expect(
      service.execute({ worktreeId, path: 'README.md' }),
    ).rejects.toThrow(PathNotReadableError);
  });
});
