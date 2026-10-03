import { describe, expect, it } from 'vitest';
import {
  ContentChangedError,
  FileTooLargeError,
  PathNotFoundError,
  PathNotReadableError,
  UnsupportedTextError,
} from '@porcelain/files/errors';
import type { TextRead } from '@porcelain/files/models';
import { InMemoryFileReader } from '../../spec/fakes/in-memory-file-reader.ts';
import { ReadTextFileService } from './read-text-file-service.ts';

const worktreeId = 'a'.repeat(32);

function text(content: string, byteLength: number): TextRead {
  return { kind: 'text', text: content, byteLength, revision: 'r1' };
}

function serviceWith(
  texts: Record<string, TextRead>,
  maxBytes = 1024 * 1024,
  head: Record<string, TextRead> = {},
) {
  return new ReadTextFileService(
    new InMemoryFileReader({ texts }),
    new InMemoryFileReader({ texts: head }),
    { maxBytes },
  );
}

describe('ReadTextFileService', () => {
  it('answers the text with its byte length and content fingerprint', async () => {
    const service = serviceWith({ 'docs/café.md': text('café\n', 6) });
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

  it('reads the committed text from HEAD rather than the worktree', async () => {
    const service = serviceWith({ 'README.md': text('edited\n', 7) }, 1024, {
      'README.md': text('committed\n', 10),
    });
    await expect(
      service.execute({ worktreeId, path: 'README.md', at: 'head' }),
    ).resolves.toMatchObject({ text: 'committed\n', byteLength: 10 });
  });

  it.each([
    {
      name: 'too large',
      read: { kind: 'too-large' as const },
      error: FileTooLargeError,
    },
    {
      name: 'not text',
      read: { kind: 'failed' as const, failure: 'unsupported-text' as const },
      error: UnsupportedTextError,
    },
  ])(
    'refuses committed text that is $name, as it refuses the worktree side',
    async ({ read, error }) => {
      const service = serviceWith({ 'README.md': text('edited\n', 7) }, 1024, {
        'README.md': read,
      });
      await expect(
        service.execute({ worktreeId, path: 'README.md', at: 'head' }),
      ).rejects.toThrow(error);
    },
  );

  it('refuses a file the reader stopped reading at the limit', async () => {
    const service = serviceWith({ 'big.txt': { kind: 'too-large' } });
    await expect(
      service.execute({ worktreeId, path: 'big.txt' }),
    ).rejects.toThrow(FileTooLargeError);
  });

  it('refuses text one byte over the read limit even when it arrives whole', async () => {
    const service = serviceWith(
      { 'over.txt': text('x'.repeat(1001), 1001) },
      1000,
    );
    await expect(
      service.execute({ worktreeId, path: 'over.txt' }),
    ).rejects.toThrow(FileTooLargeError);
  });

  it('refuses text whose answer would exceed the limit once escaped', async () => {
    const service = serviceWith(
      { 'controls.txt': text('\u0001'.repeat(40), 40) },
      200,
    );
    await expect(
      service.execute({ worktreeId, path: 'controls.txt' }),
    ).rejects.toThrow(FileTooLargeError);
  });

  it('reports a missing path as not found', async () => {
    const service = serviceWith({});
    await expect(
      service.execute({ worktreeId, path: 'missing.md' }),
    ).rejects.toThrow(PathNotFoundError);
  });

  it('reports a folder or special file as unreadable', async () => {
    const service = serviceWith({
      docs: { kind: 'failed', failure: 'unreadable' },
    });
    await expect(service.execute({ worktreeId, path: 'docs' })).rejects.toThrow(
      PathNotReadableError,
    );
  });

  it('reports a file that changed while it was read as changed', async () => {
    const service = serviceWith({
      'notes.md': { kind: 'failed', failure: 'changed' },
    });
    await expect(
      service.execute({ worktreeId, path: 'notes.md' }),
    ).rejects.toThrow(ContentChangedError);
  });

  it('refuses binary or non UTF-8 content as unsupported text', async () => {
    const service = serviceWith({
      'image.bin': { kind: 'failed', failure: 'unsupported-text' },
    });
    await expect(
      service.execute({ worktreeId, path: 'image.bin' }),
    ).rejects.toThrow(UnsupportedTextError);
  });
});
