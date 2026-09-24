import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';

export function commitExpectsSelectedFiles(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): 'agrees' | 'missing' | 'mismatched' {
  if (intent.action !== 'commit' && intent.action !== 'amend') return 'agrees';
  if (!expected.files) return 'missing';
  const expectedPaths = new Set(expected.files.map((file) => file.path));
  const selected = new Set(intent.paths);
  const merging = intent.action === 'commit' && expected.inProgress === 'merge';
  const matches = merging
    ? [...selected].every((path) => expectedPaths.has(path))
    : selected.size === expectedPaths.size &&
      [...selected].every((path) => expectedPaths.has(path));
  return matches ? 'agrees' : 'mismatched';
}
