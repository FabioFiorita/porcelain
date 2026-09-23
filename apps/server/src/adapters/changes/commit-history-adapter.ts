import type {
  CommitFiles,
  CommitFilesRequest,
  CommitPage,
  CommitPageRequest,
  CommitPatches,
  CommitPatchesRequest,
  CommitSummary,
} from '@porcelain/changes/models';
import type { CommitHistoryReader } from '@porcelain/changes/ports';
import {
  HistorySnapshotUnavailableError,
  HistoryWorktreeUnavailableError,
  type CommitReaderFactory,
  type CommitSummary as GitCommitSummary,
} from '@porcelain/git/history';
import type { WritableWorktrees } from '../projects/checkout-session.ts';

type EnvironmentReader = { read(): { environmentId: string } };

type CommitReader = ReturnType<CommitReaderFactory>;

export class CommitHistoryAdapter implements CommitHistoryReader {
  private readonly worktrees: WritableWorktrees;
  private readonly environment: EnvironmentReader;
  private readonly git: CommitReaderFactory;

  constructor(
    worktrees: WritableWorktrees,
    environment: EnvironmentReader,
    git: CommitReaderFactory,
  ) {
    this.worktrees = worktrees;
    this.environment = environment;
    this.git = git;
  }

  async listCommits(
    worktreeId: string,
    request: CommitPageRequest,
    signal?: AbortSignal,
  ): Promise<CommitPage> {
    const reader = await this.reader(worktreeId, signal);
    const page = await reader.listCommits(
      {
        ...(request.limit === undefined ? {} : { limit: request.limit }),
        ...(request.after === undefined ? {} : { after: request.after }),
        ...(request.tip === undefined ? {} : { tip: request.tip }),
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
    worktreeId: string,
    request: CommitFilesRequest,
    signal?: AbortSignal,
  ): Promise<CommitFiles | undefined> {
    const reader = await this.reader(worktreeId, signal);
    try {
      const read = await reader.readCommitFiles(
        {
          oid: request.oid,
          ...(request.parent === undefined ? {} : { parent: request.parent }),
        },
        signal,
      );
      return {
        commit: summary(read.commit),
        comparison: read.comparison,
        files: read.files.map((file) => ({
          oldPath: file.oldPath ?? undefined,
          newPath: file.newPath ?? undefined,
          status: file.status,
          oldMode: file.oldMode,
          newMode: file.newMode,
        })),
      };
    } catch (error) {
      if (error instanceof HistorySnapshotUnavailableError) return undefined;
      throw error;
    }
  }

  async readCommitPatches(
    worktreeId: string,
    request: CommitPatchesRequest,
    signal?: AbortSignal,
  ): Promise<CommitPatches> {
    const reader = await this.reader(worktreeId, signal);
    const sections = await reader.readCommitDiffs(
      {
        oid: request.oid,
        paths: request.paths,
        ...(request.parent === undefined ? {} : { parent: request.parent }),
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
    const check = await this.worktrees.forWriting(worktreeId, signal);
    if (check.outcome !== 'found') throw new HistoryWorktreeUnavailableError();
    const { worktree } = check;
    return this.git({
      path: worktree.path,
      commonDirectory: worktree.commonDirectory,
      administrativeDirectory: worktree.administrativeDirectory,
      repositoryIdentity: worktree.repositoryIdentity,
      metadataIdentity: worktree.metadataIdentity,
      scope: `${this.environment.read().environmentId}:${worktree.projectId}:${worktree.id}`,
    });
  }
}

function summary(commit: GitCommitSummary): CommitSummary {
  return {
    oid: commit.oid,
    parentOids: commit.parentOids,
    author: commit.author,
    subject: commit.subject,
    subjectTruncated: commit.subjectTruncated,
    body: commit.body ?? undefined,
    bodyTruncated: commit.bodyTruncated,
    refs: commit.refs,
  };
}
