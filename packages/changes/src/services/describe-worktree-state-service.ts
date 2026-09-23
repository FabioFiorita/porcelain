import type { DescribeWorktreeStateInput } from '../models/operation-inputs.ts';
import { describeWorktreeState } from '../rules/describe-worktree-state.ts';

export class DescribeWorktreeStateService {
  execute(input: DescribeWorktreeStateInput): string {
    return describeWorktreeState(input.changes, input.branch);
  }
}
