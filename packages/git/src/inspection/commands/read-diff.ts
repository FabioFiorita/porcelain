import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { GitDiffResult } from '../dtos/git-diff.ts';
import type { GitOrdinaryChange } from '../dtos/git-status.ts';
import { InspectionLimitError } from '../errors/inspection-limit-error.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
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

export async function readDiff(
  session: CheckoutSession,
  change: GitOrdinaryChange,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<GitDiffResult> {
  return diffFor(change, await readScopes(session, [change], limits, signal));
}

export async function readDiffs(
  session: CheckoutSession,
  changes: readonly GitOrdinaryChange[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<GitDiffResult[]> {
  const scopes = await readScopes(session, changes, limits, signal);
  return changes.map((change) => diffFor(change, scopes));
}

export function readCommitDiffs(
  checkout: string,
  oid: string,
  parent: number,
  paths: readonly PathGroup[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<Sections> {
  return readSections(
    checkout,
    { kind: 'commit', oid, parent },
    paths,
    [],
    limits,
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
): Promise<Sections> {
  return readSections(
    checkout,
    { kind: 'range', from, to },
    paths,
    [],
    limits,
    signal,
  );
}

async function readScopes(
  session: CheckoutSession,
  changes: readonly GitOrdinaryChange[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<Record<GitOrdinaryChange['scope'], Sections>> {
  const wanted = (scope: GitOrdinaryChange['scope']) =>
    changes.filter((change) => change.supported && change.scope === scope);
  const staged = wanted('staged');
  const unstaged = wanted('unstaged');
  const filters =
    unstaged.length > 0
      ? await sessionConversionFilters(session, limits, signal)
      : [];
  return {
    staged:
      staged.length > 0
        ? await readSections(
            session.path,
            { kind: 'staged' },
            staged.map(changePaths),
            [],
            limits,
            signal,
          )
        : new Map(),
    unstaged:
      unstaged.length > 0
        ? await readSections(
            session.path,
            { kind: 'unstaged' },
            unstaged.map(changePaths),
            filters,
            limits,
            signal,
          )
        : new Map(),
  };
}

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

async function readSections(
  checkout: string,
  comparison: DiffComparison,
  paths: readonly PathGroup[],
  config: readonly string[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<Sections> {
  const groups = paths.map((group) =>
    typeof group === 'string' ? [group] : [...new Set(group)],
  );
  const alone = await readPaths(
    checkout,
    comparison,
    groups.filter((group) => group.length === 1).flat(),
    false,
    config,
    limits,
    signal,
  );
  const paired = await readPaths(
    checkout,
    comparison,
    groups.filter((group) => group.length > 1).flat(),
    true,
    config,
    limits,
    signal,
  );
  return alone === null || paired === null
    ? null
    : new Map([...alone, ...paired]);
}

async function readPaths(
  checkout: string,
  comparison: DiffComparison,
  paths: readonly string[],
  renames: boolean,
  config: readonly string[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<Sections> {
  if (paths.length === 0) return new Map();
  const pathspecs = [...new Set(paths)].map((path) => `:(top,literal)${path}`);
  let output: Buffer;
  try {
    output = await runInspection(
      checkout,
      diffArguments(comparison, pathspecs, renames),
      limits,
      signal,
      { maxBytes: limits.inspection.diffBatchBytes, config },
    );
  } catch (error) {
    if (error instanceof InspectionLimitError) return null;
    throw error;
  }
  return parseDiff(output, limits);
}

function diffArguments(
  comparison: DiffComparison,
  pathspecs: readonly string[],
  renames: boolean,
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
    renames ? '--find-renames=50%' : '--no-renames',
    '--diff-algorithm=myers',
    '--no-indent-heuristic',
    '--unified=3',
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
