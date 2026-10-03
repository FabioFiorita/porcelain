export type GitActionProblem =
  | { kind: 'hunk-range' }
  | { kind: 'duplicate-expected-file' }
  | { kind: 'merge-expectation' }
  | { kind: 'empty-commit-selection' }
  | { kind: 'missing-expected-files' }
  | { kind: 'expected-files-mismatch' }
  | { kind: 'discard-expectation' }
  | { kind: 'missing-upstream-expectation' };
