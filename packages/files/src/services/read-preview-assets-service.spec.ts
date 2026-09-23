import { describe, expect, it } from 'vitest';
import { MemoryFiles } from '../../spec/fakes/memory-files.ts';
import { ReadPreviewAssetsService } from './read-preview-assets-service.ts';

const worktreeId = 'a'.repeat(32);
const png = new Uint8Array([1, 2, 3]);

describe('ReadPreviewAssetsService', () => {
  it('answers every reference in request order as an asset or unavailable', async () => {
    const service = new ReadPreviewAssetsService(
      new MemoryFiles({ 'a.png': png, 'notes.txt': 'text' }),
    );
    await expect(
      service.execute({
        worktreeId,
        document: 'README.md',
        paths: [
          'missing.png',
          'a.png',
          'notes.txt',
          '../outside.png',
          '.git/x.png',
        ],
      }),
    ).resolves.toEqual({
      assets: [
        { kind: 'unavailable', path: 'missing.png' },
        {
          kind: 'asset',
          path: 'a.png',
          mediaType: 'image/png',
          base64: 'AQID',
        },
        { kind: 'unavailable', path: 'notes.txt' },
        { kind: 'unavailable', path: '../outside.png' },
        { kind: 'unavailable', path: '.git/x.png' },
      ],
    });
  });

  it('answers a repeated reference once', async () => {
    const service = new ReadPreviewAssetsService(
      new MemoryFiles({ 'a.png': png }),
    );
    const { assets } = await service.execute({
      worktreeId,
      document: 'README.md',
      paths: ['a.png', 'a.png'],
    });
    expect(assets.map((asset) => asset.path)).toEqual(['a.png']);
  });

  it('serves only references inside the folder of the document', async () => {
    const service = new ReadPreviewAssetsService(
      new MemoryFiles({
        'docs/a.png': png,
        'docs-old/b.png': png,
        'c.png': png,
      }),
    );
    const { assets } = await service.execute({
      worktreeId,
      document: 'docs/guide.md',
      paths: ['docs/a.png', 'docs-old/b.png', 'c.png'],
    });
    expect(assets.map((asset) => asset.kind)).toEqual([
      'asset',
      'unavailable',
      'unavailable',
    ]);
  });

  it('marks assets unavailable once the preview budget is spent', async () => {
    const service = new ReadPreviewAssetsService(
      new MemoryFiles({
        'a.png': new Uint8Array(4),
        'b.png': new Uint8Array(4),
        'c.png': new Uint8Array(1),
      }),
      { maxAssetBytes: 10, maxTotalBytes: 6 },
    );
    const { assets } = await service.execute({
      worktreeId,
      document: 'README.md',
      paths: ['a.png', 'b.png', 'c.png'],
    });
    expect(assets.map((asset) => asset.kind)).toEqual([
      'asset',
      'unavailable',
      'asset',
    ]);
  });

  it('marks an asset over the single asset limit unavailable', async () => {
    const service = new ReadPreviewAssetsService(
      new MemoryFiles({
        'big.png': new Uint8Array(5),
        'ok.png': new Uint8Array(4),
      }),
      { maxAssetBytes: 4, maxTotalBytes: 100 },
    );
    const { assets } = await service.execute({
      worktreeId,
      document: 'README.md',
      paths: ['big.png', 'ok.png'],
    });
    expect(assets.map((asset) => asset.kind)).toEqual(['unavailable', 'asset']);
  });
});
