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

/**
 * A file list this large is a vendored drop rather than a commit anybody
 * reviews, and it is refused rather than truncated: a list that silently stops
 * would hide files that are in the commit.
 */
const MAX_COMMIT_FILES = 10_000;

/**
 * What a commit changed, in one Git process: its own details and the names of
 * the files, without a single patch.
 *
 * The patches follow one at a time, as they are needed, through the same
 * reader the worktree uses. That is what lets a commit touching a thousand
 * files open as quickly as one touching three — the old read returned every
 * patch at once and refused above a megabyte, so the largest commits, the ones
 * most worth opening carefully, were the ones that could not be opened.
 */
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
        // A merge prints no file list at all unless it is told which side to
        // compare against, so it would otherwise open showing nothing changed.
        // `separate` prints one list per parent, which cannot be told apart
        // here, so anything but the first parent is read on its own below.
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
  // Naming a parent the commit does not have is a request about a comparison
  // that does not exist. Not naming one is a request for "however this commit
  // is usually read", which a first commit answers with the empty tree.
  if (request.parent !== undefined && parentOid === null)
    throw new InvalidHistoryRequestError();
  if (parent > 1 && parentOid === null) throw new InvalidHistoryRequestError();
  // Every read finishes first. Confirming before the second one would leave a
  // window the confirmation is there to close, and a value awaited inside the
  // returned object is read after anything written above it.
  const files =
    parent === 1
      ? parseFiles(fields.slice(COMMIT_FIELDS))
      : parseFiles(
          await readAgainstParent(checkout, parentOid, request.oid, signal),
        );
  // Confirmed before the answer leaves, as every read here is.
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

/**
 * The file list against a parent other than the first, which is the one case
 * `show` cannot answer in the same process as the commit's own details.
 */
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

/**
 * The `--raw -z` entries that follow the commit's own fields:
 * `:<oldmode> <newmode> <oldoid> <newoid> <status>\0<path>\0`, with a second
 * path for a rename.
 */
function parseFiles(fields: readonly string[]): CommitFile[] {
  const files: CommitFile[] = [];
  let at = 0;
  // `show` separates the commit's fields from the raw entries with a newline.
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
