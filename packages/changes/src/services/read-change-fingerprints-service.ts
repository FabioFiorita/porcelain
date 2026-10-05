import { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import { logicalPath } from '@porcelain/kernel/rules';
import type {
  ReadChangeFingerprintsInput,
  ReadChangeFingerprintsOptions,
  ReadChangeFingerprintsResult,
} from '../models/read-change-fingerprints.ts';
import type { WorktreeSideReader } from '../ports/worktree-side-reader.ts';
import { assembleChanges } from '../rules/assemble-changes.ts';
import { observationStamp } from '../rules/observation-stamp.ts';
import { observedSides } from '../rules/observed-sides.ts';
import { sidePaths } from '../rules/side-paths.ts';

export class ReadChangeFingerprintsService<E = never> {
  private readonly worktreeSideReader: WorktreeSideReader<E>;
  private readonly options: ReadChangeFingerprintsOptions;

  constructor(
    worktreeSideReader: WorktreeSideReader<E>,
    options: ReadChangeFingerprintsOptions,
  ) {
    this.worktreeSideReader = worktreeSideReader;
    this.options = options;
  }

  execute(
    input: ReadChangeFingerprintsInput,
  ): Effect.Effect<ReadChangeFingerprintsResult, E, WorktreeRead> {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId } = input;
      const wanted =
        input.paths === undefined ? undefined : new Set(input.paths);
      const comparisons =
        wanted === undefined
          ? input.comparisons
          : input.comparisons.filter((comparison) =>
              wanted.has(logicalPath(comparison)),
            );
      const paths = sidePaths(comparisons, this.options.maxPathLength);
      const [entries, heads, stagingStamp] = yield* Effect.all(
        [
          paths.files.length === 0
            ? Effect.succeed(new Map())
            : this.worktreeSideReader.readEntries({
                worktreeId,
                paths: paths.files,
                maxDigestBytes: this.options.maxDigestBytes,
              }),
          paths.submodules.length === 0
            ? Effect.succeed(new Map())
            : this.worktreeSideReader.readSubmoduleHeads({
                worktreeId,
                paths: paths.submodules,
              }),
          this.worktreeSideReader.readStagingStamp({ worktreeId }),
        ],
        { concurrency: 'unbounded' },
      );
      const { sides, stamps } = observedSides(paths, entries, heads);
      return {
        changes: assembleChanges(comparisons, sides),
        stamp: observationStamp(stamps, stagingStamp),
      };
    });
  }
}
