import type {
  CheckWorktreeInput,
  ListedWorktree,
} from '@porcelain/projects/models';
import type {
  CheckRefreshedWorktreeService,
  CheckWorktreeService,
} from '@porcelain/projects/services';
import type { JobWork } from '../../runtime/interval-job.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class CheckWorktreeUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly checkRefreshedWorktree: CheckRefreshedWorktreeService;
  private readonly refreshInventory: JobWork;

  constructor(
    checkWorktree: CheckWorktreeService,
    checkRefreshedWorktree: CheckRefreshedWorktreeService,
    refreshInventory: JobWork,
  ) {
    this.checkWorktree = checkWorktree;
    this.checkRefreshedWorktree = checkRefreshedWorktree;
    this.refreshInventory = refreshInventory;
  }

  async execute(
    input: CheckWorktreeInput,
    context: OperationContext,
  ): Promise<ListedWorktree> {
    const checked = this.checkWorktree.execute(input);
    if (checked.kind === 'found') return checked.worktree;
    await this.refreshInventory.execute(context);
    return this.checkRefreshedWorktree.execute(input);
  }
}
