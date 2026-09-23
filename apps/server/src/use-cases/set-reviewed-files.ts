import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { SetReviewedFilesInput } from '../models/reviewed-file.ts';
import type { ReviewedFileStore } from '../repositories/interfaces/reviewed-file-store.ts';
import type { ListReviewedFiles } from './list-reviewed-files.ts';
import type { ReadWorktreeChanges } from './read-worktree-changes.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class SetReviewedFiles {
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
    input: SetReviewedFilesInput,
    session: GitSession,
    signal?: AbortSignal,
  ) {
    await this.worktrees.forWriting(worktreeId, signal);
    const current = await this.changes.execute(worktreeId, session, signal);
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
      const entry = current.changes.find(
        (candidate) => candidate.path === file.path,
      );
      if (!entry) {
        conflicts.push({ path: file.path, reason: 'missing' });
        continue;
      }
      if (entry.fingerprint == null || entry.fingerprint !== fingerprint) {
        conflicts.push({ path: file.path, reason: 'stale' });
        continue;
      }
      accepted.push({ path: file.path, fingerprint });
    }

    await session.confirmAll(signal);
    const reviewedAt = this.now();
    for (const file of accepted) {
      this.reviewed.set(worktreeId, file.path, file.fingerprint, reviewedAt);
      marked.push(file.path);
    }
    const list = await this.list.execute(worktreeId, signal);
    return { ...list, marked, conflicts };
  }
}
