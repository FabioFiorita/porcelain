import type {
  BranchDetails,
  BranchDetailsRequest,
  ReadWorktreeStatusInput,
} from '@porcelain/changes/models';
import { Effect, Layer } from 'effect';
import {
  readCheckoutStatus,
  readBranchDetails,
} from '@porcelain/git/inspection';
import { ChangeStatusReader } from '@porcelain/changes/ports';
import { readGitEffect } from '../../runtime/git-io.ts';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { fromGitChange } from './git-comparisons.ts';
import type { OpenInspection } from './inspection-checkouts.ts';

export const gitChangeStatusReaderLayer = (open: OpenInspection) =>
  Layer.effect(
    ChangeStatusReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        readStatus: Effect.fn('GitChangeStatusReader.readStatus')(
          (input: ReadWorktreeStatusInput) =>
            readGitEffect(
              input.worktreeId,
              Effect.gen(function* () {
                const { checkout, limits } = yield* open(input.worktreeId);
                const status = yield* readCheckoutStatus(checkout, limits);
                return {
                  statusToken: status.statusToken,
                  headOid: status.headOid ?? undefined,
                  inProgress: status.inProgress ?? undefined,
                  mergeHeadOid: status.mergeHeadOid ?? undefined,
                  branch: status.branch && {
                    name: status.branch.name ?? undefined,
                    upstream: status.branch.upstream ?? undefined,
                    ahead: status.branch.ahead,
                    behind: status.branch.behind,
                  },
                  changes: status.changes.map(fromGitChange),
                };
              }).pipe(provideGit),
            ),
        ),
        readBranchDetails: Effect.fn('GitChangeStatusReader.readBranchDetails')(
          (input: BranchDetailsRequest) =>
            readGitEffect(
              input.worktreeId,
              Effect.gen(function* () {
                const { checkout, limits } = yield* open(input.worktreeId);
                const details = yield* readBranchDetails(
                  checkout,
                  input.branchName ?? null,
                  input.headOid ?? null,
                  limits,
                );
                return {
                  remoteName: details.remoteName ?? undefined,
                  sourceRef: details.sourceRef ?? undefined,
                  upstreamOid: details.upstreamOid ?? undefined,
                  stashes: details.stashes,
                  discarded: details.discarded,
                  headCommit: details.headCommit ?? undefined,
                } satisfies BranchDetails;
              }).pipe(provideGit),
            ),
        ),
      };
    }),
  );
