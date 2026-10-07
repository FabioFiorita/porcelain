import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import {
  parseRawDiffEffect,
  type RawDiffEntry,
} from '../../inspection/index.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import type {
  CommitFiles,
  CommitFilesRequest,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import { InvalidHistoryRequestError } from '../../shared/errors/invalid-history-request-error.ts';
import { ReadLimitExceededError } from '../../shared/errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from '../../shared/errors/unsupported-history-data-error.ts';
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

export function diffFlags(limits: GitLimits): string[] {
  return [
    '--no-textconv',
    '--no-ext-diff',
    '--no-color',
    `--find-renames=${limits.renames.similarityPercent}%`,
  ];
}

export const readCommitFiles = Effect.fn('Git.readCommitFiles')(function* (
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  request: CommitFilesRequest,
  limits: GitLimits,
) {
  yield* inspectHistoryCheckout(checkout, gitVersion);
  const parent = request.parent ?? 1;
  if (!Number.isInteger(parent) || parent < 1 || !isOid(request.oid))
    return yield* Effect.fail(new InvalidHistoryRequestError());
  const output = yield* runHistory(
    checkout.path,
    [
      'show',
      '--raw',
      '-z',
      ...diffFlags(limits),
      `--diff-merges=${parent === 1 ? 'first-parent' : 'off'}`,
      `--format=${COMMIT_FORMAT}`,
      request.oid,
      '--',
    ],
    limits,
  );
  const header = (yield* decodeHistory(output))
    .split('\0')
    .slice(0, COMMIT_FIELDS);
  const commit = yield* parseCommitRecord(header, limits);
  const parentOid = commit.parentOids[parent - 1];
  if (request.parent !== undefined && parentOid === undefined)
    return yield* Effect.fail(new InvalidHistoryRequestError());
  const files =
    parent === 1 || parentOid === undefined
      ? yield* parseFiles(
          output,
          Buffer.byteLength(`${header.join('\0')}\0`),
          limits,
        )
      : yield* parseFiles(
          yield* runHistory(
            checkout.path,
            [
              'diff-tree',
              '--no-commit-id',
              '-r',
              '--raw',
              '-z',
              ...diffFlags(limits),
              parentOid,
              request.oid,
              '--',
            ],
            limits,
          ),
          0,
          limits,
        );
  yield* confirmHistoryCheckout(checkout);
  return {
    commit,
    comparison:
      parentOid === undefined
        ? { kind: 'empty-tree' }
        : { kind: 'parent', parentNumber: parent, baseOid: parentOid },
    files,
  } satisfies CommitFiles;
});

const parseFiles = Effect.fn('Git.parseFiles')(function* (
  output: Buffer,
  start: number,
  limits: GitLimits,
) {
  const entries: RawDiffEntry[] = yield* parseRawDiffEffect(output, start).pipe(
    Effect.map((parsed) => parsed.entries),
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
        oldMode: entry.oldMode,
        newMode: entry.newMode,
        status,
      };
    }),
  );
});

export const fileStatus = Effect.fn('Git.fileStatus')(function* (code: string) {
  switch (code) {
    case 'A':
      return 'added' as const;
    case 'D':
      return 'deleted' as const;
    case 'M':
      return 'modified' as const;
    case 'R':
      return 'renamed' as const;
    case 'T':
      return 'type-changed' as const;
    default:
      return yield* Effect.fail(new UnsupportedHistoryDataError());
  }
});
