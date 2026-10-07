import { InspectionLimitError } from '../../shared/errors/inspection-limit-error.ts';
import { Effect } from 'effect';
import { runGitEffect } from '../../shared/commands/run-git.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { GitDiffResult } from '../dtos/git-diff.ts';
import type { GitOrdinaryChange } from '../dtos/git-status.ts';
import type { EffectCheckoutSession } from '../interfaces/git-session.ts';
import { diffKey, parseDiff } from '../parsers/parse-diff.ts';
import { sessionConversionFilters } from './check-conversion-filters.ts';
import { runInspection } from './run-inspection.ts';

type DiffComparison =
  | { kind: 'staged' }
  | { kind: 'unstaged' }
  | { kind: 'commit'; oid: string; parent: number }
  | { kind: 'range'; from: string; to: string };

type Sections = Map<string, GitDiffResult> | null;

export type PathGroup = string | readonly string[];

export const readDiff = Effect.fn('Git.readDiff')(function* (
  session: EffectCheckoutSession,
  change: GitOrdinaryChange,
  limits: GitLimits,
) {
  return diffFor(change, yield* readScopes(session, [change], limits));
});

export const readDiffs = Effect.fn('Git.readDiffs')(function* (
  session: EffectCheckoutSession,
  changes: readonly GitOrdinaryChange[],
  limits: GitLimits,
) {
  const scopes = yield* readScopes(session, changes, limits);
  return changes.map((change) => diffFor(change, scopes));
});

export const readCommitDiffsEffect = Effect.fn('Git.readCommitDiffs')(
  function* (
    checkout: string,
    oid: string,
    parent: number,
    paths: readonly PathGroup[],
    limits: GitLimits,
  ) {
    return yield* readSections(
      checkout,
      { kind: 'commit', oid, parent },
      paths,
      [],
      limits,
    );
  },
);

export const readRangeDiffsEffect = Effect.fn('Git.readRangeDiffs')(function* (
  checkout: string,
  from: string,
  to: string,
  paths: readonly PathGroup[],
  limits: GitLimits,
) {
  return yield* readSections(
    checkout,
    { kind: 'range', from, to },
    paths,
    [],
    limits,
  );
});

const readScopes = Effect.fn('Git.readScopes')(function* (
  session: EffectCheckoutSession,
  changes: readonly GitOrdinaryChange[],
  limits: GitLimits,
) {
  const wanted = (scope: GitOrdinaryChange['scope']) =>
    changes.filter((change) => change.supported && change.scope === scope);
  const staged = wanted('staged');
  const unstaged = wanted('unstaged');
  const filters =
    unstaged.length > 0 ? yield* sessionConversionFilters(session, limits) : [];
  return {
    staged:
      staged.length > 0
        ? yield* readSections(
            session.path,
            { kind: 'staged' },
            staged.map(changePaths),
            [],
            limits,
          )
        : new Map(),
    unstaged:
      unstaged.length > 0
        ? yield* readSections(
            session.path,
            { kind: 'unstaged' },
            unstaged.map(changePaths),
            filters,
            limits,
          )
        : new Map(),
  };
});

function diffFor(
  change: GitOrdinaryChange,
  scopes: Record<GitOrdinaryChange['scope'], Sections>,
): GitDiffResult {
  if (!change.supported)
    return { kind: 'omitted', reason: 'unsupported-submodule' };
  const sections = scopes[change.scope];
  if (sections === null) return { kind: 'omitted', reason: 'size-limit' };
  return (
    sections.get(diffKey([change.oldPath, change.newPath])) ?? {
      kind: 'metadata-only',
      patch: '',
    }
  );
}

function changePaths(change: GitOrdinaryChange): string[] {
  return [change.oldPath, change.newPath].filter(
    (path): path is string => path !== null,
  );
}

const readSections = Effect.fn('Git.readSections')(function* (
  checkout: string,
  comparison: DiffComparison,
  paths: readonly PathGroup[],
  config: readonly string[],
  limits: GitLimits,
) {
  const groups = paths.map((group) =>
    typeof group === 'string' ? [group] : [...new Set(group)],
  );
  const alone = yield* readPaths(
    checkout,
    comparison,
    groups.filter((group) => group.length === 1).flat(),
    false,
    config,
    limits,
  );
  const paired = yield* readPaths(
    checkout,
    comparison,
    groups.filter((group) => group.length > 1).flat(),
    true,
    config,
    limits,
  );
  return alone === null || paired === null
    ? null
    : new Map([...alone, ...paired]);
});

const readPaths = Effect.fn('Git.readPaths')(function* (
  checkout: string,
  comparison: DiffComparison,
  paths: readonly string[],
  renames: boolean,
  config: readonly string[],
  limits: GitLimits,
) {
  if (paths.length === 0) return new Map();
  const pathspecs = [...new Set(paths)].map((path) => `:(top,literal)${path}`);
  const output = yield* runInspection(
    checkout,
    diffArguments(comparison, pathspecs, renames, limits),
    limits,
    { maxBytes: limits.inspection.diffBatchBytes, config },
  ).pipe(
    Effect.catchIf(
      (error): error is InspectionLimitError =>
        error instanceof InspectionLimitError,
      () => Effect.succeed(undefined),
    ),
  );
  return output === undefined ? null : yield* parseDiff(output, limits);
});

function diffArguments(
  comparison: DiffComparison,
  pathspecs: readonly string[],
  renames: boolean,
  limits: GitLimits,
): string[] {
  return [
    ...(comparison.kind === 'commit'
      ? [
          'diff-tree',
          '--no-commit-id',
          '-r',
          ...(comparison.parent === 1
            ? ['--root', '--diff-merges=first-parent']
            : []),
        ]
      : comparison.kind === 'range'
        ? ['diff-tree', '--no-commit-id', '-r']
        : ['diff', ...(comparison.kind === 'staged' ? ['--cached'] : [])]),
    '--no-ext-diff',
    '--no-textconv',
    '--no-color',
    renames
      ? `--find-renames=${limits.renames.similarityPercent}%`
      : '--no-renames',
    '--diff-algorithm=myers',
    '--no-indent-heuristic',
    `--unified=${limits.inspection.contextLines}`,
    '--src-prefix=a/',
    '--dst-prefix=b/',
    '--no-relative',
    '--raw',
    '-z',
    '--patch',
    ...(comparison.kind === 'commit'
      ? comparison.parent === 1
        ? [comparison.oid]
        : [`${comparison.oid}^${comparison.parent}`, comparison.oid]
      : comparison.kind === 'range'
        ? [comparison.from, comparison.to]
        : []),
    '--',
    ...pathspecs,
  ];
}

export function readCommitDiffs(
  checkout: string,
  oid: string,
  parent: number,
  paths: readonly PathGroup[],
  limits: GitLimits,
  signal?: AbortSignal,
) {
  return runGitEffect(
    readCommitDiffsEffect(checkout, oid, parent, paths, limits),
    signal,
  );
}

export function readRangeDiffs(
  checkout: string,
  from: string,
  to: string,
  paths: readonly PathGroup[],
  limits: GitLimits,
  signal?: AbortSignal,
) {
  return runGitEffect(
    readRangeDiffsEffect(checkout, from, to, paths, limits),
    signal,
  );
}
