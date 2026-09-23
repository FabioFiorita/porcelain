import { ReviewedMarkConflictError } from '../errors/reviewed-mark-conflict-error.ts';
import type {
  ReviewedFileChange,
  ReviewedFilesResult,
  SetReviewedFileInput,
} from '../models/reviewed-file.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import type { ReviewedMarkConfirmation } from '../ports/reviewed-mark-confirmation.ts';

export class SetReviewedFileService {
  private readonly reviewed: ReviewedFileStore;
  private readonly now: () => string;

  constructor(
    reviewed: ReviewedFileStore,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.reviewed = reviewed;
    this.now = now;
  }

  async execute(
    worktreeId: string,
    input: SetReviewedFileInput,
    changes: readonly ReviewedFileChange[],
    confirm: ReviewedMarkConfirmation,
  ): Promise<ReviewedFilesResult> {
    const entry = changes.find((candidate) => candidate.path === input.path);
    if (
      !entry ||
      entry.fingerprint === undefined ||
      entry.fingerprint !== input.fingerprint
    )
      throw new ReviewedMarkConflictError();
    await confirm();
    this.reviewed.set(worktreeId, input.path, input.fingerprint, this.now());
    return { worktreeId, marks: this.reviewed.list(worktreeId) };
  }
}
