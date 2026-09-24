import type {
  CommitFilesLookup,
  CommitPage,
  CommitPatches,
  CommitPatchesRequest,
  CommitSummary,
  ListCommitsInput,
  ReadCommitFilesInput,
} from '@porcelain/changes/models';
import type { CommitHistoryReader } from '@porcelain/changes/ports';
import {
  HistorySnapshotUnavailableError,
  type CommitReaderFactory,
  type CommitSummary as GitCommitSummary,
} from '@porcelain/git/history';
import {
  listedWorktree,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

type CommitReader = ReturnType<CommitReaderFactory>;

export class GitCommitHistoryReader implements CommitHistoryReader {
  private readonly worktrees: ListedWorktrees;
  private readonly git: CommitReaderFactory;

  constructor(worktrees: ListedWorktrees, git: CommitReaderFactory) {
    this.worktrees = worktrees;
    this.git = git;
  }

  async listCommits(
    input: ListCommitsInput,
    signal?: AbortSignal,
  ): Promise<CommitPage> {
    const reader = await this.reader(input.worktreeId, signal);
    const page = await reader.listCommits(
      {
        ...(input.limit === undefined ? {} : { limit: input.limit }),
        ...(input.after === undefined ? {} : { after: input.after }),
        ...(input.tip === undefined ? {} : { tip: input.tip }),
      },
      signal,
    );
    return {
      snapshot: page.snapshot
        ? {
            tipOid: page.snapshot.tipOid ?? undefined,
            head: page.snapshot.head,
          }
        : undefined,
      commits: page.commits.map(summary),
      nextAfter: page.nextAfter ?? undefined,
      tip: page.tip ?? undefined,
      boundary: page.boundary ?? undefined,
      restarted: page.restarted,
    };
  }

  async readCommitFiles(
    input: ReadCommitFilesInput,
    signal?: AbortSignal,
  ): Promise<CommitFilesLookup> {
    const reader = await this.reader(input.worktreeId, signal);
    try {
      const read = await reader.readCommitFiles(
        {
          oid: input.oid,
          ...(input.parent === undefined ? {} : { parent: input.parent }),
        },
        signal,
      );
      return {
        kind: 'found',
        files: {
          commit: summary(read.commit),
          comparison: read.comparison,
          files: read.files.map((file) => ({
            oldPath: file.oldPath ?? undefined,
            newPath: file.newPath ?? undefined,
            status: file.status,
            oldMode: file.oldMode,
            newMode: file.newMode,
          })),
        },
      };
    } catch (error) {
      if (error instanceof HistorySnapshotUnavailableError)
        return { kind: 'missing' };
      throw error;
    }
  }

  async readCommitPatches(
    input: CommitPatchesRequest,
    signal?: AbortSignal,
  ): Promise<CommitPatches> {
    const reader = await this.reader(input.worktreeId, signal);
    const sections = await reader.readCommitDiffs(
      {
        oid: input.oid,
        paths: input.paths,
        ...(input.parent === undefined ? {} : { parent: input.parent }),
      },
      signal,
    );
    if (sections === null) return { kind: 'over-limit' };
    return {
      kind: 'within-limit',
      patches: [...sections].map(([key, content]) => ({
        paths: key.split('\0'),
        content,
      })),
    };
  }

  private async reader(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<CommitReader> {
    signal?.throwIfAborted();
    const worktree = await listedWorktree(this.worktrees, worktreeId, signal);
    return this.git({
      path: worktree.path,
      commonDirectory: worktree.commonDirectory,
      administrativeDirectory: worktree.administrativeDirectory,
      repositoryIdentity: worktree.repositoryIdentity,
      metadataIdentity: worktree.metadataIdentity,
    });
  }
}

function summary(commit: GitCommitSummary): CommitSummary {
  return {
    oid: commit.oid,
    parentOids: commit.parentOids,
    author: {
      name: commit.author.name,
      timestamp: new Date(commit.author.timestamp).toISOString(),
    },
    subject: commit.subject,
    subjectTruncated: commit.subjectTruncated,
    body: commit.body ?? undefined,
    bodyTruncated: commit.bodyTruncated,
    refs: commit.refs,
  };
}
