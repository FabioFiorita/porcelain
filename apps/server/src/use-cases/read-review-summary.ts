import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { CommentThreads } from './comment-threads.ts';
import type { ListReviewedFiles } from './list-reviewed-files.ts';
import type { ReadWorktreeEvidence } from './read-worktree-evidence.ts';
import type { ReadWorktreeStatus } from './read-worktree-status.ts';

export class ReadReviewSummary {
  private readonly status: ReadWorktreeStatus;
  private readonly evidence: ReadWorktreeEvidence;
  private readonly reviewed: ListReviewedFiles;
  private readonly comments: CommentThreads;
  constructor(
    evidence: ReadWorktreeEvidence,
    reviewed: ListReviewedFiles,
    comments: CommentThreads,
    status: ReadWorktreeStatus,
  ) {
    this.status = status;
    this.evidence = evidence;
    this.reviewed = reviewed;
    this.comments = comments;
  }
  async execute(worktreeId: string, session: GitSession, signal: AbortSignal) {
    const marks = new Map(
      this.reviewed
        .execute(worktreeId)
        .marks.map((mark) => [mark.path, mark.fingerprint]),
    );
    let pendingFiles: number;
    if (marks.size === 0) {
      const { status } = await this.status.execute(worktreeId, session, signal);
      pendingFiles = new Set(
        status.changes.map((change) =>
          'path' in change ? change.path : (change.newPath ?? change.oldPath),
        ),
      ).size;
    } else {
      const evidence = await this.evidence.execute(worktreeId, session, signal);
      pendingFiles = evidence.evidence.filter(
        (entry) =>
          entry.fingerprint === null ||
          marks.get(entry.path) !== entry.fingerprint,
      ).length;
    }
    return {
      worktreeId,
      pendingFiles,
      openThreads: this.comments
        .execute({ kind: 'list', worktreeId })
        .filter((thread) => !thread.resolved).length,
    };
  }
}
