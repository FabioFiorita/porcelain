import type {
  BranchDetails,
  ChangeStatusObservation,
} from '../models/change-status.ts';

export interface ChangeStatusReader {
  readStatus(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ChangeStatusObservation>;
  readBranchDetails(
    worktreeId: string,
    branch: string | undefined,
    headOid: string | undefined,
    signal?: AbortSignal,
  ): Promise<BranchDetails>;
}
