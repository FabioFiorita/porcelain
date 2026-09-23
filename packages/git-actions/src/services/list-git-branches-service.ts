import { GitBranchListingUnavailableError } from '../errors/git-branch-listing-unavailable-error.ts';
import type { GitBranches } from '../models/git-branches.ts';
import type { ListGitBranchesInput } from '../models/list-git-branches.ts';
import type { GitBranchReader } from '../ports/git-branch-reader.ts';

export class ListGitBranchesService {
  private readonly gitBranchReader: GitBranchReader;

  constructor(gitBranchReader: GitBranchReader) {
    this.gitBranchReader = gitBranchReader;
  }

  async execute(
    input: ListGitBranchesInput,
    signal?: AbortSignal,
  ): Promise<GitBranches> {
    const branches = await this.gitBranchReader.read(input, signal);
    if (!branches) throw new GitBranchListingUnavailableError();
    return branches;
  }
}
