import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import type {
  ReadTextFileInput,
  ReadTextFileResult,
} from '../models/read-text-file.ts';
import type { FileReader } from '../ports/file-reader.ts';
import { contentFingerprint } from '../rules/content-fingerprint.ts';
import { fileFailureError } from '../rules/file-failure-error.ts';
import { serializedByteLength } from '../rules/serialized-byte-length.ts';

export type ReadTextFileOptions = { maxBytes: number };

const LIMITS: ReadTextFileOptions = { maxBytes: 1024 * 1024 };

export class ReadTextFileService {
  private readonly fileReader: FileReader;
  private readonly options: ReadTextFileOptions;

  constructor(fileReader: FileReader, options: ReadTextFileOptions = LIMITS) {
    this.fileReader = fileReader;
    this.options = options;
  }

  async execute(
    input: ReadTextFileInput,
    signal?: AbortSignal,
  ): Promise<ReadTextFileResult> {
    const read = await this.fileReader.readText(
      input,
      this.options.maxBytes,
      signal,
    );
    if (read.kind === 'too-large') throw new FileTooLargeError();
    if (read.kind === 'failed') throw fileFailureError(read.failure);
    const content = {
      worktreeId: input.worktreeId,
      path: input.path,
      encoding: 'utf-8' as const,
      byteLength: read.byteLength,
      text: read.text,
    };
    if (serializedByteLength(content) > this.options.maxBytes)
      throw new FileTooLargeError();
    return { ...content, contentFingerprint: contentFingerprint(content.text) };
  }
}
