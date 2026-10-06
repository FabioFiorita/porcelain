import type { WorktreeKey } from '@porcelain/kernel/models';
import { Context, type Effect } from 'effect';
import type {
  NoWorktreeAtPathError,
  ProjectNotFoundError,
} from '@porcelain/projects/errors';

type WorktreePathLookup = { path: string };

export interface FindWorktreeByPathUseCasePort {
  execute(
    input: WorktreePathLookup,
  ): Effect.Effect<WorktreeKey, NoWorktreeAtPathError | ProjectNotFoundError>;
}

export type AtPathExecution<Request, Result, Failure> = {
  cwd: string;
  request: Request;
  operation: {
    readonly execute: (
      input: Request & WorktreeKey,
    ) => Effect.Effect<Result, Failure>;
  };
};

export const FindWorktreeByPathUseCasePort = Context.Service<
  '@porcelain/server/FindWorktreeByPathUseCasePort',
  FindWorktreeByPathUseCasePort
>('@porcelain/server/FindWorktreeByPathUseCasePort');
