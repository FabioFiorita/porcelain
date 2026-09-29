import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import {
  InvalidGitDiffError,
  parseRawDiffObjects,
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
import { InvalidHistoryRequestError } from '../errors/invalid-history-request-error.ts';
import { ReadLimitExceededError } from '../errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';
import {
  confirmHistoryCheckout,
  inspectHistoryCheckout,
} from './inspect-history-checkout.ts';
import { lookupBranchRefs, readDefaultBase } from './read-default-base.ts';
import { DIFF_FLAGS, fileStatus } from './read-commit-files.ts';
import { readHistoryAnswer, runHistory } from './run-history.ts';

const ABSENT = 1;

export async function readBranchRange(
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  request: BranchRangeRequest,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<BranchRange> {
  await inspectHistoryCheckout(checkout, gitVersion, signal);
  if (request.base !== undefined && !isBranchRef(request.base))
    throw new InvalidHistoryRequestError();
  const range = await compare(checkout.path, request, limits, signal);
  await confirmHistoryCheckout(checkout, signal);
  return range;
}

async function compare(
  path: string,
  request: BranchRangeRequest,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<BranchRange> {
  const head = await readHead(path, limits, signal);
  if (head === null) return { kind: 'unborn' };
  const base =
    request.base === undefined
      ? await readDefaultBase(path, limits, signal)
      : await readBase(path, request.base, limits, signal);
  if (base === null)
    return request.base === undefined
      ? { kind: 'no-default-base', head }
      : { kind: 'missing-base' };
  const mergeBase = await answer(
    path,
    ['merge-base', base.oid, head.oid],
    limits,
    signal,
  );
  if (mergeBase === null) return { kind: 'unrelated' };
  const files = await readFiles(path, mergeBase, head.oid, limits, signal);
  const commits = Number(
    (
      await runHistory(
        path,
        ['rev-list', '--count', `${mergeBase}..${head.oid}`],
        limits,
        signal,
      )
    )
      .toString('utf8')
      .trim(),
  );
  if (!Number.isSafeInteger(commits)) throw new UnsupportedHistoryDataError();
  return {
    kind: 'found',
    head,
    base,
    mergeBaseOid: mergeBase,
    commits,
    files,
  };
}

async function readHead(
  path: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<BranchHead | null> {
  const oid = await answer(
    path,
    ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'],
    limits,
    signal,
  );
  if (oid === null) return null;
  const ref = await answer(
    path,
    ['symbolic-ref', '--quiet', 'HEAD'],
    limits,
    signal,
  );
  return { oid, ref };
}

async function readBase(
  path: string,
  ref: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<{ ref: string; oid: string } | null> {
  const oid = (await lookupBranchRefs(path, [ref], limits, signal)).get(ref);
  return oid === undefined ? null : { ref, oid };
}

async function readFiles(
  path: string,
  from: string,
  to: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<BranchFile[]> {
  const output = await runHistory(
    path,
    [
      'diff-tree',
      '-r',
      '--raw',
      '-z',
      '--no-abbrev',
      ...DIFF_FLAGS,
      from,
      to,
      '--',
    ],
    limits,
    signal,
  );
  let entries: RawDiffObjects[];
  try {
    entries = parseRawDiffObjects(output);
  } catch (cause) {
    if (cause instanceof InvalidGitDiffError)
      throw new UnsupportedHistoryDataError({ cause });
    throw cause;
  }
  if (entries.length > limits.history.maxCommitFiles)
    throw new ReadLimitExceededError();
  return entries.map((entry) => {
    const status = fileStatus(entry.status);
    return {
      oldPath: status === 'added' ? null : entry.oldPath,
      newPath: status === 'deleted' ? null : entry.newPath,
      status,
      oldMode: entry.oldMode,
      newMode: entry.newMode,
      oldOid: status === 'added' ? null : entry.oldOid,
      newOid: status === 'deleted' ? null : entry.newOid,
    };
  });
}

async function answer(
  path: string,
  args: readonly string[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<string | null> {
  const output = await readHistoryAnswer(
    path,
    args,
    limits,
    signal,
    (failure) => failure.exitCode === ABSENT,
  );
  if (output === null) return null;
  const value = output.toString('utf8').trim();
  return value === '' ? null : value;
}
