import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type {
  FileRead,
  FileReadInput,
  TextRead,
} from '@porcelain/files/models';
import type { FileReader } from '@porcelain/files/ports';
import {
  inspectPath,
  readFailure,
  revisionOf,
  sameFile,
  unchanged,
  verifyPath,
} from './inspect-path.ts';
import {
  listedWorktree,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

const textDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export class FilesystemFileReader implements FileReader {
  private readonly worktrees: ListedWorktrees;

  constructor(worktrees: ListedWorktrees) {
    this.worktrees = worktrees;
  }

  async readText(
    input: FileReadInput,
    signal?: AbortSignal,
  ): Promise<TextRead> {
    const read = await this.read(input, signal);
    if (read.kind !== 'file') return read;
    const text = decodedText(read.bytes);
    return text === undefined
      ? { kind: 'failed', failure: 'unsupported-text' }
      : {
          kind: 'text',
          text,
          byteLength: read.bytes.length,
          revision: read.revision,
        };
  }

  async read(input: FileReadInput, signal?: AbortSignal): Promise<FileRead> {
    const { maxBytes } = input;
    const checkout = await listedWorktree(
      this.worktrees,
      input.worktreeId,
      signal,
    );
    const target = { root: checkout.path, path: input.path };
    try {
      const before = await inspectPath(target, signal);
      if (!before.info.isFile())
        return { kind: 'failed', failure: 'unreadable' };
      const handle = await open(
        before.path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const opened = await handle.stat({ bigint: true });
        if (!opened.isFile() || !sameFile(before.info, opened))
          return { kind: 'failed', failure: 'changed' };
        if (opened.size > BigInt(maxBytes)) return { kind: 'too-large' };
        const buffer = Buffer.alloc(maxBytes + 1);
        let length = 0;
        while (length < buffer.length) {
          signal?.throwIfAborted();
          const { bytesRead } = await handle.read(
            buffer,
            length,
            buffer.length - length,
            length,
          );
          if (bytesRead === 0) break;
          length += bytesRead;
        }
        if (length > maxBytes) return { kind: 'too-large' };
        const settled = await handle.stat({ bigint: true });
        if (!unchanged(opened, settled))
          return { kind: 'failed', failure: 'changed' };
        await verifyPath(before, target, signal);
        return {
          kind: 'file',
          bytes: buffer.subarray(0, length),
          revision: revisionOf(settled),
        };
      } finally {
        await handle.close();
      }
    } catch (error) {
      const failure = readFailure(error);
      if (failure === undefined) throw error;
      return { kind: 'failed', failure };
    }
  }
}

export function decodedText(bytes: Uint8Array): string | undefined {
  if (bytes.includes(0)) return undefined;
  try {
    return textDecoder.decode(bytes);
  } catch {
    return undefined;
  }
}
