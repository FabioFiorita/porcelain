import {
  CommitPlanFailedError,
  ProviderNotInstalledError,
  ProviderProcessFailedError,
  UnsupportedCommitModelError,
  type CommitPlanner,
} from '@porcelain/agents/commit-planning';
import type {
  CommitDraftGeneration,
  CommitDraftRequest,
  CommitModel,
} from '@porcelain/git-actions/models';
import type {
  CommitDraftWriter,
  CommitModelReader,
} from '@porcelain/git-actions/ports';

export class CommitGeneratorAdapter
  implements CommitDraftWriter, CommitModelReader
{
  private readonly planner: CommitPlanner;

  constructor(planner: CommitPlanner) {
    this.planner = planner;
  }

  list(signal?: AbortSignal): Promise<CommitModel[]> {
    return this.planner.models(signal);
  }

  async write(
    request: CommitDraftRequest,
    signal?: AbortSignal,
  ): Promise<CommitDraftGeneration> {
    try {
      return {
        kind: 'drafted',
        groups: await this.planner.plan(request, signal),
      };
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof UnsupportedCommitModelError)
        return { kind: 'unsupported-model' };
      if (error instanceof ProviderNotInstalledError)
        return { kind: 'tool-missing' };
      if (error instanceof ProviderProcessFailedError)
        return { kind: 'tool-failed' };
      if (error instanceof CommitPlanFailedError) return { kind: 'failed' };
      throw error;
    }
  }
}
