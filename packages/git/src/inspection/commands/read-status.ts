import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { GitChange } from '../dtos/git-status.ts';
import type { EffectCheckoutSession } from '../interfaces/git-session.ts';
import { parseGitStatusEffect } from '../parsers/parse-git-status.ts';
import { sessionConversionFilters } from './check-conversion-filters.ts';
import { runInspection } from './run-inspection.ts';

export const readStatus = Effect.fn('Git.readStatus')(function* (
  session: EffectCheckoutSession,
  limits: GitLimits,
) {
  const config = yield* sessionConversionFilters(session, limits);
  const output = yield* runInspection(
    session.path,
    [
      'status',
      '--porcelain=v2',
      '-z',
      '--branch',
      '--ahead-behind',
      '--untracked-files=all',
      '--ignore-submodules=dirty',
      `--find-renames=${limits.renames.similarityPercent}%`,
    ],
    limits,
    { maxBytes: limits.inspection.statusBytes, config },
  );
  const status = yield* parseGitStatusEffect(output, limits);
  return {
    ...status,
    ...firstChangedFiles(status.changes, limits.inspection.maxChanges),
  };
});

function changedPath(change: GitChange) {
  return 'path' in change
    ? change.path
    : (change.newPath ?? change.oldPath ?? '');
}

function firstChangedFiles(changes: GitChange[], maxChanges: number) {
  if (changes.length <= maxChanges) return { changes, omittedChanges: 0 };
  const files = Map.groupBy(changes, changedPath);
  const kept: GitChange[] = [];
  let shown = 0;
  for (const group of files.values()) {
    if (kept.length + group.length > maxChanges) break;
    kept.push(...group);
    shown += 1;
  }
  return { changes: kept, omittedChanges: files.size - shown };
}
