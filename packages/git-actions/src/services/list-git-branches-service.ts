import type {
  ListGitBranchesInput,
  ListGitBranchesResult,
} from '../models/list-git-branches.ts';
import type { BranchReader } from '../ports/branch-reader.ts';

export class ListGitBranchesService {
  private readonly gitBranchReader: BranchReader;

  constructor(gitBranchReader: BranchReader) {
    this.gitBranchReader = gitBranchReader;
  }

  execute(
    input: ListGitBranchesInput,
    signal?: AbortSignal,
  ): Promise<ListGitBranchesResult> {
    return this.gitBranchReader.read(input, signal);
  }
}
