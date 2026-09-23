import type { CommitModel } from '@porcelain/git-actions/models';
import type { ListCommitModelsService } from '@porcelain/git-actions/services';
import type { Lanes } from '../runtime/operation-runner.ts';

export class ListCommitModelsController {
  private readonly lanes: Lanes;
  private readonly list: ListCommitModelsService;
  private models: Promise<CommitModel[]> | undefined;

  constructor(lanes: Lanes, list: ListCommitModelsService) {
    this.lanes = lanes;
    this.list = list;
  }

  execute(_signal?: AbortSignal): Promise<CommitModel[]> {
    return (this.models ??= this.lanes.unqueued(
      (signal) => this.list.execute(signal),
      { deadlineMs: 120_000 },
    ));
  }
}
