import { Effect, Layer } from 'effect';
import { BranchRangeReader } from '@porcelain/changes/ports';
import { WalkthroughSourceReader } from '@porcelain/walkthroughs/ports';
import { WalkthroughFailedError } from '@porcelain/walkthroughs/errors';
import type { DiffFile } from '@porcelain/walkthroughs/models';
import { captureGitPlatform, readOriginUrl } from '@porcelain/git/discovery';
import { githubRepository } from '@porcelain/reviews/rules';
import type { Limits } from '../../config/limits.ts';
export const gitWalkthroughSourceReaderLayer = (limits: Limits['git']) =>
  Layer.effect(
    WalkthroughSourceReader,
    Effect.gen(function* () {
      const ranges = yield* BranchRangeReader;
      const provideGit = yield* captureGitPlatform();
      return WalkthroughSourceReader.of({
        read: Effect.fn('WalkthroughSourceReader.read')(function* (input) {
          let range = yield* ranges.readBranchRange({
            worktreeId: input.worktreeId,
            base:
              input.targetBranch === undefined
                ? input.base
                : `refs/remotes/origin/${input.targetBranch}`,
          });
          if (range.kind === 'missing-base' && input.targetBranch !== undefined)
            range = yield* ranges.readBranchRange({
              worktreeId: input.worktreeId,
              base: `refs/heads/${input.targetBranch}`,
            });
          if (range.kind !== 'found')
            return yield* new WalkthroughFailedError({
              kind: 'other',
              message:
                'Choose a base branch with commits in common before writing a walkthrough.',
            });
          const patches = yield* ranges.readBranchPatches({
            worktreeId: input.worktreeId,
            baseOid: range.mergeBaseOid,
            headOid: range.head.oid,
            paths: range.files.map((file) =>
              [file.oldPath, file.newPath].filter(
                (path): path is string => path !== undefined,
              ),
            ),
          });
          if (patches.kind !== 'within-limit')
            return yield* new WalkthroughFailedError({
              kind: 'other',
              message:
                'The pinned diff could not be read within the server limits.',
            });
          const files: DiffFile[] = range.files.map((file) => {
            const patch = patches.patches.find((item) =>
              item.paths.includes(file.newPath ?? file.oldPath ?? ''),
            )?.content;
            const hunks =
              patch?.kind === 'text'
                ? [
                    ...patch.patch.matchAll(
                      /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm,
                    ),
                  ].map((match) => ({
                    oldStart: Number(match[1]),
                    oldEnd: Number(match[1]) + Number(match[2] ?? 1) - 1,
                    newStart: Number(match[3]),
                    newEnd: Number(match[3]) + Number(match[4] ?? 1) - 1,
                  }))
                : [];
            return {
              path: file.newPath ?? file.oldPath ?? '',
              oldPath: file.oldPath,
              hunks,
            };
          });

          const origin = yield* readOriginUrl(input.worktreePath, limits).pipe(
            provideGit,
            Effect.mapError(
              () =>
                new WalkthroughFailedError({
                  kind: 'other',
                  message: "The repository's origin could not be read.",
                }),
            ),
          );
          return {
            baseOid: range.mergeBaseOid,
            headOid: range.head.oid,
            branch: range.head.ref?.replace(/^refs\/heads\//, ''),
            files,
            githubRepository: githubRepository(origin),
          };
        }),
      });
    }),
  );
