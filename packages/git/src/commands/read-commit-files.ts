import type {
  CommitFile,
  CommitFiles,
  CommitFilesRequest,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import { InvalidHistoryRequestError } from '../errors/invalid-history-request-error.ts';
import { ReadLimitExceededError } from '../errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';
import {
  COMMIT_FIELDS,
  COMMIT_FORMAT,
  parseCommitRecord,
} from '../mappers/parse-commit.ts';
import { readHistory } from '../read-history.ts';
import {
  confirmHistoryCheckout,
  inspectHistoryCheckout,
} from './inspect-history-checkout.ts';

const statuses = {
  A: 'added',
  D: 'deleted',
  M: 'modified',
  R: 'renamed',
  T: 'type-changed',
} as const;

const MAX_COMMIT_FILES = 10_000;

export async function readCommitFiles(
  checkout: HistoryCheckout,
  request: CommitFilesRequest,
  signal?: AbortSignal,
): Promise<CommitFiles> {
  await inspectHistoryCheckout(checkout, signal);
  const parent = request.parent ?? 1;
  if (!Number.isInteger(parent) || parent < 1)
    throw new InvalidHistoryRequestError();
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(request.oid))
    throw new InvalidHistoryRequestError();
  const fields = (
    await readHistory(
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
    )
  ).split('\0');
  const commit = parseCommitRecord(fields.slice(0, COMMIT_FIELDS)).summary;
  const parentOid = commit.parentOids[parent - 1] ?? null;
  if (request.parent !== undefined && parentOid === null)
    throw new InvalidHistoryRequestError();
  if (parent > 1 && parentOid === null) throw new InvalidHistoryRequestError();
  const files =
    parent === 1
      ? parseFiles(fields.slice(COMMIT_FIELDS))
      : parseFiles(
          await readAgainstParent(checkout, parentOid, request.oid, signal),
        );
  await confirmHistoryCheckout(checkout, signal);
  return {
    commit,
    comparison:
      parentOid === null
        ? { kind: 'empty-tree' }
        : { kind: 'parent', parentNumber: parent, baseOid: parentOid },
    files,
  };
}

const DIFF_FLAGS = [
  '--no-textconv',
  '--no-ext-diff',
  '--no-color',
  '--find-renames=50%',
];

async function readAgainstParent(
  checkout: HistoryCheckout,
  parentOid: string | null,
  oid: string,
  signal?: AbortSignal,
) {
  if (parentOid === null) throw new InvalidHistoryRequestError();
  const output = await readHistory(
    checkout.path,
    [
      'diff-tree',
      '--no-commit-id',
      '-r',
      '--raw',
      '-z',
      ...DIFF_FLAGS,
      parentOid,
      oid,
      '--',
    ],
    signal,
  );
  return output.split('\0');
}

function parseFiles(fields: readonly string[]): CommitFile[] {
  const files: CommitFile[] = [];
  let at = 0;
  const meta = () => (fields[at] ?? '').replace(/^\n/u, '');
  while (at < fields.length && meta().startsWith(':')) {
    const header = meta().match(
      /^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([ADMRT])\d*$/u,
    );
    at += 1;
    const path = fields[at];
    at += 1;
    if (!header?.[1] || !header[2] || path === undefined)
      throw new UnsupportedHistoryDataError();
    const code = header[3] as keyof typeof statuses;
    let newPath = path;
    if (code === 'R') {
      const renamed = fields[at];
      at += 1;
      if (renamed === undefined) throw new UnsupportedHistoryDataError();
      newPath = renamed;
    }
    files.push({
      oldPath: code === 'A' ? null : path,
      newPath: code === 'D' ? null : newPath,
      oldMode: header[1],
      newMode: header[2],
      status: statuses[code],
    });
    if (files.length > MAX_COMMIT_FILES) throw new ReadLimitExceededError();
  }
  return files;
}
