import type { WorktreeKey } from '@porcelain/kernel/models';
import type { OperationContext } from '../../ports/operation-context.ts';

export type WorktreeOperation = {
  execute(input: WorktreeKey, context: OperationContext): Promise<unknown>;
};

export type AtPathRequest<Operation extends WorktreeOperation> = Omit<
  Parameters<Operation['execute']>[0],
  'worktreeId'
>;

export type AtPathResponse<Operation extends WorktreeOperation> = Awaited<
  ReturnType<Operation['execute']>
>;

export type WorktreeFinder = {
  execute(
    input: { path: string },
    context: OperationContext,
  ): Promise<WorktreeKey>;
};

export type AtPathInput<Operation extends WorktreeOperation> = {
  cwd: string;
  request: AtPathRequest<Operation>;
};

type ResolvedOperation<Operation extends WorktreeOperation> = {
  execute(
    input: AtPathRequest<Operation> & WorktreeKey,
    context: OperationContext,
  ): Promise<AtPathResponse<Operation>>;
};

export class AtWorktreePathUseCase<Operation extends WorktreeOperation> {
  private readonly findWorktreeByPath: WorktreeFinder;
  private readonly operation: ResolvedOperation<Operation>;

  constructor(
    findWorktreeByPath: WorktreeFinder,
    operation: ResolvedOperation<Operation>,
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
