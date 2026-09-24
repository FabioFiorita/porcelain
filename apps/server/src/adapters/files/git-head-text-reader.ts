import type { FileReadInput, TextRead } from '@porcelain/files/models';
import type { HeadTextReader } from '@porcelain/files/ports';
import type { OpenInspection } from '../changes/inspection-checkouts.ts';
import { decodedText } from './filesystem-file-reader.ts';

export class GitHeadTextReader implements HeadTextReader {
  private readonly open: OpenInspection;

  constructor(open: OpenInspection) {
    this.open = open;
  }

  async readText(
    input: FileReadInput,
    signal?: AbortSignal,
  ): Promise<TextRead> {
    const { git } = await this.open(input.worktreeId, signal);
    const blob = await git.readHeadBlob(
      { path: input.path, maxBytes: input.maxBytes },
      signal,
    );
    if (blob.kind === 'too-large') return blob;
    const text = decodedText(blob.bytes);
    return text === undefined
      ? { kind: 'failed', failure: 'unsupported-text' }
      : { kind: 'text', text, byteLength: blob.bytes.length, revision: 'HEAD' };
  }
}
