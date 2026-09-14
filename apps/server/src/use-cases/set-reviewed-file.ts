import type { SetReviewedFileInput } from '../models/reviewed-file.ts';
import type { ReviewedFileStore } from '../repositories/interfaces/reviewed-file-store.ts';
import { ReviewedMarkConflictError } from './errors/reviewed-mark-conflict-error.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import type { ListReviewedFiles } from './list-reviewed-files.ts';
import type { ReadWorktreeEvidence } from './read-worktree-evidence.ts';

export class SetReviewedFile {
  private readonly reviewed: ReviewedFileStore;
  private readonly evidence: ReadWorktreeEvidence;
  private readonly list: ListReviewedFiles;
  private readonly now: () => string;

  constructor(
    reviewed: ReviewedFileStore,
    evidence: ReadWorktreeEvidence,
    list: ListReviewedFiles,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.reviewed = reviewed;
    this.evidence = evidence;
    this.list = list;
    this.now = now;
  }

  async execute(
    worktreeId: string,
    input: SetReviewedFileInput,
    signal?: AbortSignal,
  ) {
    this.assertKnownWorktree(worktreeId);

    const current = await this.evidence.execute(worktreeId, signal);
    const entry = current.evidence.find(
      (candidate) => candidate.path === input.path,
    );
    if (
      !entry ||
      entry.fingerprint === null ||
      entry.fingerprint !== input.fingerprint
    )
      throw new ReviewedMarkConflictError();

    this.reviewed.set(worktreeId, input.path, input.fingerprint, this.now());
    return this.list.execute(worktreeId);
  }

  private assertKnownWorktree(worktreeId: string) {
    if (!this.reviewed.hasWorktree(worktreeId))
      throw new WorktreeNotFoundError();
  }
}
