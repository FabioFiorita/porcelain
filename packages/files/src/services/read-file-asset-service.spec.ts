import { describe, expect, it } from 'vitest';
import {
  FileTooLargeError,
  PathNotFoundError,
  UnsupportedAssetTypeError,
} from '@porcelain/files/errors';
import { MemoryFiles } from '../../spec/fakes/memory-files.ts';
import { ReadFileAssetService } from './read-file-asset-service.ts';

const worktreeId = 'a'.repeat(32);

describe('ReadFileAssetService', () => {
  it('answers an image with its media type and base64 content', async () => {
    const service = new ReadFileAssetService(
      new MemoryFiles({ 'img/dot.png': new Uint8Array([0, 255, 1]) }),
    );
    await expect(
      service.execute({ worktreeId, path: 'img/dot.png' }),
    ).resolves.toEqual({
      path: 'img/dot.png',
      mediaType: 'image/png',
      base64: 'AP8B',
    });
  });

  it('refuses a readable file that is not a previewable asset', async () => {
    const service = new ReadFileAssetService(
      new MemoryFiles({ 'README.md': '# Title' }),
    );
    await expect(
      service.execute({ worktreeId, path: 'README.md' }),
    ).rejects.toThrow(UnsupportedAssetTypeError);
  });

  it('reads an asset at the limit and refuses one byte more', async () => {
    const files = new MemoryFiles({
      'fits.png': new Uint8Array(8),
      'over.png': new Uint8Array(9),
    });
    const service = new ReadFileAssetService(files, { maxBytes: 8 });
    await expect(
      service.execute({ worktreeId, path: 'fits.png' }),
    ).resolves.toMatchObject({ path: 'fits.png' });
    await expect(
      service.execute({ worktreeId, path: 'over.png' }),
    ).rejects.toThrow(FileTooLargeError);
  });

  it('reports a missing asset as not found', async () => {
    const service = new ReadFileAssetService(new MemoryFiles());
    await expect(
      service.execute({ worktreeId, path: 'missing.png' }),
    ).rejects.toThrow(PathNotFoundError);
  });
});
