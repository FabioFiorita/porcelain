import { ExpectedFilesMismatchError } from '../errors/expected-files-mismatch-error.ts';
import { MissingExpectedFilesError } from '../errors/missing-expected-files-error.ts';
import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';

export function commitExpectsSelectedFiles(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): void {
  if (intent.action !== 'commit' && intent.action !== 'amend') return;
  if (!expected.files) throw new MissingExpectedFilesError();
  const expectedPaths = new Set(expected.files.map((file) => file.path));
  const selected = new Set(intent.paths);
  const merging = intent.action === 'commit' && expected.inProgress === 'merge';
  const matches = merging
    ? [...selected].every((path) => expectedPaths.has(path))
    : selected.size === expectedPaths.size &&
      [...selected].every((path) => expectedPaths.has(path));
  if (!matches) throw new ExpectedFilesMismatchError();
}
