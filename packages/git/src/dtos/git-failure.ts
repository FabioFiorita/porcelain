/**
 * Why the runner itself stopped a Git process, in one vocabulary both of its
 * modes use, so each caller maps it to its own domain error.
 *
 * It covers the runner's own decisions, not the process's outcome: a command
 * that simply exits non-zero reports that through its exit code, and one the
 * caller cancels reports it through the caller's own signal.
 */
export type GitFailure =
  | 'timeout'
  | 'output-limit'
  | 'invalid-encoding'
  | 'exit'
  | 'other';
