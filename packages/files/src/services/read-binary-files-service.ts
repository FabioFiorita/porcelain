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
    const { worktreeId } = input;
    const reads = await Promise.all(
      input.paths.map(async (path) => ({
        path,
        read: await this.fileReader.read(
          { worktreeId, path, maxBytes: this.options.maxBytes },
          signal,
        ),
      })),
    );
    return {
      files: new Map(
        reads.flatMap(({ path, read }) =>
          read.kind === 'file' ? [[path, read.bytes]] : [],
        ),
      ),
      tooLarge: reads.flatMap(({ path, read }) =>
        read.kind === 'too-large' ? [path] : [],
      ),
      unreadable: reads.flatMap(({ path, read }) =>
        read.kind === 'failed' ? [path] : [],
      ),
    };
  }
}
