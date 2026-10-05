import type {
  AtPathInput,
  AtPathOperationUseCasePort,
  AtPathResponse,
  FindWorktreeByPathUseCasePort,
  WorktreeOperationUseCasePort,
} from '../../ports/at-worktree-path-use-case-port.ts';
import { Effect } from 'effect';
import type {
  NoWorktreeAtPathError,
  ProjectNotFoundError,
} from '@porcelain/projects/errors';

export class AtWorktreePathUseCase<
  Operation extends WorktreeOperationUseCasePort,
> {
  private readonly findWorktreeByPath: FindWorktreeByPathUseCasePort;
  private readonly operation: AtPathOperationUseCasePort<Operation>;

  constructor(
    findWorktreeByPath: FindWorktreeByPathUseCasePort,
    operation: AtPathOperationUseCasePort<Operation>,
  ) {
    this.findWorktreeByPath = findWorktreeByPath;
    this.operation = operation;
  }

  execute(
    input: AtPathInput<Operation>,
  ): Effect.Effect<
    AtPathResponse<Operation>,
    | Effect.Error<ReturnType<Operation['execute']>>
    | NoWorktreeAtPathError
    | ProjectNotFoundError
  > {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId } = yield* this.findWorktreeByPath.execute({
        path: input.cwd,
      });
      return yield* this.operation.execute({ ...input.request, worktreeId });
    });
  }
}
