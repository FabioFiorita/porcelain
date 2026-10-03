import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';
import type { GitActionTarget } from '../models/git-action-run.ts';
import { expectsWholeChangeList } from './expects-whole-change-list.ts';

export function gitActionTarget(
  intent: GitActionIntent,
  expected: GitActionExpectation,
): GitActionTarget {
  if (expected.files === undefined) return { kind: 'unchecked' };
  return {
    kind: 'checked',
    paths: expectsWholeChangeList(intent, expected)
      ? undefined
      : expected.files.map((file) => file.path),
  };
}
