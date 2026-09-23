import { DuplicateExpectedFileError } from '../errors/duplicate-expected-file-error.ts';
import type { GitActionExpectation } from '../models/git-action-expectation.ts';

export function expectedFilesAreUnique(expected: GitActionExpectation): void {
  const paths = (expected.files ?? []).map((file) => file.path);
  if (new Set(paths).size !== paths.length)
    throw new DuplicateExpectedFileError();
}
