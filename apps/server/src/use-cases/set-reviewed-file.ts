import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { SetReviewedFileInput } from '../models/reviewed-file.ts';
import type { ReviewedFileStore } from '../repositories/interfaces/reviewed-file-store.ts';
import { ReviewedMarkConflictError } from './errors/reviewed-mark-conflict-error.ts';
import type { ListReviewedFiles } from './list-reviewed-files.ts';
import type { ReadWorktreeChanges } from './read-worktree-changes.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class SetReviewedFile {
  private readonly reviewed: ReviewedFileStore;
  private readonly worktrees: ResolveWorktree;
  private readonly changes: ReadWorktreeChanges;
  private readonly list: ListReviewedFiles;
  private readonly now: () => string;

  constructor(
    reviewed: ReviewedFileStore,
    worktrees: ResolveWorktree,
    changes: ReadWorktreeChanges,
    list: ListReviewedFiles,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.reviewed = reviewed;
    this.worktrees = worktrees;
    this.changes = changes;
    this.list = list;
    this.now = now;
  }

  async execute(
    worktreeId: string,
    input: SetReviewedFileInput,
    session: GitSession,
    signal?: AbortSignal,
  ) {
    await this.worktrees.forWriting(worktreeId, signal);
    const current = await this.changes.execute(worktreeId, session, signal);
    const entry = current.changes.find(
      (candidate) => candidate.path === input.path,
    );
    if (
      !entry ||
      entry.fingerprint === null ||
      entry.fingerprint !== input.fingerprint
    )
      throw new ReviewedMarkConflictError();

    await session.confirmAll(signal);
    this.reviewed.set(worktreeId, input.path, input.fingerprint, this.now());
    return this.list.execute(worktreeId, signal);
  }
}
