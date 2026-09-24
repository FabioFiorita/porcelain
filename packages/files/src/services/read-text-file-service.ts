import { sha256Hex, utf8ByteLength } from '@porcelain/kernel/rules';
import { fileFailureError } from '../errors/file-failure-error.ts';
import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import type {
  ReadTextFileInput,
  ReadTextFileOptions,
  ReadTextFileResult,
} from '../models/read-text-file.ts';
import type { FileReader } from '../ports/file-reader.ts';
import type { HeadTextReader } from '../ports/head-text-reader.ts';

export class ReadTextFileService {
  private readonly fileReader: FileReader;
  private readonly headTextReader: HeadTextReader;
  private readonly options: ReadTextFileOptions;

  constructor(
    fileReader: FileReader,
    headTextReader: HeadTextReader,
    options: ReadTextFileOptions,
  ) {
    this.fileReader = fileReader;
    this.headTextReader = headTextReader;
    this.options = options;
  }

  async execute(
    input: ReadTextFileInput,
    signal?: AbortSignal,
  ): Promise<ReadTextFileResult> {
    const reader = input.at === 'head' ? this.headTextReader : this.fileReader;
    const read = await reader.readText(
      {
        worktreeId: input.worktreeId,
        path: input.path,
        maxBytes: this.options.maxBytes,
      },
      signal,
    );
    if (read.kind === 'failed') throw fileFailureError(read.failure);
    if (read.kind === 'too-large') throw new FileTooLargeError();
    const answer: Omit<ReadTextFileResult, 'contentFingerprint'> = {
      worktreeId: input.worktreeId,
      path: input.path,
      encoding: 'utf-8',
      byteLength: read.byteLength,
      text: read.text,
    };
    if (utf8ByteLength(JSON.stringify(answer)) > this.options.maxBytes)
      throw new FileTooLargeError();
    return { ...answer, contentFingerprint: sha256Hex(read.text) };
  }
}
