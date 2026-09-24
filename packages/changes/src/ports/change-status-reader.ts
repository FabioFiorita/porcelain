import type {
  BranchDetails,
  BranchDetailsRequest,
  ChangeStatusObservation,
} from '../models/change-status.ts';
import type { ReadWorktreeStatusInput } from '../models/read-worktree-status.ts';

export interface ChangeStatusReader {
  readStatus(
    input: ReadWorktreeStatusInput,
    signal?: AbortSignal,
  ): Promise<ChangeStatusObservation>;
  readBranchDetails(
    input: BranchDetailsRequest,
    signal?: AbortSignal,
  ): Promise<BranchDetails>;
}
