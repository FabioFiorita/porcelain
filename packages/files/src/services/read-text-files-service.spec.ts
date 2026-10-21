import { withReadLease } from '@porcelain/effects/worktree';
import { FileReader, ReadTextFilesOptions } from '@porcelain/files/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryFileReader } from '../../spec/fakes/in-memory-file-reader.ts';
import { ReadTextFilesService } from './read-text-files-service.ts';

const worktreeId = 'a'.repeat(32);
const reader = new InMemoryFileReader({
  texts: {
    'README.md': {
      kind: 'text',
      text: 'hello\n',
      byteLength: 6,
      revision: 'r1',
    },
    'big.log': { kind: 'too-large' },
    'secret.txt': { kind: 'failed', failure: 'unreadable' },
    'image.bin': { kind: 'failed', failure: 'unsupported-text' },
    'racing.ts': { kind: 'failed', failure: 'changed' },
  },
});
const service = Effect.runSync(
  ReadTextFilesService.pipe(
    Effect.provide(ReadTextFilesService.layer),
    Effect.provideService(FileReader, reader),
    Effect.provideService(ReadTextFilesOptions, { maxBytes: 64 }),
  ),
);

describe('ReadTextFilesService', () => {
  it('maps every readable path to its text', async () => {
    const read = await Effect.runPromise(
      withReadLease(
        worktreeId,
        service.execute({ worktreeId, paths: ['README.md'] }),
      ),
    );
    expect([...read.texts]).toEqual([['README.md', 'hello\n']]);
    expect(read.unreadable).toEqual([]);
    expect(read.missing).toEqual(new Set());
  });

  it('reports each path it could not read as text instead of dropping it silently', async () => {
    const read = await Effect.runPromise(
      withReadLease(
        worktreeId,
        service.execute({
          worktreeId,
          paths: [
            'README.md',
            'gone.md',
            'big.log',
            'secret.txt',
            'image.bin',
            'racing.ts',
          ],
        }),
      ),
    );
    expect([...read.texts.keys()]).toEqual(['README.md']);
    expect(read.missing).toEqual(new Set(['gone.md']));
    expect(read.unreadable).toEqual([
      'gone.md',
      'big.log',
      'secret.txt',
      'image.bin',
      'racing.ts',
    ]);
  });
});
