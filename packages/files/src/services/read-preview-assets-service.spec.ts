import { describe, expect, it } from 'vitest';
import type { FileRead } from '@porcelain/files/models';
import { InMemoryFileReader } from '../../spec/fakes/in-memory-file-reader.ts';
import { ReadPreviewAssetsService } from './read-preview-assets-service.ts';

const worktreeId = 'a'.repeat(32);
const roomy = {
  maxAssetBytes: 1024,
  maxTotalBytes: 4096,
  maxPathLength: 4096,
  base64ChunkBytes: 0x8000,
};

function file(length: number): FileRead {
  return {
    kind: 'file',
    bytes: Uint8Array.from({ length }, (_, index) => index + 1),
    revision: 'r1',
  };
}

function serviceWith(files: Record<string, FileRead>, options = roomy) {
  return new ReadPreviewAssetsService(
    new InMemoryFileReader({ files }),
    options,
  );
}

describe('ReadPreviewAssetsService', () => {
  it('answers every reference in request order as an asset or unavailable', async () => {
    const service = serviceWith({ 'a.png': file(3), 'notes.txt': file(4) });
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
    const service = serviceWith({ 'a.png': file(3) });
    const { assets } = await service.execute({
      worktreeId,
      document: 'README.md',
      paths: ['a.png', 'a.png'],
    });
    expect(assets.map((asset) => asset.path)).toEqual(['a.png']);
  });

  it('serves only references inside the folder of the document', async () => {
    const service = serviceWith({
      'docs/a.png': file(3),
      'docs-old/b.png': file(3),
      'c.png': file(3),
    });
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
    const service = serviceWith(
      { 'a.png': file(4), 'b.png': file(4), 'c.png': file(1) },
      { ...roomy, maxAssetBytes: 10, maxTotalBytes: 6, maxPathLength: 4096 },
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
    const service = serviceWith(
      { 'big.png': file(5), 'ok.png': file(4) },
      { ...roomy, maxAssetBytes: 4, maxTotalBytes: 100, maxPathLength: 4096 },
    );
    const { assets } = await service.execute({
      worktreeId,
      document: 'README.md',
      paths: ['big.png', 'ok.png'],
    });
    expect(assets.map((asset) => asset.kind)).toEqual(['unavailable', 'asset']);
  });

  it('marks an asset the reader could not read whole unavailable', async () => {
    const service = serviceWith({
      'big.png': { kind: 'too-large' },
      'folder.png': { kind: 'failed', failure: 'unreadable' },
    });
    const { assets } = await service.execute({
      worktreeId,
      document: 'README.md',
      paths: ['big.png', 'folder.png'],
    });
    expect(assets.map((asset) => asset.kind)).toEqual([
      'unavailable',
      'unavailable',
    ]);
  });

  it('serves a reference at the path length limit and refuses one character more', async () => {
    const service = serviceWith(
      { 'abcdef.png': file(1), 'abcdefg.png': file(1) },
      { ...roomy, maxAssetBytes: 10, maxTotalBytes: 100, maxPathLength: 10 },
    );
    const { assets } = await service.execute({
      worktreeId,
      document: 'README.md',
      paths: ['abcdef.png', 'abcdefg.png'],
    });
    expect(assets.map((asset) => asset.kind)).toEqual(['asset', 'unavailable']);
  });
});
