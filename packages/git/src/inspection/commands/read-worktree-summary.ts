import { Effect } from 'effect';
import { devNull } from 'node:os';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { EffectCheckoutSession } from '../interfaces/git-session.ts';
import { readStatus } from './read-status.ts';
import { runInspection } from './run-inspection.ts';
import { sessionConversionFilters } from './check-conversion-filters.ts';
import { InspectionLimitError } from '../../shared/errors/inspection-limit-error.ts';

function totals(output: Buffer) {
  const records = output.toString('utf8').split('\0');
  const result = { additions: 0, deletions: 0, binaryFiles: 0 };
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    const match = /^(\d+|-)\t(\d+|-)\t(.*)$/s.exec(record);
    if (!match) return undefined;
    if (match[1] === '-' || match[2] === '-') result.binaryFiles++;
    else {
      result.additions += Number(match[1]);
      result.deletions += Number(match[2]);
    }
    if (match[3] === '') i += 2;
  }
  return result;
}

export const readWorktreeSummary = Effect.fn('Git.readWorktreeSummary')(
  function* (session: EffectCheckoutSession, limits: GitLimits) {
    yield* session.verify();
    const status = yield* readStatus(session, limits);
    const config = yield* sessionConversionFilters(session, limits);
    const base =
      status.headOid ??
      (yield* runInspection(
        session.path,
        ['hash-object', '-t', 'tree', '--stdin'],
        limits,
        { input: Buffer.alloc(0) },
      ))
        .toString('utf8')
        .trim();
    const output = yield* runInspection(
      session.path,
      [
        'diff',
        '--numstat',
        '-z',
        '--no-ext-diff',
        '--no-textconv',
        `--find-renames=${limits.renames.similarityPercent}%`,
        base,
        '--',
      ],
      limits,
      { config, maxBytes: limits.inspection.statusBytes },
    );
    const result = totals(output);
    if (!result) return yield* Effect.fail(new InspectionLimitError());
    for (const change of status.changes) {
      if (change.scope !== 'untracked') continue;
      const untracked = yield* runInspection(
        session.path,
        [
          'diff',
          '--numstat',
          '-z',
          '--no-index',
          '--no-ext-diff',
          '--no-textconv',
          '--',
          devNull,
          change.path,
        ],
        limits,
        {
          config,
          allowDifference: true,
          maxBytes: limits.inspection.statusBytes,
        },
      );
      const counts = totals(untracked);
      if (!counts) return yield* Effect.fail(new InspectionLimitError());
      result.additions += counts.additions;
      result.deletions += counts.deletions;
      result.binaryFiles += counts.binaryFiles;
    }
    yield* session.confirm();
    return result;
  },
);
