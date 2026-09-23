import type { ListCommitModelsResponse } from '@porcelain/contracts/git-actions';
import type { ListCommitModelsService } from '@porcelain/git-actions/services';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export type ListCommitModelsOptions = { deadlineMs: number };

export class ListCommitModelsController {
  private readonly listCommitModels: ListCommitModelsService;
  private readonly lanes: Lanes;
  private readonly options: ListCommitModelsOptions;

  constructor(
    listCommitModels: ListCommitModelsService,
    lanes: Lanes,
    options: ListCommitModelsOptions,
  ) {
    this.listCommitModels = listCommitModels;
    this.lanes = lanes;
    this.options = options;
  }

  execute(
    input: Record<never, never>,
    context: OperationContext,
  ): Promise<ListCommitModelsResponse> {
    return this.lanes.unqueued(
      (signal) => this.listCommitModels.execute(input, signal),
      { callerSignal: context.signal, deadlineMs: this.options.deadlineMs },
    );
  }
}
