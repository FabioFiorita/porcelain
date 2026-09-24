import type { ListCommitModelsResponse } from '@porcelain/contracts/git-actions';
import type { ListCommitModelsService } from '@porcelain/git-actions/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export type ListCommitModelsOptions = { deadlineMs: number };

export class ListCommitModelsUseCase {
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

  execute(context: OperationContext): Promise<ListCommitModelsResponse> {
    return this.lanes.unqueued(() => this.listCommitModels.execute(), {
      callerSignal: context.signal,
      deadlineMs: this.options.deadlineMs,
    });
  }
}
