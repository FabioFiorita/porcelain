import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { BranchBaseNotFoundError } from '../errors/branch-base-not-found-error.ts';
import { UnbornBranchError } from '../errors/unborn-branch-error.ts';
import { UnrelatedBranchError } from '../errors/unrelated-branch-error.ts';
import {
  type ReadBranchChangesInput,
  type ReadBranchChangesResult,
} from '../models/read-branch-changes.ts';
import { BranchRangeReader } from '../ports/branch-range-reader.ts';
import {
  branchFilePath,
  fingerprintBranchFile,
} from '../rules/fingerprint-branch-file.ts';

export class ReadBranchChangesService extends Context.Service<
  ReadBranchChangesService,
  {
    readonly execute: (
      input: ReadBranchChangesInput,
    ) => Effect.Effect<
      ReadBranchChangesResult,
      | GitIoFailure
      | BranchBaseNotFoundError
      | UnbornBranchError
      | UnrelatedBranchError,
      WorktreeRead
    >;
  }
>()('@porcelain/changes/ReadBranchChangesService') {
  static readonly layer = Layer.effect(
    ReadBranchChangesService,
    Effect.gen(function* () {
      const branchRangeReaderCapability = yield* BranchRangeReader;

      return {
        execute: Effect.fn('ReadBranchChangesService.execute')(function* (
          input: ReadBranchChangesInput,
        ): Effect.fn.Return<
          ReadBranchChangesResult,
          | GitIoFailure
          | BranchBaseNotFoundError
          | UnbornBranchError
          | UnrelatedBranchError,
          WorktreeRead
        > {
          const range =
            yield* branchRangeReaderCapability.readBranchRange(input);
          switch (range.kind) {
            case 'missing-base':
              return yield* Effect.fail(new BranchBaseNotFoundError());
            case 'unrelated':
              return yield* Effect.fail(new UnrelatedBranchError());
            case 'unborn':
              return yield* Effect.fail(new UnbornBranchError());
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
        }),
      };
    }),
  );
}
