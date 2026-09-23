import type {
  BranchDetails,
  ChangeStatusObservation,
} from '../models/status-observation.ts';

export interface ChangeStatusReader {
  readStatus(signal?: AbortSignal): Promise<ChangeStatusObservation>;
  readBranchDetails(
    branch: string | undefined,
    headOid: string | null,
    signal?: AbortSignal,
  ): Promise<BranchDetails>;
}
