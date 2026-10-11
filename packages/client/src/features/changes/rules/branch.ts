import type { ReadBranchChangesResponse } from '@porcelain/contracts/changes';

type BranchChanges = ReadBranchChangesResponse;
export type BranchFile = BranchChanges['files'][number];
export type BranchRange = { baseOid: string; headOid: string };

export function branchRange(changes: BranchChanges): BranchRange | null {
  return changes.mergeBaseOid === null || changes.mergeBaseOid === undefined
    ? null
    : { baseOid: changes.mergeBaseOid, headOid: changes.head.oid };
}

export function branchErrorMessage(error: unknown): string {
  return error instanceof Error &&
    (error.name === 'RequestError' || error.name === 'ConnectionError')
    ? error.message
    : 'The branch could not be compared. Try again.';
}
