import type { GitActionExpectation } from '../models/git-action-expectation.ts';

export function expectedFilesAreUnique(
  expected: GitActionExpectation,
): boolean {
  const paths = (expected.files ?? []).map((file) => file.path);
  return new Set(paths).size === paths.length;
}
