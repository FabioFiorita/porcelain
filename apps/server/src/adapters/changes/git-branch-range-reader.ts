import { Effect, Layer } from 'effect';
import { readGitEffect } from '../../runtime/git-io.ts';
import { captureGitPlatform } from '../projects/git-platform.ts';
import { makeGitSession } from '@porcelain/git/inspection';
import type { Limits } from '../../config/limits.ts';
import {
  type BranchBases,
  type BranchPatches,
  type BranchPatchesRequest,
  type BranchRangeLookup,
  type BranchRangeRequest,
  type ListBranchBasesInput,
} from '@porcelain/changes/models';
import { BranchRangeReader } from '@porcelain/changes/ports';
import {
  openCheckoutEffect,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

import * as history from '@porcelain/git/history';

export const gitBranchRangeReaderLayer = (
  worktrees: ListedWorktrees,
  gitVersion: Buffer,
  limits: Limits['git'],
) =>
  Layer.effect(
    BranchRangeReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      const readBranchRangeNative = Effect.fn(
        'BranchRangeReader.readBranchRangeNative',
      )(function* (input: BranchRangeRequest) {
        const session = yield* makeGitSession(limits);
        const { worktree, checkout } = yield* openCheckoutEffect(
          worktrees,
          session,
          input.worktreeId,
        );
        const historyCheckout = { ...worktree, path: checkout.path };
        const range = yield* history.readBranchRange(
          historyCheckout,
          gitVersion,
          input.base === undefined ? {} : { base: input.base },
          limits,
        );
        switch (range.kind) {
          case 'found':
            return {
              kind: 'found',
              head: { oid: range.head.oid, ref: range.head.ref ?? undefined },
              base: range.base,
              mergeBaseOid: range.mergeBaseOid,
              commits: range.commits,
              files: range.files.map((file) => ({
                oldPath: file.oldPath ?? undefined,
                newPath: file.newPath ?? undefined,
                status: file.status,
                oldMode: file.oldMode,
                newMode: file.newMode,
                oldOid: file.oldOid ?? undefined,
                newOid: file.newOid ?? undefined,
              })),
            } satisfies BranchRangeLookup;
          case 'no-default-base':
            return {
              kind: 'no-default-base',
              head: { oid: range.head.oid, ref: range.head.ref ?? undefined },
            } satisfies BranchRangeLookup;
          default:
            return range;
        }
      });
      const readBranchPatchesNative = Effect.fn(
        'BranchRangeReader.readBranchPatchesNative',
      )(function* (input: BranchPatchesRequest) {
        const session = yield* makeGitSession(limits);
        const { worktree, checkout } = yield* openCheckoutEffect(
          worktrees,
          session,
          input.worktreeId,
        );
        const historyCheckout = { ...worktree, path: checkout.path };
        const read = yield* history.readBranchDiffs(
          historyCheckout,
          {
            baseOid: input.baseOid,
            headOid: input.headOid,
            paths: input.paths,
          },
          limits,
        );
        if (read.kind === 'missing') return read;
        if (read.sections === null)
          return { kind: 'over-limit' } satisfies BranchPatches;
        return {
          kind: 'within-limit',
          patches: [...read.sections].map(([key, content]) => ({
            paths: key.split('\0'),
            content,
          })),
        } satisfies BranchPatches;
      });
      const listBranchBasesNative = Effect.fn(
        'BranchRangeReader.listBranchBasesNative',
      )(function* (input: ListBranchBasesInput) {
        const session = yield* makeGitSession(limits);
        const { worktree, checkout } = yield* openCheckoutEffect(
          worktrees,
          session,
          input.worktreeId,
        );
        const historyCheckout = { ...worktree, path: checkout.path };
        const listed = yield* history.listBranchBases(
          historyCheckout,
          gitVersion,
          limits,
        );
        return {
          defaultRef: listed.defaultRef ?? undefined,
          bases: listed.bases,
        } satisfies BranchBases;
      });
      return {
        readBranchRange: Effect.fn('BranchRangeReader.readBranchRange')(
          (input) =>
            readGitEffect(
              input.worktreeId,
              readBranchRangeNative(input).pipe(provideGit),
            ),
        ),
        readBranchPatches: Effect.fn('BranchRangeReader.readBranchPatches')(
          (input) =>
            readGitEffect(
              input.worktreeId,
              readBranchPatchesNative(input).pipe(provideGit),
            ),
        ),
        listBranchBases: Effect.fn('BranchRangeReader.listBranchBases')(
          (input) =>
            readGitEffect(
              input.worktreeId,
              listBranchBasesNative(input).pipe(provideGit),
            ),
        ),
      };
    }),
  );
