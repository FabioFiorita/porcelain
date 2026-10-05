import { ReadChangeFingerprintsOptions } from '../ports/read-change-fingerprints-options.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { logicalPath } from '@porcelain/kernel/rules';
import {
  type ReadChangeFingerprintsInput,
  type ReadChangeFingerprintsResult,
} from '../models/read-change-fingerprints.ts';
import { WorktreeSideReader } from '../ports/worktree-side-reader.ts';
import { assembleChanges } from '../rules/assemble-changes.ts';
import { observationStamp } from '../rules/observation-stamp.ts';
import { observedSides } from '../rules/observed-sides.ts';
import { sidePaths } from '../rules/side-paths.ts';

export class ReadChangeFingerprintsService extends Context.Service<
  ReadChangeFingerprintsService,
  {
    readonly execute: (
      input: ReadChangeFingerprintsInput,
    ) => Effect.Effect<
      ReadChangeFingerprintsResult,
      GitIoFailure,
      WorktreeRead
    >;
  }
>()('@porcelain/changes/ReadChangeFingerprintsService') {
  static readonly layer = Layer.effect(
    ReadChangeFingerprintsService,
    Effect.gen(function* () {
      const worktreeSideReaderCapability = yield* WorktreeSideReader;
      const optionsCapability = yield* ReadChangeFingerprintsOptions;

      return {
        execute: Effect.fn('ReadChangeFingerprintsService.execute')(function* (
          input: ReadChangeFingerprintsInput,
        ): Effect.fn.Return<
          ReadChangeFingerprintsResult,
          GitIoFailure,
          WorktreeRead
        > {
          const { worktreeId } = input;
          const wanted =
            input.paths === undefined ? undefined : new Set(input.paths);
          const comparisons =
            wanted === undefined
              ? input.comparisons
              : input.comparisons.filter((comparison) =>
                  wanted.has(logicalPath(comparison)),
                );
          const paths = sidePaths(comparisons, optionsCapability.maxPathLength);
          const [entries, heads, stagingStamp] = yield* Effect.all(
            [
              paths.files.length === 0
                ? Effect.succeed(new Map())
                : worktreeSideReaderCapability.readEntries({
                    worktreeId,
                    paths: paths.files,
                    maxDigestBytes: optionsCapability.maxDigestBytes,
                  }),
              paths.submodules.length === 0
                ? Effect.succeed(new Map())
                : worktreeSideReaderCapability.readSubmoduleHeads({
                    worktreeId,
                    paths: paths.submodules,
                  }),
              worktreeSideReaderCapability.readStagingStamp({ worktreeId }),
            ],
            { concurrency: 'unbounded' },
          );
          const { sides, stamps } = observedSides(paths, entries, heads);
          return {
            changes: assembleChanges(comparisons, sides),
            stamp: observationStamp(stamps, stagingStamp),
          };
        }),
      };
    }),
  );
}
