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
  },
});
const service = new ReadTextFilesService(reader, { maxBytes: 64 });

describe('ReadTextFilesService', () => {
  it('maps every readable path to its text', async () => {
    const read = await service.execute({ worktreeId, paths: ['README.md'] });
    expect([...read.texts]).toEqual([['README.md', 'hello\n']]);
    expect(read.unreadable).toEqual([]);
  });

  it('reports each path it could not read as text instead of dropping it silently', async () => {
    const read = await service.execute({
      worktreeId,
      paths: ['README.md', 'gone.md', 'big.log', 'secret.txt', 'image.bin'],
    });
    expect([...read.texts.keys()]).toEqual(['README.md']);
    expect(read.unreadable).toEqual([
      'gone.md',
      'big.log',
      'secret.txt',
      'image.bin',
    ]);
  });

  it('reads nothing when no path is asked', async () => {
    expect(await service.execute({ worktreeId, paths: [] })).toEqual({
      texts: new Map(),
      unreadable: [],
    });
  });
});
