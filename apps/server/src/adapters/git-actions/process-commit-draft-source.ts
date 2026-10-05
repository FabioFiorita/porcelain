import { nativeOperation } from '@porcelain/effects';
import type { Effect } from 'effect';
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
} from '@porcelain/git-actions/models';
import type { CommitDraftSource } from '@porcelain/git-actions/ports';

export class ProcessCommitDraftSource implements CommitDraftSource {
  private readonly planner: CommitPlanner;

  constructor(planner: CommitPlanner) {
    this.planner = planner;
  }

  generate(input: CommitDraftRequest): Effect.Effect<CommitDraftGeneration> {
    return nativeOperation((signal) => this.generateNative(input, signal));
  }

  private async generateNative(
    input: CommitDraftRequest,
    signal?: AbortSignal,
  ): Promise<CommitDraftGeneration> {
    try {
      return {
        kind: 'drafted',
        groups: await this.planner.plan(input, signal),
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
