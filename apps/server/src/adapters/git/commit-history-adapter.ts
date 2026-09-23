import { RepositoryIdentityMismatchError } from '@porcelain/git/discovery';
import {
  HistoryWorktreeUnavailableError,
  type CommitDiffsRequest,
  type CommitFiles,
  type CommitFilesRequest,
  type CommitPage,
  type CommitPageRequest,
  type CommitReaderFactory,
} from '@porcelain/git/history';
import type { GitDiffResult } from '@porcelain/git/inspection';

type HistoryWorktree = {
  id: string;
  projectId: string;
  path: string;
  commonDirectory: string;
  administrativeDirectory: string;
  repositoryIdentity: string;
  metadataIdentity: string;
};

type HistoryWorktreeAccess = {
  reachable(worktreeId: string, signal?: AbortSignal): Promise<HistoryWorktree>;
};

export class CommitHistoryAdapter {
  private readonly worktrees: HistoryWorktreeAccess;
  private readonly environmentId: () => string;
  private readonly git: CommitReaderFactory;

  constructor(
    worktrees: HistoryWorktreeAccess,
    environmentId: () => string,
    git: CommitReaderFactory,
  ) {
    this.worktrees = worktrees;
    this.environmentId = environmentId;
    this.git = git;
  }

  async listCommits(
    worktreeId: string,
    request: CommitPageRequest,
    signal?: AbortSignal,
  ): Promise<CommitPage> {
    signal?.throwIfAborted();
    return (await this.reader(worktreeId, signal)).listCommits(request, signal);
  }

  async readCommitFiles(
    worktreeId: string,
    request: CommitFilesRequest,
    signal?: AbortSignal,
  ): Promise<CommitFiles> {
    signal?.throwIfAborted();
    return (await this.reader(worktreeId, signal)).readCommitFiles(
      request,
      signal,
    );
  }

  async readCommitDiffs(
    worktreeId: string,
    request: CommitDiffsRequest,
    signal?: AbortSignal,
  ): Promise<Map<string, GitDiffResult> | null> {
    signal?.throwIfAborted();
    return (await this.reader(worktreeId, signal)).readCommitDiffs(
      request,
      signal,
    );
  }

  private async reader(worktreeId: string, signal?: AbortSignal) {
    let worktree: HistoryWorktree;
    try {
      worktree = await this.worktrees.reachable(worktreeId, signal);
    } catch (error) {
      if (error instanceof RepositoryIdentityMismatchError)
        throw new HistoryWorktreeUnavailableError();
      throw error;
    }
    return this.git({
      path: worktree.path,
      commonDirectory: worktree.commonDirectory,
      administrativeDirectory: worktree.administrativeDirectory,
      repositoryIdentity: worktree.repositoryIdentity,
      metadataIdentity: worktree.metadataIdentity,
      scope: `${this.environmentId()}:${worktree.projectId}:${worktree.id}`,
    });
  }
}
