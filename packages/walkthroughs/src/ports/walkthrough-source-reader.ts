import { Context, type Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { WalkthroughFailedError } from '../errors/walkthrough-failed-error.ts';
import type { DiffFile } from '../models/walkthrough.ts';
export interface WalkthroughSourceReader {
  readonly read: (input: {
    worktreeId: string;
    worktreePath: string;
    base: string | undefined;
    targetBranch?: string;
  }) => Effect.Effect<
    {
      baseOid: string;
      headOid: string;
      contentTreeOid: string;
      baseRef: string;
      includesUncommitted: boolean;
      patch: string;
      omittedFiles?: readonly string[] | undefined;
      branch?: string | undefined;
      files: readonly DiffFile[];
      githubRepository: { owner: string; repo: string } | undefined;
    },
    GitIoFailure | WalkthroughFailedError,
    WorktreeRead
  >;
}
export const WalkthroughSourceReader = Context.Service<
  '@porcelain/walkthroughs/WalkthroughSourceReader',
  WalkthroughSourceReader
>('@porcelain/walkthroughs/WalkthroughSourceReader');
