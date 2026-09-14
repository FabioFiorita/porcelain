import type { CommentThreads } from './comment-threads.ts';
import type { ListReviewedFiles } from './list-reviewed-files.ts';
import type { ReadWorktreeEvidence } from './read-worktree-evidence.ts';

export class ReadReviewSummary {
  private readonly evidence: ReadWorktreeEvidence;
  private readonly reviewed: ListReviewedFiles;
  private readonly comments: CommentThreads;
  constructor(
    evidence: ReadWorktreeEvidence,
    reviewed: ListReviewedFiles,
    comments: CommentThreads,
  ) {
    this.evidence = evidence;
    this.reviewed = reviewed;
    this.comments = comments;
  }
  async execute(worktreeId: string, signal: AbortSignal) {
    const evidence = await this.evidence.execute(worktreeId, signal);
    const marks = new Map(
      this.reviewed
        .execute(worktreeId)
        .marks.map((mark) => [mark.path, mark.fingerprint]),
    );
    return {
      worktreeId,
      pendingFiles: evidence.evidence.filter(
        (entry) =>
          entry.fingerprint === null ||
          marks.get(entry.path) !== entry.fingerprint,
      ).length,
      openThreads: this.comments
        .execute({ kind: 'list', worktreeId })
        .filter((thread) => !thread.resolved).length,
    };
  }
}
