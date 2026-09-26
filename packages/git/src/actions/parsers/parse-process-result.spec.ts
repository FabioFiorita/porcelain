import { describe, expect, it } from 'vitest';
import { processFailure } from './parse-process-result.ts';

const finished = {
  stdout: Buffer.alloc(0),
  stderr: Buffer.alloc(0),
  exitCode: 0,
  started: true,
  interrupted: false,
  descendantsStopped: true,
};

describe('processFailure', () => {
  it('finds no failure in a clean exit', () => {
    expect(processFailure(finished)).toBe(undefined);
  });

  it('reports a refusal with what Git said', () => {
    expect(
      processFailure({
        ...finished,
        exitCode: 1,
        stderr: Buffer.from('error: pathspec did not match\n'),
      }),
    ).toEqual({
      state: 'rejected',
      reason: 'GIT_REJECTED',
      message: 'error: pathspec did not match',
      refreshRequired: true,
    });
  });

  it('treats an interrupted or unfinished process as an unknown outcome', () => {
    expect([
      processFailure({ ...finished, interrupted: true }),
      processFailure({ ...finished, exitCode: null }),
    ]).toEqual([
      {
        state: 'indeterminate',
        reason: 'OUTCOME_UNKNOWN',
        refreshRequired: true,
      },
      {
        state: 'indeterminate',
        reason: 'OUTCOME_UNKNOWN',
        refreshRequired: true,
      },
    ]);
  });

  it('flags a process group that could not be confirmed stopped', () => {
    expect(
      processFailure({ ...finished, descendantsStopped: false }),
    ).toMatchObject({ reason: 'PROCESS_GROUP_UNCONFIRMED' });
  });

  it('asks for no refresh when Git never started', () => {
    expect(
      processFailure({ ...finished, started: false, exitCode: 128 }),
    ).toMatchObject({ refreshRequired: false });
  });
});
