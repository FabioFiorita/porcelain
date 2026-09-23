import { MissingExpectedFilesError } from '../errors/missing-expected-files-error.ts';
import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';

export function stashExpectsFiles(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): void {
  if (intent.action.startsWith('stash-') && !expected.files)
    throw new MissingExpectedFilesError();
}
