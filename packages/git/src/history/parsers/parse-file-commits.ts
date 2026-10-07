import { Effect } from 'effect';
import { parseRawDiffEffect } from '../../inspection/index.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { CommitFile, FileCommit } from '../dtos/commit-history.ts';
import { UnsupportedHistoryDataError } from '../../shared/errors/unsupported-history-data-error.ts';
import { decodeHistory } from './decode-history.ts';
import { COMMIT_FIELDS, parseCommitRecord } from './parse-commit.ts';

const STATUSES: Record<string, CommitFile['status']> = {
  A: 'added',
  D: 'deleted',
  M: 'modified',
  R: 'renamed',
  T: 'type-changed',
};

export const parseFileCommits = Effect.fn('Git.parseFileCommits')(function* (
  output: Buffer,
  path: string,
  limits: GitLimits,
) {
  const commits: FileCommit[] = [];
  let followed = path;
  let at = 0;
  while (at < output.length) {
    const fields: string[] = [];
    for (let field = 0; field < COMMIT_FIELDS; field += 1) {
      const end = output.indexOf(0, at);
      if (end === -1)
        return yield* Effect.fail(new UnsupportedHistoryDataError());
      fields.push(yield* decodeHistory(output.subarray(at, end)));
      at = end + 1;
    }
    const commit = yield* parseCommitRecord(fields, limits);
    const { entries, end } = yield* readEntries(output, at);
    at = end;
    const entry = entries.find(
      (candidate) =>
        candidate.newPath === followed || candidate.oldPath === followed,
    );
    if (entry === undefined) continue;
    const status = STATUSES[entry.status];
    if (status === undefined)
      return yield* Effect.fail(new UnsupportedHistoryDataError());
    commits.push({
      commit,
      path: status === 'deleted' ? entry.oldPath : entry.newPath,
      previousPath: status === 'renamed' ? entry.oldPath : null,
      status,
    });
    if (status === 'added') break;
    followed = entry.oldPath;
  }
  return commits;
});

const readEntries = Effect.fn('Git.readEntries')(function* (
  output: Buffer,
  start: number,
) {
  return yield* parseRawDiffEffect(output, start).pipe(
    Effect.mapError((cause) => new UnsupportedHistoryDataError({ cause })),
  );
});
