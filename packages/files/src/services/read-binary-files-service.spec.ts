import { describe, expect, it } from 'vitest';
import { InMemoryFileReader } from '../../spec/fakes/in-memory-file-reader.ts';
import { ReadBinaryFilesService } from './read-binary-files-service.ts';

const worktreeId = 'a'.repeat(32);
const shot = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const reader = new InMemoryFileReader({
  files: {
    'shot.png': { kind: 'file', bytes: shot, revision: 'r1' },
    'huge.webm': { kind: 'too-large' },
    'folder.png': { kind: 'failed', failure: 'unreadable' },
    'moving.png': { kind: 'failed', failure: 'changed' },
  },
});
const service = new ReadBinaryFilesService(reader, { maxBytes: 64 });

describe('ReadBinaryFilesService', () => {
  it('maps every readable path to its bytes', async () => {
    const read = await service.execute({ worktreeId, paths: ['shot.png'] });
    expect([...read.files]).toEqual([['shot.png', shot]]);
    expect(read.tooLarge).toEqual([]);
    expect(read.unreadable).toEqual([]);
  });

  it('reports a path over the limit apart from one it could not read', async () => {
    const read = await service.execute({
      worktreeId,
      paths: ['shot.png', 'huge.webm', 'gone.png', 'folder.png', 'moving.png'],
    });
    expect([...read.files.keys()]).toEqual(['shot.png']);
    expect(read.tooLarge).toEqual(['huge.webm']);
    expect(read.unreadable).toEqual(['gone.png', 'folder.png', 'moving.png']);
  });
});
