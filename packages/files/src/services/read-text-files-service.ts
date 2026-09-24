import type {
  ReadTextFilesInput,
  ReadTextFilesOptions,
  ReadTextFilesResult,
} from '../models/read-text-files.ts';
import type { FileReader } from '../ports/file-reader.ts';

export class ReadTextFilesService {
  private readonly fileReader: FileReader;
  private readonly options: ReadTextFilesOptions;

  constructor(fileReader: FileReader, options: ReadTextFilesOptions) {
    this.fileReader = fileReader;
    this.options = options;
  }

  async execute(
    input: ReadTextFilesInput,
    signal?: AbortSignal,
  ): Promise<ReadTextFilesResult> {
    const { worktreeId } = input;
    const reads = await Promise.all(
      input.paths.map(async (path) => ({
        path,
        read: await this.fileReader.readText(
          { worktreeId, path, maxBytes: this.options.maxBytes },
          signal,
        ),
      })),
    );
    return {
      texts: new Map(
        reads.flatMap(({ path, read }) =>
          read.kind === 'text' ? [[path, read.text]] : [],
        ),
      ),
      unreadable: reads.flatMap(({ path, read }) =>
        read.kind === 'text' ? [] : [path],
      ),
    };
  }
}
