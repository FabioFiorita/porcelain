import type { ChangeComparison, WorktreeSide } from '../models/change.ts';
import { observedSides, sidePaths } from '../models/worktree-sides.ts';
import type { WorktreeSideReader } from '../ports/worktree-side-reader.ts';

export class ObserveWorktreeSidesService {
  private readonly reader: WorktreeSideReader;

  constructor(reader: WorktreeSideReader) {
    this.reader = reader;
  }

  async execute(
    root: string,
    changes: readonly ChangeComparison[],
    signal?: AbortSignal,
  ): Promise<{
    sides: Map<string, WorktreeSide>;
    stamps: Map<string, string>;
  }> {
    const { submodules, ordinary } = sidePaths(changes);
    if (submodules.length === 0 && ordinary.length === 0)
      return { sides: new Map(), stamps: new Map() };
    const [entries, heads] = await Promise.all([
      this.reader.readFiles(root, ordinary),
      submodules.length > 0
        ? this.reader.readSubmoduleHeads(submodules, signal)
        : new Map<string, string>(),
    ]);
    signal?.throwIfAborted();
    return observedSides(submodules, ordinary, entries, heads);
  }
}
