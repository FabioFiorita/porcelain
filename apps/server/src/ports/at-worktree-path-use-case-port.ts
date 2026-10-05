import type { WorktreeKey } from '@porcelain/kernel/models';
import type { Effect } from 'effect';
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

export interface WorktreeOperationUseCasePort {
  execute(input: WorktreeKey): Effect.Effect<unknown, unknown>;
}

type AtPathRequest<Operation extends WorktreeOperationUseCasePort> = Omit<
  Parameters<Operation['execute']>[0],
  'worktreeId'
>;

export type AtPathResponse<Operation extends WorktreeOperationUseCasePort> =
  Effect.Success<ReturnType<Operation['execute']>>;

type AtPathOperationInput<Operation extends WorktreeOperationUseCasePort> =
  AtPathRequest<Operation> & WorktreeKey;

export interface AtPathOperationUseCasePort<
  Operation extends WorktreeOperationUseCasePort,
> {
  execute(
    input: AtPathOperationInput<Operation>,
  ): Effect.Effect<
    AtPathResponse<Operation>,
    Effect.Error<ReturnType<Operation['execute']>>
  >;
}

export type AtPathInput<Operation extends WorktreeOperationUseCasePort> = {
  cwd: string;
  request: AtPathRequest<Operation>;
};

export interface AtWorktreePathUseCasePort<
  Operation extends WorktreeOperationUseCasePort,
> {
  execute(
    input: AtPathInput<Operation>,
  ): Effect.Effect<
    AtPathResponse<Operation>,
    | Effect.Error<ReturnType<Operation['execute']>>
    | NoWorktreeAtPathError
    | ProjectNotFoundError
  >;
}
