import { InspectionLimitError } from '@porcelain/git/errors/inspection-limit-error';
import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export type TrackedPaths = (
  checkout: string,
  signal?: AbortSignal,
) => Promise<{ paths: string[]; complete: boolean }>;

export class ListWorktreePaths {
  private readonly worktrees: ResolveWorktree;
  private readonly tracked: TrackedPaths;

  constructor(worktrees: ResolveWorktree, tracked: TrackedPaths) {
    this.worktrees = worktrees;
    this.tracked = tracked;
  }

  async execute(worktreeId: string, signal?: AbortSignal) {
    const worktree = await resolveReadableWorktree(
      this.worktrees,
      worktreeId,
      signal,
    );
    const listed = await this.tracked(worktree.path, signal).catch(
      (error: unknown) => {
        if (error instanceof InspectionLimitError)
          return { paths: [], complete: false };
        throw error;
      },
    );
    if (!listed.complete) throw new FileInspectionError('DIRECTORY_TOO_LARGE');
    await resolveReadableWorktree(this.worktrees, worktreeId, signal);
    signal?.throwIfAborted();
    return { worktreeId, paths: listed.paths };
  }
}
