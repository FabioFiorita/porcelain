import type { WorktreeRead } from '@porcelain/effects/worktree';
import { Effect } from 'effect';
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

  execute(
    input: ReadTextFilesInput,
  ): Effect.Effect<ReadTextFilesResult, never, WorktreeRead> {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId } = input;
      const reads = yield* Effect.forEach(
        input.paths,
        (path) => this.readText(worktreeId, path),
        { concurrency: 'unbounded' },
      );
      return {
        texts: new Map(
          reads.flatMap(({ path, read }) =>
            read.kind === 'text' ? [[path, read.text] as const] : [],
          ),
        ),
        unreadable: reads.flatMap(({ path, read }) =>
          read.kind === 'text' ? [] : [path],
        ),
      };
    });
  }

  private readText(worktreeId: string, path: string) {
    return Effect.gen({ self: this }, function* () {
      const read = yield* this.fileReader.readText({
        worktreeId,
        path,
        maxBytes: this.options.maxBytes,
      });
      return { path, read };
    });
  }
}
