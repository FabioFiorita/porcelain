import { createHash } from 'node:crypto';
import type { BranchRangeFile } from '../models/branch-changes.ts';

export function branchFilePath(file: BranchRangeFile): string {
  return file.newPath ?? file.oldPath ?? '';
}

export function fingerprintBranchFile(file: BranchRangeFile): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        'branch',
        file.status,
        file.oldPath,
        file.newPath,
        file.oldMode,
        file.newMode,
        file.oldOid,
        file.newOid,
      ]),
    )
    .digest('hex');
}
