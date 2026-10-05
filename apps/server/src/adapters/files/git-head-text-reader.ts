import { nativeRead, type WorktreeRead } from '@porcelain/effects';
import type { FileReadInput, TextRead } from '@porcelain/files/models';
import type { HeadTextReader } from '@porcelain/files/ports';
import type { Effect } from 'effect';
import type { OpenInspection } from '../changes/inspection-checkouts.ts';
import { decodedText } from './filesystem-file-reader.ts';

export class GitHeadTextReader implements HeadTextReader {
  private readonly open: OpenInspection;

  constructor(open: OpenInspection) {
    this.open = open;
  }
  readText(input: FileReadInput): Effect.Effect<TextRead, never, WorktreeRead> {
    return nativeRead(input.worktreeId, (signal) =>
      this.readHeadText(input, signal),
    );
  }

  private async readHeadText(
    input: FileReadInput,
    signal?: AbortSignal,
  ): Promise<TextRead> {
    const { git } = await this.open(input.worktreeId, signal);
    const blob = await git.readHeadBlob(
      { path: input.path, maxBytes: input.maxBytes },
      signal,
    );
    if (blob.kind === 'too-large') return blob;
    if (blob.kind === 'missing') return { kind: 'failed', failure: 'missing' };
    const text = decodedText(blob.bytes);
    return text === undefined
      ? { kind: 'failed', failure: 'unsupported-text' }
      : { kind: 'text', text, byteLength: blob.bytes.length, revision: 'HEAD' };
  }
}
