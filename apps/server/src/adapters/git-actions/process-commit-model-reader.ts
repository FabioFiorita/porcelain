import { nativeOperation } from '@porcelain/effects';
import type { Effect } from 'effect';
import type { CommitPlanner } from '@porcelain/agents/commit-planning';
import type { CommitModel } from '@porcelain/git-actions/models';
import type { CommitModelReader } from '@porcelain/git-actions/ports';

export class ProcessCommitModelReader implements CommitModelReader {
  private readonly planner: CommitPlanner;

  constructor(planner: CommitPlanner) {
    this.planner = planner;
  }

  list(): Effect.Effect<CommitModel[]> {
    return nativeOperation(() => this.planner.models());
  }
}
