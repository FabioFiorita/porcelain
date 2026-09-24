import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';
import type { GitActionProblem } from '../models/git-action-problem.ts';

function hunkRangeIsOrdered(intent: GitActionIntent): boolean {
  if (intent.action !== 'discard' || intent.hunk === undefined) return true;
  return intent.hunk.endLine >= intent.hunk.startLine;
}

function expectedFilesAreUnique(expected: GitActionExpectation): boolean {
  const paths = (expected.files ?? []).map((file) => file.path);
  return new Set(paths).size === paths.length;
}

function mergeExpectationAgrees(expected: GitActionExpectation): boolean {
  return (
    (expected.inProgress === 'merge') === (expected.mergeHeadOid !== undefined)
  );
}

function commitSelectsPaths(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): boolean {
  return (
    intent.action !== 'commit' ||
    intent.paths.length > 0 ||
    expected.inProgress === 'merge'
  );
}

function commitFilesProblem(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): GitActionProblem | undefined {
  if (intent.action !== 'commit' && intent.action !== 'amend') return undefined;
  if (!expected.files) return { kind: 'missing-expected-files' };
  const expectedPaths = new Set(expected.files.map((file) => file.path));
  const selected = new Set(intent.paths);
  const merging = intent.action === 'commit' && expected.inProgress === 'merge';
  const covered = [...selected].every((path) => expectedPaths.has(path));
  const matches = merging
    ? covered
    : covered && selected.size === expectedPaths.size;
  return matches ? undefined : { kind: 'expected-files-mismatch' };
}

function discardExpectsItsPath(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): boolean {
  if (intent.action !== 'discard') return true;
  const [only, ...others] = expected.files ?? [];
  return only?.path === intent.path && others.length === 0;
}

function stashExpectsFiles(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): boolean {
  return !intent.action.startsWith('stash-') || expected.files !== undefined;
}

function networkActionExpectsUpstream(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): boolean {
  const network =
    intent.action === 'fetch' ||
    intent.action === 'pull' ||
    intent.action === 'push';
  return !network || expected.upstream !== undefined;
}

export function gitActionProblem(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): GitActionProblem | undefined {
  if (!hunkRangeIsOrdered(intent)) return { kind: 'hunk-range' };
  if (!expectedFilesAreUnique(expected))
    return { kind: 'duplicate-expected-file' };
  if (!mergeExpectationAgrees(expected)) return { kind: 'merge-expectation' };
  if (!commitSelectsPaths(intent, expected))
    return { kind: 'empty-commit-selection' };
  const commit = commitFilesProblem(intent, expected);
  if (commit) return commit;
  if (!discardExpectsItsPath(intent, expected))
    return { kind: 'discard-expectation' };
  if (!stashExpectsFiles(intent, expected))
    return { kind: 'missing-expected-files' };
  if (!networkActionExpectsUpstream(intent, expected))
    return { kind: 'missing-upstream-expectation' };
  return undefined;
}
