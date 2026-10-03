import type { WorktreeKey } from '@porcelain/kernel/models';
import type { OperationContext } from './operation-context.ts';

type WorktreePathLookup = { path: string };

export interface FindWorktreeByPathUseCasePort {
  execute(
    input: WorktreePathLookup,
    context: OperationContext,
  ): Promise<WorktreeKey>;
}

export interface WorktreeOperationUseCasePort {
  execute(input: WorktreeKey, context: OperationContext): Promise<unknown>;
}

type AtPathRequest<Operation extends WorktreeOperationUseCasePort> = Omit<
  Parameters<Operation['execute']>[0],
  'worktreeId'
>;

export type AtPathResponse<Operation extends WorktreeOperationUseCasePort> =
  Awaited<ReturnType<Operation['execute']>>;

type AtPathOperationInput<Operation extends WorktreeOperationUseCasePort> =
  AtPathRequest<Operation> & WorktreeKey;

export interface AtPathOperationUseCasePort<
  Operation extends WorktreeOperationUseCasePort,
> {
  execute(
    input: AtPathOperationInput<Operation>,
    context: OperationContext,
  ): Promise<AtPathResponse<Operation>>;
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
    context: OperationContext,
  ): Promise<AtPathResponse<Operation>>;
}
