import type {
  ReadChangeFingerprintsInput,
  ReadChangeFingerprintsOptions,
  ReadChangeFingerprintsResult,
} from '../models/read-change-fingerprints.ts';
import type { WorktreeSideReader } from '../ports/worktree-side-reader.ts';
import { assembleChanges } from '../rules/assemble-changes.ts';
import { logicalPath } from '../rules/logical-path.ts';
import { observationStamp } from '../rules/observation-stamp.ts';
import { observedSides } from '../rules/observed-sides.ts';
import { sidePaths } from '../rules/side-paths.ts';

export class ReadChangeFingerprintsService {
  private readonly worktreeSideReader: WorktreeSideReader;
  private readonly options: ReadChangeFingerprintsOptions;

  constructor(
    worktreeSideReader: WorktreeSideReader,
    options: ReadChangeFingerprintsOptions,
  ) {
    this.worktreeSideReader = worktreeSideReader;
    this.options = options;
  }

  async execute(
    input: ReadChangeFingerprintsInput,
    signal?: AbortSignal,
  ): Promise<ReadChangeFingerprintsResult> {
    const { worktreeId } = input;
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
            {
              worktreeId,
              paths: paths.files,
              maxDigestBytes: this.options.maxDigestBytes,
            },
            signal,
          ),
      paths.submodules.length === 0
        ? new Map()
        : this.worktreeSideReader.readSubmoduleHeads(
            { worktreeId, paths: paths.submodules },
            signal,
          ),
      this.worktreeSideReader.readStagingStamp({ worktreeId }, signal),
    ]);
    const { sides, stamps } = observedSides(paths, entries, heads);
    return {
      changes: assembleChanges(comparisons, sides),
      stamp: observationStamp(stamps, stagingStamp),
    };
  }
}
