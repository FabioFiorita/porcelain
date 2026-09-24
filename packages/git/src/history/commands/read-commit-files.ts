import {
  InvalidGitDiffError,
  parseRawDiff,
  type RawDiffEntry,
} from '../../inspection/index.ts';
import { isOid } from '../../shared/oid.ts';
import type {
  CommitFile,
  CommitFiles,
  CommitFilesRequest,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import { InvalidHistoryRequestError } from '../errors/invalid-history-request-error.ts';
import { ReadLimitExceededError } from '../errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';
import { decodeHistory } from '../parsers/decode-history.ts';
import {
  COMMIT_FIELDS,
  COMMIT_FORMAT,
  parseCommitRecord,
} from '../parsers/parse-commit.ts';
import {
  confirmHistoryCheckout,
  inspectHistoryCheckout,
} from './inspect-history-checkout.ts';
import { runHistory } from './run-history.ts';

const MAX_COMMIT_FILES = 10_000;

const DIFF_FLAGS = [
  '--no-textconv',
  '--no-ext-diff',
  '--no-color',
  '--find-renames=50%',
];

export async function readCommitFiles(
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  request: CommitFilesRequest,
  signal?: AbortSignal,
): Promise<CommitFiles> {
  await inspectHistoryCheckout(checkout, gitVersion, signal);
  const parent = request.parent ?? 1;
  if (!Number.isInteger(parent) || parent < 1 || !isOid(request.oid))
    throw new InvalidHistoryRequestError();
  const output = await runHistory(
    checkout.path,
    [
      'show',
      '--raw',
      '-z',
      ...DIFF_FLAGS,
      `--diff-merges=${parent === 1 ? 'first-parent' : 'off'}`,
      `--format=${COMMIT_FORMAT}`,
      request.oid,
      '--',
    ],
    signal,
  );
  const header = decodeHistory(output).split('\0').slice(0, COMMIT_FIELDS);
  const commit = parseCommitRecord(header);
  const parentOid = commit.parentOids[parent - 1];
  if (request.parent !== undefined && parentOid === undefined)
    throw new InvalidHistoryRequestError();
  const files =
    parent === 1 || parentOid === undefined
      ? parseFiles(output, Buffer.byteLength(`${header.join('\0')}\0`))
      : parseFiles(
          await runHistory(
            checkout.path,
            [
              'diff-tree',
              '--no-commit-id',
              '-r',
              '--raw',
              '-z',
              ...DIFF_FLAGS,
              parentOid,
              request.oid,
              '--',
            ],
            signal,
          ),
          0,
        );
  await confirmHistoryCheckout(checkout, signal);
  return {
    commit,
    comparison:
      parentOid === undefined
        ? { kind: 'empty-tree' }
        : { kind: 'parent', parentNumber: parent, baseOid: parentOid },
    files,
  };
}

function parseFiles(output: Buffer, start: number): CommitFile[] {
  let entries: RawDiffEntry[];
  try {
    entries = parseRawDiff(output, start).entries;
  } catch (cause) {
    if (cause instanceof InvalidGitDiffError)
      throw new UnsupportedHistoryDataError({ cause });
    throw cause;
  }
  if (entries.length > MAX_COMMIT_FILES) throw new ReadLimitExceededError();
  return entries.map((entry) => {
    const status = fileStatus(entry.status);
    return {
      oldPath: status === 'added' ? null : entry.oldPath,
      newPath: status === 'deleted' ? null : entry.newPath,
      oldMode: entry.oldMode,
      newMode: entry.newMode,
      status,
    };
  });
}

function fileStatus(code: string): CommitFile['status'] {
  switch (code) {
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'M':
      return 'modified';
    case 'R':
      return 'renamed';
    case 'T':
      return 'type-changed';
    default:
      throw new UnsupportedHistoryDataError();
  }
}
