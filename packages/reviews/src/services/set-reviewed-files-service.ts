import type {
  ReviewedFileChange,
  SetReviewedFilesInput,
  SetReviewedFilesResult,
} from '../models/reviewed-file.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import type { ReviewedMarkConfirmation } from '../ports/reviewed-mark-confirmation.ts';

export class SetReviewedFilesService {
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
    input: SetReviewedFilesInput,
    changes: readonly ReviewedFileChange[],
    confirm: ReviewedMarkConfirmation,
  ): Promise<SetReviewedFilesResult> {
    const latest = new Map(
      input.files.map((file) => [file.path, file.fingerprint]),
    );
    const marked: string[] = [];
    const conflicts: { path: string; reason: 'stale' | 'missing' }[] = [];
    const accepted: { path: string; fingerprint: string }[] = [];
    const seen = new Set<string>();
    for (const file of input.files) {
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      const fingerprint = latest.get(file.path) ?? file.fingerprint;
      const entry = changes.find((candidate) => candidate.path === file.path);
      if (!entry) {
        conflicts.push({ path: file.path, reason: 'missing' });
        continue;
      }
      if (
        entry.fingerprint === undefined ||
        entry.fingerprint !== fingerprint
      ) {
        conflicts.push({ path: file.path, reason: 'stale' });
        continue;
      }
      accepted.push({ path: file.path, fingerprint });
    }
    await confirm();
    const reviewedAt = this.now();
    for (const file of accepted) {
      this.reviewed.set(worktreeId, file.path, file.fingerprint, reviewedAt);
      marked.push(file.path);
    }
    return {
      worktreeId,
      marks: this.reviewed.list(worktreeId),
      marked,
      conflicts,
    };
  }
}
