import { Effect } from 'effect';
import type { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { WorktreeUnavailableError } from '@porcelain/projects/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type {
  CheckWorktreeInput,
  ListedWorktree,
} from '@porcelain/projects/models';
import type {
  CheckRefreshedWorktreeService,
  CheckWorktreeService,
} from '@porcelain/projects/services';
import type { JobRunner } from '../../ports/job-runner.ts';

export class CheckWorktreeUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly checkRefreshedWorktree: CheckRefreshedWorktreeService;
  private readonly refreshInventory: JobRunner<ProjectNotFoundError>;

  constructor(
    checkWorktree: CheckWorktreeService,
    checkRefreshedWorktree: CheckRefreshedWorktreeService,
    refreshInventory: JobRunner<ProjectNotFoundError>,
  ) {
    this.checkWorktree = checkWorktree;
    this.checkRefreshedWorktree = checkRefreshedWorktree;
    this.refreshInventory = refreshInventory;
  }

  execute(
    input: CheckWorktreeInput,
  ): Effect.Effect<
    ListedWorktree,
    WorktreeNotFoundError | WorktreeUnavailableError | ProjectNotFoundError
  > {
    return Effect.gen({ self: this }, function* () {
      const checked = yield* this.checkWorktree.execute(input);
      if (checked.kind === 'found') return checked.worktree;
      yield* this.refreshInventory.execute();
      return yield* this.checkRefreshedWorktree.execute(input);
    });
  }
}
