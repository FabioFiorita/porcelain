import type { ReadBranchChangesResponse } from '@porcelain/contracts/changes';

type BranchChanges = ReadBranchChangesResponse;
export type BranchFile = BranchChanges['files'][number];
export type BranchRange = { baseOid: string; headOid: string };

export function branchFilePaths(file: BranchFile): string[] {
  return [
    ...new Set([file.oldPath, file.newPath].filter((path) => path != null)),
  ];
}

export function branchName(ref: string): string {
  if (ref.startsWith('refs/heads/')) return ref.slice('refs/heads/'.length);
  if (ref.startsWith('refs/remotes/')) return ref.slice('refs/remotes/'.length);
  return ref;
}

export function branchRange(changes: BranchChanges): BranchRange | null {
  return changes.mergeBaseOid == null
    ? null
    : { baseOid: changes.mergeBaseOid, headOid: changes.head.oid };
}

export function branchErrorMessage(error: unknown): string {
  return error instanceof Error &&
    (error.name === 'RequestError' || error.name === 'ConnectionError')
    ? error.message
    : 'The branch could not be compared. Try again.';
}
