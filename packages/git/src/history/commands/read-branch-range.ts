import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import {
  parseRawDiffObjectsEffect,
  type RawDiffObjects,
} from '../../inspection/index.ts';
import { isBranchRef } from '../../shared/parsers/refs.ts';
import type {
  BranchFile,
  BranchHead,
  BranchRange,
  BranchRangeRequest,
} from '../dtos/branch-range.ts';
import type { HistoryCheckout } from '../dtos/commit-history.ts';
import { InvalidHistoryRequestError } from '../../shared/errors/invalid-history-request-error.ts';
import { ReadLimitExceededError } from '../../shared/errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from '../../shared/errors/unsupported-history-data-error.ts';
import {
  confirmHistoryCheckout,
  inspectHistoryCheckout,
} from './inspect-history-checkout.ts';
import { lookupBranchRefs, readDefaultBase } from './read-default-base.ts';
import { diffFlags, fileStatus } from './read-commit-files.ts';
import { readHistoryAnswer, runHistory } from './run-history.ts';

const ABSENT = 1;

export const readBranchRange = Effect.fn('Git.readBranchRange')(function* (
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  request: BranchRangeRequest,
  limits: GitLimits,
) {
  yield* inspectHistoryCheckout(checkout, gitVersion);
  if (request.base !== undefined && !isBranchRef(request.base))
    return yield* Effect.fail(new InvalidHistoryRequestError());
  const range = yield* compare(checkout.path, request, limits);
  yield* confirmHistoryCheckout(checkout);
  return range;
});

const compare = Effect.fn('Git.compare')(function* (
  path: string,
  request: BranchRangeRequest,
  limits: GitLimits,
) {
  const head = yield* readHead(path, limits);
  if (head === null) return { kind: 'unborn' } satisfies BranchRange;
  const base =
    request.base === undefined
      ? yield* readDefaultBase(path, limits)
      : yield* readBase(path, request.base, limits);
  if (base === null)
    return request.base === undefined
      ? ({ kind: 'no-default-base', head } satisfies BranchRange)
      : ({ kind: 'missing-base' } satisfies BranchRange);
  const mergeBase = yield* answer(
    path,
    ['merge-base', base.oid, head.oid],
    limits,
  );
  if (mergeBase === null) return { kind: 'unrelated' } satisfies BranchRange;
  const files = yield* readFiles(path, mergeBase, head.oid, limits);
  const commits = Number(
    (yield* runHistory(
      path,
      ['rev-list', '--count', `${mergeBase}..${head.oid}`],
      limits,
    ))
      .toString('utf8')
      .trim(),
  );
  if (!Number.isSafeInteger(commits))
    return yield* Effect.fail(new UnsupportedHistoryDataError());
  return {
    kind: 'found',
    head,
    base,
    mergeBaseOid: mergeBase,
    commits,
    files,
  } satisfies BranchRange;
});

const readHead = Effect.fn('Git.readHead')(function* (
  path: string,
  limits: GitLimits,
) {
  const oid = yield* answer(
    path,
    ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'],
    limits,
  );
  if (oid === null) return null;
  const ref = yield* answer(path, ['symbolic-ref', '--quiet', 'HEAD'], limits);
  return { oid, ref } satisfies BranchHead;
});

const readBase = Effect.fn('Git.readBase')(function* (
  path: string,
  ref: string,
  limits: GitLimits,
) {
  const oid = (yield* lookupBranchRefs(path, [ref], limits)).get(ref);
  return oid === undefined ? null : { ref, oid };
});

const readFiles = Effect.fn('Git.readFiles')(function* (
  path: string,
  from: string,
  to: string,
  limits: GitLimits,
) {
  const output = yield* runHistory(
    path,
    [
      'diff-tree',
      '-r',
      '--raw',
      '-z',
      '--no-abbrev',
      ...diffFlags(limits),
      from,
      to,
      '--',
    ],
    limits,
  );
  const entries: RawDiffObjects[] = yield* parseRawDiffObjectsEffect(
    output,
  ).pipe(
    Effect.mapError((cause) => new UnsupportedHistoryDataError({ cause })),
  );
  if (entries.length > limits.history.maxCommitFiles)
    return yield* Effect.fail(new ReadLimitExceededError());
  return yield* Effect.forEach(entries, (entry) =>
    Effect.gen(function* () {
      const status = yield* fileStatus(entry.status);
      return {
        oldPath: status === 'added' ? null : entry.oldPath,
        newPath: status === 'deleted' ? null : entry.newPath,
        status,
        oldMode: entry.oldMode,
        newMode: entry.newMode,
        oldOid: status === 'added' ? null : entry.oldOid,
        newOid: status === 'deleted' ? null : entry.newOid,
      } satisfies BranchFile;
    }),
  );
});

const answer = Effect.fn('Git.answer')(function* (
  path: string,
  args: readonly string[],
  limits: GitLimits,
) {
  const output = yield* readHistoryAnswer(
    path,
    args,
    limits,
    (failure) => failure.exitCode === ABSENT,
  );
  if (output === null) return null;
  const value = output.toString('utf8').trim();
  return value === '' ? null : value;
});
