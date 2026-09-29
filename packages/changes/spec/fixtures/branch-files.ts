import type { BranchRangeFile } from '../../src/models/branch-changes.ts';

export function branchFile(
  overrides: Partial<BranchRangeFile> = {},
): BranchRangeFile {
  return {
    oldPath: 'a.txt',
    newPath: 'a.txt',
    status: 'modified',
    oldMode: '100644',
    newMode: '100644',
    oldOid: '8a6929205fe52d1251aee0bbafe362ef543d4d35',
    newOid: '4cb29ea38f70d7c61b2a3a25b02e3bdf44905402',
    ...overrides,
  };
}
