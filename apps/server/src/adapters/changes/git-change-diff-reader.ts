import type {
  ChangeDiffContent,
  ReadChangeDiffsInput,
} from '@porcelain/changes/models';
import { Effect, Layer } from 'effect';
import { readDiffs } from '@porcelain/git/inspection';
import { ChangeDiffReader } from '@porcelain/changes/ports';
import { readGitEffect } from '../../runtime/git-io.ts';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { toGitChange } from './git-comparisons.ts';
import type { OpenInspection } from './inspection-checkouts.ts';

export const gitChangeDiffReaderLayer = (open: OpenInspection) =>
  Layer.effect(
    ChangeDiffReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        readDiffs: Effect.fn('GitChangeDiffReader.readDiffs')(
          (input: ReadChangeDiffsInput) =>
            readGitEffect(
              input.worktreeId,
              Effect.gen(function* () {
                const { checkout, limits } = yield* open(input.worktreeId);
                yield* checkout.verify();
                const diffs: ChangeDiffContent[] = yield* readDiffs(
                  checkout,
                  input.comparisons.map(toGitChange),
                  limits,
                );
                return diffs;
              }).pipe(provideGit),
            ),
        ),
      };
    }),
  );
