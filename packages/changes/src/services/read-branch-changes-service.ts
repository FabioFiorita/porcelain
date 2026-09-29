import { BranchBaseNotFoundError } from '../errors/branch-base-not-found-error.ts';
import { UnbornBranchError } from '../errors/unborn-branch-error.ts';
import { UnrelatedBranchError } from '../errors/unrelated-branch-error.ts';
import type {
  ReadBranchChangesInput,
  ReadBranchChangesResult,
} from '../models/read-branch-changes.ts';
import type { BranchRangeReader } from '../ports/branch-range-reader.ts';
import {
  branchFilePath,
  fingerprintBranchFile,
} from '../rules/fingerprint-branch-file.ts';

export class ReadBranchChangesService {
  private readonly branchRangeReader: BranchRangeReader;

  constructor(branchRangeReader: BranchRangeReader) {
    this.branchRangeReader = branchRangeReader;
  }

  async execute(
    input: ReadBranchChangesInput,
    signal?: AbortSignal,
  ): Promise<ReadBranchChangesResult> {
    const range = await this.branchRangeReader.readBranchRange(input, signal);
    switch (range.kind) {
      case 'missing-base':
        throw new BranchBaseNotFoundError();
      case 'unrelated':
        throw new UnrelatedBranchError();
      case 'unborn':
        throw new UnbornBranchError();
      case 'no-default-base':
        return {
          head: { oid: range.head.oid, branch: range.head.ref },
          base: undefined,
          mergeBaseOid: undefined,
          commits: 0,
          files: [],
        };
      case 'found':
        return {
          head: { oid: range.head.oid, branch: range.head.ref },
          base: range.base,
          mergeBaseOid: range.mergeBaseOid,
          commits: range.commits,
          files: range.files.map((file) => ({
            path: branchFilePath(file),
            oldPath: file.oldPath,
            newPath: file.newPath,
            status: file.status,
            oldMode: file.oldMode,
            newMode: file.newMode,
            fingerprint: fingerprintBranchFile(file),
          })),
        };
    }
  }
}
