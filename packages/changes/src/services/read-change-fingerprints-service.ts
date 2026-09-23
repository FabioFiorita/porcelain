import type { ChangeFingerprints } from '../models/change.ts';
import type { ReadChangeFingerprintsInput } from '../models/operation-inputs.ts';
import type { WorktreeSideReader } from '../ports/worktree-side-reader.ts';
import { assembleChanges } from '../rules/assemble-changes.ts';
import { logicalPath } from '../rules/logical-path.ts';
import { observationStamp } from '../rules/observation-stamp.ts';
import { observedSides } from '../rules/observed-sides.ts';
import { sidePaths } from '../rules/side-paths.ts';

export class ReadChangeFingerprintsService {
  private readonly worktreeSideReader: WorktreeSideReader;

  constructor(worktreeSideReader: WorktreeSideReader) {
    this.worktreeSideReader = worktreeSideReader;
  }

  async execute(
    input: ReadChangeFingerprintsInput,
    signal?: AbortSignal,
  ): Promise<ChangeFingerprints> {
    const wanted = input.paths === undefined ? undefined : new Set(input.paths);
    const comparisons =
      wanted === undefined
        ? input.comparisons
        : input.comparisons.filter((comparison) =>
            wanted.has(logicalPath(comparison)),
          );
    const paths = sidePaths(comparisons);
    const [entries, heads, stagingStamp] = await Promise.all([
      paths.files.length === 0
        ? new Map()
        : this.worktreeSideReader.readEntries(
            input.worktreeId,
            paths.files,
            signal,
          ),
      paths.submodules.length === 0
        ? new Map()
        : this.worktreeSideReader.readSubmoduleHeads(
            input.worktreeId,
            paths.submodules,
            signal,
          ),
      this.worktreeSideReader.readStagingStamp(input.worktreeId, signal),
    ]);
    signal?.throwIfAborted();
    const { sides, stamps } = observedSides(paths, entries, heads);
    return {
      changes: assembleChanges(comparisons, sides),
      stamp: observationStamp(stamps, stagingStamp),
    };
  }
}
