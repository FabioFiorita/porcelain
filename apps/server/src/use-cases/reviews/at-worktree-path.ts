import type {
  AtPathInput,
  AtPathOperationUseCasePort,
  AtPathResponse,
  FindWorktreeByPathUseCasePort,
  WorktreeOperationUseCasePort,
} from '../../ports/at-worktree-path-use-case-port.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

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

  async execute(
    input: AtPathInput<Operation>,
    context: OperationContext,
  ): Promise<AtPathResponse<Operation>> {
    const { worktreeId } = await this.findWorktreeByPath.execute(
      { path: input.cwd },
      context,
    );
    return this.operation.execute({ ...input.request, worktreeId }, context);
  }
}
