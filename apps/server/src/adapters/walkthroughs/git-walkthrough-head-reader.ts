import { Effect, Layer } from 'effect';
import { readWorkingTree } from '@porcelain/git/inspection';
import { captureGitPlatform } from '@porcelain/git/discovery';
import type { Limits } from '../../config/limits.ts';
import { readGitEffect } from '../../runtime/git-io.ts';
import {
  BranchRangeReader,
  ChangeStatusReader,
} from '@porcelain/changes/ports';
import { WalkthroughHeadReader } from '@porcelain/walkthroughs/ports';
export const gitWalkthroughHeadReaderLayer = (limits: Limits['git']) =>
  Layer.effect(
    WalkthroughHeadReader,
    Effect.gen(function* () {
      const status = yield* ChangeStatusReader;
      const ranges = yield* BranchRangeReader;
      const provideGit = yield* captureGitPlatform();
      return WalkthroughHeadReader.of({
        content: Effect.fn('WalkthroughHeadReader.content')(function* (input) {
          const range = yield* ranges.readBranchRange({
            worktreeId: input.worktreeId,
            base: input.baseRef,
          });
          if (range.kind !== 'found') return undefined;
          const snapshot = yield* readGitEffect(
            input.worktreeId,
            readWorkingTree(input.worktreePath, undefined, limits).pipe(
              provideGit,
            ),
          );
          return {
            baseOid: range.mergeBaseOid,
            contentTreeOid: snapshot.treeOid,
          };
        }),
        read: Effect.fn('WalkthroughHeadReader.read')(function* (input) {
          const head = yield* status.readStatus(input);
          return { branch: head.branch?.name, headOid: head.headOid };
        }),
      });
    }),
  );
