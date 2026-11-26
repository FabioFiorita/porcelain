import { FileReader, ReadPreviewAssetsOptions } from '@porcelain/files/ports';
import { Effect } from 'effect';
import { withReadLease } from '@porcelain/effects/worktree';
import { describe, expect, it } from 'vite-plus/test';
import { type FileRead } from '@porcelain/files/models';
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
  return Effect.runSync(
    ReadPreviewAssetsService.pipe(
      Effect.provide(ReadPreviewAssetsService.layer),
      Effect.provideService(FileReader, new InMemoryFileReader({ files })),
      Effect.provideService(ReadPreviewAssetsOptions, options),
    ),
  );
}

describe('ReadPreviewAssetsService', () => {
  it('answers every reference in request order as an asset or unavailable', async () => {
    const service = serviceWith({
      'a.png': file(3),
      'notes.txt': file(4),
      '../outside.png': file(3),
      '.git/x.png': file(3),
    });
    await expect(
      Effect.runPromise(
        withReadLease(
          worktreeId,
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
        ),
      ),
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
    const { assets } = await Effect.runPromise(
      withReadLease(
        worktreeId,
        service.execute({
          worktreeId,
          document: 'README.md',
          paths: ['a.png', 'a.png'],
        }),
      ),
    );
    expect(assets.map((asset) => asset.path)).toEqual(['a.png']);
  });

  it('serves references anywhere inside the repository and refuses every path that leaves it', async () => {
    const service = serviceWith({
      'assets/a.png': file(3),
      'docs/b.png': file(3),
      '../outside.png': file(3),
      'docs/../../outside.png': file(3),
      '/etc/logo.png': file(3),
      'docs\\..\\x.png': file(3),
      'C:/x.png': file(3),
      './c.png': file(3),
      '.git/d.png': file(3),
      'docs//e.png': file(3),
    });
    const { assets } = await Effect.runPromise(
      withReadLease(
        worktreeId,
        service.execute({
          worktreeId,
          document: 'docs/guide.md',
          paths: [
            'assets/a.png',
            'docs/b.png',
            '../outside.png',
            'docs/../../outside.png',
            '/etc/logo.png',
            'docs\\..\\x.png',
            'C:/x.png',
            './c.png',
            '.git/d.png',
            'docs//e.png',
          ],
        }),
      ),
    );
    expect(assets.map((asset) => [asset.path, asset.kind])).toEqual([
      ['assets/a.png', 'asset'],
      ['docs/b.png', 'asset'],
      ['../outside.png', 'unavailable'],
      ['docs/../../outside.png', 'unavailable'],
      ['/etc/logo.png', 'unavailable'],
      ['docs\\..\\x.png', 'unavailable'],
      ['C:/x.png', 'unavailable'],
      ['./c.png', 'unavailable'],
      ['.git/d.png', 'unavailable'],
      ['docs//e.png', 'unavailable'],
    ]);
  });

  it('serves video, audio and font references by their media type', async () => {
    const service = serviceWith({
      'demo.MP4': file(1),
      'clip.webm': file(1),
      'sound.mp3': file(1),
      'face.otf': file(1),
    });
    const { assets } = await Effect.runPromise(
      withReadLease(
        worktreeId,
        service.execute({
          worktreeId,
          document: 'README.md',
          paths: ['demo.MP4', 'clip.webm', 'sound.mp3', 'face.otf'],
        }),
      ),
    );
    expect(
      assets.map((asset) =>
        asset.kind === 'asset' ? asset.mediaType : undefined,
      ),
    ).toEqual(['video/mp4', 'video/webm', 'audio/mpeg', 'font/otf']);
  });

  it('marks assets unavailable once the preview budget is spent', async () => {
    const service = serviceWith(
      { 'a.png': file(4), 'b.png': file(4), 'c.png': file(1) },
      { ...roomy, maxAssetBytes: 10, maxTotalBytes: 6, maxPathLength: 4096 },
    );
    const { assets } = await Effect.runPromise(
      withReadLease(
        worktreeId,
        service.execute({
          worktreeId,
          document: 'README.md',
          paths: ['a.png', 'b.png', 'c.png'],
        }),
      ),
    );
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
    const { assets } = await Effect.runPromise(
      withReadLease(
        worktreeId,
        service.execute({
          worktreeId,
          document: 'README.md',
          paths: ['big.png', 'ok.png'],
        }),
      ),
    );
    expect(assets.map((asset) => asset.kind)).toEqual(['unavailable', 'asset']);
  });

  it('marks an asset the reader could not read whole unavailable', async () => {
    const service = serviceWith({
      'big.png': { kind: 'too-large' },
      'folder.png': { kind: 'failed', failure: 'unreadable' },
    });
    const { assets } = await Effect.runPromise(
      withReadLease(
        worktreeId,
        service.execute({
          worktreeId,
          document: 'README.md',
          paths: ['big.png', 'folder.png'],
        }),
      ),
    );
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
    const { assets } = await Effect.runPromise(
      withReadLease(
        worktreeId,
        service.execute({
          worktreeId,
          document: 'README.md',
          paths: ['abcdef.png', 'abcdefg.png'],
        }),
      ),
    );
    expect(assets.map((asset) => asset.kind)).toEqual(['asset', 'unavailable']);
  });
});
