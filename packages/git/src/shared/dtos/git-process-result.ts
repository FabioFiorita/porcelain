import type { GitFailure } from './git-failure.ts';

export type GitProcessResult = {
  stdout: Buffer;
  stderr?: Buffer;
  exitCode: number | null;
  started: boolean;
  interrupted: boolean;
  descendantsStopped: boolean;
  failure?: GitFailure;
};
