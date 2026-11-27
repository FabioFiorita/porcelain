import type { WorktreeRead } from '@porcelain/effects/worktree';
import { Context, type Effect, type Scope } from 'effect';
import type { PreviewFileBytes } from '../models/preview-file.ts';

export const PreviewFileReader = Context.Service<
  '@porcelain/files/PreviewFileReader',
  {
    readonly open: (input: {
      worktreeId: string;
      path: string;
    }) => Effect.Effect<
      PreviewFileBytes | undefined,
      never,
      WorktreeRead | Scope.Scope
    >;
  }
>('@porcelain/files/PreviewFileReader');
