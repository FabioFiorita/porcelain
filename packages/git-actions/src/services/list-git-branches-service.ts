import { GitBranchListingUnavailableError } from '../errors/git-branch-listing-unavailable-error.ts';
import type { GitBranches } from '../models/git-branches.ts';
import type { GitActionScope } from '../models/git-action.ts';
import type { GitBranchReaderPort } from '../ports/git-branch-reader-port.ts';

export class ListGitBranchesService {
  private readonly reader: GitBranchReaderPort;

  constructor(reader: GitBranchReaderPort) {
    this.reader = reader;
  }

  async execute(
    scope: GitActionScope,
    signal: AbortSignal,
  ): Promise<GitBranches> {
    const branches = await this.reader.read(scope, signal);
    if (!branches) throw new GitBranchListingUnavailableError();
    return branches;
  }
}
