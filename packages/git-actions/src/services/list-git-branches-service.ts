import type {
  ListGitBranchesInput,
  ListGitBranchesResult,
} from '../models/list-git-branches.ts';
import type { GitBranchReader } from '../ports/git-branch-reader.ts';

export class ListGitBranchesService {
  private readonly gitBranchReader: GitBranchReader;

  constructor(gitBranchReader: GitBranchReader) {
    this.gitBranchReader = gitBranchReader;
  }

  execute(
    input: ListGitBranchesInput,
    signal?: AbortSignal,
  ): Promise<ListGitBranchesResult> {
    return this.gitBranchReader.read(input, signal);
  }
}
