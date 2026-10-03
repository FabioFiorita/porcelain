import { describe, expect, it } from 'vitest';
import {
  ContentChangedError,
  DirectoryTooLargeError,
  PathNotFoundError,
  PathNotReadableError,
  UnsupportedEntryNameError,
} from '@porcelain/files/errors';
import type { DirectoryRead, EntryKind } from '@porcelain/files/models';
import { InMemoryDirectoryReader } from '../../spec/fakes/in-memory-directory-reader.ts';
import { InMemoryIgnoredEntriesReader } from '../../spec/fakes/in-memory-ignored-entries-reader.ts';
import { ListDirectoryService } from './list-directory-service.ts';

const worktreeId = 'a'.repeat(32);
const roomy = { maxEntries: 100, maxResponseBytes: 1024 * 1024 };

function listed(
  entries: readonly (readonly [string, EntryKind])[],
  truncated = false,
): DirectoryRead {
  return {
    kind: 'listed',
    entries: entries.map(([name, kind]) => ({ name, kind })),
    truncated,
  };
}

function files(count: number) {
  return Array.from({ length: count }, (_, index): [string, EntryKind] => [
    `f${index}`,
    'file',
  ]);
}

function serviceWith(
  listings: Record<string, DirectoryRead>,
  options = roomy,
  ignored: readonly string[] = [],
) {
  return new ListDirectoryService(
    new InMemoryDirectoryReader(listings),
    new InMemoryIgnoredEntriesReader(ignored),
    options,
  );
}

describe('ListDirectoryService', () => {
  it('lists the entries of a folder in code unit order', async () => {
    const service = serviceWith({
      '': listed([
        ['b.md', 'file'],
        ['B.md', 'file'],
        ['a', 'directory'],
      ]),
    });
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
    const service = serviceWith(
      {
        src: listed([
          ['app.ts', 'file'],
          ['app.log', 'file'],
        ]),
      },
      roomy,
      ['src/app.log', 'app.ts'],
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

  it('hides the Git folder from the listing', async () => {
    const service = serviceWith({
      '': listed([
        ['.git', 'directory'],
        ['.github', 'directory'],
      ]),
    });
    await expect(service.execute({ worktreeId, path: '' })).resolves.toEqual({
      worktreeId,
      path: '',
      entries: [{ name: '.github', kind: 'directory' }],
    });
  });

  it('does not count the Git folder toward the entry limit', async () => {
    const service = serviceWith(
      { '': listed([['.git', 'directory'], ...files(3)]) },
      { maxEntries: 3, maxResponseBytes: 1024 },
    );
    await expect(
      service.execute({ worktreeId, path: '' }),
    ).resolves.toMatchObject({ entries: { length: 3 } });
  });

  it('lists a folder at the entry limit and refuses one entry more', async () => {
    const options = { maxEntries: 3, maxResponseBytes: 1024 };
    await expect(
      serviceWith({ '': listed(files(3)) }, options).execute({
        worktreeId,
        path: '',
      }),
    ).resolves.toMatchObject({ entries: { length: 3 } });
    await expect(
      serviceWith({ '': listed(files(4)) }, options).execute({
        worktreeId,
        path: '',
      }),
    ).rejects.toThrow(DirectoryTooLargeError);
  });

  it('refuses a folder the reader stopped listing at its limit', async () => {
    const service = serviceWith({ '': listed(files(1), true) });
    await expect(service.execute({ worktreeId, path: '' })).rejects.toThrow(
      DirectoryTooLargeError,
    );
  });

  it('refuses a listing whose answer exceeds the response limit', async () => {
    const service = serviceWith(
      { '': listed([[`${'n'.repeat(200)}.md`, 'file']]) },
      { maxEntries: 10, maxResponseBytes: 200 },
    );
    await expect(service.execute({ worktreeId, path: '' })).rejects.toThrow(
      DirectoryTooLargeError,
    );
  });

  it('reports a missing folder as not found', async () => {
    const service = serviceWith({});
    await expect(
      service.execute({ worktreeId, path: 'missing' }),
    ).rejects.toThrow(PathNotFoundError);
  });

  it('reports a path that is not a folder as unreadable', async () => {
    const service = serviceWith({
      'README.md': { kind: 'failed', failure: 'unreadable' },
    });
    await expect(
      service.execute({ worktreeId, path: 'README.md' }),
    ).rejects.toThrow(PathNotReadableError);
  });

  it('refuses a folder holding a name that is not UTF-8', async () => {
    const service = serviceWith({
      raw: { kind: 'failed', failure: 'unsupported-name' },
    });
    await expect(service.execute({ worktreeId, path: 'raw' })).rejects.toThrow(
      UnsupportedEntryNameError,
    );
  });

  it('reports a folder that changed while it was listed as changed', async () => {
    const service = serviceWith({
      src: { kind: 'failed', failure: 'changed' },
    });
    await expect(service.execute({ worktreeId, path: 'src' })).rejects.toThrow(
      ContentChangedError,
    );
  });
});
