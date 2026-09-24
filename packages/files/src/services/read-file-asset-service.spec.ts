import { describe, expect, it } from 'vitest';
import {
  ContentChangedError,
  FileTooLargeError,
  PathNotFoundError,
  PathNotReadableError,
  UnsupportedAssetTypeError,
} from '@porcelain/files/errors';
import type { FileRead } from '@porcelain/files/models';
import { InMemoryFileReader } from '../../spec/fakes/in-memory-file-reader.ts';
import { ReadFileAssetService } from './read-file-asset-service.ts';

const worktreeId = 'a'.repeat(32);

function file(bytes: Uint8Array): FileRead {
  return { kind: 'file', bytes, revision: 'r1' };
}

function serviceWith(files: Record<string, FileRead>, maxBytes = 1024) {
  return new ReadFileAssetService(new InMemoryFileReader({ files }), {
    maxBytes,
    base64ChunkBytes: 0x8000,
  });
}

describe('ReadFileAssetService', () => {
  it('answers an image with its media type and base64 content', async () => {
    const service = serviceWith({
      'img/dot.png': file(new Uint8Array([0, 255, 1])),
    });
    await expect(
      service.execute({ worktreeId, path: 'img/dot.png' }),
    ).resolves.toEqual({
      path: 'img/dot.png',
      mediaType: 'image/png',
      base64: 'AP8B',
    });
  });

  it('refuses a file that is not a previewable asset before reading it', async () => {
    const service = serviceWith({});
    await expect(
      service.execute({ worktreeId, path: 'README.md' }),
    ).rejects.toThrow(UnsupportedAssetTypeError);
  });

  it('reads an asset at the limit and refuses one byte more', async () => {
    const service = serviceWith(
      {
        'fits.png': file(new Uint8Array(8)),
        'over.png': file(new Uint8Array(9)),
      },
      8,
    );
    await expect(
      service.execute({ worktreeId, path: 'fits.png' }),
    ).resolves.toMatchObject({ path: 'fits.png' });
    await expect(
      service.execute({ worktreeId, path: 'over.png' }),
    ).rejects.toThrow(FileTooLargeError);
  });

  it('refuses an asset the reader stopped reading at the limit', async () => {
    const service = serviceWith({ 'big.png': { kind: 'too-large' } });
    await expect(
      service.execute({ worktreeId, path: 'big.png' }),
    ).rejects.toThrow(FileTooLargeError);
  });

  it('reports a missing asset as not found', async () => {
    const service = serviceWith({});
    await expect(
      service.execute({ worktreeId, path: 'missing.png' }),
    ).rejects.toThrow(PathNotFoundError);
  });

  it('reports an asset path that is not a regular file as unreadable', async () => {
    const service = serviceWith({
      'folder.png': { kind: 'failed', failure: 'unreadable' },
    });
    await expect(
      service.execute({ worktreeId, path: 'folder.png' }),
    ).rejects.toThrow(PathNotReadableError);
  });

  it('reports an asset that changed while it was read as changed', async () => {
    const service = serviceWith({
      'logo.png': { kind: 'failed', failure: 'changed' },
    });
    await expect(
      service.execute({ worktreeId, path: 'logo.png' }),
    ).rejects.toThrow(ContentChangedError);
  });
});
