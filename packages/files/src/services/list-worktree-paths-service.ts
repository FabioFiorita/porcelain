import { DirectoryTooLargeError } from '../errors/directory-too-large-error.ts';
import type {
  ListWorktreePathsInput,
  ListWorktreePathsResult,
} from '../models/list-worktree-paths.ts';
import type { WorktreePathsReader } from '../ports/worktree-paths-reader.ts';

export class ListWorktreePathsService {
  private readonly worktreePathsReader: WorktreePathsReader;

  constructor(worktreePathsReader: WorktreePathsReader) {
    this.worktreePathsReader = worktreePathsReader;
  }

  async execute(
    input: ListWorktreePathsInput,
    signal?: AbortSignal,
  ): Promise<ListWorktreePathsResult> {
    const read = await this.worktreePathsReader.read(input.worktreeId, signal);
    if (read.kind === 'too-large') throw new DirectoryTooLargeError();
    return { worktreeId: input.worktreeId, paths: read.paths };
  }
}
