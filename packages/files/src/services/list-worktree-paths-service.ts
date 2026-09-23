import { FileInspectionError } from '../errors/file-inspection-error.ts';
import type { ReachableWorktreeReader } from '../ports/reachable-worktree.ts';
import type { TrackedPathsReader } from '../ports/tracked-paths-reader.ts';

export class ListWorktreePathsService {
  private readonly worktrees: ReachableWorktreeReader;
  private readonly tracked: TrackedPathsReader;

  constructor(worktrees: ReachableWorktreeReader, tracked: TrackedPathsReader) {
    this.worktrees = worktrees;
    this.tracked = tracked;
  }

  async execute(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<{ worktreeId: string; paths: string[] }> {
    const worktree = await this.worktrees.reachable(worktreeId, signal);
    const listed = await this.tracked.list(worktree.path, signal);
    if (!listed.complete) throw new FileInspectionError('DIRECTORY_TOO_LARGE');
    await this.worktrees.reachable(worktreeId, signal);
    signal?.throwIfAborted();
    return { worktreeId, paths: listed.paths };
  }
}
