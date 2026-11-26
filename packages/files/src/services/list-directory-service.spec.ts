import {
  DirectoryReader,
  IgnoredEntriesReader,
  ListDirectoryOptions,
} from '@porcelain/files/ports';
import { Effect } from 'effect';
import { withReadLease } from '@porcelain/effects/worktree';
import { describe, expect, it } from 'vite-plus/test';
import {
  ContentChangedError,
  PathNotFoundError,
  PathNotReadableError,
  UnsupportedEntryNameError,
} from '@porcelain/files/errors';
import { type DirectoryRead, type EntryKind } from '@porcelain/files/models';
import { InMemoryDirectoryReader } from '../../spec/fakes/in-memory-directory-reader.ts';
import { InMemoryIgnoredEntriesReader } from '../../spec/fakes/in-memory-ignored-entries-reader.ts';
import { ListDirectoryService } from './list-directory-service.ts';

const worktreeId = 'a'.repeat(32);
const roomy = { maxEntries: 100, maxResponseBytes: 1024 * 1024 };

function listed(
  entries: readonly (readonly [string, EntryKind])[],
  omitted = 0,
): DirectoryRead {
  return {
    kind: 'listed',
    entries: entries.map(([name, kind]) => ({ name, kind })),
    omitted,
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
  return Effect.runSync(
    ListDirectoryService.pipe(
      Effect.provide(ListDirectoryService.layer),
      Effect.provideService(
        DirectoryReader,
        new InMemoryDirectoryReader(listings),
      ),
      Effect.provideService(
        IgnoredEntriesReader,
        new InMemoryIgnoredEntriesReader(ignored),
      ),
      Effect.provideService(ListDirectoryOptions, options),
    ),
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
    await expect(
      Effect.runPromise(
        withReadLease(worktreeId, service.execute({ worktreeId, path: '' })),
      ),
    ).resolves.toEqual({
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
      Effect.runPromise(
        withReadLease(worktreeId, service.execute({ worktreeId, path: 'src' })),
      ),
    ).resolves.toEqual({
      worktreeId,
      path: 'src',
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
    await expect(
      Effect.runPromise(
        withReadLease(worktreeId, service.execute({ worktreeId, path: '' })),
      ),
    ).resolves.toEqual({
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
      Effect.runPromise(
        withReadLease(worktreeId, service.execute({ worktreeId, path: '' })),
      ),
    ).resolves.toMatchObject({ entries: { length: 3 } });
  });

  it('lists a folder at the entry limit and counts the entries past it', async () => {
    const options = { maxEntries: 3, maxResponseBytes: 1024 };
    await expect(
      Effect.runPromise(
        withReadLease(
          worktreeId,
          serviceWith({ '': listed(files(3)) }, options).execute({
            worktreeId,
            path: '',
          }),
        ),
      ),
    ).resolves.toEqual({
      worktreeId,
      path: '',
      entries: files(3).map(([name, kind]) => ({ name, kind })),
    });
    await expect(
      Effect.runPromise(
        withReadLease(
          worktreeId,
          serviceWith({ '': listed(files(4)) }, options).execute({
            worktreeId,
            path: '',
          }),
        ),
      ),
    ).resolves.toEqual({
      worktreeId,
      path: '',
      entries: files(3).map(([name, kind]) => ({ name, kind })),
      omitted: 1,
    });
  });

  it('counts the entries the reader left out of a large folder', async () => {
    const service = serviceWith({ '': listed(files(1), 19_999) });
    await expect(
      Effect.runPromise(
        withReadLease(worktreeId, service.execute({ worktreeId, path: '' })),
      ),
    ).resolves.toEqual({
      worktreeId,
      path: '',
      entries: [{ name: 'f0', kind: 'file' }],
      omitted: 19_999,
    });
  });

  it('shortens a listing that would exceed the response limit and counts the rest', async () => {
    const long = (letter: string): [string, EntryKind] => [
      `${letter.repeat(100)}.md`,
      'file',
    ];
    const service = serviceWith(
      { '': listed([long('a'), long('b'), long('c')]) },
      { maxEntries: 10, maxResponseBytes: 300 },
    );
    await expect(
      Effect.runPromise(
        withReadLease(worktreeId, service.execute({ worktreeId, path: '' })),
      ),
    ).resolves.toEqual({
      worktreeId,
      path: '',
      entries: [{ name: `${'a'.repeat(100)}.md`, kind: 'file' }],
      omitted: 2,
    });
  });

  it('reports a missing folder as not found', async () => {
    const service = serviceWith({});
    await expect(
      Effect.runPromise(
        withReadLease(
          worktreeId,
          service.execute({ worktreeId, path: 'missing' }),
        ),
      ),
    ).rejects.toThrow(PathNotFoundError);
  });

  it('reports a path that is not a folder as unreadable', async () => {
    const service = serviceWith({
      'README.md': { kind: 'failed', failure: 'unreadable' },
    });
    await expect(
      Effect.runPromise(
        withReadLease(
          worktreeId,
          service.execute({ worktreeId, path: 'README.md' }),
        ),
      ),
    ).rejects.toThrow(PathNotReadableError);
  });

  it('refuses a folder holding a name that is not UTF-8', async () => {
    const service = serviceWith({
      raw: { kind: 'failed', failure: 'unsupported-name' },
    });
    await expect(
      Effect.runPromise(
        withReadLease(worktreeId, service.execute({ worktreeId, path: 'raw' })),
      ),
    ).rejects.toThrow(UnsupportedEntryNameError);
  });

  it('reports a folder that changed while it was listed as changed', async () => {
    const service = serviceWith({
      src: { kind: 'failed', failure: 'changed' },
    });
    await expect(
      Effect.runPromise(
        withReadLease(worktreeId, service.execute({ worktreeId, path: 'src' })),
      ),
    ).rejects.toThrow(ContentChangedError);
  });
});
