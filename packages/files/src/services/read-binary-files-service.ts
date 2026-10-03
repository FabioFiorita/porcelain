import type {
  ReadBinaryFilesInput,
  ReadBinaryFilesOptions,
  ReadBinaryFilesResult,
} from '../models/read-binary-files.ts';
import type { FileReader } from '../ports/file-reader.ts';

export class ReadBinaryFilesService {
  private readonly fileReader: FileReader;
  private readonly options: ReadBinaryFilesOptions;

  constructor(fileReader: FileReader, options: ReadBinaryFilesOptions) {
    this.fileReader = fileReader;
    this.options = options;
  }

  async execute(
    input: ReadBinaryFilesInput,
    signal?: AbortSignal,
  ): Promise<ReadBinaryFilesResult> {
    const files = new Map<string, Uint8Array>();
    const tooLarge: string[] = [];
    const unreadable: string[] = [];
    let remaining = this.options.totalBytes;
    for (const path of input.paths) {
      if (remaining <= 0) {
        tooLarge.push(path);
        continue;
      }
      const maxBytes = Math.min(this.options.maxBytes, remaining);
      const read = await this.fileReader.read(
        { worktreeId: input.worktreeId, path, maxBytes },
        signal,
      );
      if (read.kind === 'file' && read.bytes.length <= maxBytes) {
        files.set(path, read.bytes);
        remaining -= read.bytes.length;
      } else if (read.kind !== 'failed') tooLarge.push(path);
      else unreadable.push(path);
    }
    return { files, tooLarge, unreadable };
  }
}
