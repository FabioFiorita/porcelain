import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { SetReviewedFileInput } from '../models/reviewed-file.ts';
import type { ReviewedFileStore } from '../repositories/interfaces/reviewed-file-store.ts';
import { ReviewedMarkConflictError } from './errors/reviewed-mark-conflict-error.ts';
import type { ListReviewedFiles } from './list-reviewed-files.ts';
import type { ReadWorktreeEvidence } from './read-worktree-evidence.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class SetReviewedFile {
  private readonly reviewed: ReviewedFileStore;
  private readonly worktrees: ResolveWorktree;
  private readonly evidence: ReadWorktreeEvidence;
  private readonly list: ListReviewedFiles;
  private readonly now: () => string;

  constructor(
    reviewed: ReviewedFileStore,
    worktrees: ResolveWorktree,
    evidence: ReadWorktreeEvidence,
    list: ListReviewedFiles,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.reviewed = reviewed;
    this.worktrees = worktrees;
    this.evidence = evidence;
    this.list = list;
    this.now = now;
  }

  async execute(
    worktreeId: string,
    input: SetReviewedFileInput,
    session: GitSession,
    signal?: AbortSignal,
  ) {
    // A write: the worktree is recorded as present before the mark is stored.
    await this.worktrees.forWriting(worktreeId, signal);
    const current = await this.evidence.execute(
      worktreeId,
      session,
      signal,
      new Set([input.path]),
    );
    const entry = current.evidence.find(
      (candidate) => candidate.path === input.path,
    );
    if (
      !entry ||
      entry.fingerprint === null ||
      entry.fingerprint !== input.fingerprint
    )
      throw new ReviewedMarkConflictError();

    // The mark outlives the request, so confirm the checkout it was read from.
    await session.confirmAll(signal);
    this.reviewed.set(worktreeId, input.path, input.fingerprint, this.now());
    return this.list.execute(worktreeId, signal);
  }
}
