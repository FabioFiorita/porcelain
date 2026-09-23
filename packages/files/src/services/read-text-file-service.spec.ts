import { describe, expect, it } from 'vitest';
import {
  FileTooLargeError,
  PathNotFoundError,
  PathNotReadableError,
  UnsupportedTextError,
} from '@porcelain/files/errors';
import { MemoryFiles } from '../../spec/fakes/memory-files.ts';
import { ReadTextFileService } from './read-text-file-service.ts';

const worktreeId = 'a'.repeat(32);

describe('ReadTextFileService', () => {
  it('answers the text with its byte length and content fingerprint', async () => {
    const service = new ReadTextFileService(
      new MemoryFiles({ 'docs/café.md': 'café\n' }),
    );
    await expect(
      service.execute({ worktreeId, path: 'docs/café.md' }),
    ).resolves.toEqual({
      worktreeId,
      path: 'docs/café.md',
      encoding: 'utf-8',
      byteLength: 6,
      text: 'café\n',
      contentFingerprint:
        '7b49b9e063bd91a4f9252b413261f5557b9c570aa61516989499f64a62dbcdd6',
    });
  });

  it('refuses a file one byte over the read limit', async () => {
    const files = new MemoryFiles({ 'over.txt': 'x'.repeat(1001) });
    const service = new ReadTextFileService(files, { maxBytes: 1000 });
    await expect(
      service.execute({ worktreeId, path: 'over.txt' }),
    ).rejects.toThrow(FileTooLargeError);
  });

  it('refuses text whose answer would exceed the limit once escaped', async () => {
    const service = new ReadTextFileService(
      new MemoryFiles({ 'controls.txt': '\u0001'.repeat(40) }),
      { maxBytes: 200 },
    );
    await expect(
      service.execute({ worktreeId, path: 'controls.txt' }),
    ).rejects.toThrow(FileTooLargeError);
  });

  it('refuses binary and non UTF-8 content as unsupported text', async () => {
    const service = new ReadTextFileService(
      new MemoryFiles({
        'nul.bin': new Uint8Array([0x61, 0x00, 0x62]),
        'latin1.txt': new Uint8Array([0xff, 0xfe, 0x41]),
      }),
    );
    await expect(
      service.execute({ worktreeId, path: 'nul.bin' }),
    ).rejects.toThrow(UnsupportedTextError);
    await expect(
      service.execute({ worktreeId, path: 'latin1.txt' }),
    ).rejects.toThrow(UnsupportedTextError);
  });

  it('reports a missing path as not found and a folder as unreadable', async () => {
    const service = new ReadTextFileService(
      new MemoryFiles({ 'docs/readme.md': 'hi' }),
    );
    await expect(
      service.execute({ worktreeId, path: 'missing.md' }),
    ).rejects.toThrow(PathNotFoundError);
    await expect(service.execute({ worktreeId, path: 'docs' })).rejects.toThrow(
      PathNotReadableError,
    );
  });
});
