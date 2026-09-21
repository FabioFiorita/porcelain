import type { GitFailure } from './git-failure.ts';

export type GitProcessResult = {
  stdout: Buffer;
  stderr?: Buffer;
  exitCode: number | null;
  started: boolean;
  interrupted: boolean;
  descendantsStopped: boolean;
  /**
   * Set when the runner stopped the process for breaking a policy limit, in
   * the vocabulary reads use. A non-zero exit is reported by `exitCode` and a
   * cancellation by the caller's signal, so neither sets this.
   */
  failure?: GitFailure;
};
