export type GitFailure =
  | 'timeout'
  | 'output-limit'
  | 'invalid-encoding'
  | 'exit'
  | 'other';
